import { expect, test } from "@playwright/test";
import {
  createNamedThread,
  desktopShortcut,
  launchDesktop,
  makeGitWorkspace,
  makeUserDataDir,
} from "../helpers/electron-app";

test("opens and closes the browser companion from the topbar and persists the default-safe browser policy", async () => {
  test.setTimeout(30_000);
  const userDataDir = await makeUserDataDir();
  const workspacePath = await makeGitWorkspace("browser-panel-workspace");

  const launch = () =>
    launchDesktop(userDataDir, {
      initialWorkspaces: [workspacePath],
      testMode: "background",
    });

  let harness = await launch();
  try {
    const window = await harness.firstWindow();
    await createNamedThread(window, "Browser panel test");

    const panel = window.locator(".browser-panel");
    await expect(panel).toHaveCount(0);

    await window.getByRole("button", { name: "Toggle browser companion" }).click();
    await expect(panel).toBeVisible();
    await expect(panel.getByText("Paste a URL to start browsing")).toBeVisible();

    await window.getByRole("button", { name: "Toggle browser companion" }).click();
    await expect(panel).toHaveCount(0);

    await window.keyboard.press(desktopShortcut(","));
    await expect(window.getByTestId("settings-surface")).toBeVisible();
    await expect(window.getByText("Browser automation")).toBeVisible();
    await expect(window.getByRole("button", { name: "Ask every time" })).toHaveAttribute("aria-pressed", "true");

    await window.getByRole("button", { name: "Allow full automation" }).click();
    await expect(window.getByRole("button", { name: "Allow full automation" })).toHaveAttribute("aria-pressed", "true");
  } finally {
    await harness.close();
  }

  harness = await launch();
  try {
    const window = await harness.firstWindow();
    await window.keyboard.press(desktopShortcut(","));
    await expect(window.getByRole("button", { name: "Allow full automation" })).toHaveAttribute("aria-pressed", "true");
  } finally {
    await harness.close();
  }
});
