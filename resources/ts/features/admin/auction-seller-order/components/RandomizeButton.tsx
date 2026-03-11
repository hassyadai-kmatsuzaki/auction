import { useState } from 'react';
import {
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  DialogContentText,
  CircularProgress,
} from '@mui/material';
import { Shuffle as ShuffleIcon } from '@mui/icons-material';
import { useRandomizeSellerOrder } from '../hooks/useRandomizeSellerOrder';

interface RandomizeButtonProps {
  auctionId: number;
  disabled?: boolean;
  onSuccess?: () => void;
}

export default function RandomizeButton({ auctionId, disabled, onSuccess }: RandomizeButtonProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const randomizeMutation = useRandomizeSellerOrder(auctionId);

  const handleRandomize = async () => {
    try {
      await randomizeMutation.mutateAsync();
      setDialogOpen(false);
      onSuccess?.();
    } catch (error) {
      console.error('Failed to randomize seller order:', error);
    }
  };

  return (
    <>
      <Button
        variant="outlined"
        startIcon={<ShuffleIcon />}
        onClick={() => setDialogOpen(true)}
        disabled={disabled || randomizeMutation.isPending}
      >
        ランダム化
      </Button>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>出品者順序をランダム化</DialogTitle>
        <DialogContent>
          <DialogContentText>
            出品者の表示順序をランダムに並び替えます。
            <br />
            よろしいですか?
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)} disabled={randomizeMutation.isPending}>
            キャンセル
          </Button>
          <Button
            onClick={handleRandomize}
            variant="contained"
            color="primary"
            disabled={randomizeMutation.isPending}
            startIcon={randomizeMutation.isPending ? <CircularProgress size={20} /> : null}
          >
            ランダム化実行
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
