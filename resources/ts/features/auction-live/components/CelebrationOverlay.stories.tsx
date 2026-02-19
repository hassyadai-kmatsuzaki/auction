import type { Meta, StoryObj } from '@storybook/react-vite';
import { CelebrationOverlay } from './CelebrationOverlay';

const meta: Meta<typeof CelebrationOverlay> = {
  title: 'AuctionLive/CelebrationOverlay',
  component: CelebrationOverlay,
  tags: ['autodocs'],
  parameters: { layout: 'fullscreen' },
};
export default meta;

export const Default: StoryObj<typeof CelebrationOverlay> = {
  name: '落札おめでとう演出',
  args: { speciesName: '幹之メダカ（フルボディ）', winningPrice: 12500 },
};
