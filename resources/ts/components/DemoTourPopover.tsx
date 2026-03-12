import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  IconButton,
  LinearProgress,
} from '@mui/material';
import {
  NavigateNext as NextIcon,
  NavigateBefore as PrevIcon,
  Close as CloseIcon,
  Refresh as RefreshIcon,
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
}

const POPOVER_WIDTH = 340;
const POPOVER_GAP = 16;
const SPOTLIGHT_PADDING = 8;

export const DemoTourPopover: React.FC<Props> = ({
  steps,
  activeStep,
  onNext,
  onPrev,
  onClose,
  onReset,
  isAutoPlaying = false,
}) => {
  const [position, setPosition] = useState<{
    top: number;
    left: number;
    arrowSide: 'top' | 'bottom' | 'left' | 'right';
    spotlightRect: DOMRect | null;
  }>({ top: 0, left: 0, arrowSide: 'top', spotlightRect: null });
  const popoverRef = useRef<HTMLDivElement>(null);
  const step = steps[activeStep];
  const isLastStep = activeStep === steps.length - 1;

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
  }, [step]);

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
      step.targetRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
      const timer = setTimeout(calculatePosition, 350);
      return () => clearTimeout(timer);
    }
  }, [activeStep, step, calculatePosition]);

  if (!step) return null;

  const arrowStyles: Record<string, object> = {
    top: {
      top: -8,
      left: '50%',
      transform: 'translateX(-50%) rotate(45deg)',
    },
    bottom: {
      bottom: -8,
      left: '50%',
      transform: 'translateX(-50%) rotate(45deg)',
    },
    left: {
      left: -8,
      top: '50%',
      transform: 'translateY(-50%) rotate(45deg)',
    },
    right: {
      right: -8,
      top: '50%',
      transform: 'translateY(-50%) rotate(45deg)',
    },
  };

  const { spotlightRect } = position;

  return (
    <>
      {/* Backdrop with spotlight cutout (pointer-events: none so clicks pass through to underlying elements) */}
      <Box
        sx={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 1300,
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

        {/* Spotlight ring glow */}
        {spotlightRect && (
          <Box
            sx={{
              position: 'absolute',
              top: spotlightRect.top - SPOTLIGHT_PADDING,
              left: spotlightRect.left - SPOTLIGHT_PADDING,
              width: spotlightRect.width + SPOTLIGHT_PADDING * 2,
              height: spotlightRect.height + SPOTLIGHT_PADDING * 2,
              borderRadius: '12px',
              border: '2px solid rgba(25, 118, 210, 0.6)',
              boxShadow: '0 0 0 4px rgba(25, 118, 210, 0.15), 0 0 20px rgba(25, 118, 210, 0.3)',
              pointerEvents: 'none',
              animation: 'spotlightPulse 2s ease-in-out infinite',
              '@keyframes spotlightPulse': {
                '0%, 100%': {
                  boxShadow: '0 0 0 4px rgba(25, 118, 210, 0.15), 0 0 20px rgba(25, 118, 210, 0.3)',
                },
                '50%': {
                  boxShadow: '0 0 0 6px rgba(25, 118, 210, 0.25), 0 0 30px rgba(25, 118, 210, 0.4)',
                },
              },
            }}
          />
        )}

      </Box>

      {/* Popover */}
      <Paper
        ref={popoverRef}
        elevation={16}
        sx={{
          position: 'fixed',
          top: position.top,
          left: position.left,
          width: POPOVER_WIDTH,
          zIndex: 1301,
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

        {/* Progress bar */}
        <LinearProgress
          variant="determinate"
          value={((activeStep + 1) / steps.length) * 100}
          sx={{
            borderRadius: '12px 12px 0 0',
            height: 4,
            bgcolor: 'grey.100',
          }}
        />

        <Box sx={{ p: 2.5, position: 'relative' }}>
          {/* Close button */}
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

          {/* Step counter */}
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

          {/* Title */}
          <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1, pr: 3 }}>
            {step.title}
          </Typography>

          {/* Description */}
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ mb: 2, lineHeight: 1.7 }}
          >
            {step.description}
          </Typography>

          {/* Auto-playing indicator */}
          {isAutoPlaying && (
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                mb: 2,
                p: 1,
                bgcolor: 'primary.50',
                borderRadius: 1,
              }}
            >
              <Box
                sx={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  bgcolor: 'primary.main',
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
          )}

          {/* Navigation buttons */}
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Button
              size="small"
              startIcon={<PrevIcon />}
              onClick={onPrev}
              disabled={activeStep === 0 || isAutoPlaying}
              sx={{ visibility: activeStep === 0 ? 'hidden' : 'visible' }}
            >
              前へ
            </Button>

            {isLastStep ? (
              <Button
                size="small"
                variant="contained"
                startIcon={<RefreshIcon />}
                onClick={onReset}
                disabled={isAutoPlaying}
              >
                最初から
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
                }}
              >
                <Box
                  sx={{
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    bgcolor: 'warning.main',
                    animation: 'waitPulse 1.5s infinite',
                    '@keyframes waitPulse': {
                      '0%, 100%': { transform: 'scale(1)' },
                      '50%': { transform: 'scale(1.5)' },
                    },
                  }}
                />
                <Typography variant="caption" fontWeight={600} color="warning.dark">
                  {step.waitForAction}
                </Typography>
              </Box>
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
        </Box>
      </Paper>
    </>
  );
};
