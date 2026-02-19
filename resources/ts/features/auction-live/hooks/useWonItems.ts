import { useQuery, useQueryClient } from '@tanstack/react-query';
import { participantAuctionApi } from '@/api/participant/auctionApi';

export const WON_ITEMS_QUERY_KEY = (auctionId: number) =>
  ['auction-won-items', auctionId] as const;

export function useWonItems(auctionId: number) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: WON_ITEMS_QUERY_KEY(auctionId),
    queryFn: () => participantAuctionApi.getMyWonItems(auctionId),
    staleTime: 10_000,
  });

  const refetch = () =>
    queryClient.invalidateQueries({ queryKey: WON_ITEMS_QUERY_KEY(auctionId) });

  return {
    items: query.data?.items ?? [],
    totalAmount: query.data?.total_amount ?? 0,
    isLoading: query.isLoading,
    refetch,
  };
}
