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

test.skip(process.platform !== "darwin", "Desktop extension-surface coverage currently targets macOS.");

test("renders Tungdev pi-mode as a native settings surface in Extensions and updates its mode", async () => {
  test.setTimeout(120_000);

  const userDataDir = await makeUserDataDir("pi-gui-extensions-native-surfaces-");
  const agentDir = `${userDataDir}/agent`;
  const workspacePath = await makeWorkspace("extensions-native-surfaces-workspace");
  await seedAgentDir(agentDir, {
    packages: [PI_EXTENSIONS_SOURCE],
  });

  const harness = await launchDesktop(userDataDir, {
    initialWorkspaces: [workspacePath],
    agentDir,
    testMode: "background",
  });

  try {
    const window = await harness.firstWindow();
    const workspace = await waitForWorkspaceByPath(window, workspacePath);

    await window.getByRole("button", { name: "Extensions", exact: true }).click();
    await expect(window.getByTestId("extensions-surface")).toBeVisible();
    await expect(window.getByTestId("extensions-accordion")).toBeVisible();

    const packageGroup = window.getByRole("button", { name: /@tungthedev\/pi-extensions/i }).first();
    await expect(packageGroup).toHaveAttribute("aria-expanded", "true");

    const piModesRow = window.getByRole("button", { name: /pi-modes/i }).first();
    await expect(piModesRow).toHaveAttribute("aria-expanded", "false");
    await piModesRow.click();
    await expect(piModesRow).toHaveAttribute("aria-expanded", "true");
    const detail = window.locator(".extension-inline-surface");
    await expect(detail).toContainText("Pi Mode");

    await window.getByRole("tab", { name: "Configure", exact: true }).click();
    await expect(detail).toContainText("Pi Mode");
    await expect(detail).toContainText("Mode");
    await expect(detail).toContainText("Inject SYSTEM.md");
    await expect(detail).toContainText("Include Pi prompt section");

    await detail.getByRole("button", { name: "Codex", exact: true }).click();

    await expect
      .poll(() => readPiModeToolSet(window, workspace.id), { timeout: 30_000 })
      .toBe("codex");

    await piModesRow.click();
    await expect(piModesRow).toHaveAttribute("aria-expanded", "false");
    await expect(window.locator(".extension-inline-surface")).toHaveCount(0);

    await piModesRow.click();
    await expect(piModesRow).toHaveAttribute("aria-expanded", "true");
    await expect(window.locator(".extension-inline-surface")).toContainText("Pi Mode");
  } finally {
    await harness.close();
  }
});

test("keeps pi-mode out of chat by default and shows it again after a global chat override", async () => {
  test.setTimeout(120_000);

  const userDataDir = await makeUserDataDir("pi-gui-extensions-visibility-");
  const agentDir = `${userDataDir}/agent`;
  const workspacePath = await makeWorkspace("extensions-visibility-workspace");
  await seedAgentDir(agentDir, {
    packages: [PI_EXTENSIONS_SOURCE],
  });

  const harness = await launchDesktop(userDataDir, {
    initialWorkspaces: [workspacePath],
    agentDir,
    testMode: "background",
  });

  try {
    const window = await harness.firstWindow();
    const workspace = await waitForWorkspaceByPath(window, workspacePath);
    await createSessionViaIpc(window, workspacePath, "Visibility session");
    await selectSession(window, "Visibility session");

    await expect
      .poll(() => hasSessionCommand(window, workspace.id, "pi-mode"), { timeout: 15_000 })
      .toBe(true);

    const composer = window.getByTestId("composer");
    await composer.fill("/pi-mo");
    await expect(window.getByTestId("slash-menu")).toHaveCount(0);

    await window.getByRole("button", { name: "Extensions", exact: true }).click();
    await expect(window.getByTestId("extensions-surface")).toBeVisible();
    const piModesRow = window.getByRole("button", { name: /pi-modes/i }).first();
    await piModesRow.click();
    await window.getByRole("tab", { name: "Commands", exact: true }).click();

    const detail = window.locator(".extension-inline-surface");
    await expect(detail).toContainText("/pi-mode");
    const piModeCommand = detail.locator(".skill-detail__meta-label", { hasText: "/pi-mode" }).locator("xpath=..");
    await piModeCommand.getByRole("button", { name: "Chat", exact: true }).click();

    await expect
      .poll(() => readPiModeVisibilityOverride(window), { timeout: 30_000 })
      .toEqual({
        commandName: "pi-mode",
        visibility: "chat",
      });

    await window.getByRole("button", { name: "Back to app", exact: true }).click();
    await expect(composer).toBeVisible();
    await composer.fill("/pi-mo");
    await expect(window.getByTestId("slash-menu")).toContainText("pi-mode");
  } finally {
    await harness.close();
  }
});

async function readPiModeToolSet(window: Parameters<typeof getDesktopState>[0], workspaceId: string): Promise<string | null> {
  const state = await getDesktopState(window);
  const extension = state.runtimeByWorkspace[workspaceId]?.extensions.find((entry) =>
    entry.path.includes("/@tungthedev/pi-extensions/") &&
    (entry.path.endsWith("/extensions/settings/index.ts") || entry.path.endsWith("/extensions/pi-modes.ts")),
  );
  const surface = extension?.surfaces.find((entry) => entry.id === "pi-mode-settings");
  const field = surface?.fields.find((entry) => entry.key === "toolSet");
  return field?.kind === "enum" ? field.value : null;
}

async function hasSessionCommand(
  window: Parameters<typeof getDesktopState>[0],
  workspaceId: string,
  commandName: string,
): Promise<boolean> {
  const state = await getDesktopState(window);
  const workspace = state.workspaces.find((entry) => entry.id === workspaceId);
  const sessionId = workspace?.sessions.find((entry) => entry.title === "Visibility session")?.id;
  if (!sessionId) {
    return false;
  }
  return state.sessionCommandsBySession[`${workspaceId}:${sessionId}`]?.some((entry) => entry.name === commandName) ?? false;
}

async function readPiModeVisibilityOverride(
  window: Parameters<typeof getDesktopState>[0],
): Promise<{ commandName: string; visibility: string } | null> {
  const state = await getDesktopState(window);
  const override = state.extensionCommandVisibilityOverrides.find((entry) => entry.commandName === "pi-mode");
  return override ? { commandName: override.commandName, visibility: override.visibility } : null;
}
