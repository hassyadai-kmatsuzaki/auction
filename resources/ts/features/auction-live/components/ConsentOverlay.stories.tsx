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
  args: { onAgree: () => alert('同意しました') },
};
