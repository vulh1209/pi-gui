import { expect, test, type Page } from "@playwright/test";
import {
  createNamedThread,
  desktopShortcut,
  getSelectedTranscript,
  launchDesktop,
  makeGitWorkspace,
  makeUserDataDir,
} from "../helpers/electron-app";

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

async function approveBrowserAutomation(window: Page): Promise<void> {
  await expect(window.getByTestId("browser-automation-dialog")).toBeVisible();
  await window.getByRole("button", { name: "Allow once" }).click();
}

function interactiveBrowserPageUrl(): string {
  const html = `
    <!doctype html>
    <html>
      <head>
        <title>Interactive Ready</title>
        <style>body{height:2400px;font-family:sans-serif;padding:24px} form,select,button,input{display:block;margin:16px 0}</style>
      </head>
      <body>
        <input id="name" placeholder="Name" />
        <button id="clicker" type="button">Click me</button>
        <form id="demo-form">
          <input id="email" name="email" value="" />
          <button id="submitter" type="submit">Submit</button>
        </form>
        <select id="flavor">
          <option value="vanilla">Vanilla</option>
          <option value="chocolate">Chocolate</option>
        </select>
        <script>
          const setTitle = (value) => { document.title = value; };
          document.querySelector('#name')?.addEventListener('input', (event) => setTitle('Typed:' + event.target.value));
          document.querySelector('#email')?.addEventListener('input', (event) => setTitle('Typed:' + event.target.value));
          document.querySelector('#clicker')?.addEventListener('click', () => setTitle('Clicked'));
          document.querySelector('#demo-form')?.addEventListener('submit', (event) => {
            event.preventDefault();
            setTitle('Submitted:' + document.querySelector('#email').value);
          });
          document.querySelector('#flavor')?.addEventListener('change', (event) => setTitle('Selected:' + event.target.value));
          let scrollTick;
          window.addEventListener('scroll', () => {
            window.clearTimeout(scrollTick);
            scrollTick = window.setTimeout(() => setTitle('Scrolled'), 25);
          });
        </script>
      </body>
    </html>
  `;
  return `data:text/html,${encodeURIComponent(html)}`;
}

function googleLikeSearchPageUrl(): string {
  const html = `
    <!doctype html>
    <html>
      <head>
        <title>Search Home</title>
        <style>
          body { font-family: sans-serif; padding: 32px; }
          form { display: flex; gap: 12px; align-items: center; }
          input { width: 320px; padding: 8px 12px; }
          button { padding: 8px 12px; }
        </style>
      </head>
      <body>
        <h1>Search</h1>
        <form id="search-form">
          <input id="search-box" name="q" type="search" autocomplete="off" />
          <button id="search-submit" type="submit">Search</button>
        </form>
        <script>
          const input = document.querySelector('#search-box');
          const form = document.querySelector('#search-form');
          input?.addEventListener('input', (event) => {
            document.title = 'Typed:' + event.target.value;
          });
          form?.addEventListener('submit', (event) => {
            event.preventDefault();
            document.title = 'Results:' + input.value;
          });
        </script>
      </body>
    </html>
  `;
  return `data:text/html,${encodeURIComponent(html)}`;
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

test("browser-first routing preference prioritizes the browser companion for web-style requests", async () => {
  test.setTimeout(30_000);
  const userDataDir = await makeUserDataDir();
  const workspacePath = await makeGitWorkspace("browser-routing-preference-workspace");
  const harness = await launchDesktop(userDataDir, {
    initialWorkspaces: [workspacePath],
    testMode: "background",
  });

  try {
    const window = await harness.firstWindow();
    await createNamedThread(window, "Browser routing preference test");

    const preferenceUrl = "data:text/html,<title>Browser%20Preference</title><h1>Preferred</h1>";

    await submitComposerText(window, `open ${preferenceUrl}`);
    await expect(window.getByTestId("transcript")).toContainText(`open ${preferenceUrl}`);
    await expect(window.getByTestId("browser-panel")).toHaveCount(0);

    await window.keyboard.press(desktopShortcut(","));
    await window.getByRole("button", { name: "Prefer browser companion" }).click();
    await window.getByRole("button", { name: "Back" }).click();

    await submitComposerText(window, `open ${preferenceUrl}`);
    await expectBrowserTitle(window, "Browser Preference");
    await expectTranscriptToContainToolLabel(window, "Open browser companion");
  } finally {
    await harness.close();
  }
});

test("natural-language browser search opens a search page, types a query, and submits through browser actions", async () => {
  test.setTimeout(30_000);
  const userDataDir = await makeUserDataDir();
  const workspacePath = await makeGitWorkspace("browser-natural-language-search-workspace");
  const harness = await launchDesktop(userDataDir, {
    initialWorkspaces: [workspacePath],
    testMode: "background",
  });

  try {
    const window = await harness.firstWindow();
    await createNamedThread(window, "Browser NL search test");

    const searchUrl = googleLikeSearchPageUrl();
    const query = "browser companion flow";

    await submitComposerText(window, `open ${searchUrl} and search for ${query}`);
    await approveBrowserAutomation(window);
    await approveBrowserAutomation(window);

    await expectBrowserTitle(window, `Results:${query}`);
    await expect(window.getByLabel("Browser address")).toHaveValue(searchUrl);
    await expectTranscriptToContainToolLabel(window, "Open browser companion");
    await expectTranscriptToContainToolLabel(window, "Type in browser companion element");
    await expectTranscriptToContainToolLabel(window, "Submit browser companion form");
  } finally {
    await harness.close();
  }
});

test("interactive browser commands ask for approval and act on the visible browser session", async () => {
  test.setTimeout(30_000);
  const userDataDir = await makeUserDataDir();
  const workspacePath = await makeGitWorkspace("browser-interactive-workspace");
  const harness = await launchDesktop(userDataDir, {
    initialWorkspaces: [workspacePath],
    testMode: "background",
  });

  try {
    const window = await harness.firstWindow();
    await createNamedThread(window, "Browser interactive test");

    await submitComposerText(window, `/browser open ${interactiveBrowserPageUrl()}`);
    await expectBrowserTitle(window, "Interactive Ready");

    await submitComposerText(window, `/browser type "#name" "Ava"`);
    await approveBrowserAutomation(window);
    await expectBrowserTitle(window, "Typed:Ava");
    await expectTranscriptToContainToolLabel(window, "Type in browser companion element");

    await submitComposerText(window, `/browser click "#clicker"`);
    await approveBrowserAutomation(window);
    await expectBrowserTitle(window, "Clicked");
    await expectTranscriptToContainToolLabel(window, "Click browser companion element");

    await submitComposerText(window, `/browser select "#flavor" "chocolate"`);
    await approveBrowserAutomation(window);
    await expectBrowserTitle(window, "Selected:chocolate");
    await expectTranscriptToContainToolLabel(window, "Select browser companion option");

    await submitComposerText(window, `/browser type "#email" "qa@example.com"`);
    await approveBrowserAutomation(window);
    await expectBrowserTitle(window, "Typed:qa@example.com");

    await submitComposerText(window, `/browser submit "#demo-form"`);
    await approveBrowserAutomation(window);
    await expectBrowserTitle(window, "Submitted:qa@example.com");
    await expectTranscriptToContainToolLabel(window, "Submit browser companion form");

    await submitComposerText(window, "/browser scroll down");
    await approveBrowserAutomation(window);
    await expectBrowserTitle(window, "Scrolled");
    await expectTranscriptToContainToolLabel(window, "Scroll browser companion page");
  } finally {
    await harness.close();
  }
});

test("allow full automation skips interactive browser approval prompts", async () => {
  test.setTimeout(30_000);
  const userDataDir = await makeUserDataDir();
  const workspacePath = await makeGitWorkspace("browser-interactive-policy-workspace");
  const harness = await launchDesktop(userDataDir, {
    initialWorkspaces: [workspacePath],
    testMode: "background",
  });

  try {
    const window = await harness.firstWindow();
    await createNamedThread(window, "Browser interactive policy test");

    await window.keyboard.press(desktopShortcut(","));
    await window.getByRole("button", { name: "Allow full automation" }).click();
    await window.getByRole("button", { name: "Back" }).click();

    await submitComposerText(window, `/browser open ${interactiveBrowserPageUrl()}`);
    await expectBrowserTitle(window, "Interactive Ready");

    await submitComposerText(window, `/browser click "#clicker"`);
    await expect(window.getByTestId("browser-automation-dialog")).toHaveCount(0);
    await expectBrowserTitle(window, "Clicked");
  } finally {
    await harness.close();
  }
});
