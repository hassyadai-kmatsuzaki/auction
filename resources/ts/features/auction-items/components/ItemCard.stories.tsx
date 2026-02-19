import type { Meta, StoryObj } from '@storybook/react-vite';
import { ItemCard } from './ItemCard';

const baseItem = {
  id: 1, item_number: 1, species_name: '幹之メダカ（フルボディ）',
  quantity: 5, start_price: 3000, current_price: 3000,
  inspection_info: '体長3cm以上・三色バランス良好', is_premium: false,
  thumbnail_path: '/img/noimage.png', status: 'registered', media: [],
};

const meta: Meta<typeof ItemCard> = {
  title: 'AuctionItems/ItemCard',
  component: ItemCard,
  tags: ['autodocs'],
  parameters: { layout: 'centered' },
  decorators: [(Story) => <div style={{ width: 280 }}><Story /></div>],
};
export default meta;
type Story = StoryObj<typeof ItemCard>;

export const Default: Story = { name: '通常', args: { item: baseItem, isFavorited: false, onClick: () => {}, onFavoriteToggle: () => {} } };
export const Favorited: Story = { name: 'お気に入り済み', args: { item: baseItem, isFavorited: true, onClick: () => {}, onFavoriteToggle: () => {} } };
export const Premium: Story = { name: 'プレミアム', args: { item: { ...baseItem, is_premium: true }, isFavorited: false, onClick: () => {}, onFavoriteToggle: () => {} } };
export const Live: Story = { name: '入札中', args: { item: { ...baseItem, status: 'live' }, isFavorited: false, onClick: () => {}, onFavoriteToggle: () => {} } };
export const Sold: Story = { name: '落札済み', args: { item: { ...baseItem, status: 'sold' }, isFavorited: false, onClick: () => {}, onFavoriteToggle: () => {} } };
