/** 外部プロセスの JSON 応答を安全に読むための小さな補助 */
export function obj(v) {
    return typeof v === "object" && v !== null && !Array.isArray(v) ? v : undefined; // 直前で object であることを確認済み
}
export function num(v) {
    return typeof v === "number" && Number.isFinite(v) ? v : undefined;
}
export function str(v) {
    return typeof v === "string" && v !== "" ? v : undefined;
}
export function arr(v) {
    return Array.isArray(v) ? v : [];
}
