import type { Meta, StoryObj } from '@storybook/react-vite';
import { AuctionHeader } from './AuctionHeader';

const meta: Meta<typeof AuctionHeader> = {
  title: 'AuctionLive/AuctionHeader',
  component: AuctionHeader,
  tags: ['autodocs'],
};
export default meta;

export const Connected: StoryObj<typeof AuctionHeader> = {
  name: 'リアルタイム接続中',
  args: { title: '第17回 大感謝祭オークション', activeLaneCount: 4, totalLaneCount: 6, socketConnected: true, onRefresh: () => {} },
};
export const Polling: StoryObj<typeof AuctionHeader> = {
  name: 'ポーリング中（WS切断）',
  args: { title: '第17回 大感謝祭オークション', activeLaneCount: 4, totalLaneCount: 6, socketConnected: false, onRefresh: () => {} },
};
export const AllFinished: StoryObj<typeof AuctionHeader> = {
  name: '全レーン終了',
  args: { title: '第17回 大感謝祭オークション', activeLaneCount: 0, totalLaneCount: 6, socketConnected: true, onRefresh: () => {} },
};
