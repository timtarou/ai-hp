// README の画像（docs/demo.png・docs/demo-ja.png）と GitHub の Social preview（docs/social-preview.png）を作る。
// 架空のアカウントを色付きの表で描き、HTML にして Chrome のヘッドレスモードで PNG に撮る。
//   node scripts/screenshot.ts        （Chrome の場所は CHROME で変えられる）
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { displayWidth } from "../skills/ai-hp/scripts/terminal.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const chrome = process.env.CHROME ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

const FONT_PX = 14;
const CHAR_PX = FONT_PX * 0.6021; // Menlo の 1 桁の幅
const LINE_PX = Math.round(FONT_PX * 1.5);
const COLORS: Record<string, string> = { "31": "#ff6b6b", "32": "#5fd38d", "33": "#f2c14e", "38;5;173": "#e08a6c" };

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** ターミナルと同じく、全角文字と絵文字をちょうど 2 桁に収める（ブラウザの和文フォントは 2 桁より狭い） */
function cells(s: string): string {
  return [...s]
    .map((ch) => (displayWidth(ch) === 2 ? `<span class="wide">${escapeHtml(ch)}</span>` : escapeHtml(ch)))
    .join("");
}

/** ai-hp が使う SGR（太字・薄字・色）だけを span にする */
function ansiToHtml(text: string): string {
  let bold = false;
  let dim = false;
  let color: string | undefined;
  let html = "";
  for (const part of text.split(/(\x1b\[[0-9;]*m)/)) {
    const sgr = /^\x1b\[([0-9;]*)m$/.exec(part);
    if (sgr) {
      const code = sgr[1];
      if (code === "1") bold = true;
      else if (code === "2") dim = true;
      else if (code === "22") bold = dim = false;
      else if (code === "39") color = undefined;
      else color = COLORS[code];
      continue;
    }
    if (part === "") continue;
    const style = [bold && "font-weight:700", dim && "opacity:.5", color && `color:${color}`].filter(Boolean).join(";");
    html += style ? `<span style="${style}">${cells(part)}</span>` : cells(part);
  }
  return html;
}

function demo(lang: string, columns: number): string {
  return execFileSync(process.execPath, [path.join(root, "scripts", "demo.ts"), "--lang", lang, "--columns", String(columns)], {
    encoding: "utf8",
  }).trimEnd();
}

const STYLE = `
  * { margin: 0; box-sizing: border-box; }
  html, body { background: transparent; }
  body { font-family: -apple-system, "Helvetica Neue", sans-serif; }
  .window { background: #15171c; border-radius: 12px; box-shadow: 0 16px 48px rgba(0,0,0,.35), 0 0 0 1px rgba(255,255,255,.08) inset; overflow: hidden; }
  .bar { height: 36px; display: flex; align-items: center; gap: 8px; padding: 0 16px; background: #1d2027; }
  .bar i { width: 12px; height: 12px; border-radius: 50%; display: block; }
  pre { font: ${FONT_PX}px/${LINE_PX}px Menlo, "SF Mono", monospace; color: #d7dae0; padding: 18px 22px 22px; white-space: pre; }
  .wide { display: inline-block; width: 2ch; text-align: center; }
  .prompt { color: #8b93a1; }
  .prompt b { color: #d7dae0; font-weight: 400; }
`;

function terminalWindow(output: string, command: string): string {
  return `<div class="window"><div class="bar"><i style="background:#ff5f57"></i><i style="background:#febc2e"></i><i style="background:#28c840"></i></div><pre><span class="prompt">$ <b>${command}</b></span>\n\n${ansiToHtml(output)}</pre></div>`;
}

function shoot(html: string, file: string, width: number, height: number): void {
  const dir = mkdtempSync(path.join(tmpdir(), "ai-hp-shot-"));
  try {
    const page = path.join(dir, "page.html");
    writeFileSync(page, `<!doctype html><meta charset="utf-8"><style>${STYLE}</style>${html}`);
    execFileSync(chrome, [
      "--headless=new",
      "--disable-gpu",
      "--hide-scrollbars",
      "--force-device-scale-factor=2",
      "--default-background-color=00000000",
      `--window-size=${width},${height}`,
      `--screenshot=${path.join(root, file)}`,
      `file://${page}`,
    ], { stdio: "ignore" });
    console.log(`wrote ${file} (${width}x${height} @2x)`);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

const MARGIN = 28;

function readmeImage(lang: string, file: string): void {
  const output = demo(lang, 1000);
  const lines = output.split("\n");
  const cols = Math.max(...lines.map((l) => displayWidth(l.replace(/\x1b\[[0-9;]*m/g, ""))));
  const width = Math.ceil(cols * CHAR_PX) + 44 + MARGIN * 2;
  const height = 36 + 40 + (lines.length + 2) * LINE_PX + MARGIN * 2;
  shoot(`<div style="padding:${MARGIN}px">${terminalWindow(output, "npx ai-hp")}</div>`, file, width, height);
}

function socialPreview(file: string): void {
  // 1280x640。上に名前と説明、下に表の左側（週間リセット〜週間 残り）を見せる
  const output = demo("en", 1000).split("\n").slice(2, 8).join("\n");
  shoot(
    `<div style="width:1280px;height:640px;padding:64px 72px;background:linear-gradient(135deg,#0d0f14,#1b1f2a);color:#fff;overflow:hidden">
      <div style="font:700 72px/1 Menlo,monospace;letter-spacing:-2px">ai-hp <span style="color:#5fd38d">█████</span><span style="opacity:.16">█████</span></div>
      <div style="font-size:34px;margin-top:22px;font-weight:600">An HP bar for your AI accounts</div>
      <div style="font-size:23px;margin-top:12px;color:#aab1bf">Weekly limits, resets and banked resets for every Claude Code and Codex account, in one table</div>
      <div style="margin-top:36px;width:1300px">${terminalWindow(output, "npx ai-hp")}</div>
    </div>`,
    file,
    1280,
    640,
  );
}

readmeImage("en", "docs/demo.png");
readmeImage("ja", "docs/demo-ja.png");
socialPreview("docs/social-preview.png");
