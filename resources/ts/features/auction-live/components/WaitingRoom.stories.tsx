import type { Meta, StoryObj } from '@storybook/react-vite';
import { WaitingRoom, EntranceBlocked, StartingCountdown } from './WaitingRoom';

const meta: Meta = {
  title: 'AuctionLive/WaitingRoom',
  tags: ['autodocs'],
};

export default meta;

export const Waiting: StoryObj<typeof WaitingRoom> = {
  name: '待機室（開始待ち）',
  render: () => <WaitingRoom title="2026年春季オークション" />,
};

export const Blocked: StoryObj<typeof EntranceBlocked> = {
  name: '入室不可（開始前）',
  render: () => (
    <EntranceBlocked
      title="2026年春季オークション"
      startAt="2026-02-20T10:00:00"
      venueOpenMinutes={30}
      entranceCountdown="29分45秒"
    />
  ),
};

export const Countdown: StoryObj<typeof StartingCountdown> = {
  name: '開始カウントダウン',
  render: () => <StartingCountdown title="2026年春季オークション" count={7} />,
};
