import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Button, CircularProgress, Box } from '@mui/material';
import { PlayArrow as PlayArrowIcon, Pause as PauseIcon, Timer as TimerIcon } from '@mui/icons-material';

interface Props {
  myBidStatus: 'active' | 'inactive' | null;
  isPreBid: boolean;
  isFreeze?: boolean;
  freezeRemainingSeconds?: number;
  freezeTotalSeconds?: number;
  isLoading: boolean;
  isTopBidder?: boolean;
  activeBidderCount?: number;
  onToggle: () => void;
}

/**
 * フリーズ中ボタン
 * freezeTotalSeconds の時間でちょうど円が埋まるシームレスな円形ローディングをボタン内に表示
 */
const FreezeButton = React.memo(({ freezeRemainingSeconds = 0, freezeTotalSeconds = 1 }: {
  freezeRemainingSeconds?: number;
  freezeTotalSeconds?: number;
}) => {
  const total = freezeTotalSeconds || 1;
  const animRef = useRef<number>(0);
  const startRef = useRef<{ time: number; remaining: number } | null>(null);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const remaining = freezeRemainingSeconds ?? 0;
    startRef.current = { time: performance.now(), remaining };

    const tick = () => {
      if (!startRef.current) return;
      const elapsed = (performance.now() - startRef.current.time) / 1000;
      const currentRemaining = Math.max(0, startRef.current.remaining - elapsed);
      const pct = ((total - currentRemaining) / total) * 100;
      setProgress(Math.min(100, Math.max(0, pct)));
      if (currentRemaining > 0) {
        animRef.current = requestAnimationFrame(tick);
      }
    };

    animRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animRef.current);
  }, [freezeRemainingSeconds, total]);

  const progressIcon = (
    <Box sx={{ position: 'relative', display: 'inline-flex', width: 20, height: 20 }}>
      <CircularProgress
        variant="determinate"
        value={100}
        size={20}
        thickness={4}
        sx={{ color: 'grey.400', position: 'absolute' }}
      />
      <CircularProgress
        variant="determinate"
        value={progress}
        size={20}
        thickness={4}
        sx={{ color: 'warning.main', transition: 'none' }}
      />
    </Box>
  );

  return (
    <Button
      fullWidth variant="contained" size="large" disabled
      startIcon={progressIcon}
      sx={{
        bgcolor: 'grey.300', color: 'grey.600',
        '&.Mui-disabled': { bgcolor: 'grey.200', color: 'grey.500' },
        py: 1.5,
      }}
    >
      入札準備中...
    </Button>
  );
});
FreezeButton.displayName = 'FreezeButton';

/**
 * 入札ボタン（単方向入札仕様）
 * - 押す = 入札参加。OFF/離脱動線は廃止
 * - 自分が active になった以降は disabled（落札権利者でも非権利者でも自分から降りられない）
 * - pre_bid / freeze フェーズ中は無効化
 */
export const BidButton = React.memo(({ myBidStatus, isPreBid, isFreeze, freezeRemainingSeconds, freezeTotalSeconds, isLoading, isTopBidder, activeBidderCount, onToggle }: Props) => {
  if (isPreBid) {
    return (
      <Button fullWidth variant="outlined" color="inherit" size="large" disabled startIcon={<TimerIcon />}>
        入札準備中...
      </Button>
    );
  }

  if (isFreeze) {
    return (
      <FreezeButton
        freezeRemainingSeconds={freezeRemainingSeconds}
        freezeTotalSeconds={freezeTotalSeconds}
      />
    );
  }

  const isActive = myBidStatus === 'active';
  // active 中は単方向仕様で押せない。「最高入札者」は表示ラベルの出し分けのみに使う
  const isOnlyBidder = isActive && activeBidderCount === 1;

  // 実装書 F3: クリック throttle + inflight ガード（連打防止 = サーバー負荷軽減）
  // 25 名同時クリック時、ローカル側で 800ms 内の再 click を破棄するだけで、
  // 実際にサーバーまで届くリクエストを 1 ユーザーあたり 1 件に絞れる
  const lastClickRef = useRef<number>(0);
  const inflightRef = useRef<boolean>(false);
  const handleClickThrottled = useCallback(() => {
    const now = Date.now();
    if (now - lastClickRef.current < 800) return; // 800ms 以内の連打を破棄
    if (inflightRef.current) return;               // API 呼び出し中は弾く
    lastClickRef.current = now;
    inflightRef.current = true;
    try {
      onToggle();
    } finally {
      // 600ms 後に再有効化（楽観的更新が反映される時間）
      setTimeout(() => { inflightRef.current = false; }, 600);
    }
  }, [onToggle]);

  if (isActive) {
    // 実装書 F2/F6: 動的 sx animation を static CSS class に切替
    // GPU 合成可能なため 25 枚並んでも 60fps 維持
    return (
      <Button
        fullWidth
        variant="contained"
        size="large"
        disabled={true}
        className={isOnlyBidder ? 'bid-btn-only' : 'bid-btn-active'}
        startIcon={
          isLoading
            ? <CircularProgress size={20} color="inherit" />
            : <PauseIcon />
        }
        sx={{
          position: 'relative',
          overflow: 'hidden',
          fontWeight: 800,
          fontSize: '1rem',
          letterSpacing: '0.03em',
          border: '1px solid rgba(255, 215, 0, 0.6)',
          '&.Mui-disabled': {
            color: '#5D3A00',
            opacity: 0.85,
          },
        }}
      >
        {isOnlyBidder ? '最高入札者' : '入札中'}
      </Button>
    );
  }

  return (
    <Button
      fullWidth
      variant="outlined"
      color="primary"
      size="large"
      onClick={handleClickThrottled}
      disabled={isLoading}
      startIcon={
        isLoading
          ? <CircularProgress size={20} color="inherit" />
          : <PlayArrowIcon />
      }
    >
      入札する
    </Button>
  );
});

BidButton.displayName = 'BidButton';
