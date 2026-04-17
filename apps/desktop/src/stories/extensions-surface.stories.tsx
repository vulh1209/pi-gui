import type { Meta, StoryObj } from "@storybook/react-vite";
import { ExtensionsSurface } from "../extensions-surface";
import {
  tungdevCompatibilityFixture,
  tungdevExtensionsFixture,
  tungdevVisibilityOverridesFixture,
} from "./extensions-fixtures";

const extension = tungdevExtensionsFixture[0]!;

const meta: Meta<typeof ExtensionsSurface> = {
  component: ExtensionsSurface,
  args: {
    extension,
    compatibilityRecords: tungdevCompatibilityFixture,
    visibilityOverrides: tungdevVisibilityOverridesFixture,
    onOpenExtensionFolder: () => undefined,
    onToggleExtension: () => undefined,
    onSetSurfaceField: () => undefined,
    onSetVisibilityOverride: () => undefined,
    onClearVisibilityOverride: () => undefined,
  },
};

export default meta;

export const Default: StoryObj<typeof ExtensionsSurface> = {};
