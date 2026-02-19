import type { Meta, StoryObj } from '@storybook/react-vite';
import { QuickLimitButtons } from './QuickLimitButtons';

const meta: Meta<typeof QuickLimitButtons> = {
  title: 'BidLimit/QuickLimitButtons',
  component: QuickLimitButtons,
  tags: ['autodocs'],
  parameters: { layout: 'centered' },
  decorators: [(Story) => <div style={{ width: 360 }}><Story /></div>],
};
export default meta;

const baseOptions = { base_price: 30000, x1_5: 45000, x2: 60000, x2_5: 75000, x3: 90000 };

export const NoSelection: StoryObj<typeof QuickLimitButtons> = {
  name: '未選択',
  args: { quickOptions: baseOptions, currentValue: null, onSelect: () => {}, isLive: false },
};
export const Selected: StoryObj<typeof QuickLimitButtons> = {
  name: '×2 選択中',
  args: { quickOptions: baseOptions, currentValue: 60000, onSelect: () => {}, isLive: false },
};
export const LiveMode: StoryObj<typeof QuickLimitButtons> = {
  name: 'ライブ中（現在価格基準）',
  args: { quickOptions: { base_price: 50000, x1_5: 75000, x2: 100000, x2_5: 125000, x3: 150000 }, currentValue: null, onSelect: () => {}, isLive: true },
};
