import axios from '@/lib/axios';

export interface AuctionAnalyticsSummary {
  auction: { id: number; title: string; status: string; event_date: string | null };
  metrics: {
    item_view: { count: number; unique_users: number };
    venue_enter: { count: number; unique_users: number };
    favorite_add: { count: number; manual: number; auto: number; unique_users: number };
    favorite_remove: { count: number };
    favorite_current: { count: number };
    bid_limit_set: { count: number; unique_users: number };
    bid_limit_remove: { count: number };
    bid_limit_current: { count: number };
    bidders: { unique_users: number };
  };
}

export interface AuctionAnalyticsItem {
  item_id: number;
  item_number: number | null;
  exhibit_code: string | null;
  species_name: string | null;
  views: number;
  view_users: number;
  favorites: number;
  bid_limits: number;
}

export interface AnalyticsUserRow {
  id: number;
  name: string | null;
  trade_name: string | null;
  email: string | null;
  cnt: number;
  last_at: string | null;
}

export type DrilldownEvent =
  | 'item_view'
  | 'venue_enter'
  | 'favorite_add'
  | 'favorite_remove'
  | 'bid_limit_set'
  | 'bid_limit_remove'
  | 'bid';

export interface AnalyticsOverview {
  range: { from: string; to: string };
  total_users: number;
  active_users: number;
  daily_trend: { date: string; uu: number }[];
  auctions: {
    auction_id: number;
    title: string;
    status: string;
    event_date: string | null;
    item_view_uu: number;
    venue_enter: number;
    favorites: number;
    bid_limits: number;
    bidders: number;
  }[];
}

export const adminAnalyticsApi = {
  auctionSummary: async (auctionId: number): Promise<AuctionAnalyticsSummary> => {
    const res = await axios.get(`/api/admin/auctions/${auctionId}/analytics`);
    return res.data.data;
  },
  auctionItems: async (auctionId: number): Promise<AuctionAnalyticsItem[]> => {
    const res = await axios.get(`/api/admin/auctions/${auctionId}/analytics/items`);
    return res.data.data.items;
  },
  auctionUsers: async (
    auctionId: number,
    event: DrilldownEvent,
    itemId?: number,
  ): Promise<AnalyticsUserRow[]> => {
    const res = await axios.get(`/api/admin/auctions/${auctionId}/analytics/users`, {
      params: { event, item_id: itemId },
    });
    return res.data.data.users;
  },
  overview: async (from?: string, to?: string): Promise<AnalyticsOverview> => {
    const res = await axios.get('/api/admin/analytics/overview', { params: { from, to } });
    return res.data.data;
  },
};
