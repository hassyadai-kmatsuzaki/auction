import axios from '@/lib/axios';
import type { LiveState, WonItemSummary } from '@/types';

export const participantAuctionApi = {
  /** ライブ状態取得 */
  getLiveState: async (auctionId: number): Promise<LiveState> => {
    const res = await axios.get(`/api/participant/auctions/${auctionId}/live`);
    return res.data.data as LiveState;
  },

  /** 自分の落札一覧 */
  getMyWonItems: async (
    auctionId: number
  ): Promise<{ items: WonItemSummary[]; total_amount: number }> => {
    const res = await axios.get(`/api/participant/auctions/${auctionId}/my-won-items`);
    return res.data.data;
  },

  /** オークション一覧 */
  getAuctions: async () => {
    const res = await axios.get('/api/participant/auctions');
    return res.data.data;
  },
};
