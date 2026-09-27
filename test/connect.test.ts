import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { connectAccount } from "../skills/ai-hp/scripts/connect.ts";

async function temporaryHome(run: (home: string) => Promise<void>) {
  const home = await mkdtemp(path.join(tmpdir(), "ai-hp-connect-"));
  try { await run(home); }
  finally { await rm(home, { recursive: true, force: true }); }
}
const executable = () => "/fixture/bin/provider";
const log = () => {};

describe("account connection", () => {
  it("connect codex completes through the existing login script with an isolated fake CLI", () => temporaryHome(async (home) => {
    const bin = path.join(home, "bin");
    await mkdir(bin);
    await writeFile(path.join(bin, "codex"), `#!${process.execPath}
const fs = require('node:fs');
const path = require('node:path');
const marker = path.join(process.env.CODEX_HOME, 'connected');
if (process.argv[2] !== 'login') process.exit(9);
if (process.argv[3] === 'status') {
  if (!fs.existsSync(marker)) process.exit(1);
  console.log('Logged in using ChatGPT');
} else fs.writeFileSync(marker, 'fixture');
`, { mode: 0o755 });
    const cli = fileURLToPath(new URL("../skills/ai-hp/dist/cli.js", import.meta.url));
    const child = spawnSync(process.execPath, [cli, "connect", "codex", "--lang", "ja"], {
      encoding: "utf8", timeout: 10_000,
      env: { HOME: home, PATH: `${bin}:/usr/bin:/bin`, XDG_CONFIG_HOME: home },
    });
    assert.equal(child.error, undefined);
    assert.equal(child.status, 0, child.stderr);
    assert.match(child.stdout, /接続が完了しました/);
    assert.equal(await readFile(path.join(home, ".codex-ai-hp-1", "connected"), "utf8"), "fixture");
  }));

  it("chooses an unused name and leaves existing accounts untouched", () => temporaryHome(async (home) => {
    const existing = path.join(home, ".claude-ai-hp-1");
    await mkdir(existing);
    await writeFile(path.join(existing, "keep"), "existing login");
    let invocation: unknown;
    assert.equal(await connectAccount("claude", (command, args) => { invocation = [command, args]; return 0; }, { home, executable, log }), 0);
    assert.deepEqual(invocation, ["add-claude", ["ai-hp-2"]]);
    assert.equal(await readFile(path.join(existing, "keep"), "utf8"), "existing login");
  }));

  it("does not create a directory or start login if the CLI is missing", () => temporaryHome(async (home) => {
    const status = await connectAccount("codex", () => { throw new Error("must not launch"); }, { home, executable: () => undefined, log });
    assert.equal(status, 1);
    assert.deepEqual(await readdir(home), []);
  }));

  it("simultaneous connections reserve different directories", () => temporaryHome(async (home) => {
    const names: string[] = [];
    const run = (_command: string, args: string[]) => { names.push(args[0]); return 0; };
    await Promise.all([connectAccount("codex", run, { home, executable, log }), connectAccount("codex", run, { home, executable, log })]);
    assert.deepEqual(names.sort(), ["ai-hp-1", "ai-hp-2"]);
  }));

  it("reports unsuccessful login and retries into a new folder", () => temporaryHome(async (home) => {
    const messages: string[] = [];
    assert.equal(await connectAccount("codex", () => 1, { home, executable, log: (text) => messages.push(text) }), 1);
    let name: string | undefined;
    await connectAccount("codex", (_command, args) => { name = args[0]; return 0; }, { home, executable, log });
    assert.equal(name, "ai-hp-2");
    assert.ok(messages.some((text) => /did not complete|完了していません/.test(text)));
  }));
});
