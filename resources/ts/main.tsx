import React from 'react';
import ReactDOM from 'react-dom/client';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App';
import theme from './theme';
import { SnackbarProvider } from './contexts/SnackbarContext';
// 実装書 F6: ライブ画面のアニメーション CSS（GPU 合成可能な static class）
import '../css/auction-live.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // 3回リトライ（ネットワークエラー対策）
      retry: 3,
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 10000),
      // 5分間キャッシュを新鮮として扱う
      staleTime: 5 * 60 * 1000,
      // ウィンドウフォーカス時の自動再取得は無効化。
      // ライブ中に 100〜300 名がタブ復帰した瞬間、全クエリが一斉 refetch されて
      // PHP-FPM が枯渇する 502 リスクが現実にある（負荷レビュー C5 指摘）。
      // ライブ画面は WebSocket（Reverb）が状態同期を担うため、フォーカス復帰でも
      // 再取得は不要。WS切断時のみ refetchInterval（useAuctionLive.ts L19-23）で復旧する。
      refetchOnWindowFocus: false,
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
        <SnackbarProvider>
          <App />
        </SnackbarProvider>
      </ThemeProvider>
    </QueryClientProvider>
  </React.StrictMode>,
);

