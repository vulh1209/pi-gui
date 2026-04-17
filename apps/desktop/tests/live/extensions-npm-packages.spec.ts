import { join } from "node:path";
import { expect, test } from "@playwright/test";
import {
  createSessionViaIpc,
  getDesktopState,
  launchDesktop,
  makeUserDataDir,
  makeWorkspace,
  seedAgentDir,
  selectSession,
  waitForWorkspaceByPath,
} from "../helpers/electron-app";

const PI_EXTENSIONS_SOURCE = "npm:@tungthedev/pi-extensions";

test.skip(process.platform !== "darwin", "This regression targets macOS GUI launch behavior.");

test("loads npm-installed extension commands from a reduced GUI environment", async () => {
  test.setTimeout(120_000);

  const userDataDir = await makeUserDataDir("pi-gui-npm-package-user-data-");
  const agentDir = join(userDataDir, "agent");
  const workspacePath = await makeWorkspace("extensions-npm-package-workspace");
  await seedAgentDir(agentDir, {
    packages: [PI_EXTENSIONS_SOURCE],
  });

  const harness = await launchDesktop(userDataDir, {
    initialWorkspaces: [workspacePath],
    agentDir,
    testMode: "background",
    inheritParentEnv: false,
    envOverrides: {
      HOME: process.env.HOME,
      USER: process.env.USER,
      PATH: "/usr/bin:/bin:/usr/sbin:/sbin",
    },
  });

  try {
    const window = await harness.firstWindow();
    await waitForWorkspaceByPath(window, workspacePath);
    await createSessionViaIpc(window, workspacePath, "npm package session");
    await selectSession(window, "npm package session");

    const composer = window.getByTestId("composer");
    await composer.fill("/pi-mo");

    await expect(window.getByTestId("slash-menu")).toHaveCount(0);
    await expect
      .poll(
        async () => {
          const state = await getDesktopState(window);
          const key = `${state.selectedWorkspaceId}:${state.selectedSessionId}`;
          return state.sessionCommandsBySession[key]?.some((command) => command.name === "pi-mode") ?? false;
        },
        { timeout: 15_000 },
      )
      .toBe(true);

    await window.getByRole("button", { name: "Extensions", exact: true }).click();
    await expect(window.getByTestId("extensions-surface")).toBeVisible();
    await window.getByTestId("extensions-list").getByRole("button", { name: /pi-modes/i }).click();
    await window.getByRole("tab", { name: "Configure", exact: true }).click();
    await expect(window.locator(".skill-detail")).toContainText("Pi Mode");
  } finally {
    await harness.close();
  }
});
