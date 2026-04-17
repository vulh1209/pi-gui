import type { StorybookConfig } from "@storybook/react-vite";
import tsconfigPaths from "vite-tsconfig-paths";

const config: StorybookConfig = {
  framework: {
    name: "@storybook/react-vite",
    options: {},
  },
  stories: ["../src/**/*.stories.@(ts|tsx)"],
  addons: [],
  viteFinal: async (config) => {
    config.plugins = [...(config.plugins ?? []), tsconfigPaths({ projects: ["./tsconfig.paths.json"] })];
    return config;
  },
};

export default config;
