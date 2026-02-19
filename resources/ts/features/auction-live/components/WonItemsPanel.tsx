import React from 'react';
import {
  Paper, Typography,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
} from '@mui/material';
import { EmojiEvents as EmojiEventsIcon } from '@mui/icons-material';
import type { WonItemSummary } from '@/types';

interface Props {
  items: WonItemSummary[];
  totalAmount: number;
}

export const WonItemsPanel = React.memo(({ items, totalAmount }: Props) => {
  if (items.length === 0) return null;

  return (
    <Paper sx={{ mt: 2, p: 2 }}>
      <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <EmojiEventsIcon color="warning" />
        あなたの落札一覧（{items.length}件）
      </Typography>
      <TableContainer sx={{ overflowX: 'auto' }}>
        <Table size="small" sx={{ '& th, & td': { whiteSpace: 'nowrap' } }}>
          <TableHead>
            <TableRow>
              <TableCell>No.</TableCell>
              <TableCell>品種</TableCell>
              <TableCell align="right">単価</TableCell>
              <TableCell align="right">数量</TableCell>
              <TableCell align="right">合計(税込)</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {items.map((item) => {
              const unit = item.quantity_unit === 'kg' ? 'kg' : item.quantity_unit === 'bag' ? '袋' : '匹';
              return (
                <TableRow key={item.id}>
                  <TableCell>{item.item_number}</TableCell>
                  <TableCell>{item.species_name}</TableCell>
                  <TableCell align="right">
                    ¥{Math.floor(item.winning_price).toLocaleString()}/1{unit}
                  </TableCell>
                  <TableCell align="right">{item.quantity}{unit}</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 'bold' }}>
                    ¥{Math.floor(item.total_amount).toLocaleString()}
                  </TableCell>
                </TableRow>
              );
            })}
            <TableRow>
              <TableCell colSpan={4} align="right" sx={{ fontWeight: 'bold' }}>合計金額</TableCell>
              <TableCell align="right" sx={{ fontWeight: 'bold', color: 'primary.main', fontSize: '1.1rem' }}>
                ¥{Math.floor(totalAmount).toLocaleString()}
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </TableContainer>
    </Paper>
  );
});

WonItemsPanel.displayName = 'WonItemsPanel';
