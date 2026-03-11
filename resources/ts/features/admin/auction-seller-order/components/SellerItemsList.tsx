import { Box, Typography } from '@mui/material';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  horizontalListSortingStrategy,
} from '@dnd-kit/sortable';
import { useCallback, useEffect, useState } from 'react';
import { debounce } from 'lodash';
import ItemCard from './ItemCard';
import { SellerOrderItem } from '../api/sellerOrderApi';
import { useReorderSellerItems } from '../hooks/useReorderSellerItems';

interface SellerItemsListProps {
  auctionId: number;
  sellerProfileId: number;
  items: SellerOrderItem[];
  isEditable: boolean;
}

export default function SellerItemsList({
  auctionId,
  sellerProfileId,
  items: initialItems,
  isEditable,
}: SellerItemsListProps) {
  const [items, setItems] = useState(initialItems);
  const reorderMutation = useReorderSellerItems(auctionId, sellerProfileId);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    setItems(initialItems);
  }, [initialItems]);

  // debounce付きの保存関数
  const debouncedSave = useCallback(
    debounce((reorderedItems: SellerOrderItem[]) => {
      const itemsData = reorderedItems.map((item, index) => ({
        item_id: item.id,
        seller_display_order: index + 1,
      }));
      reorderMutation.mutate(itemsData);
    }, 1000),
    [auctionId, sellerProfileId]
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setItems((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id);
        const newIndex = items.findIndex((item) => item.id === over.id);
        const newItems = arrayMove(items, oldIndex, newIndex);
        
        // debounce付きで保存
        if (isEditable) {
          debouncedSave(newItems);
        }
        
        return newItems;
      });
    }
  };

  if (items.length === 0) {
    return (
      <Box sx={{ p: 2, textAlign: 'center' }}>
        <Typography variant="body2" color="text.secondary">
          生体がありません
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 2, backgroundColor: 'grey.50', borderRadius: 1 }}>
      <Typography variant="subtitle2" gutterBottom>
        生体の並び替え
      </Typography>
      
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={items.map((item) => item.id)} strategy={horizontalListSortingStrategy}>
          <Box
            sx={{
              display: 'flex',
              gap: 2,
              overflowX: 'auto',
              pb: 1,
              '&::-webkit-scrollbar': {
                height: 8,
              },
              '&::-webkit-scrollbar-thumb': {
                backgroundColor: 'rgba(0,0,0,0.2)',
                borderRadius: 4,
              },
            }}
          >
            {items.map((item) => (
              <ItemCard key={item.id} item={item} />
            ))}
          </Box>
        </SortableContext>
      </DndContext>
    </Box>
  );
}
