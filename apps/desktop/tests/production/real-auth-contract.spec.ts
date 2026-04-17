import { mkdtemp, readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { expect, test } from "@playwright/test";
import { getRealAuthConfig, launchDesktop, makeUserDataDir, seedAgentDir } from "../helpers/electron-app";

const browserCompanionPackagePath = resolve(
  __dirname,
  "..",
  "..",
  "..",
  "..",
  "packages",
  "pi-browser-companion-extension",
);

test.skip(process.env.PI_APP_REAL_AUTH === "1", "This contract covers the default non-real-auth path.");

test("default desktop launches keep real-auth mode disabled and seed fake auth in a temp agent dir", async () => {
  const realAuth = getRealAuthConfig();
  expect(realAuth.enabled).toBe(false);
  expect(realAuth.skipReason).toContain("PI_APP_REAL_AUTH=1");
  expect(realAuth.skipReason).toContain("PI_APP_REAL_AUTH_SOURCE_DIR");

  const userDataDir = await makeUserDataDir();
  const harness = await launchDesktop(userDataDir, { testMode: "background" });

  try {
    await harness.firstWindow();

    const agentDir = await harness.electronApp.evaluate(() => process.env.PI_CODING_AGENT_DIR ?? "");
    expect(agentDir).toBe(join(userDataDir, "agent"));

    const auth = JSON.parse(await readFile(join(agentDir, "auth.json"), "utf8")) as {
      openai?: { key?: string };
    };
    expect(auth.openai?.key).toBe("test-openai-key");

    const settings = JSON.parse(await readFile(join(agentDir, "settings.json"), "utf8")) as {
      defaultProvider?: string;
      defaultModel?: string;
      packages?: unknown;
    };
    expect(settings).toMatchObject({
      defaultProvider: "openai",
      defaultModel: "gpt-5",
    });
    expect(settings.packages).toBeUndefined();
  } finally {
    await harness.close();
  }
});

test("desktop launch removes the browser companion package from an existing configured agent settings file", async () => {
  const userDataDir = await makeUserDataDir();
  const sharedAgentDir = join(userDataDir, "shared-agent");
  await seedAgentDir(sharedAgentDir, {
    packages: [browserCompanionPackagePath, "npm:@example/existing-package"],
  });

  const settingsPath = join(sharedAgentDir, "settings.json");
  const before = await readFile(settingsPath, "utf8");
  const harness = await launchDesktop(userDataDir, {
    agentDir: sharedAgentDir,
    testMode: "background",
  });

  try {
    await harness.firstWindow();

    const after = await readFile(settingsPath, "utf8");
    expect(after).not.toBe(before);

    const settings = JSON.parse(after) as {
      packages?: string[];
    };
    expect(settings.packages).toEqual(["npm:@example/existing-package"]);
  } finally {
    await harness.close();
  }
});

test("desktop launch also scrubs the browser companion package when PI_CODING_AGENT_DIR uses a tilde path", async () => {
  const userDataDir = await makeUserDataDir();
  const sharedAgentDir = await mkdtemp(join(homedir(), "pi-gui-agent-dir-"));
  await seedAgentDir(sharedAgentDir, {
    packages: [browserCompanionPackagePath, "npm:@example/existing-package"],
  });

  const settingsPath = join(sharedAgentDir, "settings.json");
  const tildeAgentDir = `~${sharedAgentDir.slice(homedir().length)}`;
  const harness = await launchDesktop(userDataDir, {
    agentDir: sharedAgentDir,
    testMode: "background",
    envOverrides: {
      PI_CODING_AGENT_DIR: tildeAgentDir,
    },
  });

  try {
    await harness.firstWindow();

    const settings = JSON.parse(await readFile(settingsPath, "utf8")) as {
      packages?: string[];
    };
    expect(settings.packages).toEqual(["npm:@example/existing-package"]);
  } finally {
    await harness.close();
  }
});
