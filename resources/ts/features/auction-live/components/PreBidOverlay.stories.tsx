import type { Meta, StoryObj } from '@storybook/react-vite';
import { PreBidOverlay } from './PreBidOverlay';

const meta: Meta<typeof PreBidOverlay> = {
  title: 'AuctionLive/PreBidOverlay',
  component: PreBidOverlay,
  tags: ['autodocs'],
  parameters: { layout: 'centered' },
  decorators: [(Story) => <div style={{ width: 360 }}><Story /></div>],
};
export default meta;

export const FiveSeconds: StoryObj<typeof PreBidOverlay> = { name: '5秒', args: { remainingSeconds: 5 } };
export const TwoPointFive: StoryObj<typeof PreBidOverlay> = { name: '2.5秒（整数表示: 3秒）', args: { remainingSeconds: 2.5 } };
export const OneSecond: StoryObj<typeof PreBidOverlay> = { name: '1秒', args: { remainingSeconds: 1 } };
export const Zero: StoryObj<typeof PreBidOverlay> = { name: '0秒', args: { remainingSeconds: 0 } };
