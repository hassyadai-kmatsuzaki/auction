// 共通型定義

export interface Role {
  id: number;
  name: string;
  display_name: string;
}

export interface User {
  id: number;
  name: string;
  email: string;
  status: 'pending' | 'approved' | 'suspended' | 'rejected';
  phone?: string;
  postal_code?: string;
  prefecture?: string;
  city?: string;
  address_line1?: string;
  address_line2?: string;
  roles?: Role[];
  created_at: string;
  updated_at?: string;
}

export interface Auction {
  id: number;
  title: string;
  event_date: string;
  start_time: string;
  end_time?: string | null;
  status: 'preparing' | 'scheduled' | 'live' | 'finished' | 'cancelled';
  description?: string;
  lane_count?: number;
  deposit_required?: boolean;
  upload_deadline?: string | null;
  payment_deadline_hours?: number;
  shipping_deadline_hours?: number;
  items_count?: number;
  total_items?: number;
  total_sold?: number;
  total_sales?: number;
  can_edit?: boolean;
  created_by?: number;
  created_at?: string;
  updated_at?: string;
  /** scheduled のとき: 待機室に入室可能かどうか（null = live/finished など非該当） */
  entrance_allowed?: boolean | null;
}

export interface Item {
  id: number;
  auction_id: number;
  item_number: number;
  species_name: string;
  quantity: number;
  start_price: number;
  current_price: number;
  inspection_info?: string;
  individual_info?: string;
  notes?: string;
  is_premium: boolean;
  premium_fee?: number;
  thumbnail_path?: string;
  status: 'registered' | 'live' | 'sold' | 'unsold' | 'cancelled';
}

export interface ItemMedia {
  id: number;
  item_id: number;
  media_type: 'video_top' | 'video_side' | 'photo';
  file_path: string;
  file_size?: number;
  duration?: number;
  display_order: number;
}

export interface Lane {
  id: number;
  auction_id: number;
  lane_number: number;
  current_item?: Item;
  status: 'waiting' | 'active' | 'paused' | 'finished';
}

export interface Bid {
  id: number;
  item_id: number;
  bidder_id: number;
  bid_price: number;
  is_active: boolean;
  created_at: string;
}

export interface WonItem {
  id: number;
  item: Item;
  winner?: User;
  winning_price: number;
  total_amount: number;
  payment_status: 'pending' | 'paid' | 'refunded';
  payment_confirmed_at?: string;
  delivery_status: 'pending' | 'shipped' | 'completed';
  shipping_address?: string;
  shipped_at?: string;
  tracking_number?: string;
  notes?: string;
}

export interface Announcement {
  id: number;
  title: string;
  content: string;
  status: 'draft' | 'scheduled' | 'published' | 'hidden';
  target_roles: string[];
  is_important: boolean;
  published_at: string | null;
  created_by: number;
  updated_by?: number | null;
  is_read?: boolean;
  created_at: string;
  updated_at?: string;
}

export interface SystemSettings {
  site_name: string;
  contact_email: string;
  price_increment_rate: number;
  price_increment_min: number;
  countdown_seconds: number;
  premium_plan_fee: number;
}

// ============================================================
// ライブオークション専用型
// ============================================================

export interface LaneItem {
  id: number;
  item_number: number;
  species_name: string;
  seller_name?: string;
  quantity: number;
  quantity_unit?: string;
  current_price: number;
  inspection_info?: string;
  individual_info?: string;
  is_premium: boolean;
  thumbnail_path?: string;
  media?: ItemMedia[];
  active_bidders_count: number;
  /** カウントダウン残り秒数（0.5秒単位。表示時は Math.ceil で整数秒に変換） */
  countdown_seconds: number;
  my_bid_status: 'active' | 'inactive' | null;
  /** 自分の指値（上限価格） */
  my_limit_price?: number | null;
  my_limit_triggered?: boolean;
  phase?: 'bidding' | 'pre_bid' | 'freeze';
  pre_bid_remaining_seconds?: number;
  freeze_remaining_seconds?: number;
  freeze_countdown_seconds?: number;
}

export interface UpcomingItem {
  id: number;
  item_number: number;
  species_name: string;
  quantity: number;
  start_price: number;
  thumbnail_path?: string | null;
  is_premium: boolean;
  is_favorited?: boolean;
  my_limit_price?: number | null;
  my_limit_triggered?: boolean;
}

export interface LiveLane {
  lane_id: number;
  lane_number: number;
  lane_name: string | null;
  status: string;
  current_item: LaneItem | null;
  upcoming_items?: UpcomingItem[];
}

export interface LiveState {
  auction_id: number;
  auction_title: string;
  status: string;
  countdown_seconds: number;
  starting_countdown?: number;
  entrance_allowed?: boolean;
  entrance_at?: string;
  start_at?: string;
  venue_open_minutes_before_start?: number;
  message?: string;
  show_consent_screen?: boolean;
  price_increment_rate?: number;
  price_increment_min?: number;
  lanes: LiveLane[];
}

export interface WonItemSummary {
  id: number;
  item_number: number;
  species_name: string;
  quantity: number;
  quantity_unit?: string;
  winning_price: number;
  total_amount: number;
}

