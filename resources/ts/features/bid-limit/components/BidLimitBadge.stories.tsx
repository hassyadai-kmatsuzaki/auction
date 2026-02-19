import type { Meta, StoryObj } from '@storybook/react-vite';
import { BidLimitBadge } from './BidLimitBadge';

const meta: Meta<typeof BidLimitBadge> = {
  title: 'BidLimit/BidLimitBadge',
  component: BidLimitBadge,
  tags: ['autodocs'],
  parameters: { layout: 'centered' },
};
export default meta;

export const NotSet: StoryObj<typeof BidLimitBadge> = {
  name: '未設定',
  args: { limitPrice: null, isTriggered: false, onEdit: () => {} },
};
export const SetPrice: StoryObj<typeof BidLimitBadge> = {
  name: '設定済み（¥50,000）',
  args: { limitPrice: 50000, isTriggered: false, onEdit: () => {}, onRemove: () => {} },
};
export const Triggered: StoryObj<typeof BidLimitBadge> = {
  name: '発動済み',
  args: { limitPrice: 50000, isTriggered: true, onEdit: () => {} },
};
export const MediumSize: StoryObj<typeof BidLimitBadge> = {
  name: 'Mediumサイズ',
  args: { limitPrice: 100000, isTriggered: false, onEdit: () => {}, onRemove: () => {}, size: 'medium' },
};
