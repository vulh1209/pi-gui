import type { StorybookConfig } from "@storybook/react-vite";
import path from "node:path";
import { fileURLToPath } from "node:url";
import tsconfigPaths from "vite-tsconfig-paths";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const config: StorybookConfig = {
  framework: "@storybook/react-vite",
  stories: ["../src/**/*.stories.@(ts|tsx)"],
  addons: [],
  viteFinal: async (config) => ({
    ...config,
    plugins: [
      ...(config.plugins ?? []),
      tsconfigPaths({ projects: [path.resolve(__dirname, "../tsconfig.paths.json")] }),
    ],
  }),
};

export default config;
