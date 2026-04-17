import { expect, test } from "@playwright/test";
import {
  createNamedThread,
  getRealAuthConfig,
  launchDesktop,
  makeUserDataDir,
  makeWorkspace,
} from "../helpers/electron-app";

test("renders grouped tool calls that expand and collapse from the transcript", async () => {
  test.setTimeout(180_000);
  const realAuth = getRealAuthConfig();
  test.skip(!realAuth.enabled, realAuth.skipReason);

  const userDataDir = await makeUserDataDir();
  const workspacePath = await makeWorkspace("tool-call-workspace");
  const harness = await launchDesktop(userDataDir, {
    initialWorkspaces: [workspacePath],
    testMode: "background",
    realAuthSourceDir: realAuth.sourceDir,
  });

  try {
    const window = await harness.firstWindow();
    await createNamedThread(window, "Tool test");

    const composer = window.getByTestId("composer");
    await composer.fill("Use your bash or shell tool to run `pwd` before answering. After the tool finishes, reply with exactly TOOL_OK.");
    await composer.press("Enter");

    await expect(window.getByTestId("transcript")).toContainText("TOOL_OK", { timeout: 150_000 });
    await expect
      .poll(async () => window.getByTestId("timeline-tool-group").count(), { timeout: 120_000 })
      .toBeGreaterThan(0);

    const toolGroup = window.getByTestId("timeline-tool-group").first();
    const toolGroupHeader = toolGroup.getByTestId("timeline-tool-group-toggle");
    await expect(toolGroupHeader).toHaveAttribute("aria-expanded", "false");

    await toolGroupHeader.click();
    await expect(toolGroupHeader).toHaveAttribute("aria-expanded", "true");

    const toolItem = toolGroup.locator(".timeline-tool").first();
    const toolHeader = toolItem.locator(".timeline-tool__header");
    await expect(toolHeader).toHaveAttribute("aria-expanded", "false");

    await toolHeader.click();
    await expect(toolHeader).toHaveAttribute("aria-expanded", "true");
    await expect(toolItem.locator(".timeline-tool__body")).toBeVisible();
    await expect(toolItem.locator(".timeline-tool__pre")).not.toHaveText("");

    await toolHeader.click();
    await expect(toolHeader).toHaveAttribute("aria-expanded", "false");
    await expect(toolItem.locator(".timeline-tool__body")).toHaveCount(0);

    await toolGroupHeader.click();
    await expect(toolGroupHeader).toHaveAttribute("aria-expanded", "false");
    await expect(toolGroup.locator(".timeline-tool")).toHaveCount(0);
  } finally {
    await harness.close();
  }
});
