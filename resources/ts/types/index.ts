// 共通型定義

export interface User {
  id: number;
  name: string;
  email: string;
  user_type: 'admin' | 'participant';
  status: 'pending' | 'approved' | 'suspended';
  phone?: string;
  postal_code?: string;
  address?: string;
  created_at: string;
}

export interface Auction {
  id: number;
  title: string;
  event_date: string;
  start_time: string;
  status: 'preparing' | 'live' | 'finished' | 'cancelled';
  description?: string;
  total_items?: number;
  total_sold?: number;
  total_sales?: number;
  can_edit?: boolean;
}

export interface Item {
  id: number;
  auction_id: number;
  item_number: number;
  species_name: string;
  quantity: number;
  start_price: number;
  current_price: number;
  estimated_price?: number;
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
  is_published: boolean;
  published_at?: string;
  expires_at?: string;
  priority: 'low' | 'normal' | 'high';
  created_by: number;
  is_read?: boolean;
  created_at: string;
}

export interface SystemSettings {
  site_name: string;
  contact_email: string;
  price_increment_rate: number;
  price_increment_min: number;
  countdown_seconds: number;
  premium_plan_fee: number;
}

