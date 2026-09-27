import Foundation

struct UsageEnvelope: Decodable {
    let schemaVersion: Int
    let generatedAt: Date
    let status: String
    let exitCode: Int
    let accounts: [UsageAccount]
    let excluded: [UsageIssue]
    let issues: [UsageIssue]

    static func decode(_ data: Data) throws -> Self {
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .custom { decoder in
            let raw = try decoder.singleValueContainer().decode(String.self)
            let formatter = ISO8601DateFormatter()
            formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
            if let date = formatter.date(from: raw) { return date }
            formatter.formatOptions = [.withInternetDateTime]
            if let date = formatter.date(from: raw) { return date }
            throw AppError.message("取得日時を読み取れませんでした。")
        }
        let result = try decoder.decode(Self.self, from: data)
        guard result.schemaVersion == 1 else { throw AppError.message("対応していないデータ形式です。アプリを更新してください。") }
        return result
    }
}

struct UsageIssue: Decodable {
    let code: String
    let message: String
    let provider: String?
    let sources: [String]?
    let source: String?
}

struct UsageAccount: Decodable, Identifiable {
    let provider: String
    let accountKey: String
    let email: String
    let plan: String?
    let sources: [String]
    let fetchedAt: Date?
    let freshness: String
    let limits: [UsageLimit]
    let resetCredits: UsageCredits
    var id: String { accountKey }
    var service: String { provider == "claude" ? "Claude" : "Codex" }
    var weekly: UsageLimit? { limits.first { $0.kind == "weekly" } }
    var isFresh: Bool { freshness == "fresh" }
}

enum ResetDisplay: String, CaseIterable {
    case relative, dateTime, weekdayTime
    var label: String {
        switch self {
        case .relative: return "相対"
        case .dateTime: return "実際の日時"
        case .weekdayTime: return "曜日と時刻"
        }
    }
}

struct UsageLimit: Decodable {
    let kind: String
    let scope: String?
    let windowHours: Double?
    let usedPercent: Double
    let resetsAt: Date?
    var remaining: Double { max(0, min(100, 100 - usedPercent)) }
    var percentage: String { String(format: "%.0f%%", remaining) }
    var label: String {
        if kind == "weekly" { return "週間" }
        if kind == "scoped" { return scope ?? "モデル別" }
        return windowHours.map { "\(Int($0))時間" } ?? "短期"
    }
    func relativeReset(now: Date = Date()) -> String {
        guard let date = resetsAt else { return "未定" }
        guard date > now else { return "予定時刻経過" }
        let totalMinutes = Int(ceil(date.timeIntervalSince(now) / 60))
        let days = totalMinutes / 1440
        let hours = (totalMinutes % 1440) / 60
        let minutes = totalMinutes % 60
        if days > 0 { return "あと\(days)日\(hours)時間" }
        if hours > 0 { return "あと\(hours)時間\(minutes)分" }
        return "あと\(minutes)分"
    }
    func resetDisplay(_ format: ResetDisplay, now: Date = Date(), timeZone: TimeZone = .current) -> String {
        guard let date = resetsAt else { return "未定" }
        if format == .relative { return relativeReset(now: now) }
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "ja_JP")
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.timeZone = timeZone
        formatter.dateFormat = format == .dateTime ? "M/d HH:mm" : "E HH:mm"
        return formatter.string(from: date)
    }
    func resetLabel(now: Date = Date()) -> String {
        guard let date = resetsAt else { return "リセット日時未定" }
        let formatted = date.formatted(.dateTime.month().day().hour().minute())
        return date <= now ? "予定時刻経過 · \(formatted)" : "リセット \(formatted)"
    }
}

struct UsageCredits: Decodable {
    let status: String
    let available: Int?
    let items: [Credit]
    struct Credit: Decodable {
        let title: String
        let count: Int
        let expiresAt: Date?
    }
    var countLabel: String {
        if status == "unsupported" { return "非対応" }
        guard status == "available", let count = available else { return "未取得" }
        return "\(count)回"
    }
    var earliestExpiry: Date? {
        guard status == "available", let available, available > 0 else { return nil }
        return items.filter { $0.count > 0 }.compactMap(\.expiresAt).min()
    }
    var expiryLabel: String {
        if let expiry = earliestExpiry {
            return "期限 " + expiry.formatted(.dateTime.month(.twoDigits).day(.twoDigits).hour().minute())
        }
        return status == "available" && (available ?? 0) > 0 ? "期限不明" : "—"
    }
    var label: String {
        if status == "unsupported" { return "リセット権：非対応" }
        guard status == "available", let count = available else { return "リセット権：未取得" }
        return "リセット権：\(count)回"
    }
}

enum AppError: LocalizedError {
    case message(String)
    var errorDescription: String? { if case let .message(text) = self { return text }; return nil }
}

enum AccountSort: String, CaseIterable {
    case reset, mostRemaining, leastRemaining, name
    var label: String {
        switch self {
        case .reset: return "リセットが近い順"
        case .mostRemaining: return "残り枠が多い順"
        case .leastRemaining: return "残り枠が少ない順"
        case .name: return "アカウント名順"
        }
    }
}

func visibleAccounts(_ accounts: [UsageAccount], provider: String, search: String, sort: AccountSort, now: Date = Date()) -> [UsageAccount] {
    let query = search.trimmingCharacters(in: .whitespacesAndNewlines)
    let filtered = accounts.filter { account in
        (provider == "all" || account.provider == provider) &&
        (query.isEmpty || ([account.email, account.service, account.plan ?? ""] + account.sources)
            .contains { $0.localizedCaseInsensitiveContains(query) })
    }
    func resetKey(_ account: UsageAccount) -> Double {
        guard let date = account.weekly?.resetsAt, date > now else { return .infinity }
        return date.timeIntervalSince1970
    }
    return filtered.sorted { a, b in
        switch sort {
        case .reset:
            if resetKey(a) != resetKey(b) { return resetKey(a) < resetKey(b) }
        case .mostRemaining, .leastRemaining:
            let aValue = a.weekly?.remaining, bValue = b.weekly?.remaining
            if aValue == nil && bValue != nil { return false }
            if aValue != nil && bValue == nil { return true }
            if let aValue, let bValue, aValue != bValue {
                return sort == .mostRemaining ? aValue > bValue : aValue < bValue
            }
        case .name: break
        }
        let names = a.email.localizedCaseInsensitiveCompare(b.email)
        if names != .orderedSame { return names == .orderedAscending }
        if a.provider != b.provider { return a.provider < b.provider }
        return a.accountKey < b.accountKey
    }
}
