import axios from '@/lib/axios';

export interface BulkBidLimitItem {
  id: number;
  item_number: number | string;
  exhibit_code: string | null;
  species_name: string;
  quantity: number;
  start_price: number;
  /** スタート価格帯の入札単位 */
  unit: number;
  /** 現在の指値（未設定は null） */
  limit_price: number | null;
  /** メダカ以外の種別（金魚・エビ等）。「その他」タブにまとめ、一括入札の対象外 */
  is_other: boolean;
}

/** 金額帯別上昇幅テーブルの1段（to_price null = 上限なし） */
export interface IncrementTier {
  from_price: number;
  to_price: number | null;
  increment_amount: number;
}

export interface BulkBidLimitData {
  auction: { id: number; title: string; status: string };
  /** 開催前（scheduled）かつ開始の close_minutes 分前より前なら true。false の間は確定できない */
  is_open: boolean;
  /** 受付締切（ISO8601）と、開始の何分前か */
  closes_at: string;
  close_minutes: number;
  /** 開催ごとの入札単位テーブル（from_price 昇順）。空ならrate/minで計算 */
  increment_tiers: IncrementTier[];
  increment_rate: number;
  increment_min: number;
  items: BulkBidLimitItem[];
}

export interface BulkBidLimitError {
  item_id: number;
  message: string;
}

export const bulkBidLimitApi = {
  /** 一括指値の対象生体（自分の出品・落札済・取下げを除く） */
  get: async (auctionId: number | string): Promise<BulkBidLimitData> => {
    const res = await axios.get(`/api/participant/auctions/${auctionId}/bulk-bid-limits`);
    return res.data.data;
  },

  /** 一括確定。1件でも不正なら何も保存されない（422 と data.errors） */
  store: async (auctionId: number | string, limits: { item_id: number; limit_price: number }[]) => {
    const res = await axios.post(`/api/participant/auctions/${auctionId}/bulk-bid-limits`, { limits });
    return res.data;
  },
};
