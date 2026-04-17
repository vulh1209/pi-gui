import { app } from "electron";
import installExtension, { REACT_DEVELOPER_TOOLS } from "electron-devtools-installer";

export async function installDesktopDevtoolsIfPossible(): Promise<void> {
  if (app.isPackaged) {
    return;
  }

  try {
    await installExtension([REACT_DEVELOPER_TOOLS], {
      loadExtensionOptions: {
        allowFileAccess: true,
      },
    });
  } catch (error) {
    console.warn(
      `[pi-gui] Failed to install React DevTools: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}
