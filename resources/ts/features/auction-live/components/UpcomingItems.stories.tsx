import type { Meta, StoryObj } from '@storybook/react-vite';
import { UpcomingItems } from './UpcomingItems';
import type { LiveLane } from '@/types';

const meta: Meta<typeof UpcomingItems> = {
  title: 'AuctionLive/UpcomingItems',
  component: UpcomingItems,
  tags: ['autodocs'],
  parameters: { layout: 'padded' },
  decorators: [(Story) => <div style={{ maxWidth: 900 }}><Story /></div>],
};

export default meta;
type Story = StoryObj<typeof UpcomingItems>;

const lanes: LiveLane[] = [
  {
    lane_id: 1,
    lane_number: 1,
    lane_name: '幹之系',
    status: 'active',
    current_item: {
      id: 101, item_number: 1, species_name: '幹之メダカ', quantity: 5,
      current_price: 3500, is_premium: false, active_bidders_count: 2,
      countdown_seconds: 5, my_bid_status: null, phase: 'bidding', pre_bid_remaining_seconds: 0,
    },
    upcoming_items: [
      { id: 102, item_number: 2, species_name: '三色ラメ幹之', quantity: 3, start_price: 5000, is_premium: false },
      { id: 103, item_number: 3, species_name: '紅白ラメ', quantity: 5, start_price: 3000, is_premium: true },
    ],
  },
  {
    lane_id: 2,
    lane_number: 2,
    lane_name: 'ラメ系',
    status: 'active',
    current_item: {
      id: 201, item_number: 10, species_name: 'オーロラ黄ラメ', quantity: 3,
      current_price: 8000, is_premium: true, active_bidders_count: 3,
      countdown_seconds: 2, my_bid_status: 'active', phase: 'bidding', pre_bid_remaining_seconds: 0,
    },
    upcoming_items: [
      { id: 202, item_number: 11, species_name: '夜桜ゴールド', quantity: 5, start_price: 4000, is_premium: false },
    ],
  },
];

export const Default: Story = {
  name: '次の商品あり',
  args: { lanes },
};

export const NoUpcoming: Story = {
  name: '次の商品なし',
  args: {
    lanes: lanes.map(l => ({ ...l, upcoming_items: [] })),
  },
};
