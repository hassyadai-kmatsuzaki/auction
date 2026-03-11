import { useMutation, useQueryClient } from '@tanstack/react-query';
import { sellerOrderApi } from '../api/sellerOrderApi';

export const useRandomizeSellerOrder = (auctionId: number) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => sellerOrderApi.randomize(auctionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sellerOrder', auctionId] });
    },
  });
};
