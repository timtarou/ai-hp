import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { it } from "node:test";

it("cancelling a usage query terminates even a provider that ignores SIGTERM", { skip: process.platform === "win32", timeout: 10_000 }, async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "ai-hp-stop-"));
  let providerPid: number | undefined;
  const moduleURL = new URL("../skills/ai-hp/dist/jsonl-process.js", import.meta.url).href;
  const marker = path.join(directory, "pid");
  const provider = path.join(directory, "provider.cjs");
  const runner = path.join(directory, "runner.mjs");
  await writeFile(provider, `require('fs').writeFileSync(${JSON.stringify(marker)}, String(process.pid)); process.on('SIGTERM', () => {}); setInterval(() => {}, 1000);`);
  await writeFile(runner, `import { exchangeJsonLines } from ${JSON.stringify(moduleURL)};
try { await exchangeJsonLines({ command: process.execPath, args: [${JSON.stringify(provider)}], env: process.env, cwd: ${JSON.stringify(directory)}, messages: [], isDone: () => false, timeoutMs: 5000 }); } catch { process.exitCode = 1; }`);
  const child = spawn(process.execPath, [runner], { stdio: "ignore" });
  try {
    const exited = new Promise<number | null>((resolve, reject) => { child.once("exit", resolve); child.once("error", reject); });
    for (let attempt = 0; attempt < 100; attempt++) {
      try { providerPid = Number(await readFile(marker, "utf8")); break; } catch { await new Promise((resolve) => setTimeout(resolve, 20)); }
    }
    assert.ok(providerPid, "provider never started");
    child.kill("SIGTERM");
    assert.equal(await exited, 1);
    assert.throws(() => process.kill(providerPid!, 0), { code: "ESRCH" });
  } finally {
    child.kill("SIGKILL");
    if (providerPid) { try { process.kill(providerPid, "SIGKILL"); } catch { } }
    await rm(directory, { recursive: true, force: true });
  }
});
