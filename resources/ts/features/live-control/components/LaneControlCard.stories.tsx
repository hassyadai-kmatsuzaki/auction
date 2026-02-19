import type { Meta, StoryObj } from '@storybook/react-vite';
import { LaneControlCard } from './LaneControlCard';

const baseLane = {
  lane_id: 1, lane_number: 1, lane_name: '幹之系', status: 'active',
  countdown_seconds: 8, phase: 'bidding',
  current_item: {
    id: 101, item_number: 1, species_name: '幹之メダカ', quantity: 5,
    start_price: 2000, current_price: 3500, status: 'live', is_premium: false,
    thumbnail_path: '/img/noimage.png', active_bidders_count: 2,
    active_bidders: [{ user_id: 1, user_name: '参加者A', activated_at: new Date().toISOString() }],
  },
};

const meta: Meta<typeof LaneControlCard> = {
  title: 'LiveControl/LaneControlCard',
  component: LaneControlCard,
  tags: ['autodocs'],
  parameters: { layout: 'centered' },
  decorators: [(Story) => <div style={{ width: 320 }}><Story /></div>],
};
export default meta;

export const Active: StoryObj<typeof LaneControlCard> = {
  name: '進行中',
  args: { lane: baseLane, onNextItem: () => {}, isLoading: false },
};
export const Paused: StoryObj<typeof LaneControlCard> = {
  name: '一時停止中',
  args: { lane: { ...baseLane, status: 'paused' }, onNextItem: () => {}, isLoading: false },
};
export const Empty: StoryObj<typeof LaneControlCard> = {
  name: '出品なし',
  args: { lane: { ...baseLane, current_item: null, status: 'waiting' }, onNextItem: () => {}, isLoading: false },
};
export const Finished: StoryObj<typeof LaneControlCard> = {
  name: '終了済み',
  args: { lane: { ...baseLane, current_item: null, status: 'finished' }, onNextItem: () => {}, isLoading: false },
};
