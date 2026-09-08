import { Box, Chip, Collapse, IconButton, Tooltip, Typography } from '@mui/material';
import {
  DragIndicator as DragIndicatorIcon,
  ExpandMore as ExpandMoreIcon,
  Store as StoreIcon,
  Delete as DeleteIcon,
  Star as StarIcon,
} from '@mui/icons-material';
import { LaneGroup } from './types';

interface LaneGroupCardProps {
  group: LaneGroup;
  /** レーン内の順番。未割当では表示しない */
  seq?: number;
  expanded: boolean;
  onToggleExpand: () => void;
  draggable: boolean;
  dragging: boolean;
  onDragStart: (e: React.DragEvent) => void;
  onDragEnd: () => void;
  /** レーンから外して未割当へ戻す。未割当側では渡さない */
  onRemove?: () => void;
}

const smallChipSx = { height: 18, fontSize: '0.65rem', '& .MuiChip-label': { px: 0.75 } } as const;

/**
 * 出品者グループのカード（アコーディオン）。
 * ヘッダー = 出品者名・コード・点数、本文 = 生体名と匹数だけのコンパクトな一覧。
 * カード全体を掴んでレーン間・レーン内を移動する。
 */
export default function LaneGroupCard({
  group,
  seq,
  expanded,
  onToggleExpand,
  draggable,
  dragging,
  onDragStart,
  onDragEnd,
  onRemove,
}: LaneGroupCardProps) {
  return (
    <Box
      draggable={draggable}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      sx={{
        border: '1px solid',
        borderColor: 'grey.300',
        borderRadius: 2,
        bgcolor: 'background.paper',
        boxShadow: 1,
        opacity: dragging ? 0.45 : 1,
        transition: 'opacity 0.15s',
        overflow: 'hidden',
        my: 0.5,
      }}
    >
      {/* ヘッダー */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          px: 1.5,
          py: 1,
          bgcolor: 'grey.50',
          cursor: draggable ? 'grab' : 'default',
          '&:active': { cursor: draggable ? 'grabbing' : 'default' },
        }}
      >
        {seq !== undefined && (
          <Typography variant="caption" sx={{ fontWeight: 700, width: 14, textAlign: 'center', flexShrink: 0 }}>
            {seq}
          </Typography>
        )}
        <DragIndicatorIcon sx={{ color: 'text.secondary', fontSize: 20, flexShrink: 0 }} />

        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, minWidth: 0 }}>
            <StoreIcon sx={{ fontSize: 16, color: 'text.secondary', flexShrink: 0 }} />
            {group.is_anonymous && (
              <Chip label="匿名" size="small" color="warning" sx={smallChipSx} />
            )}
            <Typography
              variant="body2"
              sx={{ fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
              title={group.seller_name}
            >
              {group.seller_name}
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.25 }}>
            {group.seller_code && (
              <Chip label={group.seller_code} size="small" variant="outlined" sx={smallChipSx} />
            )}
            <Typography variant="caption" color="text.secondary">
              {group.items.length}点
            </Typography>
          </Box>
        </Box>

        <Tooltip title={expanded ? '生体一覧を閉じる' : '生体一覧を開く'}>
          <IconButton
            size="small"
            onClick={(e) => {
              e.stopPropagation();
              onToggleExpand();
            }}
            sx={{ transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}
          >
            <ExpandMoreIcon />
          </IconButton>
        </Tooltip>
        {onRemove && (
          <Tooltip title="グループごと未割当に戻す">
            <IconButton
              size="small"
              color="error"
              onClick={(e) => {
                e.stopPropagation();
                onRemove();
              }}
              disabled={!draggable}
            >
              <DeleteIcon sx={{ fontSize: 18 }} />
            </IconButton>
          </Tooltip>
        )}
      </Box>

      {/* 生体一覧（名前と匹数だけ） */}
      <Collapse in={expanded} unmountOnExit>
        <Box sx={{ px: 1.5, py: 0.5, pl: seq !== undefined ? 6 : 5.5, borderTop: '1px solid', borderColor: 'grey.200' }}>
          {group.items.map((item, idx) => (
            <Box
              key={item.id}
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 0.75,
                py: 0.5,
                borderBottom: idx < group.items.length - 1 ? '1px dashed' : 'none',
                borderColor: 'grey.200',
                whiteSpace: 'nowrap',
              }}
            >
              <Typography variant="caption" color="text.secondary" sx={{ minWidth: 28, flexShrink: 0 }}>
                #{item.item_number}
              </Typography>
              {item.status === 'draft' && (
                <Chip label="審査中" size="small" color="warning" variant="outlined" sx={smallChipSx} />
              )}
              <Typography
                variant="body2"
                sx={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}
                title={item.species_name}
              >
                {item.species_name}
              </Typography>
              {item.is_premium && <StarIcon sx={{ color: '#F59E0B', fontSize: 16, flexShrink: 0 }} />}
              <Typography variant="caption" color="text.secondary" sx={{ flexShrink: 0 }}>
                {item.quantity}匹
              </Typography>
            </Box>
          ))}
        </Box>
      </Collapse>
    </Box>
  );
}
