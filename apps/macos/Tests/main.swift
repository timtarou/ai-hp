import Foundation

let payload = """
{"schemaVersion":1,"generatedAt":"2026-09-27T00:00:00.123Z","status":"ok","exitCode":0,"accounts":[{"provider":"claude","accountKey":"a","email":"fixture@example.com","plan":"max","sources":["/fixture/.claude"],"fetchedAt":"2026-09-27T00:00:00Z","freshness":"fresh","limits":[{"kind":"weekly","scope":null,"windowHours":null,"usedPercent":47,"resetsAt":"2026-09-26T00:00:00Z"}],"resetCredits":{"status":"unsupported","available":null,"items":[]}}],"excluded":[],"issues":[]}
"""
let decoded = try UsageEnvelope.decode(Data(payload.utf8))
assert(decoded.accounts[0].weekly?.percentage == "53%")
assert(decoded.accounts[0].weekly?.resetLabel().hasPrefix("予定時刻経過") == true)
assert(decoded.accounts[0].resetCredits.label == "リセット権：非対応")
assert(decoded.accounts[0].isFresh)
let targetAccount = decoded.accounts[0]
let targetEnv = try accountRefreshEnvironment(targetAccount, base: ["PATH": "/fixture/bin", "AI_HP_CODEX_HOMES": "/unrelated"])
assert(targetEnv["AI_HP_CLAUDE_DIRS"] == "/fixture/.claude")
assert(targetEnv["AI_HP_CODEX_HOMES"] == ":")
assert(targetEnv["PATH"] == "/fixture/bin")
let refreshedTarget = try refreshedAccount(targetAccount, from: decoded)
assert(refreshedTarget.id == targetAccount.id)
let otherIdentity = UsageAccount(provider: "codex", accountKey: "other", email: "other@example.com", plan: nil,
    sources: ["/fixture/.codex"], fetchedAt: nil, freshness: "fresh", limits: [],
    resetCredits: UsageCredits(status: "unknown", available: nil, items: []))
let codexEnv = try accountRefreshEnvironment(otherIdentity, base: [:])
assert(codexEnv["AI_HP_CLAUDE_DIRS"] == ":")
assert(codexEnv["AI_HP_CODEX_HOMES"] == "/fixture/.codex")
do {
    _ = try refreshedAccount(otherIdentity, from: decoded)
    fatalError("an account refresh accepted another identity")
} catch { }

let base = Date(timeIntervalSince1970: 1700000000)
func sample(_ id: String, _ provider: String, _ percent: Double, _ reset: Date?) -> UsageAccount {
    UsageAccount(provider: provider, accountKey: id, email: "\(id)@example.com", plan: "pro", sources: [], fetchedAt: base,
                 freshness: "fresh", limits: [UsageLimit(kind: "weekly", scope: nil, windowHours: nil, usedPercent: percent, resetsAt: reset)],
                 resetCredits: UsageCredits(status: "unknown", available: nil, items: []))
}
let near = sample("near", "claude", 90, base.addingTimeInterval(3600))
let later = sample("later", "codex", 20, base.addingTimeInterval(2 * 86400 + 3 * 3600))
let past = sample("past", "codex", 100, base.addingTimeInterval(-1))
let unknown = sample("unknown", "claude", 10, nil)
let tokyo = TimeZone(identifier: "Asia/Tokyo")!
assert(decoded.accounts[0].weekly?.resetDisplay(.dateTime, timeZone: tokyo) == "9/26 09:00")
assert(decoded.accounts[0].weekly?.resetDisplay(.weekdayTime, timeZone: tokyo) == "土 09:00")
assert(near.weekly?.resetDisplay(.relative, now: base) == "あと1時間0分")
for format in ResetDisplay.allCases {
    assert(unknown.weekly?.resetDisplay(format) == "未定")
}
let examples = [unknown, later, past, near]
assert(near.weekly?.relativeReset(now: base) == "あと1時間0分")
assert(later.weekly?.relativeReset(now: base) == "あと2日3時間")
assert(past.weekly?.relativeReset(now: base) == "予定時刻経過")
assert(unknown.weekly?.relativeReset(now: base) == "未定")
let credits = UsageCredits(status: "available", available: 3, items: [
    .init(title: "later", count: 2, expiresAt: base.addingTimeInterval(1000)),
    .init(title: "first", count: 1, expiresAt: base.addingTimeInterval(500)),
    .init(title: "empty", count: 0, expiresAt: base),
])
assert(credits.countLabel == "3回")
assert(credits.earliestExpiry == base.addingTimeInterval(500))
assert(UsageCredits(status: "available", available: 0, items: []).expiryLabel == "—")
assert(UsageCredits(status: "unknown", available: nil, items: []).countLabel == "未取得")
assert(UsageCredits(status: "unsupported", available: nil, items: []).countLabel == "非対応")
assert(visibleAccounts(examples, provider: "all", search: "", sort: .reset, now: base).map(\.id) == ["near", "later", "past", "unknown"])
assert(visibleAccounts(examples, provider: "codex", search: "", sort: .mostRemaining, now: base).map(\.id) == ["later", "past"])
assert(visibleAccounts(examples, provider: "all", search: "NEAR@", sort: .reset, now: base).map(\.id) == ["near"])
assert(visibleAccounts(examples, provider: "all", search: "", sort: .leastRemaining, now: base).map(\.id) == ["past", "near", "later", "unknown"])
do {
    _ = try UsageEnvelope.decode(Data(payload.replacingOccurrences(of: "\"schemaVersion\":1", with: "\"schemaVersion\":2").utf8))
    fatalError("unsupported schema accepted")
} catch { }
let directory = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
defer { try? FileManager.default.removeItem(at: directory) }
let script = directory.appendingPathComponent("fixture.js")
let encoded = String(data: try JSONSerialization.data(withJSONObject: payload, options: .fragmentsAllowed), encoding: .utf8)!
try "process.stderr.write('x'.repeat(100000)); process.stdout.write(\(encoded)); process.exitCode = 1;".write(to: script, atomically: true, encoding: .utf8)
let completion = DispatchSemaphore(value: 0)
var successful = false
let worker = CLIWorker()
worker.query(node: CommandLine.arguments[1], cli: script, environment: ProcessInfo.processInfo.environment) { result in
    if case .success(let envelope) = result { successful = envelope.accounts.count == 1 }
    completion.signal()
}
assert(completion.wait(timeout: .now() + 10) == .success, "subprocess stalled on full stderr pipe")
assert(successful, "valid partial data was discarded because of nonzero exit")
let cancelled = CLIWorker()
cancelled.cancel()
let cancelledCompletion = DispatchSemaphore(value: 0)
cancelled.query(node: CommandLine.arguments[1], cli: script, environment: [:]) { result in
    if case .success = result { fatalError("cancelled process ran") }
    cancelledCompletion.signal()
}
assert(cancelledCompletion.wait(timeout: .now() + 5) == .success)
print("Native checks passed: decoding, null credits, no inferred reset, schema version, pipe draining, nonzero exit, cancellation, relative resets, filtering and sorting.")
