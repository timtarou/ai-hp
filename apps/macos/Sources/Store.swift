import AppKit
import Combine
import ServiceManagement

@MainActor final class UsageStore: ObservableObject {
    @Published var accounts: [UsageAccount] = []
    @Published var messages: [String] = []
    @Published var unconnectedMessages: [String] = []
    @Published var updating = false
    @Published var refreshingAccountID: String?
    @Published var accountErrors: [String: String] = [:]
    @Published var lastRead: Date?
    @Published var showSettings = false
    @Published var connectionNotice: String?
    @Published var hoveredAccount: String?
    @Published var appearance = "system" {
        didSet {
            defaults.set(appearance, forKey: "appearance")
            applyAppearance()
        }
    }
    @Published var resetDisplay: ResetDisplay = .relative { didSet { defaults.set(resetDisplay.rawValue, forKey: "resetDisplay") } }
    @Published var search = ""
    @Published var providerFilter = "all" { didSet { defaults.set(providerFilter, forKey: "providerFilter") } }
    @Published var sort = AccountSort.reset { didSet { defaults.set(sort.rawValue, forKey: "sort") } }
    @Published var hideEmail: Bool { didSet { defaults.set(hideEmail, forKey: "hideEmail") } }
    @Published var showShort = false { didSet { defaults.set(showShort, forKey: "showShort") } }
    @Published var showScoped = false { didSet { defaults.set(showScoped, forKey: "showScoped") } }
    @Published var showCredits = false { didSet { defaults.set(showCredits, forKey: "showCredits") } }
    @Published var nodePath: String { didSet { defaults.set(nodePath, forKey: "nodePath") } }
    @Published var extraPath: String { didSet { defaults.set(extraPath, forKey: "extraPath") } }
    @Published var loginEnabled = SMAppService.mainApp.status == .enabled
    private let defaults = UserDefaults.standard
    private var worker: CLIWorker?
    private var observers: [NSObjectProtocol] = []
    private var sleeping = false
    private var stopped = false

    init() {
        resetDisplay = ResetDisplay(rawValue: defaults.string(forKey: "resetDisplay") ?? "") ?? .relative
        hideEmail = defaults.bool(forKey: "hideEmail")
        let savedAppearance = defaults.string(forKey: "appearance") ?? "system"
        appearance = ["system", "light", "dark"].contains(savedAppearance) ? savedAppearance : "system"
        let savedProvider = defaults.string(forKey: "providerFilter") ?? "all"
        providerFilter = ["all", "claude", "codex"].contains(savedProvider) ? savedProvider : "all"
        sort = AccountSort(rawValue: defaults.string(forKey: "sort") ?? "") ?? .reset
        showShort = defaults.bool(forKey: "showShort")
        showScoped = defaults.bool(forKey: "showScoped")
        showCredits = defaults.bool(forKey: "showCredits")
        extraPath = defaults.string(forKey: "extraPath") ?? ""
        let resource = Bundle.main.url(forResource: "runtime", withExtension: "json")
        let runtime = resource.flatMap { try? Data(contentsOf: $0) }.flatMap { try? JSONSerialization.jsonObject(with: $0) as? [String: String] }
        nodePath = defaults.string(forKey: "nodePath") ?? runtime?["node"] ?? "/opt/homebrew/bin/node"
        applyAppearance()
        let center = NSWorkspace.shared.notificationCenter
        observers.append(center.addObserver(forName: NSWorkspace.willSleepNotification, object: nil, queue: .main) { [weak self] _ in
            Task { @MainActor in self?.sleeping = true; self?.worker?.cancel() }
        })
        observers.append(center.addObserver(forName: NSWorkspace.didWakeNotification, object: nil, queue: .main) { [weak self] _ in
            Task { @MainActor in self?.sleeping = false }
        })
        observers.append(NotificationCenter.default.addObserver(forName: NSApplication.willTerminateNotification, object: nil, queue: .main) { [weak self] _ in
            MainActor.assumeIsolated { self?.stop() }
        })
    }

    private func applyAppearance() {
        // MenuBarExtra's native panel does not reliably inherit a SwiftUI
        // presentation preference. Apply the choice to its AppKit host too.
        switch appearance {
        case "dark": NSApplication.shared.appearance = NSAppearance(named: .darkAqua)
        case "light": NSApplication.shared.appearance = NSAppearance(named: .aqua)
        default: NSApplication.shared.appearance = nil
        }
    }

    var displayedAccounts: [UsageAccount] { visibleAccounts(accounts, provider: providerFilter, search: search, sort: sort) }
    var menuTitle: String {
        return updating ? "AI …" : "AI HP"
    }
    var environment: [String: String] {
        var env = ProcessInfo.processInfo.environment
        env["PATH"] = [extraPath, URL(fileURLWithPath: nodePath).deletingLastPathComponent().path,
                       NSHomeDirectory() + "/.local/bin", "/opt/homebrew/bin", "/usr/local/bin", env["PATH"] ?? "/usr/bin:/bin"].filter { !$0.isEmpty }.joined(separator: ":")
        return env
    }
    var cli: URL? { Bundle.main.resourceURL?.appendingPathComponent("cli/dist/cli.js") }

    func opened() { refresh() }
    func refresh() {
        guard !updating, !sleeping, !stopped else { return }
        accounts = [] // Never present old numbers as current during a failed refresh.
        messages = []
        accountErrors = [:]
        unconnectedMessages = []
        connectionNotice = nil
        guard FileManager.default.isExecutableFile(atPath: nodePath), let cli else {
            messages = ["Node.jsが見つかりません。設定で実行ファイルの場所を指定してください。"]
            return
        }
        updating = true
        let job = CLIWorker()
        worker = job
        job.query(node: nodePath, cli: cli, environment: environment) { [weak self] result in
            Task { @MainActor in
                guard let self, !self.stopped else { return }
                self.updating = false
                self.worker = nil
                switch result {
                case .success(let data):
                    self.accounts = data.accounts.filter(\.isFresh)
                    self.lastRead = data.generatedAt
                    func describe(_ issue: UsageIssue) -> String {
                        let source = issue.source ?? issue.sources?.first ?? issue.provider ?? ""
                        return "\(URL(fileURLWithPath: source).lastPathComponent): \(issue.message)"
                    }
                    let unconnectedCodes = ["not_logged_in", "not_logged_in_or_api_key"]
                    self.unconnectedMessages = data.excluded.filter { unconnectedCodes.contains($0.code) }.map(describe)
                    self.messages = (data.issues + data.excluded.filter { !unconnectedCodes.contains($0.code) }).map(describe)
                case .failure(let error):
                    self.messages = [error.localizedDescription]
                }
            }
        }
    }
    func refresh(account: UsageAccount) {
        guard !updating, !sleeping, !stopped else { return }
        do {
            guard FileManager.default.isExecutableFile(atPath: nodePath), let cli else {
                throw AppError.message("Node.jsが見つかりません。設定を確認してください。")
            }
            let env = try accountRefreshEnvironment(account, base: environment)
            accountErrors[account.id] = nil
            refreshingAccountID = account.id
            updating = true
            let job = CLIWorker()
            worker = job
            job.query(node: nodePath, cli: cli, environment: env) { [weak self] result in
                Task { @MainActor in
                    guard let self, !self.stopped else { return }
                    self.updating = false
                    self.refreshingAccountID = nil
                    self.worker = nil
                    do {
                        let data = try result.get()
                        let fresh = try refreshedAccount(account, from: data)
                        if let index = self.accounts.firstIndex(where: { $0.id == account.id }) {
                            self.accounts[index] = fresh
                        }
                        let warnings = data.issues.map(\.message).joined(separator: " / ")
                        if !warnings.isEmpty { self.accountErrors[account.id] = warnings }
                    } catch {
                        self.accountErrors[account.id] = "更新失敗（前回値を表示）：" + error.localizedDescription
                    }
                }
            }
        } catch { accountErrors[account.id] = "更新失敗（前回値を表示）：" + error.localizedDescription }
    }
    func setLogin(_ enabled: Bool) {
        do {
            if enabled { try SMAppService.mainApp.register() } else { try SMAppService.mainApp.unregister() }
            loginEnabled = SMAppService.mainApp.status == .enabled
            if enabled && !loginEnabled { connectionNotice = "システム設定の「ログイン項目」でAI HPを許可してください。" }
        } catch { connectionNotice = error.localizedDescription }
    }
    func connect(_ provider: String) {
        guard let cli, FileManager.default.isExecutableFile(atPath: nodePath) else {
            connectionNotice = "設定でNode.jsの場所を確認してください。"; return
        }
        func quote(_ value: String) -> String { "'" + value.replacingOccurrences(of: "'", with: "'\\''") + "'" }
        do {
            let directory = try FileManager.default.url(for: .applicationSupportDirectory, in: .userDomainMask, appropriateFor: nil, create: true).appendingPathComponent("AI HP/Connections")
            try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
            let script = directory.appendingPathComponent("connect-\(provider).command")
            let content = "#!/bin/sh\nexport PATH=\(quote(environment["PATH"] ?? ""))\n\(quote(nodePath)) \(quote(cli.path)) connect \(quote(provider)) --lang ja\nstatus=$?\nprintf '\\n完了したらこのウィンドウを閉じ、AI HPの「今すぐ更新」を押してください。\\n'\nexit \"$status\"\n"
            try content.write(to: script, atomically: true, encoding: .utf8)
            try FileManager.default.setAttributes([.posixPermissions: 0o700], ofItemAtPath: script.path)
            let configuration = NSWorkspace.OpenConfiguration()
            NSWorkspace.shared.open([script], withApplicationAt: URL(fileURLWithPath: "/System/Applications/Utilities/Terminal.app"), configuration: configuration) { [weak self] _, error in
                if let error { Task { @MainActor in self?.connectionNotice = error.localizedDescription } }
            }
            connectionNotice = "ターミナルとブラウザで接続した後、「今すぐ更新」を押してください。"
        } catch { connectionNotice = error.localizedDescription }
    }
    func stop() { stopped = true; worker?.cancel() }
}
