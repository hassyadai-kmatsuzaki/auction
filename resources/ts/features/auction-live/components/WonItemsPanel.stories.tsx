import type { Meta, StoryObj } from '@storybook/react-vite';
import { WonItemsPanel } from './WonItemsPanel';

const meta: Meta<typeof WonItemsPanel> = {
  title: 'AuctionLive/WonItemsPanel',
  component: WonItemsPanel,
  tags: ['autodocs'],
};
export default meta;

const items = [
  { id: 1, item_number: 1, species_name: '幹之メダカ（フルボディ）', quantity: 5, quantity_unit: 'fish', winning_price: 3500, total_amount: 19250 },
  { id: 2, item_number: 3, species_name: '三色ラメ幹之',            quantity: 3, quantity_unit: 'fish', winning_price: 5000, total_amount: 16500 },
];

export const Default: StoryObj<typeof WonItemsPanel> = {
  name: '落札一覧（2件）',
  args: { items, totalAmount: 35750 },
};
export const Empty: StoryObj<typeof WonItemsPanel> = {
  name: '落札なし（非表示）',
  args: { items: [], totalAmount: 0 },
};
