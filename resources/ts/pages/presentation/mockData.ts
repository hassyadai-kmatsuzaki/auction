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
  seller_profile_image_url: null,
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
// ガイド付きデモ用データ（6レーン x 各1アイテム + upcoming 2）
// ====================================================================

const DEMO_IMG = '/img/demo/medaka';

export const GUIDED_INITIAL_ITEMS: LaneItem[] = [
  makeLaneItem({
    id: 1, species_name: 'エメキン 20匹(10ペア)', current_price: 300, quantity: 20, seller_name: 'ブリーダーA',
    thumbnail_path: `${DEMO_IMG}/エメキン_サムネ.jpg`,
    media: [
      { id: 101, item_id: 1, media_type: 'photo', file_path: `${DEMO_IMG}/エメキン_上見.jpg`, display_order: 1 },
      { id: 102, item_id: 1, media_type: 'photo', file_path: `${DEMO_IMG}/エメキン_上見②.jpg`, display_order: 2 },
      { id: 103, item_id: 1, media_type: 'video_side', file_path: `${DEMO_IMG}/エメキン_横見_10秒.mp4`, duration: 10, display_order: 3 },
    ],
  }),
  makeLaneItem({
    id: 2, species_name: '紅帝リアルロングフィン 35匹', current_price: 500, quantity: 35, seller_name: 'ブリーダーB',
    thumbnail_path: `${DEMO_IMG}/紅帝リアルロングフィン_サムネ.jpg`,
    media: [
      { id: 201, item_id: 2, media_type: 'photo', file_path: `${DEMO_IMG}/紅帝リアルロングフィン＿横見.jpg`, display_order: 1 },
      { id: 202, item_id: 2, media_type: 'photo', file_path: `${DEMO_IMG}/紅帝リアルロングフィン_上見.jpg`, display_order: 2 },
      { id: 203, item_id: 2, media_type: 'video_side', file_path: `${DEMO_IMG}/紅帝リアルロングフィン_横見_8秒.mp4`, duration: 8, display_order: 3 },
    ],
  }),
  makeLaneItem({
    id: 3, species_name: '三色体外光亜種 40匹', current_price: 400, quantity: 40, seller_name: 'ブリーダーC',
    thumbnail_path: `${DEMO_IMG}/三色体外光亜種_サムネ.jpg`,
    media: [
      { id: 301, item_id: 3, media_type: 'photo', file_path: `${DEMO_IMG}/三色体外光亜種_上見.jpg`, display_order: 1 },
      { id: 302, item_id: 3, media_type: 'photo', file_path: `${DEMO_IMG}/三色体外光亜種_上見②.jpg`, display_order: 2 },
      { id: 303, item_id: 3, media_type: 'video_top', file_path: `${DEMO_IMG}/三色体外光亜種_上見_8秒.mp4`, duration: 8, display_order: 3 },
    ],
  }),
  makeLaneItem({
    id: 4, species_name: '和墨ミッドナイトフリル 40匹', current_price: 600, quantity: 40, seller_name: 'ブリーダーD',
    thumbnail_path: `${DEMO_IMG}/和墨ミッドナイトフリル_サムネ.jpg`,
    media: [
      { id: 401, item_id: 4, media_type: 'photo', file_path: `${DEMO_IMG}/和墨ミッドナイトフリル_横見.jpg`, display_order: 1 },
      { id: 402, item_id: 4, media_type: 'photo', file_path: `${DEMO_IMG}/和墨ミッドナイトフリル＿上見.jpg`, display_order: 2 },
      { id: 403, item_id: 4, media_type: 'video_top', file_path: `${DEMO_IMG}/和墨ミッドナイトフリル_上見_8秒.mp4`, duration: 8, display_order: 3 },
    ],
  }),
  makeLaneItem({
    id: 5, species_name: '和墨白銀 20匹(10ペア)', current_price: 350, quantity: 20, seller_name: 'ブリーダーE',
    thumbnail_path: `${DEMO_IMG}/和墨白銀_サムネ.jpg`,
    media: [
      { id: 501, item_id: 5, media_type: 'photo', file_path: `${DEMO_IMG}/和墨白銀_横見.jpg`, display_order: 1 },
      { id: 502, item_id: 5, media_type: 'photo', file_path: `${DEMO_IMG}/和墨白銀_上見.jpg`, display_order: 2 },
      { id: 503, item_id: 5, media_type: 'video_side', file_path: `${DEMO_IMG}/和墨白銀_横見_10秒.mp4`, duration: 10, display_order: 3 },
    ],
  }),
  makeLaneItem({
    id: 6, species_name: '黒天幻龍 10匹(5ペア)', current_price: 800, quantity: 10, seller_name: 'ブリーダーF',
    thumbnail_path: `${DEMO_IMG}/黒天幻龍_サムネ.jpg`,
    media: [
      { id: 601, item_id: 6, media_type: 'photo', file_path: `${DEMO_IMG}/黒天幻龍_横見.jpg`, display_order: 1 },
      { id: 602, item_id: 6, media_type: 'video_side', file_path: `${DEMO_IMG}/黒天幻龍_10秒.MP4`, duration: 10, display_order: 2 },
    ],
  }),
];

export const GUIDED_INITIAL_LANES: LiveLane[] = [
  makeLane(1, 1, 'レーン 1', GUIDED_INITIAL_ITEMS[0]),
  makeLane(2, 2, 'レーン 2', GUIDED_INITIAL_ITEMS[1]),
  makeLane(3, 3, 'レーン 3', GUIDED_INITIAL_ITEMS[2]),
  makeLane(4, 4, 'レーン 4', GUIDED_INITIAL_ITEMS[3]),
  makeLane(5, 5, 'レーン 5', GUIDED_INITIAL_ITEMS[4]),
  makeLane(6, 6, 'レーン 6', GUIDED_INITIAL_ITEMS[5]),
];

export const GUIDED_UPCOMING: (UpcomingItem & { laneNumber: number })[] = [
  { id: 10, item_number: 7, species_name: 'エメキン 選別漏れ 30匹', start_price: 200, thumbnail_path: `${DEMO_IMG}/エメキン_サムネ.jpg`, is_premium: false, is_favorited: false, quantity: 30, laneNumber: 1 },
  { id: 11, item_number: 8, species_name: '紅帝リアルロングフィン 若魚 20匹', start_price: 400, thumbnail_path: `${DEMO_IMG}/紅帝リアルロングフィン_サムネ.jpg`, is_premium: false, is_favorited: true, quantity: 20, laneNumber: 2 },
];

// ====================================================================
// ガイドなしデモ用データ（6レーン x 各1アイテム）
// ====================================================================

const MEDAKA_SPECIES = [
  { id: 101, species_name: 'エメキン 20匹(10ペア)', price: 300, quantity: 20, premium: false, seller: 'ブリーダーA', thumbnail: `${DEMO_IMG}/エメキン_サムネ.jpg` },
  { id: 201, species_name: '紅帝リアルロングフィン 35匹', price: 500, quantity: 35, premium: false, seller: 'ブリーダーB', thumbnail: `${DEMO_IMG}/紅帝リアルロングフィン_サムネ.jpg` },
  { id: 301, species_name: '三色体外光亜種 40匹', price: 400, quantity: 40, premium: false, seller: 'ブリーダーC', thumbnail: `${DEMO_IMG}/三色体外光亜種_サムネ.jpg` },
  { id: 401, species_name: '和墨ミッドナイトフリル 40匹', price: 600, quantity: 40, premium: false, seller: 'ブリーダーD', thumbnail: `${DEMO_IMG}/和墨ミッドナイトフリル_サムネ.jpg` },
  { id: 501, species_name: '和墨白銀 20匹(10ペア)', price: 350, quantity: 20, premium: false, seller: 'ブリーダーE', thumbnail: `${DEMO_IMG}/和墨白銀_サムネ.jpg` },
  { id: 601, species_name: '黒天幻龍 10匹(5ペア)', price: 800, quantity: 10, premium: false, seller: 'ブリーダーF', thumbnail: `${DEMO_IMG}/黒天幻龍_サムネ.jpg` },
];

/** レーン1のアイテムキュー */
export const FREE_LANE1_ITEMS = MEDAKA_SPECIES.filter(s => s.id === 101)
  .map(s => makeLaneItem({ id: s.id, species_name: s.species_name, current_price: s.price, quantity: s.quantity, is_premium: s.premium, seller_name: s.seller, thumbnail_path: s.thumbnail }));

/** レーン2のアイテムキュー */
export const FREE_LANE2_ITEMS = MEDAKA_SPECIES.filter(s => s.id === 201)
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
  sellers?: string[];
}

export const MOCK_AUCTIONS: MockAuction[] = [
  { id: 1, title: 'デモフリーオークション', event_date: '2026-04-15', start_time: '13:00', status: 'scheduled', total_items: 120, entrance_allowed: true, description: '厳選された個体を多数出品！希少品種も見逃せない春の特別オークションです。', sellers: ['ブリーダーA', 'ブリーダーB', 'ブリーダーC', 'ブリーダーD', 'ブリーダーE', 'ブリーダーF'] },
  { id: 2, title: '2026年GWスペシャルオークション', event_date: '2026-05-03', start_time: '10:00', status: 'scheduled', total_items: 200, entrance_allowed: false, description: 'ゴールデンウィーク限定の大型オークション。初心者の方も大歓迎！', sellers: ['ブリーダーA', 'ブリーダーB', 'ブリーダーG'] },
  { id: 3, title: '2026年早春オークション', event_date: '2026-03-01', start_time: '13:00', status: 'finished', total_items: 80, description: '早春の人気品種を集めたオークションです。', sellers: ['ブリーダーC', 'ブリーダーD'] },
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
    item: { id: 1, item_number: 1, species_name: 'エメキン 20匹(10ペア)', quantity: 20, thumbnail_path: `${DEMO_IMG}/エメキン_サムネ.jpg`, auction: { id: 3, title: '2026年早春オークション', event_date: '2026-03-01' } },
    winning_price: 850, quantity: 20, total_amount: 18700, commission_amount: 1700,
    payment_status: 'confirmed', delivery_status: 'shipped',
    shipping_address: '〒150-0001 東京都渋谷区神宮前1-2-3 メダカハイツ101', tracking_number: '1234-5678-9012', shipping_company: 'ヤマト運輸', shipped_at: '2026-03-10',
  },
  {
    id: 2,
    item: { id: 2, item_number: 2, species_name: '紅帝リアルロングフィン 35匹', quantity: 35, thumbnail_path: `${DEMO_IMG}/紅帝リアルロングフィン_サムネ.jpg`, auction: { id: 3, title: '2026年早春オークション', event_date: '2026-03-01' } },
    winning_price: 1200, quantity: 35, total_amount: 46200, commission_amount: 4200,
    payment_status: 'confirmed', delivery_status: 'completed',
    shipping_address: '〒150-0001 東京都渋谷区神宮前1-2-3 メダカハイツ101', shipped_at: '2026-03-08',
  },
  {
    id: 3,
    item: { id: 3, item_number: 3, species_name: '三色体外光亜種 40匹', quantity: 40, thumbnail_path: `${DEMO_IMG}/三色体外光亜種_サムネ.jpg`, auction: { id: 3, title: '2026年早春オークション', event_date: '2026-03-01' } },
    winning_price: 420, quantity: 40, total_amount: 18480, commission_amount: 1680,
    payment_status: 'pending', payment_deadline: '2026-03-19', delivery_status: 'pending',
    shipping_address: '未設定',
  },
  {
    id: 4,
    item: { id: 4, item_number: 4, species_name: '和墨ミッドナイトフリル 40匹', quantity: 40, thumbnail_path: `${DEMO_IMG}/和墨ミッドナイトフリル_サムネ.jpg`, auction: { id: 3, title: '2026年早春オークション', event_date: '2026-03-01' } },
    winning_price: 1500, quantity: 40, total_amount: 66000, commission_amount: 6000,
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
  media?: { id: number; item_id: number; media_type: string; file_path: string; duration?: number; display_order: number }[];
  seller_name?: string;
  seller_profile_image_url?: string | null;
}

/** GUIDED_INITIAL_ITEMS から media 配列を id で引く */
const mediaForItem = (id: number) => GUIDED_INITIAL_ITEMS.find(i => i.id === id)?.media ?? [];

export const MOCK_ITEMS: ItemData[] = [
  { id: 1, item_number: 1, species_name: 'エメキン 20匹(10ペア)', quantity: 20, start_price: 200, current_price: 300, status: 'registered', is_premium: false, thumbnail_path: `${DEMO_IMG}/エメキン_サムネ.jpg`, inspection_info: '発色良好、ペア選別済み', media: mediaForItem(1), seller_name: 'ブリーダーA' },
  { id: 2, item_number: 2, species_name: '紅帝リアルロングフィン 35匹', quantity: 35, start_price: 300, current_price: 500, status: 'registered', is_premium: false, thumbnail_path: `${DEMO_IMG}/紅帝リアルロングフィン_サムネ.jpg`, inspection_info: 'ロングフィン確認済み', media: mediaForItem(2), seller_name: 'ブリーダーB' },
  { id: 3, item_number: 3, species_name: '三色体外光亜種 40匹', quantity: 40, start_price: 300, current_price: 400, status: 'registered', is_premium: false, thumbnail_path: `${DEMO_IMG}/三色体外光亜種_サムネ.jpg`, inspection_info: '三色バランス良好', media: mediaForItem(3), seller_name: 'ブリーダーC' },
  { id: 4, item_number: 4, species_name: '和墨ミッドナイトフリル 40匹', quantity: 40, start_price: 400, current_price: 600, status: 'registered', is_premium: false, thumbnail_path: `${DEMO_IMG}/和墨ミッドナイトフリル_サムネ.jpg`, inspection_info: '墨質良好', media: mediaForItem(4), seller_name: 'ブリーダーD' },
  { id: 5, item_number: 5, species_name: '和墨白銀 20匹(10ペア)', quantity: 20, start_price: 250, current_price: 350, status: 'registered', is_premium: false, thumbnail_path: `${DEMO_IMG}/和墨白銀_サムネ.jpg`, inspection_info: '白銀体外光あり', media: mediaForItem(5), seller_name: 'ブリーダーE' },
  { id: 6, item_number: 6, species_name: '黒天幻龍 10匹(5ペア)', quantity: 10, start_price: 500, current_price: 800, status: 'registered', is_premium: false, thumbnail_path: `${DEMO_IMG}/黒天幻龍_サムネ.jpg`, inspection_info: '希少個体', media: mediaForItem(6), seller_name: 'ブリーダーF' },
];

export const MOCK_LANES_LIST = [
  { lane_name: 'レーン 1', items: MOCK_ITEMS.filter(i => i.id === 1) },
  { lane_name: 'レーン 2', items: MOCK_ITEMS.filter(i => i.id === 2) },
  { lane_name: 'レーン 3', items: MOCK_ITEMS.filter(i => i.id === 3) },
  { lane_name: 'レーン 4', items: MOCK_ITEMS.filter(i => i.id === 4) },
  { lane_name: 'レーン 5', items: MOCK_ITEMS.filter(i => i.id === 5) },
  { lane_name: 'レーン 6', items: MOCK_ITEMS.filter(i => i.id === 6) },
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
  thumbnail_path?: string;
  item_number?: number;
  lane_number?: number;
}

// ====================================================================
// ItemData → LaneItem 変換（デモの詳細ダイアログ用）
// ====================================================================

export const itemDataToLaneItem = (item: ItemData): LaneItem => makeLaneItem({
  id: item.id,
  species_name: item.species_name,
  current_price: item.current_price,
  quantity: item.quantity,
  thumbnail_path: item.thumbnail_path,
  media: item.media as LaneItem['media'],
  is_premium: item.is_premium,
  seller_name: item.seller_name ?? 'デモ出品者',
  seller_profile_image_url: item.seller_profile_image_url ?? null,
  inspection_info: item.inspection_info,
});

// ====================================================================
// 出品一覧ID ↔ オークションID マッピング
// MOCK_ITEMS.id → FREE_LANE_ITEMS.id の対応（species_name で紐付け）
// ====================================================================

export const ITEM_ID_TO_LANE_ITEM_ID: Record<number, number> = {
  1: 101,   // エメキン
  2: 201,   // 紅帝リアルロングフィン
  3: 301,   // 三色体外光亜種
  4: 401,   // 和墨ミッドナイトフリル
  5: 501,   // 和墨白銀
  6: 601,   // 黒天幻龍
};

export const LANE_ITEM_ID_TO_ITEM_ID: Record<number, number> =
  Object.fromEntries(Object.entries(ITEM_ID_TO_LANE_ITEM_ID).map(([k, v]) => [Number(v), Number(k)]));
