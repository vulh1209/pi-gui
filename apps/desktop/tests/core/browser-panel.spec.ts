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

test("navigates a live browser companion and reflects title plus history state", async () => {
  test.setTimeout(30_000);
  const userDataDir = await makeUserDataDir();
  const workspacePath = await makeGitWorkspace("browser-navigation-workspace");
  const harness = await launchDesktop(userDataDir, {
    initialWorkspaces: [workspacePath],
    testMode: "background",
  });

  try {
    const window = await harness.firstWindow();
    await createNamedThread(window, "Browser navigation test");

    const firstUrl = "data:text/html,<title>Browser%20One</title><h1>One</h1>";
    const secondUrl = "data:text/html,<title>Browser%20Two</title><h1>Two</h1>";

    await window.getByRole("button", { name: "Toggle browser companion" }).click();
    const address = window.getByLabel("Browser address");

    await address.fill(firstUrl);
    await address.press("Enter");
    await expect(window.locator(".browser-panel__title")).toContainText("Browser One");
    await expect(window.getByRole("button", { name: "Back" })).toBeDisabled();

    await address.fill(secondUrl);
    await address.press("Enter");
    await expect(window.locator(".browser-panel__title")).toContainText("Browser Two");
    await expect(window.getByRole("button", { name: "Back" })).toBeEnabled();

    await window.getByRole("button", { name: "Back" }).click();
    await expect(window.locator(".browser-panel__title")).toContainText("Browser One");
    await expect(window.getByRole("button", { name: "Forward" })).toBeEnabled();
  } finally {
    await harness.close();
  }
});
