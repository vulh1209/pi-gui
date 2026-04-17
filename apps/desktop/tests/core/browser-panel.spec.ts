import { createServer } from "node:http";
import { expect, test } from "@playwright/test";
import {
  createNamedThread,
  desktopShortcut,
  getTimelineScrollMetrics,
  jumpTimelineToBottom,
  launchDesktop,
  makeGitWorkspace,
  makeUserDataDir,
  seedTranscriptMessages,
  selectSession,
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
    await expect(panel).toContainText("Ready to browse");
    await expect(window.getByLabel("Browser address")).toHaveAttribute("placeholder", "Paste a URL to start browsing");

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

test("keeps browser auth state per workspace across relaunch", async () => {
  test.setTimeout(45_000);
  const userDataDir = await makeUserDataDir();
  const workspaceA = await makeGitWorkspace("browser-workspace-a");
  const workspaceB = await makeGitWorkspace("browser-workspace-b");

  const server = createServer((req, res) => {
    const cookies = req.headers.cookie ?? "";
    if (req.url === "/login") {
      res.writeHead(200, {
        "Content-Type": "text/html",
        "Set-Cookie": "companion_auth=1; Path=/; HttpOnly; Max-Age=3600",
      });
      res.end("<title>Logged In</title><body>logged in</body>");
      return;
    }

    const title = cookies.includes("companion_auth=1") ? "Authed" : "Guest";
    res.writeHead(200, { "Content-Type": "text/html" });
    res.end(`<title>${title}</title><body>${title}</body>`);
  });

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Failed to start browser auth server");
  }
  const baseUrl = `http://127.0.0.1:${address.port}`;

  const launch = () =>
    launchDesktop(userDataDir, {
      initialWorkspaces: [workspaceA, workspaceB],
      testMode: "background",
    });

  let harness = await launch();
  try {
    const window = await harness.firstWindow();
    await createNamedThread(window, "Workspace A thread", { workspaceName: "browser-workspace-a" });
    await createNamedThread(window, "Workspace B thread", { workspaceName: "browser-workspace-b" });
    await selectSession(window, "Workspace A thread");

    await window.getByRole("button", { name: "Toggle browser companion" }).click();
    const browserAddress = window.getByLabel("Browser address");
    await browserAddress.fill(`${baseUrl}/login`);
    await browserAddress.press("Enter");
    await expect(window.locator(".browser-panel__title")).toContainText("Logged In");
  } finally {
    await harness.close();
  }

  harness = await launch();
  try {
    const window = await harness.firstWindow();
    await selectSession(window, "Workspace A thread");
    await window.getByRole("button", { name: "Toggle browser companion" }).click();

    const browserAddress = window.getByLabel("Browser address");
    await browserAddress.fill(`${baseUrl}/status`);
    await browserAddress.press("Enter");
    await expect(window.locator(".browser-panel__title")).toContainText("Authed");

    await selectSession(window, "Workspace B thread");
    await browserAddress.fill(`${baseUrl}/status`);
    await browserAddress.press("Enter");
    await expect(window.locator(".browser-panel__title")).toContainText("Guest");
  } finally {
    await harness.close();
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
});

test("restores composer focus and preserves bottom pinning when the browser companion closes", async () => {
  test.setTimeout(30_000);
  const userDataDir = await makeUserDataDir();
  const workspacePath = await makeGitWorkspace("browser-focus-workspace");
  const harness = await launchDesktop(userDataDir, {
    initialWorkspaces: [workspacePath],
    testMode: "background",
  });

  try {
    const window = await harness.firstWindow();
    await createNamedThread(window, "Browser focus test");
    await seedTranscriptMessages(harness, window, { count: 12 });
    await jumpTimelineToBottom(window);

    const composer = window.getByTestId("composer");
    await expect(composer).toBeFocused();

    await window.getByRole("button", { name: "Toggle browser companion" }).click();
    await expect(window.locator(".browser-panel")).toBeVisible();
    await window.getByRole("button", { name: "Toggle browser companion" }).click();

    await expect(window.locator(".browser-panel")).toHaveCount(0);
    await expect(composer).toBeFocused();

    const metrics = await getTimelineScrollMetrics(window);
    expect(metrics.remainingFromBottom).toBeLessThan(32);
  } finally {
    await harness.close();
  }
});
