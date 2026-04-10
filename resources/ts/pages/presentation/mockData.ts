/**
 * デモ画面用のモックデータ
 * ガイド付きデモ・ガイドなしデモの両方で使用
 */
import type { LaneItem, LiveLane, UpcomingItem } from '@/types';

// ====================================================================
// Item factory
// ====================================================================

export const makeLaneItem = (overrides: Partial<LaneItem> & { id: number; species_name: string }): LaneItem => ({
  item_number: overrides.id,
  current_price: 3000,
  quantity: 2,
  quantity_unit: 'fish',
  active_bidders_count: 0,
  countdown_seconds: 8,
  my_bid_status: null,
  is_premium: false,
  thumbnail_path: '/img/noimage.png',
  phase: 'bidding',
  pre_bid_remaining_seconds: 0,
  freeze_remaining_seconds: 0,
  freeze_countdown_seconds: 3,
  my_limit_price: null,
  my_limit_triggered: false,
  seller_name: 'デモ出品者',
  ...overrides,
});

export const makeLane = (id: number, num: number, name: string, item: LaneItem): LiveLane => ({
  lane_id: id,
  lane_number: num,
  lane_name: name,
  status: 'active',
  current_item: item,
  upcoming_items: [],
});

// ====================================================================
// ガイド付きデモ用データ（2レーン x 各1アイテム + upcoming 2）
// ====================================================================

export const GUIDED_INITIAL_ITEMS: LaneItem[] = [
  makeLaneItem({ id: 1, species_name: '紅白ラメ ペア', current_price: 300, quantity: 2, seller_name: 'ブリーダーA', thumbnail_path: '/img/medaka/紅白ラメ.jpg' }),
  makeLaneItem({ id: 2, species_name: '幹之フルボディ', current_price: 500, quantity: 5, is_premium: true, seller_name: 'ブリーダーB', thumbnail_path: '/img/medaka/幹之フルボディ.jpg' }),
];

export const GUIDED_INITIAL_LANES: LiveLane[] = [
  makeLane(1, 1, 'レーン 1', GUIDED_INITIAL_ITEMS[0]),
  makeLane(2, 2, 'レーン 2', GUIDED_INITIAL_ITEMS[1]),
];

export const GUIDED_UPCOMING: (UpcomingItem & { laneNumber: number })[] = [
  { id: 10, item_number: 3, species_name: '三色ラメ', start_price: 400, thumbnail_path: '/img/medaka/三色ラメ.jpeg', is_premium: false, is_favorited: false, quantity: 3, laneNumber: 1 },
  { id: 11, item_number: 4, species_name: 'オロチ ペア', start_price: 600, thumbnail_path: '/img/medaka/オロチ.jpg', is_premium: true, is_favorited: true, quantity: 2, laneNumber: 2 },
];

// ====================================================================
// ガイドなしデモ用データ（2レーン x 3アイテム = 6アイテム）
// ====================================================================

const MEDAKA_SPECIES = [
  // レーン1（3匹）
  { id: 101, species_name: '紅白ラメ ペア', price: 300, quantity: 2, premium: false, seller: 'ブリーダーA', thumbnail: '/img/medaka/紅白ラメ.jpg' },
  { id: 102, species_name: '三色ラメ 3匹', price: 400, quantity: 3, premium: false, seller: 'ブリーダーB', thumbnail: '/img/medaka/三色ラメ.jpeg' },
  { id: 103, species_name: 'サファイア ペア', price: 800, quantity: 2, premium: true, seller: 'ブリーダーC', thumbnail: '/img/medaka/02.png' },
  // レーン2（3匹）
  { id: 201, species_name: '幹之フルボディ', price: 500, quantity: 5, premium: true, seller: 'ブリーダーB', thumbnail: '/img/medaka/幹之フルボディ.jpg' },
  { id: 202, species_name: 'オロチ ペア', price: 600, quantity: 2, premium: true, seller: 'ブリーダーD', thumbnail: '/img/medaka/オロチ.jpg' },
  { id: 203, species_name: '女雛 3匹', price: 250, quantity: 3, premium: false, seller: 'ブリーダーA', thumbnail: '/img/medaka/05.png' },
];

/** レーン1のアイテムキュー（3個） */
export const FREE_LANE1_ITEMS = MEDAKA_SPECIES.filter(s => s.id >= 101 && s.id <= 103)
  .map(s => makeLaneItem({ id: s.id, species_name: s.species_name, current_price: s.price, quantity: s.quantity, is_premium: s.premium, seller_name: s.seller, thumbnail_path: s.thumbnail }));

/** レーン2のアイテムキュー（3個） */
export const FREE_LANE2_ITEMS = MEDAKA_SPECIES.filter(s => s.id >= 201 && s.id <= 203)
  .map(s => makeLaneItem({ id: s.id, species_name: s.species_name, current_price: s.price, quantity: s.quantity, is_premium: s.premium, seller_name: s.seller, thumbnail_path: s.thumbnail }));

// ====================================================================
// オークション・お知らせ等のモックデータ
// ====================================================================

export interface MockAuction {
  id: number;
  title: string;
  event_date: string;
  start_time: string;
  status: string;
  description?: string;
  total_items?: number;
  entrance_allowed?: boolean;
}

export const MOCK_AUCTIONS: MockAuction[] = [
  { id: 1, title: 'デモフリーオークション', event_date: '2026-04-15', start_time: '13:00', status: 'scheduled', total_items: 120, entrance_allowed: true, description: '厳選された個体を多数出品！希少品種も見逃せない春の特別オークションです。' },
  { id: 2, title: '2026年GWスペシャルオークション', event_date: '2026-05-03', start_time: '10:00', status: 'scheduled', total_items: 200, entrance_allowed: false, description: 'ゴールデンウィーク限定の大型オークション。初心者の方も大歓迎！' },
  { id: 3, title: '2026年早春オークション', event_date: '2026-03-01', start_time: '13:00', status: 'finished', total_items: 80, description: '早春の人気品種を集めたオークションです。' },
];

export interface MockAnnouncement {
  id: number;
  title: string;
  content: string;
  published_at: string;
  is_important: boolean;
}

export const MOCK_ANNOUNCEMENTS: MockAnnouncement[] = [
  { id: 1, title: 'GWスペシャルオークション出品受付開始', content: 'ゴールデンウィーク限定の大型オークションの出品受付を開始しました。出品をご希望の方は、マイページの出品管理から申請をお願いいたします。', published_at: '2026-03-15T10:00:00', is_important: true },
  { id: 2, title: 'システムメンテナンスのお知らせ', content: '2026年3月20日 02:00〜06:00にシステムメンテナンスを実施いたします。', published_at: '2026-03-10T00:02:00', is_important: true },
  { id: 3, title: 'デモフリーオークション出品者募集中', content: 'デモフリーオークションの出品者を募集しています。', published_at: '2026-03-01T09:00:00', is_important: false },
  { id: 4, title: '新機能「指値（上限価格）」のご案内', content: '入札時に上限価格を設定できる「指値」機能をリリースしました。', published_at: '2026-02-20T05:36:00', is_important: false },
  { id: 5, title: '利用規約の一部改定について', content: '2026年3月1日より利用規約の一部を改定いたしました。', published_at: '2026-02-15T05:36:00', is_important: false },
];

export interface MockWonItem {
  id: number;
  item: {
    id: number;
    item_number: number;
    species_name: string;
    quantity: number;
    thumbnail_path: string;
    auction: { id: number; title: string; event_date: string };
  };
  winning_price: number;
  quantity: number;
  total_amount: number;
  commission_amount: number;
  payment_status: 'pending' | 'paid' | 'confirmed';
  payment_deadline?: string;
  delivery_status: 'pending' | 'preparing' | 'shipped' | 'completed';
  shipping_address: string;
  tracking_number?: string;
  shipping_company?: string;
  shipped_at?: string;
}

export const MOCK_WON_ITEMS: MockWonItem[] = [
  {
    id: 1,
    item: { id: 1, item_number: 12, species_name: '紅白ラメ ペア', quantity: 2, thumbnail_path: '/img/medaka/紅白ラメ.jpg', auction: { id: 3, title: '2026年早春オークション', event_date: '2026-03-01' } },
    winning_price: 850, quantity: 2, total_amount: 1870, commission_amount: 170,
    payment_status: 'confirmed', delivery_status: 'shipped',
    shipping_address: '〒150-0001 東京都渋谷区神宮前1-2-3 メダカハイツ101', tracking_number: '1234-5678-9012', shipping_company: 'ヤマト運輸', shipped_at: '2026-03-10',
  },
  {
    id: 2,
    item: { id: 2, item_number: 28, species_name: '幹之フルボディ', quantity: 5, thumbnail_path: '/img/medaka/幹之フルボディ.jpg', auction: { id: 3, title: '2026年早春オークション', event_date: '2026-03-01' } },
    winning_price: 1200, quantity: 5, total_amount: 6600, commission_amount: 600,
    payment_status: 'confirmed', delivery_status: 'completed',
    shipping_address: '〒150-0001 東京都渋谷区神宮前1-2-3 メダカハイツ101', shipped_at: '2026-03-08',
  },
  {
    id: 3,
    item: { id: 3, item_number: 55, species_name: '楊貴妃ダルマ', quantity: 1, thumbnail_path: '/img/medaka/楊貴妃ダルマ.jpeg', auction: { id: 3, title: '2026年早春オークション', event_date: '2026-03-01' } },
    winning_price: 420, quantity: 1, total_amount: 462, commission_amount: 42,
    payment_status: 'pending', payment_deadline: '2026-03-19', delivery_status: 'pending',
    shipping_address: '未設定',
  },
  {
    id: 4,
    item: { id: 4, item_number: 71, species_name: 'サファイア ペア', quantity: 2, thumbnail_path: '/img/medaka/01.png', auction: { id: 3, title: '2026年早春オークション', event_date: '2026-03-01' } },
    winning_price: 1500, quantity: 2, total_amount: 3300, commission_amount: 300,
    payment_status: 'paid', delivery_status: 'preparing',
    shipping_address: '〒150-0001 東京都渋谷区神宮前1-2-3 メダカハイツ101',
  },
];

// ====================================================================
// 出品一覧用データ
// ====================================================================

export interface ItemData {
  id: number;
  item_number: number;
  species_name: string;
  quantity: number;
  start_price: number;
  current_price: number;
  status: string;
  is_premium: boolean;
  thumbnail_path?: string;
  inspection_info?: string;
}

export const MOCK_ITEMS: ItemData[] = [
  { id: 1, item_number: 1, species_name: '紅白ラメ ペア', quantity: 2, start_price: 200, current_price: 350, status: 'registered', is_premium: false, thumbnail_path: '/img/medaka/紅白ラメ.jpg', inspection_info: '体長3cm前後、発色良好' },
  { id: 2, item_number: 2, species_name: '幹之フルボディ', quantity: 5, start_price: 300, current_price: 300, status: 'registered', is_premium: true, thumbnail_path: '/img/medaka/幹之フルボディ.jpg', inspection_info: 'フルボディ確認済み' },
  { id: 3, item_number: 3, species_name: '楊貴妃ダルマ', quantity: 1, start_price: 150, current_price: 150, status: 'registered', is_premium: false, thumbnail_path: '/img/medaka/楊貴妃ダルマ.jpeg' },
  { id: 4, item_number: 4, species_name: '三色ラメ 3匹セット', quantity: 3, start_price: 400, current_price: 400, status: 'registered', is_premium: false, thumbnail_path: '/img/medaka/三色ラメ.jpeg', inspection_info: '三色バランス良好' },
  { id: 5, item_number: 5, species_name: 'オロチ ペア', quantity: 2, start_price: 600, current_price: 600, status: 'registered', is_premium: true, thumbnail_path: '/img/medaka/オロチ.jpg', inspection_info: '漆黒度S級' },
  { id: 6, item_number: 6, species_name: '夜桜ゴールド', quantity: 1, start_price: 350, current_price: 350, status: 'registered', is_premium: false, thumbnail_path: '/img/medaka/夜桜ゴールド.jpg' },
  { id: 7, item_number: 7, species_name: '煌 3匹セット', quantity: 3, start_price: 500, current_price: 500, status: 'registered', is_premium: true, thumbnail_path: '/img/medaka/01.png', inspection_info: 'ラメ数100以上' },
  { id: 8, item_number: 8, species_name: 'サファイア ペア', quantity: 2, start_price: 800, current_price: 800, status: 'registered', is_premium: true, thumbnail_path: '/img/medaka/02.png' },
  { id: 9, item_number: 9, species_name: 'ブラックダイヤ', quantity: 1, start_price: 450, current_price: 450, status: 'registered', is_premium: false, thumbnail_path: '/img/medaka/03.png', inspection_info: '体外光あり' },
  { id: 10, item_number: 10, species_name: '松井ヒレ長 ペア', quantity: 2, start_price: 300, current_price: 300, status: 'registered', is_premium: false, thumbnail_path: '/img/medaka/04.png' },
];

export const MOCK_LANES_LIST = [
  { lane_name: 'レーン 1', items: MOCK_ITEMS.filter((_, i) => i < 5) },
  { lane_name: 'レーン 2', items: MOCK_ITEMS.filter((_, i) => i >= 5) },
];

// ====================================================================
// CPUキャラクター定義
// ====================================================================

export interface CpuCharacter {
  id: number;
  name: string;
  /** 入札する確率 (0-1) */
  bidProbability: number;
  /** 指値上限（開始価格の何倍まで入札するか） */
  maxPriceMultiplier: number;
  /** 入札間隔 (ms) - 最小値 */
  bidIntervalMin: number;
  /** 入札間隔 (ms) - 最大値 */
  bidIntervalMax: number;
  /** 興味のあるレーン (null=全レーン) */
  preferredLanes: number[] | null;
}

export const CPU_CHARACTERS: CpuCharacter[] = [
  { id: 1, name: '田中さん', bidProbability: 0.7, maxPriceMultiplier: 2.0, bidIntervalMin: 3000, bidIntervalMax: 8000, preferredLanes: null },
  { id: 2, name: '鈴木さん', bidProbability: 0.5, maxPriceMultiplier: 3.0, bidIntervalMin: 4000, bidIntervalMax: 10000, preferredLanes: [1] },
  { id: 3, name: '佐藤さん', bidProbability: 0.8, maxPriceMultiplier: 1.5, bidIntervalMin: 2000, bidIntervalMax: 6000, preferredLanes: null },
  { id: 4, name: '高橋さん', bidProbability: 0.6, maxPriceMultiplier: 2.5, bidIntervalMin: 3000, bidIntervalMax: 9000, preferredLanes: [2, 3] },
  { id: 5, name: '渡辺さん', bidProbability: 0.4, maxPriceMultiplier: 4.0, bidIntervalMin: 5000, bidIntervalMax: 12000, preferredLanes: null },
  { id: 6, name: '伊藤さん', bidProbability: 0.9, maxPriceMultiplier: 1.8, bidIntervalMin: 2000, bidIntervalMax: 5000, preferredLanes: [1, 2] },
  { id: 7, name: '山本さん', bidProbability: 0.3, maxPriceMultiplier: 5.0, bidIntervalMin: 6000, bidIntervalMax: 15000, preferredLanes: [3] },
  { id: 8, name: '中村さん', bidProbability: 0.65, maxPriceMultiplier: 2.2, bidIntervalMin: 3000, bidIntervalMax: 7000, preferredLanes: null },
  { id: 9, name: '小林さん', bidProbability: 0.55, maxPriceMultiplier: 1.6, bidIntervalMin: 4000, bidIntervalMax: 8000, preferredLanes: [1, 3] },
  { id: 10, name: '加藤さん', bidProbability: 0.75, maxPriceMultiplier: 2.8, bidIntervalMin: 2500, bidIntervalMax: 7000, preferredLanes: null },
];

// ====================================================================
// ヘルパー関数
// ====================================================================

export function getDaysUntil(dateString: string): string {
  const target = new Date(dateString + 'T00:00:00');
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const diff = Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  if (diff <= 0) return '本日開催';
  if (diff === 1) return 'あと1日';
  return `あと${diff}日`;
}

export function formatDate(dateString: string) {
  const date = new Date(dateString);
  return date.toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' });
}

export function formatDateTime(dateString: string) {
  return new Date(dateString).toLocaleString('ja-JP', {
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
  });
}

export const STATUS_CONFIG: Record<string, { label: string; color: 'default' | 'primary' | 'success' | 'warning' | 'error' }> = {
  registered: { label: '出品中', color: 'primary' },
  live: { label: '入札中', color: 'error' },
  sold: { label: '落札済', color: 'success' },
  unsold: { label: '不成立', color: 'default' },
};

export const getPaymentStatusLabel = (status: string) => {
  switch (status) {
    case 'pending': return '支払い待ち';
    case 'paid': return '入金済み';
    case 'confirmed': return '入金確認済み';
    default: return status;
  }
};

export const getPaymentStatusColor = (status: string) => {
  switch (status) {
    case 'pending': return { color: '#F59E0B', bgcolor: '#FEF3C7' };
    case 'paid':
    case 'confirmed': return { color: '#059669', bgcolor: '#ECFDF5' };
    default: return { color: '#64748B', bgcolor: '#F1F5F9' };
  }
};

export const getDeliveryStatusLabel = (status: string) => {
  switch (status) {
    case 'pending': return '発送待ち';
    case 'preparing': return '発送準備中';
    case 'shipped': return '配送中';
    case 'completed': return '配達完了';
    default: return status;
  }
};

export const getDeliveryStepIndex = (status: string) => {
  switch (status) {
    case 'pending':
    case 'preparing': return 0;
    case 'shipped': return 1;
    case 'completed': return 2;
    default: return 0;
  }
};

export const getTrackingUrl = (trackingNumber: string, company: string) => {
  const cleanNumber = trackingNumber.replace(/-/g, '');
  switch (company) {
    case 'ヤマト運輸':
      return `https://toi.kuronekoyamato.co.jp/cgi-bin/tneko?number=${cleanNumber}`;
    case '佐川急便':
      return `https://k2k.sagawa-exp.co.jp/p/web/okurijosearch.do?okurijoNo=${cleanNumber}`;
    case '日本郵便':
      return `https://trackings.post.japanpost.jp/services/srv/search/?requestNo1=${cleanNumber}`;
    default:
      return '';
  }
};

// ====================================================================
// WonEntry型（デモのオークション結果用）
// ====================================================================

export interface WonEntry {
  species_name: string;
  winning_price: number;
  quantity: number;
  total_amount: number;
}
