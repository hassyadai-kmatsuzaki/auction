import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  IconButton,
  LinearProgress,
  useMediaQuery,
  useTheme,
  Collapse,
} from '@mui/material';
import {
  NavigateNext as NextIcon,
  NavigateBefore as PrevIcon,
  Close as CloseIcon,
  TouchApp as TouchAppIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
} from '@mui/icons-material';

export interface TourStep {
  targetRef: React.RefObject<HTMLElement | null>;
  title: string;
  description: string;
  placement?: 'top' | 'bottom' | 'left' | 'right';
  /** 「次へ」ボタンを押したとき自動実行するアクション */
  autoAction?: () => void;
  /** 「次へ」ボタンの代わりに表示するテキスト（ユーザー操作待ちの場合） */
  waitForAction?: string;
  /** autoAction 実行後にポップオーバー表示するまでの遅延(ms) */
  autoActionDelay?: number;
  /** autoActionのボタンラベル（デフォルト: "実行"） */
  autoActionLabel?: string;
}

interface Props {
  steps: TourStep[];
  activeStep: number;
  onNext: () => void;
  onPrev: () => void;
  onClose: () => void;
  onReset: () => void;
  /** 自動アクション実行中かどうか */
  isAutoPlaying?: boolean;
  /** autoActionの実行ボタンが押された時 */
  onExecuteAction?: () => void;
}

const POPOVER_WIDTH = 340;
const POPOVER_GAP = 16;
const SPOTLIGHT_PADDING = 8;
const MOBILE_FOOTER_HEIGHT = 200;
const SWIPE_THRESHOLD = 50;

export const DemoTourPopover: React.FC<Props> = ({
  steps,
  activeStep,
  onNext,
  onPrev,
  onClose,
  onReset,
  isAutoPlaying = false,
  onExecuteAction,
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isLandscape = useMediaQuery('(orientation: landscape) and (max-height: 500px)');

  const [position, setPosition] = useState<{
    top: number;
    left: number;
    arrowSide: 'top' | 'bottom' | 'left' | 'right';
    spotlightRect: DOMRect | null;
  }>({ top: 0, left: 0, arrowSide: 'top', spotlightRect: null });
  const popoverRef = useRef<HTMLDivElement>(null);
  const step = steps[activeStep];
  const isLastStep = activeStep === steps.length - 1;

  // SP: 説明文展開/折りたたみ
  const [expanded, setExpanded] = useState(false);
  // SP: ステップ切替時のフェードキー
  const [fadeKey, setFadeKey] = useState(0);
  // SP: スワイプ検知
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);

  // ステップ変更時にフェードアニメーションをリセット & 説明文を折りたたむ
  useEffect(() => {
    setFadeKey(prev => prev + 1);
    setExpanded(false);
  }, [activeStep]);

  // waitForAction時: ターゲット要素とその親をオーバーレイ(z-index:1400)の上に持ち上げる
  useEffect(() => {
    if (!step?.waitForAction || !step.targetRef.current) return;
    const el = step.targetRef.current;
    const parent = el.parentElement;

    const saved: { node: HTMLElement; zIndex: string; position: string }[] = [];
    const raise = (node: HTMLElement) => {
      saved.push({ node, zIndex: node.style.zIndex, position: node.style.position });
      node.style.zIndex = '1401';
      if (!node.style.position || node.style.position === 'static') {
        node.style.position = 'relative';
      }
    };
    raise(el);
    if (parent && parent !== document.body) raise(parent);

    return () => {
      saved.forEach(({ node, zIndex, position }) => {
        node.style.zIndex = zIndex;
        node.style.position = position;
      });
    };
  }, [step, activeStep]);

  const calculatePosition = useCallback(() => {
    if (!step?.targetRef?.current) {
      setPosition({
        top: window.innerHeight / 2 - 100,
        left: window.innerWidth / 2 - POPOVER_WIDTH / 2,
        arrowSide: 'top',
        spotlightRect: null,
      });
      return;
    }

    const targetRect = step.targetRef.current.getBoundingClientRect();

    if (isMobile) {
      setPosition({ top: 0, left: 0, arrowSide: 'top', spotlightRect: targetRect });
      return;
    }

    const popoverHeight = popoverRef.current?.offsetHeight || 200;
    const placement = step.placement || 'bottom';

    let top = 0;
    let left = 0;
    let arrowSide: 'top' | 'bottom' | 'left' | 'right' = 'top';

    switch (placement) {
      case 'bottom':
        top = targetRect.bottom + POPOVER_GAP;
        left = targetRect.left + targetRect.width / 2 - POPOVER_WIDTH / 2;
        arrowSide = 'top';
        if (top + popoverHeight > window.innerHeight - 20) {
          top = targetRect.top - popoverHeight - POPOVER_GAP;
          arrowSide = 'bottom';
        }
        break;
      case 'top':
        top = targetRect.top - popoverHeight - POPOVER_GAP;
        left = targetRect.left + targetRect.width / 2 - POPOVER_WIDTH / 2;
        arrowSide = 'bottom';
        if (top < 20) {
          top = targetRect.bottom + POPOVER_GAP;
          arrowSide = 'top';
        }
        break;
      case 'right':
        top = targetRect.top + targetRect.height / 2 - popoverHeight / 2;
        left = targetRect.right + POPOVER_GAP;
        arrowSide = 'left';
        if (left + POPOVER_WIDTH > window.innerWidth - 20) {
          left = targetRect.left - POPOVER_WIDTH - POPOVER_GAP;
          arrowSide = 'right';
        }
        break;
      case 'left':
        top = targetRect.top + targetRect.height / 2 - popoverHeight / 2;
        left = targetRect.left - POPOVER_WIDTH - POPOVER_GAP;
        arrowSide = 'right';
        if (left < 20) {
          left = targetRect.right + POPOVER_GAP;
          arrowSide = 'left';
        }
        break;
    }

    left = Math.max(12, Math.min(left, window.innerWidth - POPOVER_WIDTH - 12));
    top = Math.max(12, Math.min(top, window.innerHeight - popoverHeight - 12));

    setPosition({ top, left, arrowSide, spotlightRect: targetRect });
  }, [step, isMobile]);

  useEffect(() => {
    calculatePosition();
    const handleResize = () => calculatePosition();
    window.addEventListener('resize', handleResize);
    window.addEventListener('scroll', handleResize, true);
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('scroll', handleResize, true);
    };
  }, [calculatePosition, activeStep]);

  useEffect(() => {
    if (step?.targetRef?.current) {
      if (isMobile) {
        const rect = step.targetRef.current.getBoundingClientRect();
        const visibleBottom = window.innerHeight - MOBILE_FOOTER_HEIGHT;
        if (rect.bottom > visibleBottom || rect.top < 0) {
          const scrollTarget = window.scrollY + rect.top - 80;
          window.scrollTo({ top: Math.max(0, scrollTarget), behavior: 'smooth' });
        }
      } else {
        step.targetRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      const timer = setTimeout(calculatePosition, 350);
      return () => clearTimeout(timer);
    }
  }, [activeStep, step, calculatePosition, isMobile]);

  // スワイプハンドラー
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  }, []);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (isAutoPlaying) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    const dy = e.changedTouches[0].clientY - touchStartY.current;
    // 水平方向のスワイプのみ検知（垂直方向の動きが小さい場合）
    if (Math.abs(dx) > SWIPE_THRESHOLD && Math.abs(dy) < Math.abs(dx) * 0.7) {
      if (dx < 0 && !isLastStep && !step.waitForAction) {
        onNext(); // 左スワイプ → 次へ
      } else if (dx > 0 && activeStep > 0) {
        onPrev(); // 右スワイプ → 前へ
      }
    }
  }, [isAutoPlaying, isLastStep, step, activeStep, onNext, onPrev]);

  if (!step) return null;

  const { spotlightRect } = position;
  const progressValue = ((activeStep + 1) / steps.length) * 100;

  // ── 共通: スポットライトバックドロップ ──
  const spotlightBackdrop = (
    <>
      {/* Visual overlay (dark mask with spotlight cutout) */}
      <Box
        sx={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 1400,
          pointerEvents: 'none',
        }}
      >
        <svg
          width="100%"
          height="100%"
          style={{ position: 'absolute', top: 0, left: 0 }}
        >
          <defs>
            <mask id="demo-spotlight-mask">
              <rect width="100%" height="100%" fill="white" />
              {spotlightRect && (
                <rect
                  x={spotlightRect.left - SPOTLIGHT_PADDING}
                  y={spotlightRect.top - SPOTLIGHT_PADDING}
                  width={spotlightRect.width + SPOTLIGHT_PADDING * 2}
                  height={spotlightRect.height + SPOTLIGHT_PADDING * 2}
                  rx={12}
                  fill="black"
                />
              )}
            </mask>
          </defs>
          <rect
            width="100%"
            height="100%"
            fill="rgba(0,0,0,0.55)"
            mask="url(#demo-spotlight-mask)"
          />
        </svg>

        {spotlightRect && (
          <Box
            sx={{
              position: 'absolute',
              top: spotlightRect.top - SPOTLIGHT_PADDING,
              left: spotlightRect.left - SPOTLIGHT_PADDING,
              width: spotlightRect.width + SPOTLIGHT_PADDING * 2,
              height: spotlightRect.height + SPOTLIGHT_PADDING * 2,
              borderRadius: '12px',
              pointerEvents: 'none',
              // waitForAction時: ゴールドの強いパルスで「ここをタップ」を示す
              // それ以外: 青の穏やかなパルス
              ...(step.waitForAction ? {
                border: '2px solid rgba(255, 165, 0, 0.8)',
                boxShadow: '0 0 0 4px rgba(255, 165, 0, 0.3), 0 0 24px rgba(255, 165, 0, 0.4)',
                animation: 'spotlightTapPulse 1.2s ease-in-out infinite',
                '@keyframes spotlightTapPulse': {
                  '0%, 100%': {
                    boxShadow: '0 0 0 4px rgba(255, 165, 0, 0.3), 0 0 24px rgba(255, 165, 0, 0.4)',
                  },
                  '50%': {
                    boxShadow: '0 0 0 8px rgba(255, 165, 0, 0.5), 0 0 40px rgba(255, 165, 0, 0.6)',
                  },
                },
              } : {
                border: '2px solid rgba(25, 118, 210, 0.6)',
                boxShadow: '0 0 0 4px rgba(25, 118, 210, 0.15), 0 0 20px rgba(25, 118, 210, 0.3)',
                animation: 'spotlightPulse 2s ease-in-out infinite',
                '@keyframes spotlightPulse': {
                  '0%, 100%': {
                    boxShadow: '0 0 0 4px rgba(25, 118, 210, 0.15), 0 0 20px rgba(25, 118, 210, 0.3)',
                  },
                  '50%': {
                    boxShadow: '0 0 0 6px rgba(25, 118, 210, 0.25), 0 0 30px rgba(25, 118, 210, 0.4)',
                  },
                },
              }),
            }}
          />
        )}
      </Box>

      {/* Tap-here ripple indicator (only for waitForAction steps) */}
      {spotlightRect && step.waitForAction && (
        <Box
          sx={{
            position: 'fixed',
            top: spotlightRect.top + spotlightRect.height / 2 - 20,
            left: spotlightRect.left + spotlightRect.width / 2 - 20,
            width: 40,
            height: 40,
            zIndex: 1400,
            pointerEvents: 'none',
          }}
        >
          {/* Expanding ring */}
          <Box
            sx={{
              position: 'absolute',
              top: 0, left: 0, right: 0, bottom: 0,
              borderRadius: '50%',
              border: '2px solid rgba(255, 165, 0, 0.6)',
              animation: 'tapRipple 1.5s ease-out infinite',
              '@keyframes tapRipple': {
                '0%': { transform: 'scale(0.8)', opacity: 1 },
                '100%': { transform: 'scale(2.5)', opacity: 0 },
              },
            }}
          />
          {/* Center dot */}
          <Box
            sx={{
              position: 'absolute',
              top: '50%', left: '50%',
              transform: 'translate(-50%, -50%)',
              width: 12,
              height: 12,
              borderRadius: '50%',
              bgcolor: 'rgba(255, 165, 0, 0.8)',
              boxShadow: '0 0 8px rgba(255, 165, 0, 0.6)',
            }}
          />
        </Box>
      )}

      {/* Click-blocking overlay: 4枚のBoxでスポットライト領域を囲み、外側だけブロック */}
      {/* waitForAction時はスポットライト内をクリック可能にする */}
      {(() => {
        // スポットライト穴がない or waitForActionでない場合: 全面ブロック
        if (!spotlightRect || !step.waitForAction) {
          return (
            <Box sx={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 1400, pointerEvents: 'all' }} />
          );
        }
        // waitForAction時: スポットライト領域に穴を開けた4枚のBoxでブロック
        // + スポットライト領域にクリック転送レイヤーを配置（z-indexスタッキング問題を回避）
        const sx = spotlightRect.left - SPOTLIGHT_PADDING;
        const sy = spotlightRect.top - SPOTLIGHT_PADDING;
        const sw = spotlightRect.width + SPOTLIGHT_PADDING * 2;
        const sh = spotlightRect.height + SPOTLIGHT_PADDING * 2;
        const common = { position: 'fixed' as const, zIndex: 1400, pointerEvents: 'all' as const };
        return (
          <>
            {/* 上 */}
            <Box sx={{ ...common, top: 0, left: 0, right: 0, height: sy }} />
            {/* 下 */}
            <Box sx={{ ...common, top: sy + sh, left: 0, right: 0, bottom: 0 }} />
            {/* 左 */}
            <Box sx={{ ...common, top: sy, left: 0, width: sx, height: sh }} />
            {/* 右 */}
            <Box sx={{ ...common, top: sy, left: sx + sw, right: 0, height: sh }} />
          </>
        );
      })()}
    </>
  );

  // ── 共通: 自動再生インジケーター ──
  const autoPlayingIndicator = isAutoPlaying ? (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 0.75,
        px: 1,
        py: 0.5,
        bgcolor: 'rgba(25, 118, 210, 0.08)',
        borderRadius: 1,
      }}
    >
      <Box
        sx={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          bgcolor: 'primary.main',
          flexShrink: 0,
          animation: 'autoPulse 1s infinite',
          '@keyframes autoPulse': {
            '0%, 100%': { opacity: 1 },
            '50%': { opacity: 0.3 },
          },
        }}
      />
      <Typography variant="caption" color="primary.main" fontWeight={600}>
        シミュレーション実行中...
      </Typography>
    </Box>
  ) : null;

  // ── 共通: ナビゲーションボタン群 ──
  const navButtons = (
    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
      <Button
        size="small"
        startIcon={<PrevIcon />}
        onClick={onPrev}
        disabled={activeStep === 0 || isAutoPlaying}
        sx={{ visibility: activeStep === 0 ? 'hidden' : 'visible', minWidth: 'auto' }}
      >
        前へ
      </Button>

      {isLastStep ? (
        <Button
          size="small"
          variant="contained"
          onClick={onReset}
          disabled={isAutoPlaying}
        >
          デモTOPに戻る
        </Button>
      ) : step.waitForAction ? (
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 0.5,
            px: 1.5,
            py: 0.5,
            bgcolor: 'warning.50',
            borderRadius: 1,
            border: '1px dashed',
            borderColor: 'warning.main',
            maxWidth: '60%',
          }}
        >
          <TouchAppIcon sx={{ fontSize: 14, color: 'warning.main', flexShrink: 0 }} />
          <Typography variant="caption" fontWeight={600} color="warning.dark" noWrap>
            {step.waitForAction}
          </Typography>
        </Box>
      ) : step.autoAction ? (
        isAutoPlaying ? (
          autoPlayingIndicator
        ) : (
          <Button
            size="small"
            variant="contained"
            color="warning"
            onClick={onExecuteAction}
          >
            {step.autoActionLabel || '実行'}
          </Button>
        )
      ) : (
        <Button
          size="small"
          variant="contained"
          endIcon={<NextIcon />}
          onClick={onNext}
          disabled={isAutoPlaying}
        >
          次へ
        </Button>
      )}
    </Box>
  );

  // ════════════════════════════════════════════
  // モバイル: フッター固定パネル
  // ════════════════════════════════════════════
  if (isMobile) {
    return (
      <>
        {spotlightBackdrop}

        <Paper
          elevation={16}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          sx={{
            position: 'fixed',
            bottom: 0,
            left: 0,
            right: 0,
            zIndex: 1401,
            borderRadius: '16px 16px 0 0',
            overflow: 'hidden',
            animation: 'footerSlideUp 0.3s ease-out',
            '@keyframes footerSlideUp': {
              '0%': { transform: 'translateY(100%)' },
              '100%': { transform: 'translateY(0)' },
            },
            pb: 'env(safe-area-inset-bottom, 0px)',
          }}
        >
          {/* プログレスバー */}
          <LinearProgress
            variant="determinate"
            value={progressValue}
            sx={{ height: 3, bgcolor: 'grey.100' }}
          />

          {/* スワイプインジケーター（つまみ） */}
          <Box sx={{ display: 'flex', justifyContent: 'center', pt: 0.75, pb: 0.25 }}>
            <Box sx={{ width: 32, height: 4, borderRadius: 2, bgcolor: 'grey.300' }} />
          </Box>

          <Box
            key={fadeKey}
            sx={{
              px: 2,
              pt: 0.5,
              pb: isLandscape ? 1 : 1.5,
              animation: 'contentFadeIn 0.25s ease-out',
              '@keyframes contentFadeIn': {
                '0%': { opacity: 0, transform: 'translateX(8px)' },
                '100%': { opacity: 1, transform: 'translateX(0)' },
              },
            }}
          >
            {/* ヘッダー行: ステップ番号 + 閉じるボタン */}
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.25 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography
                  variant="caption"
                  sx={{ color: 'primary.main', fontWeight: 700, letterSpacing: '0.05em' }}
                >
                  STEP {activeStep + 1} / {steps.length}
                </Typography>
                {/* ステップドットインジケーター */}
                <Box sx={{ display: 'flex', gap: 0.5 }}>
                  {steps.map((_, i) => (
                    <Box
                      key={i}
                      sx={{
                        width: i === activeStep ? 12 : 6,
                        height: 6,
                        borderRadius: 3,
                        bgcolor: i === activeStep ? 'primary.main' : i < activeStep ? 'primary.light' : 'grey.300',
                        transition: 'all 0.3s ease',
                      }}
                    />
                  ))}
                </Box>
              </Box>
              <IconButton
                size="small"
                onClick={onClose}
                sx={{ color: 'grey.400', p: 0.5, '&:hover': { color: 'grey.600' } }}
              >
                <CloseIcon sx={{ fontSize: 18 }} />
              </IconButton>
            </Box>

            {/* タイトル */}
            <Typography
              variant="subtitle2"
              fontWeight={700}
              sx={{ mb: 0.25, lineHeight: 1.3, fontSize: isLandscape ? '0.8rem' : undefined }}
            >
              {step.title}
            </Typography>

            {/* 説明文 (ランドスケープ時は折りたたみ可能) */}
            {isLandscape ? (
              <>
                <Collapse in={expanded} collapsedSize={0}>
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ lineHeight: 1.5, fontSize: '0.75rem', mb: 0.5 }}
                  >
                    {step.description}
                  </Typography>
                </Collapse>
                <Button
                  size="small"
                  onClick={() => setExpanded(!expanded)}
                  endIcon={expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                  sx={{ p: 0, minHeight: 'auto', fontSize: '0.7rem', color: 'grey.500' }}
                >
                  {expanded ? '閉じる' : '説明を見る'}
                </Button>
              </>
            ) : (
              <>
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{
                    lineHeight: 1.6,
                    fontSize: '0.8rem',
                    ...(!expanded && {
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                    }),
                  }}
                >
                  {step.description}
                </Typography>
                {/* 長い説明文の場合のみ展開ボタンを表示 */}
                {step.description.length > 50 && (
                  <Button
                    size="small"
                    onClick={() => setExpanded(!expanded)}
                    sx={{ p: 0, minHeight: 'auto', fontSize: '0.7rem', color: 'primary.main', mt: 0.25 }}
                  >
                    {expanded ? '閉じる' : 'もっと見る'}
                  </Button>
                )}
              </>
            )}

            {/* 自動再生インジケーター */}
            {autoPlayingIndicator && <Box sx={{ mt: 0.75, mb: 0.5 }}>{autoPlayingIndicator}</Box>}

            {/* ナビゲーションボタン */}
            <Box sx={{ mt: autoPlayingIndicator ? 0 : 1 }}>
              {navButtons}
            </Box>
          </Box>
        </Paper>
      </>
    );
  }

  // ════════════════════════════════════════════
  // デスクトップ: 従来のポップオーバー
  // ════════════════════════════════════════════
  const arrowStyles: Record<string, object> = {
    top: { top: -8, left: '50%', transform: 'translateX(-50%) rotate(45deg)' },
    bottom: { bottom: -8, left: '50%', transform: 'translateX(-50%) rotate(45deg)' },
    left: { left: -8, top: '50%', transform: 'translateY(-50%) rotate(45deg)' },
    right: { right: -8, top: '50%', transform: 'translateY(-50%) rotate(45deg)' },
  };

  return (
    <>
      {spotlightBackdrop}

      <Paper
        ref={popoverRef}
        elevation={16}
        sx={{
          position: 'fixed',
          top: position.top,
          left: position.left,
          width: POPOVER_WIDTH,
          zIndex: 1401,
          borderRadius: 3,
          overflow: 'visible',
          animation: 'popoverEnter 0.3s ease-out',
          '@keyframes popoverEnter': {
            '0%': { opacity: 0, transform: 'scale(0.9) translateY(8px)' },
            '100%': { opacity: 1, transform: 'scale(1) translateY(0)' },
          },
        }}
      >
        {/* Arrow */}
        <Box
          sx={{
            position: 'absolute',
            width: 16,
            height: 16,
            bgcolor: 'background.paper',
            boxShadow: 3,
            ...arrowStyles[position.arrowSide],
          }}
        />

        {/* Content wrapper with overflow hidden for progress bar clipping */}
        <Box sx={{ overflow: 'hidden', borderRadius: 'inherit' }}>

        {/* Progress bar */}
        <LinearProgress
          variant="determinate"
          value={progressValue}
          sx={{ height: 4, bgcolor: 'grey.100' }}
        />

        <Box sx={{ p: 2.5, position: 'relative' }}>
          <IconButton
            size="small"
            onClick={onClose}
            sx={{
              position: 'absolute',
              top: 4,
              right: 4,
              color: 'grey.400',
              '&:hover': { color: 'grey.600' },
            }}
          >
            <CloseIcon fontSize="small" />
          </IconButton>

          <Typography
            variant="caption"
            sx={{
              color: 'primary.main',
              fontWeight: 700,
              letterSpacing: '0.05em',
              mb: 0.5,
              display: 'block',
            }}
          >
            STEP {activeStep + 1} / {steps.length}
          </Typography>

          <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1, pr: 3 }}>
            {step.title}
          </Typography>

          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ mb: 2, lineHeight: 1.7 }}
          >
            {step.description}
          </Typography>

          {autoPlayingIndicator && <Box sx={{ mb: 2 }}>{autoPlayingIndicator}</Box>}

          {navButtons}
        </Box>
        </Box>{/* /Content wrapper */}
      </Paper>
    </>
  );
};
