import type { Meta, StoryObj } from "@storybook/react-vite";
import { ExtensionsSurface } from "../extensions-surface";
import {
  compatibilityFixture,
  noVisibilityOverridesFixture,
  tungdevPiModesExtensionFixture,
} from "./extensions-fixtures";

const meta: Meta<typeof ExtensionsSurface> = {
  title: "Extensions/Inline Surface",
  component: ExtensionsSurface,
  args: {
    extension: tungdevPiModesExtensionFixture,
    compatibilityRecords: compatibilityFixture,
    visibilityOverrides: noVisibilityOverridesFixture,
    onOpenExtensionFolder: () => undefined,
    onToggleExtension: () => undefined,
    onSetSurfaceField: () => undefined,
    onSetVisibilityOverride: () => undefined,
    onClearVisibilityOverride: () => undefined,
  },
};

export default meta;

type Story = StoryObj<typeof ExtensionsSurface>;

export const Default: Story = {};
