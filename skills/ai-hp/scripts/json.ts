/** 外部プロセスの JSON 応答を安全に読むための小さな補助 */

export type Obj = Record<string, unknown>;

export function obj(v: unknown): Obj | undefined {
  return typeof v === "object" && v !== null && !Array.isArray(v) ? (v as Obj) : undefined; // 直前で object であることを確認済み
}

export function num(v: unknown): number | undefined {
  return typeof v === "number" && Number.isFinite(v) ? v : undefined;
}

export function str(v: unknown): string | undefined {
  return typeof v === "string" && v !== "" ? v : undefined;
}

export function arr(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}
