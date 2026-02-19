import type { Meta, StoryObj } from '@storybook/react-vite';
import { BidButton } from './BidButton';

const meta: Meta<typeof BidButton> = {
  title: 'AuctionLive/BidButton',
  component: BidButton,
  tags: ['autodocs'],
  argTypes: {
    myBidStatus: {
      control: 'select',
      options: ['active', 'inactive', null],
    },
    isPreBid: { control: 'boolean' },
    isLoading: { control: 'boolean' },
  },
};

export default meta;
type Story = StoryObj<typeof BidButton>;

export const Idle: Story = {
  name: '未入札',
  args: { myBidStatus: null, isPreBid: false, isLoading: false, onToggle: () => {} },
};

export const Active: Story = {
  name: '入札中',
  args: { myBidStatus: 'active', isPreBid: false, isLoading: false, onToggle: () => {} },
};

export const Loading: Story = {
  name: '処理中',
  args: { myBidStatus: null, isPreBid: false, isLoading: true, onToggle: () => {} },
};

export const PreBid: Story = {
  name: '入札待機中（pre_bid）',
  args: { myBidStatus: null, isPreBid: true, isLoading: false, onToggle: () => {} },
};
