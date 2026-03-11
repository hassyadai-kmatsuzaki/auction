import { useQuery } from '@tanstack/react-query';
import { sellerOrderApi } from '../api/sellerOrderApi';

export const useSellerOrder = (auctionId: number) => {
  return useQuery({
    queryKey: ['sellerOrder', auctionId],
    queryFn: () => sellerOrderApi.getSellerOrders(auctionId),
    staleTime: 30000, // 30秒
  });
};
