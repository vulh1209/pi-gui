import type { Meta, StoryObj } from "@storybook/react-vite";
import { ExtensionsView } from "../extensions-view";
import {
  extensionsStoryRuntime,
  extensionsStoryWorkspace,
  tungdevCompatibilityFixture,
  tungdevVisibilityOverridesFixture,
} from "./extensions-fixtures";

const meta: Meta<typeof ExtensionsView> = {
  component: ExtensionsView,
  args: {
    workspace: extensionsStoryWorkspace,
    runtime: extensionsStoryRuntime,
    commandCompatibility: tungdevCompatibilityFixture,
    visibilityOverrides: tungdevVisibilityOverridesFixture,
    onRefresh: () => undefined,
    onOpenExtensionFolder: () => undefined,
    onToggleExtension: () => undefined,
    onSetSurfaceField: () => undefined,
    onSetVisibilityOverride: () => undefined,
    onClearVisibilityOverride: () => undefined,
  },
};

export default meta;

export const Default: StoryObj<typeof ExtensionsView> = {};
