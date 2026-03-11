import { useMutation, useQueryClient } from '@tanstack/react-query';
import { sellerOrderApi } from '../api/sellerOrderApi';

export const useReorderSellers = (auctionId: number) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (sellerOrders: Array<{ seller_profile_id: number; display_order: number }>) =>
      sellerOrderApi.reorderSellers(auctionId, sellerOrders),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sellerOrder', auctionId] });
    },
  });
};
