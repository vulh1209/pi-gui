import { expect, test, type Page } from "@playwright/test";
import { createNamedThread, getSelectedTranscript, launchDesktop, makeGitWorkspace, makeUserDataDir } from "../helpers/electron-app";

async function submitComposerText(window: Page, text: string): Promise<void> {
  const composer = window.getByTestId("composer");
  await expect(composer).toBeVisible();
  await composer.fill(text);
  await composer.press("Enter");
}

async function getBrowserToolLabels(window: Page): Promise<string[]> {
  const transcript = await getSelectedTranscript(window);
  return (transcript?.transcript ?? []).flatMap((item) => (item.kind === "tool" ? [item.label] : []));
}

async function expectTranscriptToContainToolLabel(window: Page, label: string): Promise<void> {
  await expect.poll(async () => getBrowserToolLabels(window)).toContain(label);
  await expect(window.getByTestId("transcript")).toContainText(label);
}

async function expectBrowserTitle(window: Page, title: string): Promise<void> {
  await expect(window.getByTestId("browser-panel")).toBeVisible();
  await expect(window.locator(".browser-panel__title")).toContainText(title);
}

test("/browser open opens the visible browser companion and emits browser timeline rows", async () => {
  test.setTimeout(30_000);
  const userDataDir = await makeUserDataDir();
  const workspacePath = await makeGitWorkspace("browser-commands-workspace");
  const harness = await launchDesktop(userDataDir, {
    initialWorkspaces: [workspacePath],
    testMode: "background",
  });

  try {
    const window = await harness.firstWindow();
    await createNamedThread(window, "Browser commands test");

    const openUrl = "data:text/html,<title>Browser%20Command</title><h1>Opened</h1>";

    await submitComposerText(window, `/browser open ${openUrl}`);

    await expectBrowserTitle(window, "Browser Command");
    await expect(window.getByLabel("Browser address")).toHaveValue(openUrl);
    await expectTranscriptToContainToolLabel(window, "Open browser companion");
    await expect(window.getByTestId("transcript")).toContainText(openUrl);
    await expect(window.locator(".timeline-tool").first()).toBeVisible();
    await expect.poll(async () => (await getBrowserToolLabels(window)).length).toBeGreaterThan(0);
  } finally {
    await harness.close();
  }
});

test("browser back, forward, reload, and focus reuse the same visible browser session", async () => {
  test.setTimeout(30_000);
  const userDataDir = await makeUserDataDir();
  const workspacePath = await makeGitWorkspace("browser-nav-commands-workspace");
  const harness = await launchDesktop(userDataDir, {
    initialWorkspaces: [workspacePath],
    testMode: "background",
  });

  try {
    const window = await harness.firstWindow();
    await createNamedThread(window, "Browser nav commands");

    const firstUrl = "data:text/html,<title>Browser%20One</title><h1>One</h1>";
    const secondUrl = "data:text/html,<title>Browser%20Two</title><h1>Two</h1>";

    await submitComposerText(window, `/browser open ${firstUrl}`);
    await expectBrowserTitle(window, "Browser One");

    await submitComposerText(window, `/browser open ${secondUrl}`);
    await expectBrowserTitle(window, "Browser Two");
    await expect(window.getByRole("button", { name: "Back" })).toBeEnabled();

    await window.getByRole("button", { name: "Toggle browser companion" }).click();
    await expect(window.getByTestId("browser-panel")).toHaveCount(0);

    await submitComposerText(window, "/browser focus");
    await expectBrowserTitle(window, "Browser Two");
    await expectTranscriptToContainToolLabel(window, "Focus browser companion");
    await expect(window.getByLabel("Browser address")).toHaveValue(secondUrl);

    await submitComposerText(window, "/browser back");
    await expectBrowserTitle(window, "Browser One");
    await expectTranscriptToContainToolLabel(window, "Go back in browser companion");
    await expect(window.getByRole("button", { name: "Forward" })).toBeEnabled();

    await submitComposerText(window, "/browser forward");
    await expectBrowserTitle(window, "Browser Two");
    await expectTranscriptToContainToolLabel(window, "Go forward in browser companion");

    await submitComposerText(window, "/browser reload");
    await expectBrowserTitle(window, "Browser Two");
    await expectTranscriptToContainToolLabel(window, "Reload browser companion");
    await expect(window.getByLabel("Browser address")).toHaveValue(secondUrl);
  } finally {
    await harness.close();
  }
});

test("common natural-language browser intents route into the same browser command layer", async () => {
  test.setTimeout(30_000);
  const userDataDir = await makeUserDataDir();
  const workspacePath = await makeGitWorkspace("browser-natural-language-workspace");
  const harness = await launchDesktop(userDataDir, {
    initialWorkspaces: [workspacePath],
    testMode: "background",
  });

  try {
    const window = await harness.firstWindow();
    await createNamedThread(window, "Browser NL test");

    const naturalUrl = "data:text/html,<title>Natural%20Language</title><h1>Natural</h1>";

    await submitComposerText(window, `mở ${naturalUrl} bằng browser companion`);
    await expectBrowserTitle(window, "Natural Language");
    await expect(window.getByLabel("Browser address")).toHaveValue(naturalUrl);
    await expectTranscriptToContainToolLabel(window, "Open browser companion");

    await window.getByRole("button", { name: "Toggle browser companion" }).click();
    await expect(window.getByTestId("browser-panel")).toHaveCount(0);

    await submitComposerText(window, "show browser companion");
    await expectBrowserTitle(window, "Natural Language");
    await expectTranscriptToContainToolLabel(window, "Focus browser companion");

    await submitComposerText(window, "reload browser companion");
    await expectBrowserTitle(window, "Natural Language");
    await expectTranscriptToContainToolLabel(window, "Reload browser companion");

    await submitComposerText(window, "show the browser");
    await expect(window.getByTestId("transcript")).toContainText("show the browser");
    await expectBrowserTitle(window, "Natural Language");
  } finally {
    await harness.close();
  }
});
