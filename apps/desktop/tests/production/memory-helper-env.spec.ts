import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import { resolvePackagedAppBundle } from "../helpers/electron-app";

test("packaged desktop ships a runnable memory helper payload", async () => {
  test.setTimeout(120_000);

  const appBundlePath = await resolvePackagedAppBundle();
  const helperRoot = join(appBundlePath, "Contents", "Resources", "memory-helper");
  const helperPath = join(
    helperRoot,
    process.platform === "win32" ? "launch-memory-helper.cmd" : "launch-memory-helper.sh",
  );
  const helperEntryPath = join(helperRoot, "dist", "memory", "helper-entry.js");
  const schemaPath = join(helperRoot, "sql", "001_graphiti_lite_memory.sql");

  expect(existsSync(helperPath)).toBe(true);
  expect(existsSync(helperEntryPath)).toBe(true);
  expect(existsSync(schemaPath)).toBe(true);

  const response = await new Promise<string>((resolve, reject) => {
    const child = spawn(helperPath, [helperEntryPath], {
      stdio: ["pipe", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";

    child.stdout.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
      if (stdout.includes("\n")) {
        child.kill();
        resolve(stdout.trim());
      }
    });

    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });

    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (stdout.trim()) {
        return;
      }
      reject(new Error(`memory helper exited before responding (code=${code ?? "null"}, signal=${signal ?? "null"}, stderr=${stderr.trim()})`));
    });

    child.stdin.write('{"id":"1","method":"helper.hello","params":{}}\n', "utf8");
  });

  expect(response).toContain('"protocolVersion":"1"');
  expect(response).toContain('"helperVersion":"1"');
  expect(response).toContain('"memory.status"');
});
