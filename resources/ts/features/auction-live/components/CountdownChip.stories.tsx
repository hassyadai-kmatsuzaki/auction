import type { Meta, StoryObj } from '@storybook/react-vite';
import { CountdownChip } from './CountdownChip';

const meta: Meta<typeof CountdownChip> = {
  title: 'AuctionLive/CountdownChip',
  component: CountdownChip,
  tags: ['autodocs'],
  argTypes: {
    seconds: { control: { type: 'number', min: 0, max: 30, step: 0.5 } },
    isCompetitive: { control: 'boolean' },
  },
};

export default meta;
type Story = StoryObj<typeof CountdownChip>;

export const Normal: Story = {
  name: '通常（10秒）',
  args: { seconds: 10, isCompetitive: false },
};

export const Warning: Story = {
  name: '警告（残り3秒）',
  args: { seconds: 3, isCompetitive: false },
};

export const Competitive: Story = {
  name: '競合中（2人以上入札）',
  args: { seconds: 1, isCompetitive: true },
};

export const HalfSecond: Story = {
  name: '0.5秒表示',
  args: { seconds: 0.5, isCompetitive: true },
};

export const Zero: Story = {
  name: '0秒',
  args: { seconds: 0, isCompetitive: false },
};
