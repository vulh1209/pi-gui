import { expect, test } from "@playwright/test";
import {
  createSessionViaIpc,
  launchDesktop,
  makeUserDataDir,
  makeWorkspace,
  writeProjectExtension,
} from "../helpers/electron-app";

const helperEnvExtensionSource = String.raw`
export default function helperEnvExtension(pi) {
  pi.registerCommand("memory-helper-env", {
    description: "Inspect helper env",
    handler: async (_args, ctx) => {
      ctx.ui.notify(
        JSON.stringify({
          helperPath: process.env.PI_MEMORY_HELPER_PATH ?? null,
          helperArgs: process.env.PI_MEMORY_HELPER_ARGS ?? null,
          resourcesPath: process.resourcesPath ?? null,
        }),
        "info",
      );
    },
  });
}
`;

test("desktop host exposes memory helper env to runtime extensions", async () => {
  test.setTimeout(60_000);
  const userDataDir = await makeUserDataDir();
  const workspacePath = await makeWorkspace("memory-helper-env-workspace");
  await writeProjectExtension(workspacePath, "memory-helper-env.ts", helperEnvExtensionSource);

  const harness = await launchDesktop(userDataDir, {
    initialWorkspaces: [workspacePath],
    testMode: "background",
  });

  try {
    const window = await harness.firstWindow();
    await createSessionViaIpc(window, workspacePath, "Inspect memory helper env");

    const composer = window.getByTestId("composer");
    await composer.fill("/memory-helper-env ");
    await composer.press("Enter");

    await expect(window.locator(".timeline")).toContainText('"helperPath":');
    await expect(window.locator(".timeline")).toContainText('"helperArgs":');
    await expect(window.locator(".timeline")).toContainText("helper-entry");
    await expect(window.locator(".timeline")).toContainText("memory-helper");
  } finally {
    await harness.close();
  }
});
