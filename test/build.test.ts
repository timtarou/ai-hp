import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = path.join(root, "skills", "ai-hp", "dist");
const tsc = path.join(root, "node_modules", ".bin", "tsc");

function listFiles(dir: string, base = dir): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .flatMap((name) => {
      const full = path.join(dir, name);
      return statSync(full).isDirectory() ? listFiles(full, base) : [path.relative(base, full)];
    })
    .sort();
}

describe("dist（スキルが実行する JavaScript。Node 18 以上で動くようにリポジトリに含める）", () => {
  it(
    "TypeScript のソースから作り直した内容と一致する（npm run build の実行忘れを検出する）",
    { skip: !existsSync(tsc) && "typescript が入っていない（npm install で入る）" },
    () => {
      const out = mkdtempSync(path.join(tmpdir(), "ai-hp-build-"));
      try {
        execFileSync(tsc, ["-p", path.join(root, "tsconfig.build.json"), "--outDir", out], { cwd: root });
        assert.deepEqual(listFiles(dist), listFiles(out), "dist のファイル構成が古い。npm run build を実行してください");
        for (const file of listFiles(out)) {
          assert.equal(
            readFileSync(path.join(dist, file), "utf8"),
            readFileSync(path.join(out, file), "utf8"),
            `dist/${file} が古い。npm run build を実行してください`,
          );
        }
      } finally {
        rmSync(out, { recursive: true, force: true });
      }
    },
  );

  it("dist/cli.js を実行できる", () => {
    const help = execFileSync(process.execPath, [path.join(dist, "cli.js"), "--help"], { encoding: "utf8" });
    assert.match(help, /^Usage: node dist\/cli\.js \[--lang en\|ja\]/m);
  });
});
