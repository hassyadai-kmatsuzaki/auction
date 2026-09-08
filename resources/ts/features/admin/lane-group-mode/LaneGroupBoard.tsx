import { useEffect, useState } from 'react';
import { Box, Grid, Paper, Typography } from '@mui/material';
import { Pets as PetsIcon } from '@mui/icons-material';
import LaneGroupCard from './LaneGroupCard';
import { deriveLaneGroups, deriveUnassignedGroups, sumQuantity } from './groupUtils';
import { GroupDropTarget, GroupItem, LaneGroup } from './types';

export interface LaneLike {
  id: number;
  lane_number: number;
  lane_name: string | null;
  items: GroupItem[];
}

export interface LaneStats {
  groups: number;
  items: number;
  quantity: number;
}

interface LaneGroupBoardProps<TLane extends LaneLike> {
  lanes: TLane[];
  unassignedItems: GroupItem[];
  /** 出品者順序（seller_profile_id を display_order 順に並べたもの）。未割当グループの並びに使う */
  sellerOrder: number[];
  /** 常時展開。ON なら全グループを開いた状態にする（個別に閉じることはできる） */
  expandAll: boolean;
  disabled: boolean;
  onMoveGroup: (group: LaneGroup, sourceLaneId: number | null, target: GroupDropTarget) => void;
  renderLaneHeader: (lane: TLane, stats: LaneStats) => React.ReactNode;
}

interface DragState {
  group: LaneGroup;
  sourceLaneId: number | null;
}

const groupStateKey = (laneId: number | null, group: LaneGroup) =>
  `${laneId ?? 'u'}:${group.key}:${group.items[0]?.id ?? 0}`;

const DropIndicator = ({ visible }: { visible: boolean }) => (
  <Box
    sx={{
      height: visible ? 3 : 0,
      bgcolor: visible ? 'primary.main' : 'transparent',
      borderRadius: 2,
      mx: 1,
      transition: 'height 0.15s ease',
      position: 'relative',
      '&::before': visible
        ? { content: '""', position: 'absolute', left: -4, top: -3, width: 9, height: 9, borderRadius: '50%', bgcolor: 'primary.main' }
        : {},
      '&::after': visible
        ? { content: '""', position: 'absolute', right: -4, top: -3, width: 9, height: 9, borderRadius: '50%', bgcolor: 'primary.main' }
        : {},
    }}
  />
);

/**
 * 出品者グループ配置モードの盤面（未割当 + レーン）。
 * グループ単位のドラッグ&ドロップだけを扱い、生体単位の操作は持たない。
 * データは持たず、確定後の生体単位モードと同じ lanes / unassignedItems をグループに畳んで描く。
 */
export default function LaneGroupBoard<TLane extends LaneLike>({
  lanes,
  unassignedItems,
  sellerOrder,
  expandAll,
  disabled,
  onMoveGroup,
  renderLaneHeader,
}: LaneGroupBoardProps<TLane>) {
  const [drag, setDrag] = useState<DragState | null>(null);
  const [dropTarget, setDropTarget] = useState<GroupDropTarget | null>(null);
  // 常時展開の既定値に対する個別の開閉（常時展開を切り替えたらリセット）
  const [overrides, setOverrides] = useState<Record<string, boolean>>({});
  useEffect(() => {
    setOverrides({});
  }, [expandAll]);

  const isExpanded = (key: string) => overrides[key] ?? expandAll;
  const toggle = (key: string) =>
    setOverrides((prev) => ({ ...prev, [key]: !(prev[key] ?? expandAll) }));

  const unassignedGroups = deriveUnassignedGroups(unassignedItems, sellerOrder);

  // ----- ドラッグ -----
  const handleDragStart = (e: React.DragEvent, group: LaneGroup, sourceLaneId: number | null) => {
    if (disabled) {
      e.preventDefault();
      return;
    }
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', ''); // Firefox 対策
    setDrag({ group, sourceLaneId });
  };

  const handleDragEnd = () => {
    setDrag(null);
    setDropTarget(null);
  };

  /** グループカード上: 上半分なら「このグループの前」、下半分なら「次のグループの前」 */
  const handleDragOverGroup = (e: React.DragEvent, laneId: number, groups: LaneGroup[], index: number) => {
    e.preventDefault();
    e.stopPropagation();
    if (!drag) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const upper = e.clientY < rect.top + rect.height / 2;
    const anchor = upper ? groups[index] : groups[index + 1];
    setDropTarget({ laneId, beforeItemId: anchor ? anchor.items[0].id : null });
  };

  const handleDragOverLane = (e: React.DragEvent, laneId: number) => {
    e.preventDefault();
    if (!drag) return;
    setDropTarget({ laneId, beforeItemId: null });
  };

  const handleDropOnLane = (laneId: number, groups: LaneGroup[]) => {
    if (!drag) return;
    const target: GroupDropTarget =
      dropTarget && dropTarget.laneId === laneId ? dropTarget : { laneId, beforeItemId: null };

    // 同じレーンで位置が変わらないドロップは無視
    if (drag.sourceLaneId === laneId) {
      const idx = groups.findIndex((g) => g.items[0]?.id === drag.group.items[0]?.id);
      const selfFirst = drag.group.items[0]?.id ?? null;
      const nextFirst = idx >= 0 ? (groups[idx + 1]?.items[0]?.id ?? null) : null;
      if (target.beforeItemId === selfFirst || target.beforeItemId === nextFirst) {
        handleDragEnd();
        return;
      }
    }

    const { group, sourceLaneId } = drag;
    handleDragEnd();
    onMoveGroup(group, sourceLaneId, target);
  };

  const handleDragOverUnassigned = (e: React.DragEvent) => {
    if (!drag || drag.sourceLaneId === null) return;
    e.preventDefault();
    setDropTarget({ laneId: null, beforeItemId: null });
  };

  const handleDropOnUnassigned = () => {
    if (!drag || drag.sourceLaneId === null) return;
    const { group, sourceLaneId } = drag;
    handleDragEnd();
    onMoveGroup(group, sourceLaneId, { laneId: null, beforeItemId: null });
  };

  const draggingFromLane = !!drag && drag.sourceLaneId !== null;

  return (
    <Grid container spacing={2}>
      {/* 未割当 */}
      <Grid item xs={12} md={3}>
        <Paper
          sx={{
            p: 2,
            height: 'calc(100vh - 300px)',
            overflow: 'auto',
            bgcolor: draggingFromLane ? 'action.hover' : 'background.paper',
            border: draggingFromLane ? '2px dashed' : 'none',
            borderColor: 'primary.main',
            transition: 'all 0.2s',
          }}
          onDragOver={handleDragOverUnassigned}
          onDrop={handleDropOnUnassigned}
        >
          <Typography variant="h6" sx={{ fontWeight: 600, mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
            <PetsIcon />
            未割当 ({unassignedItems.length})
          </Typography>

          {unassignedGroups.length === 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
              すべての生体が割当済みです
            </Typography>
          ) : (
            unassignedGroups.map((group) => {
              const key = groupStateKey(null, group);
              return (
                <LaneGroupCard
                  key={key}
                  group={group}
                  expanded={isExpanded(key)}
                  onToggleExpand={() => toggle(key)}
                  draggable={!disabled}
                  dragging={drag?.sourceLaneId === null && drag?.group.key === group.key}
                  onDragStart={(e) => handleDragStart(e, group, null)}
                  onDragEnd={handleDragEnd}
                />
              );
            })
          )}
        </Paper>
      </Grid>

      {/* レーン */}
      <Grid item xs={12} md={9}>
        <Grid container spacing={2}>
          {lanes.map((lane) => {
            const groups = deriveLaneGroups(lane.items);
            const stats: LaneStats = { groups: groups.length, items: lane.items.length, quantity: sumQuantity(lane.items) };
            const isTarget = !!drag && dropTarget?.laneId === lane.id;
            return (
              <Grid item xs={12} md={6} key={lane.id}>
                <Paper
                  sx={{
                    p: 2,
                    height: 'calc(100vh - 300px)',
                    overflow: 'auto',
                    bgcolor: drag ? 'grey.50' : 'background.paper',
                    border: isTarget ? '2px solid' : drag ? '2px dashed' : 'none',
                    borderColor: isTarget ? 'primary.main' : 'grey.300',
                    transition: 'border-color 0.15s ease',
                  }}
                  onDragOver={(e) => handleDragOverLane(e, lane.id)}
                  onDrop={() => handleDropOnLane(lane.id, groups)}
                >
                  {renderLaneHeader(lane, stats)}

                  {groups.length === 0 ? (
                    <Box
                      sx={{
                        height: 200,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        border: '2px dashed',
                        borderColor: drag ? 'primary.main' : 'grey.300',
                        borderRadius: 2,
                        bgcolor: drag ? 'primary.50' : 'grey.50',
                        transition: 'all 0.2s',
                      }}
                    >
                      <Typography variant="body2" color="text.secondary">
                        ここに出品者グループをドラッグ&ドロップ
                      </Typography>
                    </Box>
                  ) : (
                    groups.map((group, index) => {
                      const key = groupStateKey(lane.id, group);
                      const firstId = group.items[0]?.id;
                      const isSelf = drag?.sourceLaneId === lane.id && drag.group.items[0]?.id === firstId;
                      return (
                        <Box key={key} onDragOver={(e) => handleDragOverGroup(e, lane.id, groups, index)}>
                          <DropIndicator
                            visible={!!drag && dropTarget?.laneId === lane.id && dropTarget.beforeItemId === firstId && !isSelf}
                          />
                          <LaneGroupCard
                            group={group}
                            seq={index + 1}
                            expanded={isExpanded(key)}
                            onToggleExpand={() => toggle(key)}
                            draggable={!disabled}
                            dragging={isSelf}
                            onDragStart={(e) => handleDragStart(e, group, lane.id)}
                            onDragEnd={handleDragEnd}
                            onRemove={() => onMoveGroup(group, lane.id, { laneId: null, beforeItemId: null })}
                          />
                          {index === groups.length - 1 && (
                            <DropIndicator
                              visible={!!drag && dropTarget?.laneId === lane.id && dropTarget.beforeItemId === null && !isSelf}
                            />
                          )}
                        </Box>
                      );
                    })
                  )}
                </Paper>
              </Grid>
            );
          })}
        </Grid>
      </Grid>
    </Grid>
  );
}
