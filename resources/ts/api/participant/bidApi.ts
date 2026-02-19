import axios from '@/lib/axios';

export interface BidToggleResult {
  success: boolean;
  message: string;
  data?: {
    item_id: number;
    is_active: boolean;
    current_price: number;
    active_bidder_count: number;
    pre_bid_remaining_seconds?: number;
  };
}

export const bidApi = {
  /** 入札ON/OFF切り替え */
  toggle: async (itemId: number, isActive: boolean): Promise<BidToggleResult> => {
    const res = await axios.post('/api/participant/bids', {
      item_id: itemId,
      is_active: isActive,
    });
    return res.data as BidToggleResult;
  },

  /** 自分のアクティブな入札一覧 */
  getMyActive: async () => {
    const res = await axios.get('/api/participant/bids/my-active');
    return res.data.data;
  },
};
