import type { StorybookConfig } from '@storybook/react-vite';
import path from 'path';

const config: StorybookConfig = {
  "stories": [
    "../resources/ts/**/*.mdx",
    "../resources/ts/**/*.stories.@(js|jsx|mjs|ts|tsx)"
  ],
  "addons": [
    "@chromatic-com/storybook",
    "@storybook/addon-vitest",
    "@storybook/addon-a11y",
    "@storybook/addon-docs",
    "@storybook/addon-onboarding"
  ],
  "framework": "@storybook/react-vite",
  "viteFinalConfig": async (config) => {
    config.resolve = config.resolve ?? {};
    config.resolve.alias = {
      ...(config.resolve.alias ?? {}),
      '@': path.resolve(__dirname, '../resources/ts'),
    };
    return config;
  },
};
export default config;