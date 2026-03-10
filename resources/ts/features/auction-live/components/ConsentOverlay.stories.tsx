import type { Meta, StoryObj } from '@storybook/react-vite';
import { ConsentOverlay } from './ConsentOverlay';

const meta: Meta<typeof ConsentOverlay> = {
  title: 'AuctionLive/ConsentOverlay',
  component: ConsentOverlay,
  tags: ['autodocs'],
  parameters: { layout: 'fullscreen' },
};
export default meta;

export const Default: StoryObj<typeof ConsentOverlay> = {
  name: '同意画面',
  args: {
    onAgree: () => alert('同意しました'),
    priceIncrementTiers: [
      { from_price: 0, to_price: 100, increment_amount: 1 },
      { from_price: 101, to_price: 1000, increment_amount: 10 },
      { from_price: 1001, to_price: null, increment_amount: 100 },
    ],
    countdownTiers: [
      { from_price: 0, to_price: 50000, bid_countdown_seconds: 10, freeze_countdown_seconds: 0.5 },
      { from_price: 50001, to_price: null, bid_countdown_seconds: 15, freeze_countdown_seconds: 0.5 },
    ],
  },
};
