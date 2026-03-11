import { useState, useCallback, useEffect } from 'react';
import { Box } from '@mui/material';
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
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { debounce } from 'lodash';
import SellerOrderAccordion from './SellerOrderAccordion';
import { SellerOrder } from '../api/sellerOrderApi';
import { useReorderSellers } from '../hooks/useReorderSellers';

interface SellerOrderListProps {
  auctionId: number;
  sellers: SellerOrder[];
  isEditable: boolean;
}

export default function SellerOrderList({ auctionId, sellers: initialSellers, isEditable }: SellerOrderListProps) {
  const [sellers, setSellers] = useState(initialSellers);
  const [expandedSeller, setExpandedSeller] = useState<number | null>(null);
  const reorderMutation = useReorderSellers(auctionId);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    setSellers(initialSellers);
  }, [initialSellers]);

  // debounce付きの保存関数
  const debouncedSave = useCallback(
    debounce((reorderedSellers: SellerOrder[]) => {
      const sellersData = reorderedSellers.map((seller, index) => ({
        seller_profile_id: seller.seller_profile_id,
        display_order: index + 1,
      }));
      reorderMutation.mutate(sellersData);
    }, 1000),
    [auctionId]
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setSellers((sellers) => {
        const oldIndex = sellers.findIndex((s) => s.seller_profile_id === active.id);
        const newIndex = sellers.findIndex((s) => s.seller_profile_id === over.id);
        const newSellers = arrayMove(sellers, oldIndex, newIndex).map((seller, index) => ({
          ...seller,
          display_order: index + 1,
        }));
        
        // debounce付きで保存
        if (isEditable) {
          debouncedSave(newSellers);
        }
        
        return newSellers;
      });
    }
  };

  const handleExpand = (sellerId: number) => {
    setExpandedSeller(expandedSeller === sellerId ? null : sellerId);
  };

  return (
    <Box>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext
          items={sellers.map((s) => s.seller_profile_id)}
          strategy={verticalListSortingStrategy}
        >
          {sellers.map((seller) => (
            <SellerOrderAccordion
              key={seller.seller_profile_id}
              auctionId={auctionId}
              seller={seller}
              isEditable={isEditable}
              expanded={expandedSeller === seller.seller_profile_id}
              onExpand={handleExpand}
            />
          ))}
        </SortableContext>
      </DndContext>
    </Box>
  );
}
