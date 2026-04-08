import React, { useState, useEffect } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Box, Typography, TextField, Button, InputAdornment,
  Divider, Alert, IconButton, CircularProgress,
} from '@mui/material';
import { Close as CloseIcon, PriceCheck as PriceCheckIcon } from '@mui/icons-material';
import { QuickLimitButtons } from './QuickLimitButtons';

interface QuickOptions {
  base_price: number;
  x1_5: number;
  x2: number;
  x2_5: number;
  x3: number;
}

interface Props {
  open: boolean;
  onClose: () => void;
  itemId: number;
  speciesName: string;
  currentLimitPrice: number | null;
  currentPrice: number;        // ライブ中は現在価格、開始前は開始価格
  quickOptions: QuickOptions | null;
  isLive?: boolean;            // ライブ中かどうか
  isSetting?: boolean;
  isRemoving?: boolean;
  onSet: (price: number) => void;
  onRemove: () => void;
  /** Dialog の z-index を上書き（デモのオーバーレイより上に表示する場合） */
  zIndex?: number;
  /** 指定した価格のみ選択可能にする（デモ用） */
  allowedPrice?: number;
}

export const BidLimitModal = React.memo(({
  open, onClose, speciesName, currentLimitPrice,
  currentPrice, quickOptions, isLive,
  isSetting, isRemoving, onSet, onRemove, zIndex, allowedPrice,
}: Props) => {
  const [inputValue, setInputValue] = useState<string>('');
  const [selectedQuick, setSelectedQuick] = useState<number | null>(null);

  // useEffect より先に定義（useEffect内で参照するため）
  const effectiveQuickOptions = quickOptions ?? {
    base_price: currentPrice,
    x1_5: Math.floor(currentPrice * 1.5),
    x2:   Math.floor(currentPrice * 2),
    x2_5: Math.floor(currentPrice * 2.5),
    x3:   Math.floor(currentPrice * 3),
  };

  // モーダルが開くたびに現在値を初期化
  useEffect(() => {
    if (open) {
      const strVal = currentLimitPrice ? String(Math.floor(currentLimitPrice)) : '';
      setInputValue(strVal);

      // クイック選択肢と一致するかチェックして selectedQuick を設定
      if (currentLimitPrice) {
        const opts = effectiveQuickOptions;
        const matchedKey = (
          currentLimitPrice === opts.x1_5 ? opts.x1_5 :
          currentLimitPrice === opts.x2   ? opts.x2   :
          currentLimitPrice === opts.x2_5 ? opts.x2_5 :
          currentLimitPrice === opts.x3   ? opts.x3   : null
        );
        setSelectedQuick(matchedKey);
      } else {
        setSelectedQuick(null);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, currentLimitPrice]);

  const parsedValue = parseFloat(inputValue);
  const isValid     = !isNaN(parsedValue) && parsedValue >= 1;
  const isBelowCurrent = isValid && parsedValue <= currentPrice;

  const handleQuickSelect = (value: number) => {
    setSelectedQuick(value);
    setInputValue(String(value));
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/[^0-9]/g, '');
    setInputValue(val);
    setSelectedQuick(null);
  };

  const handleSubmit = () => {
    if (!isValid) return;
    onSet(parsedValue);
    onClose();
  };

  const handleRemove = () => {
    onRemove();
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth sx={zIndex ? { zIndex } : undefined}>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pb: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <PriceCheckIcon color="primary" />
          <Typography variant="h6">上限価格を設定</Typography>
        </Box>
        <IconButton onClick={onClose} size="small"><CloseIcon /></IconButton>
      </DialogTitle>

      <DialogContent sx={{ pt: 1 }}>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {speciesName} ／ {isLive ? '現在' : '開始'}価格 ¥{Math.floor(currentPrice).toLocaleString()}
        </Typography>

        {/* クイック入力 */}
        <QuickLimitButtons
          quickOptions={effectiveQuickOptions}
          currentValue={selectedQuick}
          onSelect={handleQuickSelect}
          isLive={isLive}
          allowedPrice={allowedPrice}
        />

        <Divider sx={{ my: 2 }} />

        {/* カスタム入力 */}
        <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
          カスタム入力
        </Typography>
        <TextField
          fullWidth
          type="number"
          placeholder="例: 8000"
          value={inputValue}
          onChange={handleInputChange}
          disabled={!!allowedPrice}
          InputProps={{
            startAdornment: <InputAdornment position="start">¥</InputAdornment>,
            inputProps: { min: 1 },
          }}
          size="small"
          autoComplete="off"
        />

        {/* 現在価格以下の警告 */}
        {isBelowCurrent && (
          <Alert severity="warning" sx={{ mt: 1.5, py: 0.5 }}>
            <Typography variant="caption">
              現在価格（¥{currentPrice.toLocaleString()}）以下の設定です。
              {isLive ? '入札中の場合は即時自動オフになります。' : 'オークション開始時に即時発動する可能性があります。'}
            </Typography>
          </Alert>
        )}

        {/* 現在の設定表示 */}
        {currentLimitPrice && (
          <Typography variant="caption" color="text.secondary" sx={{ mt: 1.5, display: 'block' }}>
            現在の設定: ¥{Math.floor(currentLimitPrice).toLocaleString()}
          </Typography>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2, gap: 1, flexWrap: 'wrap' }}>
        {currentLimitPrice && (
          <Button
            variant="text" color="error" size="small"
            onClick={handleRemove} disabled={isRemoving}
            sx={{ mr: 'auto' }}
          >
            {isRemoving ? <CircularProgress size={16} /> : '設定を解除'}
          </Button>
        )}
        <Button onClick={onClose} variant="outlined" size="small">キャンセル</Button>
        <Button
          onClick={handleSubmit}
          variant="contained" size="small"
          disabled={!isValid || isSetting}
          startIcon={isSetting ? <CircularProgress size={16} color="inherit" /> : undefined}
        >
          設定する
        </Button>
      </DialogActions>
    </Dialog>
  );
});

BidLimitModal.displayName = 'BidLimitModal';
