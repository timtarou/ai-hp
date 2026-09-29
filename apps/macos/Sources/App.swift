import SwiftUI
import AppKit

@main struct AIHPApp: App {
    @StateObject private var store = UsageStore()
    var body: some Scene {
        MenuBarExtra { Panel(store: store) } label: {
            Text(store.menuTitle).monospacedDigit()
        }
        .menuBarExtraStyle(.window)
    }
}

struct Panel: View {
    @ObservedObject var store: UsageStore

    private var accountWidth: CGFloat {
        func width(_ text: String, size: CGFloat, weight: NSFont.Weight = .regular) -> CGFloat {
            (text as NSString).size(withAttributes: [.font: NSFont.systemFont(ofSize: size, weight: weight)]).width
        }
        let widths = store.displayedAccounts.map { account -> CGFloat in
            let name = account.displayName(hideEmail: store.hideEmail)
            let provider = width(account.service, size: 10, weight: .semibold)
            let plan = account.plan.map { 6 + width($0.uppercased(), size: 10) } ?? 0
            let scoped = store.showScoped
                ? account.limits.filter { $0.kind == "scoped" }.map { width($0.scope ?? "モデル別枠", size: 12) }.max() ?? 0
                : 0
            return max(width(name, size: 12), provider + plan, scoped)
        }
        return ceil(max(80, widths.max() ?? 0)) + 8
    }
    private var panelWidth: CGFloat {
        accountWidth + 64 + LimitColumn.width + (store.showShort ? LimitColumn.width + 16 : 0) + (store.showCredits ? 106 : 0)
    }
    private var listHeight: CGFloat {
        let rows = store.displayedAccounts.reduce(0) { total, account in
            let scoped = store.showScoped ? account.limits.filter { $0.kind == "scoped" }.count : 0
            return total + 61 + scoped * 46 + (store.accountErrors[account.id] == nil ? 0 : 36)
        }
        return CGFloat(min(480, max(90, rows + store.messages.count * 44)))
    }
    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 8) {
                Text("AI HP").font(.title3.bold())
                Text("\(store.displayedAccounts.count) / \(store.accounts.count)アカウント").font(.caption).foregroundStyle(.secondary)
                Spacer()
                if store.updating { ProgressView().controlSize(.small) }
                Menu {
                    Picker("リセット日時", selection: $store.resetDisplay) {
                        ForEach(ResetDisplay.allCases, id: \.self) { format in Text(format.label).tag(format) }
                    }
                    Divider()
                    Toggle("5時間枠（2列目）", isOn: $store.showShort)
                    Toggle("Fable・モデル別枠（下段）", isOn: $store.showScoped)
                    Toggle("バンクリセット権（4列目）", isOn: $store.showCredits)
                } label: { Image(systemName: "line.3.horizontal.decrease") }
                    .menuStyle(.borderlessButton).fixedSize().help("表示項目").accessibilityLabel("表示項目")
                Button { store.refresh() } label: { Image(systemName: "arrow.clockwise") }
                    .help("今すぐ更新").accessibilityLabel("今すぐ更新").disabled(store.updating)
                Button { store.showSettings.toggle() } label: { Image(systemName: "gearshape") }
                    .help("設定").accessibilityLabel("設定")
            }
            if store.showSettings { settings }
            HStack(spacing: 8) {
                TextField("アカウントを検索", text: $store.search).textFieldStyle(.roundedBorder)
                    .accessibilityLabel("アカウントを検索")
                Menu {
                    Picker("サービス", selection: $store.providerFilter) {
                        Text("すべて").tag("all")
                        Text("Claude").tag("claude")
                        Text("Codex").tag("codex")
                    }
                } label: { Text(store.providerFilter == "all" ? "すべて" : store.providerFilter == "claude" ? "Claude" : "Codex") }
                    .fixedSize().accessibilityLabel("サービスで絞り込み")
                Menu {
                    Picker("並び順", selection: $store.sort) {
                        ForEach(AccountSort.allCases, id: \.self) { order in Text(order.label).tag(order) }
                    }
                } label: { Image(systemName: "arrow.up.arrow.down") }
                    .fixedSize().help(store.sort.label).accessibilityLabel("並び替え：\(store.sort.label)")
            }
            HStack(spacing: 16) {
                Text("アカウント").frame(width: accountWidth, alignment: .leading)
                if store.showShort { Text("5時間枠").frame(width: LimitColumn.width, alignment: .leading) }
                Text("週間枠").frame(width: LimitColumn.width, alignment: .leading)
                if store.showCredits { Text("バンクリセット権").frame(width: 90, alignment: .leading) }
            }.font(.caption2).foregroundStyle(.secondary).padding(.horizontal, 10)
            ScrollView {
                VStack(spacing: 0) {
                    if store.displayedAccounts.isEmpty {
                        VStack(alignment: .leading, spacing: 6) {
                            Text(store.updating ? "利用枠を取得しています…" : store.accounts.isEmpty ? "取得できたアカウントがありません" : "条件に一致するアカウントがありません").font(.headline)
                            Text(store.accounts.isEmpty ? "「アカウントを追加」からClaude・Codexに接続できます。" : "検索やサービスの条件を変更してください。")
                                .font(.caption).foregroundStyle(.secondary)
                        }.frame(maxWidth: .infinity, alignment: .leading).padding(12)
                    }
                    ForEach(store.displayedAccounts) { account in
                        AccountRow(account: account, store: store, accountWidth: accountWidth)
                        Divider()
                    }
                    ForEach(Array(store.messages.enumerated()), id: \.offset) { _, text in
                        HStack(alignment: .top) {
                            Label(text, systemImage: "exclamationmark.triangle").font(.caption)
                                .foregroundStyle(.orange).textSelection(.enabled)
                            Spacer()
                            Button { store.messages.removeAll { $0 == text } } label: { Image(systemName: "xmark") }
                                .buttonStyle(.plain).accessibilityLabel("警告を閉じる")
                        }.padding(8)
                    }
                }.frame(maxWidth: .infinity, alignment: .leading)
            }.frame(height: listHeight)
            if let notice = store.connectionNotice {
                HStack(alignment: .top) {
                    Text(notice).font(.caption).foregroundStyle(.secondary)
                    Spacer()
                    Button { store.connectionNotice = nil } label: { Image(systemName: "xmark") }
                        .buttonStyle(.plain).accessibilityLabel("案内を閉じる")
                }
            }
            HStack {
                Menu("アカウントを追加") {
                    Button("Claudeに接続") { store.connect("claude") }
                    Button("Codexに接続") { store.connect("codex") }
                }.fixedSize()
                Spacer()
                if let date = store.lastRead {
                    Text("\(date.formatted(date: .omitted, time: .shortened)) 照会")
                        .font(.caption2).foregroundStyle(.secondary)
                        .help("開くたびに取得します。取得元CLIの反映に時間がかかる場合があります。")
                }
                Button("終了") { store.stop(); NSApplication.shared.terminate(nil) }
            }
        }
        .padding(14).frame(width: panelWidth)
        .background(Color(nsColor: .windowBackgroundColor))
        .preferredColorScheme(store.appearance == "dark" ? .dark : store.appearance == "light" ? .light : nil)
        .onAppear { store.opened() }
    }
    var settings: some View {
        VStack(alignment: .leading, spacing: 10) {
            Picker("外観", selection: $store.appearance) {
                Text("システムに合わせる").tag("system")
                Text("ライト").tag("light")
                Text("ダーク").tag("dark")
            }
            if !store.unconnectedMessages.isEmpty {
                VStack(alignment: .leading, spacing: 4) {
                    Text("未接続の設定（\(store.unconnectedMessages.count)件）").font(.caption)
                    ForEach(Array(store.unconnectedMessages.enumerated()), id: \.offset) { _, message in
                        Text(message).font(.caption2).foregroundStyle(.secondary).textSelection(.enabled)
                    }
                }
            }
            Toggle("メールアドレスを隠す", isOn: $store.hideEmail)
            Toggle("ログイン時に起動", isOn: Binding(get: { store.loginEnabled }, set: { store.setLogin($0) }))
            TextField("Node.jsの実行ファイル", text: $store.nodePath).textFieldStyle(.roundedBorder)
            TextField("追加のCLIフォルダ（:で区切る）", text: $store.extraPath).textFieldStyle(.roundedBorder)
            Text("Node.jsとClaude / Codex CLIは、このMacにインストール済みのものを使います。")
                .font(.caption2).foregroundStyle(.secondary)
            Divider()
        }
    }
}

struct AccountRow: View {
    let account: UsageAccount
    @ObservedObject var store: UsageStore
    let accountWidth: CGFloat
    private var name: String {
        account.displayName(hideEmail: store.hideEmail)
    }
    private var scoped: [UsageLimit] {
        store.showScoped ? account.limits.filter { $0.kind == "scoped" } : []
    }
    private var shortColumn: LimitColumn {
        LimitColumn(limit: account.limits.first { $0.kind == "short" && $0.windowHours == 5 }, title: "5時間の残り枠", resetDisplay: store.resetDisplay)
    }
    private var weeklyColumn: LimitColumn {
        LimitColumn(limit: account.weekly, title: "週の残り枠", resetDisplay: store.resetDisplay,
                    showRefresh: store.hoveredAccount == account.id,
                    refreshing: store.refreshingAccountID == account.id,
                    refreshDisabled: store.updating,
                    refreshAction: { store.refresh(account: account) })
    }
    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            Grid(alignment: .leading, horizontalSpacing: 16, verticalSpacing: 3) {
                GridRow(alignment: .center) {
                    Text(name).font(.system(size: 12))
                        .lineLimit(1).truncationMode(.middle).textSelection(.enabled)
                        .frame(width: accountWidth, alignment: .leading).help(name)
                    if store.showShort { shortColumn.bar }
                    weeklyColumn.bar
                    if store.showCredits {
                        Text(account.resetCredits.countLabel).font(.system(size: 10)).monospacedDigit()
                            .frame(width: 90, alignment: .leading)
                    }
                }
                GridRow(alignment: .firstTextBaseline) {
                    HStack(alignment: .firstTextBaseline, spacing: 6) {
                        Text(account.service).fontWeight(.semibold)
                            .foregroundStyle(account.provider == "claude" ? Color.orange : Color.accentColor)
                        if let plan = account.plan { Text(plan.uppercased()) }
                    }.font(.system(size: 10)).foregroundStyle(.secondary)
                        .frame(width: accountWidth, alignment: .leading)
                    if store.showShort { shortColumn.detail }
                    weeklyColumn.detail
                    if store.showCredits {
                        Text(account.resetCredits.expiryLabel).font(.system(size: 10)).foregroundStyle(.secondary)
                            .lineLimit(1).help(account.resetCredits.expiryLabel)
                            .frame(width: 90, alignment: .leading)
                    }
                }
            }.padding(.horizontal, 10).frame(height: 60)
            if let error = store.accountErrors[account.id] {
                Label(error, systemImage: "exclamationmark.triangle")
                    .font(.caption2).foregroundStyle(.orange).lineLimit(2)
                    .help(error).frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.horizontal, 10).frame(height: 36)
            }
            ForEach(Array(scoped.enumerated()), id: \.offset) { _, limit in
                HStack(spacing: 16) {
                    Text(limit.scope ?? "モデル別枠").font(.caption).foregroundStyle(.secondary)
                        .frame(width: accountWidth, alignment: .leading)
                    if store.showShort { Color.clear.frame(width: LimitColumn.width, height: 1) }
                    LimitColumn(limit: limit, title: "残り枠", resetDisplay: store.resetDisplay)
                    if store.showCredits { Color.clear.frame(width: 90, height: 1) }
                    }.padding(.horizontal, 10).frame(height: 46)
            }
        }
        .contentShape(Rectangle())
        .background(store.hoveredAccount == account.id ? Color.primary.opacity(0.06) : Color.clear,
                    in: RoundedRectangle(cornerRadius: 6))
        .onHover { hovering in
            if hovering { store.hoveredAccount = account.id }
            else if store.hoveredAccount == account.id { store.hoveredAccount = nil }
        }
    }
}

private struct LimitColumn: View {
    static let width: CGFloat = 164
    let limit: UsageLimit?
    let title: String
    let resetDisplay: ResetDisplay
    var showRefresh = false
    var refreshing = false
    var refreshDisabled = false
    var refreshAction: (() -> Void)? = nil
    var body: some View {
        VStack(alignment: .leading, spacing: 3) {
            bar.frame(height: 16)
            detail
        }
    }
    var bar: some View {
        GeometryReader { geometry in
            ZStack(alignment: .leading) {
                Capsule().fill(.quaternary)
                if let limit {
                    Capsule().fill(limit.remaining < 20 ? Color.red : .green)
                        .frame(width: geometry.size.width * CGFloat(min(100, max(0, limit.remaining))) / 100)
                }
            }
        }.frame(width: Self.width, height: 5).accessibilityHidden(true)
    }
    var detail: some View {
        HStack(alignment: .firstTextBaseline, spacing: 4) {
            Text(limit?.percentage ?? "—")
                .font(.system(size: 13, weight: .medium))
                .foregroundStyle(limit.map { $0.remaining < 20 ? Color.red : Color.primary } ?? Color.secondary)
                .accessibilityLabel("\(title) \(limit?.percentage ?? "未取得")")
            if let refreshAction {
                ZStack {
                    Button(action: refreshAction) { Image(systemName: "arrow.clockwise") }
                        .buttonStyle(.plain).disabled(refreshDisabled)
                        .opacity(showRefresh && !refreshing ? 1 : 0)
                        .allowsHitTesting(showRefresh && !refreshing)
                        .accessibilityHidden(!showRefresh || refreshing)
                        .accessibilityLabel("このアカウントを更新").help("このアカウントだけ更新")
                    if refreshing { ProgressView().controlSize(.mini).accessibilityLabel("更新中") }
                }.frame(width: 12, height: 12)
            }
            Spacer(minLength: 4)
            Text(limit?.resetDisplay(resetDisplay) ?? "—").foregroundStyle(.secondary)
                .help(limit?.resetLabel() ?? "未取得")
        }.font(.system(size: 10)).monospacedDigit().lineLimit(1)
            .frame(width: Self.width)
    }
}

private extension UsageAccount {
    func displayName(hideEmail: Bool) -> String {
        hideEmail ? sources.map { URL(fileURLWithPath: $0).lastPathComponent }.joined(separator: " / ") : email
    }
}
