import type { Meta, StoryObj } from "@storybook/react-vite";
import { ExtensionsView } from "../extensions-view";
import {
  compatibilityFixture,
  noVisibilityOverridesFixture,
  runtimeFixture,
  workspaceFixture,
  chatVisibilityOverrideFixture,
} from "./extensions-fixtures";

const meta: Meta<typeof ExtensionsView> = {
  title: "Extensions/Accordion Page",
  component: ExtensionsView,
  args: {
    workspace: workspaceFixture,
    runtime: runtimeFixture,
    commandCompatibility: compatibilityFixture,
    visibilityOverrides: noVisibilityOverridesFixture,
    onRefresh: () => undefined,
    onOpenExtensionFolder: () => undefined,
    onToggleExtension: () => undefined,
    onSetSurfaceField: () => undefined,
    onSetVisibilityOverride: () => undefined,
    onClearVisibilityOverride: () => undefined,
  },
};

export default meta;

type Story = StoryObj<typeof ExtensionsView>;

export const Default: Story = {};

export const ChatOverrideActive: Story = {
  args: {
    visibilityOverrides: chatVisibilityOverrideFixture,
  },
};
