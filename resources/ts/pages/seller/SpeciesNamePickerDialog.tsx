import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  List,
  ListItemButton,
  ListItemText,
  Typography,
  InputAdornment,
  IconButton,
} from '@mui/material';
import { Search as SearchIcon, Close as CloseIcon } from '@mui/icons-material';

interface Props {
  open: boolean;
  /** モーダルを開いた時点での現在値（編集時はこれを初期表示に流用する） */
  initialValue: string;
  /** 品種名（生体名）候補の一覧 */
  options: string[];
  /** 照合用の正規化関数（ひらがな⇄カタカナ非区別など、呼び出し側と揃える） */
  normalize: (s: string) => string;
  onClose: () => void;
  onConfirm: (value: string) => void;
}

// 候補表示の上限。マスタが膨らんでも一覧が重くならないよう頭打ちにする。
const MAX_VISIBLE = 50;

/**
 * 品種名（生体名）入力用のモーダル。
 * 出品フォーム本体ではテキスト欄をタップするとこのモーダルが開き、
 * ここで「入力 → 候補から選択 → 決定」を完結させる。
 * これにより、確定後にフォーム本体で文字を編集しても予測候補が出続けない（モード分離）。
 */
const SpeciesNamePickerDialog: React.FC<Props> = ({
  open,
  initialValue,
  options,
  normalize,
  onClose,
  onConfirm,
}) => {
  const [value, setValue] = useState(initialValue);
  const inputRef = useRef<HTMLInputElement>(null);

  // 開くたびに現在値で初期化し、入力欄にフォーカスする（トランジション後に当てる）。
  useEffect(() => {
    if (!open) return;
    setValue(initialValue);
    const t = setTimeout(() => inputRef.current?.focus(), 120);
    return () => clearTimeout(t);
  }, [open, initialValue]);

  const filtered = useMemo(() => {
    const q = normalize(value.trim());
    const base = q ? options.filter((o) => normalize(o).includes(q)) : options;
    return base.slice(0, MAX_VISIBLE);
  }, [value, options, normalize]);

  const trimmed = value.trim();

  const handleConfirm = () => {
    if (!trimmed) return;
    onConfirm(trimmed);
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pr: 1 }}>
        品種名を入力
        <IconButton onClick={onClose} size="small" aria-label="閉じる">
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent dividers>
        <TextField
          fullWidth
          autoFocus
          inputRef={inputRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              handleConfirm();
            }
          }}
          placeholder="例: 紅白ラメ、幹之フルボディ"
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" />
              </InputAdornment>
            ),
          }}
          sx={{ mb: 1.5 }}
        />

        {filtered.length > 0 ? (
          <List
            dense
            sx={{
              maxHeight: 320,
              overflow: 'auto',
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: 1,
              py: 0,
            }}
          >
            {filtered.map((o) => (
              <ListItemButton
                key={o}
                onClick={() => setValue(o)}
                selected={normalize(o) === normalize(value)}
              >
                <ListItemText primary={o} />
              </ListItemButton>
            ))}
          </List>
        ) : (
          <Typography variant="body2" color="text.secondary" sx={{ px: 1, py: 2 }}>
            一致する候補はありません。このまま「決定」で入力した名前を使えます。
          </Typography>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose} color="inherit">
          キャンセル
        </Button>
        <Button onClick={handleConfirm} variant="contained" disabled={!trimmed}>
          決定
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default SpeciesNamePickerDialog;
