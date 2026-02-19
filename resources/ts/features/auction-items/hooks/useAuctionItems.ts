import { useQuery } from '@tanstack/react-query';
import axios from '@/lib/axios';

interface AuctionItemsParams {
  auctionId: number;
  page?: number;
  perPage?: number;
  search?: string;
  sort?: string;
  status?: string;
}

const fetchAuctionItems = async ({ auctionId, ...params }: AuctionItemsParams) => {
  const res = await axios.get(`/api/participant/auctions/${auctionId}/items`, { params });
  return res.data.data;
};

export function useAuctionItems(params: AuctionItemsParams) {
  return useQuery({
    queryKey: ['auction-items', params],
    queryFn: () => fetchAuctionItems(params),
    staleTime: 30_000,
    placeholderData: (prev) => prev, // ページ切り替え時にちらつきを防ぐ
  });
}
