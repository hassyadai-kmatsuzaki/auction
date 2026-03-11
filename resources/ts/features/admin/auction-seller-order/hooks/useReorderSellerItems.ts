import { useMutation, useQueryClient } from '@tanstack/react-query';
import { sellerOrderApi } from '../api/sellerOrderApi';

export const useReorderSellerItems = (auctionId: number, sellerProfileId: number) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (items: Array<{ item_id: number; seller_display_order: number }>) =>
      sellerOrderApi.reorderItems(auctionId, sellerProfileId, items),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sellerOrder', auctionId] });
    },
  });
};
