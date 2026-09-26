import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, before, beforeEach, describe, it } from "node:test";
import { loadSettings } from "../skills/ai-hp/scripts/settings.ts";

describe("表のあとの「ひとこと」の設定", () => {
  let home: string;
  const savedXdg = process.env.XDG_CONFIG_HOME;

  // 手元の ~/.config/ai-hp/config.json を読まないよう、設定フォルダを一時フォルダに向ける
  before(() => {
    home = mkdtempSync(path.join(tmpdir(), "ai-hp-settings-"));
    process.env.XDG_CONFIG_HOME = home;
  });
  after(() => {
    if (savedXdg === undefined) delete process.env.XDG_CONFIG_HOME;
    else process.env.XDG_CONFIG_HOME = savedXdg;
    rmSync(home, { recursive: true, force: true });
  });
  beforeEach(() => rmSync(path.join(home, "ai-hp"), { recursive: true, force: true }));

  function writeConfig(config: object): void {
    mkdirSync(path.join(home, "ai-hp"), { recursive: true });
    writeFileSync(path.join(home, "ai-hp", "config.json"), JSON.stringify(config));
  }

  async function commentary(argv: string[], env: NodeJS.ProcessEnv = {}): Promise<boolean> {
    return (await loadSettings(argv, env)).commentary;
  }

  it("既定では出さない", async () => {
    assert.equal(await commentary([]), false);
  });

  it("--comment・AI_HP_COMMENTARY=1・config.json の \"commentary\": true のどれかで出す", async () => {
    assert.equal(await commentary(["--comment"]), true);
    assert.equal(await commentary([], { AI_HP_COMMENTARY: "1" }), true);
    writeConfig({ commentary: true });
    assert.equal(await commentary([]), true);
  });

  it("環境変数は config.json より優先する", async () => {
    writeConfig({ commentary: true });
    assert.equal(await commentary([], { AI_HP_COMMENTARY: "0" }), false);
  });

  it("--no-comment は --comment・環境変数・config.json より優先する", async () => {
    writeConfig({ commentary: true });
    assert.equal(await commentary(["--comment", "--no-comment"], { AI_HP_COMMENTARY: "1" }), false);
  });
});
