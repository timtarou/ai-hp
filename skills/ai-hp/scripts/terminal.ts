import { t } from "./i18n.ts";
import type { ReportModel } from "./report.ts";

export type TerminalOptions = {
  /** ターミナルの幅（桁数）。表が収まらなければアカウントごとに縦に並べる */
  columns: number;
  color: boolean;
};

const GAP = "  ";
/** 残りの色分け（%）。これ未満は赤、WARN 未満は黄、それ以上は緑 */
const LOW = 20;
const WARN = 50;
const SERVICE_COLUMN = 1;
const ACCOUNT_COLUMN = 2;

type Style = "bold" | "dim" | "red" | "yellow" | "green" | "claude";

const SGR: Record<Style, [string, string]> = {
  bold: ["1", "22"],
  dim: ["2", "22"],
  red: ["31", "39"],
  yellow: ["33", "39"],
  green: ["32", "39"],
  claude: ["38;5;173", "39"], // Claude のブランドカラーに近いオレンジ
};

/** 全角（東アジアの幅広文字）と絵文字は 2 桁、結合文字は 0 桁として数える */
const WIDE =
  /[ᄀ-ᅟ⺀-〾ぁ-㏿㐀-䶿一-鿿ꀀ-꓏가-힣豈-﫿︰-﹏＀-｠￠-￦\u{1F300}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{1F900}-\u{1F9FF}\u{20000}-\u{3FFFD}]/u;
const ZERO_WIDTH = /[\p{M}​-‏︀-️]/u;

/** ターミナルでの表示幅（桁数） */
export function displayWidth(text: string): number {
  let width = 0;
  for (const ch of text) width += ZERO_WIDTH.test(ch) ? 0 : WIDE.test(ch) ? 2 : 1;
  return width;
}

function plain(cell: string): string {
  return cell.replace(/\*\*(.+?)\*\*/g, "$1");
}

function level(percent: number): Style {
  return percent < LOW ? "red" : percent < WARN ? "yellow" : "green";
}

function makePaint(color: boolean) {
  return (text: string, ...styles: Style[]): string => {
    if (!color || text === "") return text;
    return styles.reduce((s, style) => `\x1b[${SGR[style][0]}m${s}\x1b[${SGR[style][1]}m`, text);
  };
}

type Paint = ReturnType<typeof makePaint>;

/** セルに色を付ける。残りが少ない値（**…**）は赤の太字、残りの棒は残量で色分けし、「—」は薄くする */
function styleCell(cell: string, column: number, paint: Paint): string {
  if (cell === "—") return paint(cell, "dim");
  if (column === SERVICE_COLUMN) {
    const styles: Style[] = cell === "Claude" ? ["bold", "claude"] : ["bold"];
    return paint(cell, ...styles);
  }
  const bar = /^([█]*)([░]*) (\**)(\d+)%/.exec(cell);
  let out = cell;
  if (bar && bar[1].length + bar[2].length > 0) {
    const [whole, filled, empty] = bar;
    const rest = whole.slice(filled.length + empty.length);
    out = paint(filled, level(Number(bar[4]))) + paint(empty, "dim") + rest + cell.slice(whole.length);
  }
  return out.replace(/\*\*(.+?)\*\*/g, (_, value: string) => paint(value, "bold", "red"));
}

function pad(text: string, width: number, shown: string): string {
  return shown + " ".repeat(Math.max(0, width - displayWidth(text)));
}

function renderTable(model: ReportModel, paint: Paint): { lines: string[]; width: number } {
  const widths = model.headers.map((h, i) => Math.max(displayWidth(h), ...model.rows.map((r) => displayWidth(plain(r[i])))));
  const line = (cells: string[], show: (cell: string, i: number) => string) =>
    cells
      .map((c, i) => (i === cells.length - 1 ? show(c, i) : pad(plain(c), widths[i], show(c, i))))
      .join(GAP)
      .trimEnd();
  const lines = [
    line(model.headers, (h) => paint(h, "bold")),
    paint(widths.map((w) => "─".repeat(w)).join(GAP), "dim"),
    ...model.rows.map((r) => line(r, (c, i) => styleCell(c, i, paint))),
  ];
  return { lines, width: widths.reduce((sum, w) => sum + w, 0) + GAP.length * (widths.length - 1) };
}

/** 幅の狭いターミナル向け。アカウントごとに「サービス アカウント」の行と、値のある項目だけを並べる */
function renderCards(model: ReportModel, paint: Paint): string[] {
  const fields = model.headers.map((h, i) => ({ h, i })).filter(({ i }) => i !== SERVICE_COLUMN && i !== ACCOUNT_COLUMN);
  const labelWidth = Math.max(...fields.map(({ h }) => displayWidth(h)));
  const lines: string[] = [];
  for (const r of model.rows) {
    if (lines.length > 0) lines.push("");
    lines.push(`${styleCell(r[SERVICE_COLUMN], SERVICE_COLUMN, paint)}  ${styleCell(r[ACCOUNT_COLUMN], ACCOUNT_COLUMN, paint)}`);
    for (const { h, i } of fields) {
      if (r[i] === "—") continue;
      lines.push(`  ${pad(h, labelWidth, paint(h, "dim"))}  ${styleCell(r[i], i, paint)}`);
    }
  }
  return lines;
}

/** 表の中身をターミナル向けに描く（出力先がターミナルのとき） */
export function renderTerminal(model: ReportModel, options: TerminalOptions): string {
  const paint = makePaint(options.color);
  const lines = [paint(model.title, "bold"), ""];
  if (model.rows.length === 0) lines.push(paint(t("noAccounts"), "dim"));
  else {
    const table = renderTable(model, paint);
    lines.push(...(table.width <= options.columns ? table.lines : renderCards(model, paint)));
  }
  if (model.comment) lines.push("", `💬 ${model.comment}`);
  if (model.notes.length > 0) lines.push("", ...model.notes.map((n) => paint(`- ${n}`, "dim")));
  return lines.join("\n");
}
