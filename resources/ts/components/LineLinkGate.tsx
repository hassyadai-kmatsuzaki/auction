import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import {
  Dialog,
  DialogContent,
  DialogActions,
  Box,
  Typography,
  Button,
  IconButton,
  CircularProgress,
} from '@mui/material';
import { Close as CloseIcon } from '@mui/icons-material';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import { useBlockingGate } from '../contexts/BlockingGateContext';
import { lineApi } from '../api/line/lineApi';

interface Props {
  children: React.ReactNode;
}

// LineConnectionCard と同じキーを使い、連携状態のキャッシュを共有する。
const LINE_STATUS_KEY = ['line-status'] as const;

/**
 * LINE 未連携ユーザーに連携を促すポップアップを表示するゲート。
 * - 未連携の間はページ遷移のたびに再表示する（同一ページ内では「あとで」「×」で閉じられる）。
 * - ライブオークション画面（/live 配下）では表示しない（操作・負荷に影響を出さないため）。
 * - 連携が完了すると status.linked=true になり自動的に出なくなる。
 */
export default function LineLinkGate({ children }: Props) {
  const { user } = useAuth();
  const { isBlocking } = useBlockingGate();
  const location = useLocation();
  const [open, setOpen] = useState(false);

  const isLivePage = location.pathname.includes('/live');

  // ログイン中のみ連携状態を取得する。
  const { data: status } = useQuery({
    queryKey: LINE_STATUS_KEY,
    queryFn: lineApi.getStatus,
    enabled: !!user,
    staleTime: 60_000,
  });

  // 「未連携」かつ「ライブ画面以外」かつ「他の必須ゲート非表示」で表示対象。
  // 必須ゲート（サブスク登録・配送先住所）が出ている間は重ねて表示しない。
  const shouldShow = !!user && !!status && !status.linked && !isLivePage && !isBlocking;

  // ページ遷移（pathname 変化）のたびに再評価して再表示する。
  // shouldShow が false になれば（連携完了・ライブ画面）閉じる。
  useEffect(() => {
    setOpen(shouldShow);
  }, [location.pathname, shouldShow]);

  const linkMutation = useMutation({
    mutationFn: async () => {
      // 連携後に元のページへ戻れるよう、現在のパスを return_to に渡す。
      const url = await lineApi.getRedirectUrl(location.pathname + location.search);
      window.location.href = url;
    },
  });

  return (
    <>
      {children}
      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="xs">
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', pt: 1, pr: 1 }}>
          <IconButton onClick={() => setOpen(false)} size="small" aria-label="閉じる">
            <CloseIcon />
          </IconButton>
        </Box>
        <DialogContent sx={{ pt: 0, textAlign: 'center' }}>
          <Box
            component="img"
            src="https://upload.wikimedia.org/wikipedia/commons/4/41/LINE_logo.svg"
            alt="LINE"
            sx={{ width: 56, height: 56, mb: 1.5 }}
          />
          <Typography variant="h6" fontWeight="bold" gutterBottom>
            LINE連携のお願い
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            落札通知やオークション開始通知をLINEで受け取るには、LINE連携が必要です。
            <br />
            連携がお済みでないと重要なお知らせを見逃す可能性があります。
          </Typography>
        </DialogContent>
        <DialogActions sx={{ flexDirection: 'column', gap: 1, px: 3, pb: 3 }}>
          <Button
            fullWidth
            variant="contained"
            onClick={() => linkMutation.mutate()}
            disabled={linkMutation.isPending}
            sx={{ bgcolor: '#06C755', '&:hover': { bgcolor: '#05B04C' } }}
          >
            {linkMutation.isPending ? <CircularProgress size={20} color="inherit" /> : 'LINEと連携する'}
          </Button>
          <Button fullWidth color="inherit" onClick={() => setOpen(false)}>
            あとで
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
