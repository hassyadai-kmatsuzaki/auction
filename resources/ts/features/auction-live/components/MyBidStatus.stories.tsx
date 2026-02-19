import type { Meta, StoryObj } from '@storybook/react-vite';
import { MyBidStatus } from './MyBidStatus';
import type { LiveLane } from '@/types';

const baseLane = (id: number, name: string, species: string, bidStatus: 'active' | 'inactive' | null): LiveLane => ({
  lane_id: id, lane_number: id, lane_name: name, status: 'active',
  current_item: {
    id: id * 100, item_number: id, species_name: species, quantity: 5, quantity_unit: 'fish',
    current_price: 5000, is_premium: false, active_bidders_count: 2, countdown_seconds: 8,
    my_bid_status: bidStatus,
  },
});

const meta: Meta<typeof MyBidStatus> = {
  title: 'AuctionLive/MyBidStatus',
  component: MyBidStatus,
  tags: ['autodocs'],
};
export default meta;

export const NoBids: StoryObj<typeof MyBidStatus> = {
  name: '入札なし',
  args: {
    lanes: [baseLane(1, '幹之系', '幹之メダカ', null), baseLane(2, '三色系', '三色ラメ', null)],
    onLeaveBid: () => {},
  },
};
export const TwoBids: StoryObj<typeof MyBidStatus> = {
  name: '2レーン入札中',
  args: {
    lanes: [baseLane(1, '幹之系', '幹之メダカ', 'active'), baseLane(2, '三色系', '三色ラメ', 'active')],
    onLeaveBid: () => {},
  },
};
