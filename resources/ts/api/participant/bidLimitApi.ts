import axios from '@/lib/axios';

export interface BidLimitData {
  limit_price: number | null;
  is_triggered: boolean;
}

export interface QuickOptions {
  base_price: number;
  x1_5: number;
  x2: number;
  x2_5: number;
  x3: number;
}

export const bidLimitApi = {
  /** 指値の一括取得 */
  getMany: async (itemIds: number[]): Promise<Record<number, BidLimitData | null>> => {
    const params = new URLSearchParams();
    itemIds.forEach((id) => params.append('item_ids[]', String(id)));
    const res = await axios.get(`/api/participant/bid-limits?${params}`);
    return res.data.data.limits;
  },

  /** 単一商品の指値 + クイック選択肢取得 */
  getOne: async (itemId: number): Promise<BidLimitData & { quick_options: QuickOptions }> => {
    const res = await axios.get(`/api/participant/bid-limits/${itemId}`);
    return res.data.data;
  },

  /** 指値を設定・更新 */
  set: async (itemId: number, limitPrice: number) => {
    const res = await axios.post('/api/participant/bid-limits', {
      item_id: itemId,
      limit_price: limitPrice,
    });
    return res.data;
  },

  /** 指値を解除 */
  remove: async (itemId: number) => {
    const res = await axios.delete(`/api/participant/bid-limits/${itemId}`);
    return res.data;
  },
};
