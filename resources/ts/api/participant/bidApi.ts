import axios from '@/lib/axios';

export interface BidToggleResult {
  success: boolean;
  message: string;
  /**
   * true=トースト非表示。サーバー再検証で正常に弾かれた競合
   * （pre_bid/freeze 中の滑り込み・価格不一致・他者が落札権利者）の合図。
   * UI は WS イベント (price.updated / bidder.updated) で同期される。
   */
  silent?: boolean;
  data?: {
    item_id: number;
    is_active: boolean;
    current_price: number;
    active_bidder_count: number;
    pre_bid_remaining_seconds?: number;
  };
}

export const bidApi = {
  /**
   * 入札参加（単方向入札仕様）
   *
   * - `signal` を渡すと、useBidToggle 側の AbortController で連打中の旧リクエストを
   *   即時キャンセルできる（負荷レビュー H1 指摘の二重 POST 抑止）。
   * - 旧 API 互換のため `isActive` は引数として残しているが、サーバーは
   *   `is_active=false` を 403 拒否する（v1.1 単方向入札仕様）。
   */
  toggle: async (
    itemId: number,
    isActive: boolean,
    signal?: AbortSignal,
  ): Promise<BidToggleResult> => {
    const res = await axios.post(
      '/api/participant/bids',
      { item_id: itemId, is_active: isActive },
      { signal },
    );
    return res.data as BidToggleResult;
  },

  /** 自分のアクティブな入札一覧 */
  getMyActive: async () => {
    const res = await axios.get('/api/participant/bids/my-active');
    return res.data.data;
  },
};
