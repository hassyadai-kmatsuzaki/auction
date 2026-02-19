import type { Meta, StoryObj } from '@storybook/react-vite';
import { LaneCard } from './LaneCard';
import type { LiveLane } from '@/types';

const baseLane: LiveLane = {
  lane_id: 1,
  lane_number: 1,
  lane_name: '幹之系',
  status: 'active',
  current_item: {
    id: 101,
    item_number: 1,
    species_name: '幹之メダカ（フルボディ）',
    quantity: 5,
    quantity_unit: 'fish',
    current_price: 3500,
    is_premium: false,
    thumbnail_path: '/img/noimage.png',
    active_bidders_count: 1,
    countdown_seconds: 8,
    my_bid_status: null,
    phase: 'bidding',
    pre_bid_remaining_seconds: 0,
  },
};

const meta: Meta<typeof LaneCard> = {
  title: 'AuctionLive/LaneCard',
  component: LaneCard,
  tags: ['autodocs'],
  parameters: { layout: 'centered' },
  decorators: [(Story) => <div style={{ width: 360 }}><Story /></div>],
};

export default meta;
type Story = StoryObj<typeof LaneCard>;

export const Default: Story = {
  name: '通常（未入札）',
  args: { lane: baseLane, isLoading: false, onBidToggle: () => {}, onDetailOpen: () => {} },
};

export const Bidding: Story = {
  name: '入札中',
  args: {
    lane: { ...baseLane, current_item: { ...baseLane.current_item!, my_bid_status: 'active' } },
    isLoading: false, onBidToggle: () => {}, onDetailOpen: () => {},
  },
};

export const Competitive: Story = {
  name: '競合中（2人以上）',
  args: {
    lane: {
      ...baseLane,
      current_item: {
        ...baseLane.current_item!,
        active_bidders_count: 3,
        countdown_seconds: 1,
        my_bid_status: 'active',
      },
    },
    isLoading: false, onBidToggle: () => {}, onDetailOpen: () => {},
  },
};

export const PreBid: Story = {
  name: '入札開始待機中（pre_bid）',
  args: {
    lane: {
      ...baseLane,
      current_item: {
        ...baseLane.current_item!,
        phase: 'pre_bid',
        pre_bid_remaining_seconds: 4,
        active_bidders_count: 0,
      },
    },
    isLoading: false, onBidToggle: () => {}, onDetailOpen: () => {},
  },
};

export const Premium: Story = {
  name: 'プレミアム商品',
  args: {
    lane: { ...baseLane, current_item: { ...baseLane.current_item!, is_premium: true } },
    isLoading: false, onBidToggle: () => {}, onDetailOpen: () => {},
  },
};

export const Empty: Story = {
  name: '待機中（商品なし）',
  args: {
    lane: { ...baseLane, current_item: null, status: 'waiting' },
    isLoading: false, onBidToggle: () => {}, onDetailOpen: () => {},
  },
};

export const Finished: Story = {
  name: '全出品終了',
  args: {
    lane: { ...baseLane, current_item: null, status: 'finished' },
    isLoading: false, onBidToggle: () => {}, onDetailOpen: () => {},
  },
};
