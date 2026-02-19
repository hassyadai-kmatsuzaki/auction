import type { Preview } from '@storybook/react-vite';
import React from 'react';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import theme from '../resources/ts/theme';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false, staleTime: Infinity } },
});

const preview: Preview = {
  decorators: [
    (Story) => (
      <QueryClientProvider client={queryClient}>
        <ThemeProvider theme={theme}>
          <CssBaseline />
          <Story />
        </ThemeProvider>
      </QueryClientProvider>
    ),
  ],
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    backgrounds: {
      default: 'light',
      values: [
        { name: 'light', value: '#F8FAFC' },
        { name: 'dark', value: '#0F172A' },
        { name: 'white', value: '#FFFFFF' },
      ],
    },
    a11y: { test: 'todo' },
  },
};

export default preview;
