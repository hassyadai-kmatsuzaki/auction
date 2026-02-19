import React from 'react';
import ReactDOM from 'react-dom/client';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App';
import theme from './theme';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // 3回リトライ（ネットワークエラー対策）
      retry: 3,
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 10000),
      // 5分間キャッシュを新鮮として扱う
      staleTime: 5 * 60 * 1000,
      // ウィンドウフォーカス時に自動再取得（タブを戻ったときに状態を同期）
      refetchOnWindowFocus: true,
    },
    mutations: {
      retry: 1,
    },
  },
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <App />
      </ThemeProvider>
    </QueryClientProvider>
  </React.StrictMode>,
);

