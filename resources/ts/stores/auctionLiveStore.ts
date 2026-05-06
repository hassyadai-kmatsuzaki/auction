import { create, type StateCreator } from 'zustand';
import { subscribeWithSelector, devtools } from 'zustand/middleware';

interface AuctionLiveStore {
  /** WebSocket接続状態 */
  socketConnected: boolean;
  setSocketConnected: (v: boolean) => void;

  /** 入札処理中のアイテムID集合（競合防止ロック） */
  bidLockMap: Record<number, boolean>;
  lockBid: (itemId: number) => void;
  unlockBid: (itemId: number) => void;
  isBidLocked: (itemId: number) => boolean;
}

// 実装書 F11: Zustand devtools を本番で無効化（メモリリーク対策）
//   旧: 常時 devtools 有効 → state mutation を Redux DevTools へ送信
//      120名 × 数千 mutation を全部 history 蓄積 → メモリ圧迫
//   新: dev 時のみ devtools 有効、production は subscribeWithSelector のみ
const IS_DEV = import.meta.env.DEV;

const storeCreator: StateCreator<AuctionLiveStore, [['zustand/subscribeWithSelector', never]], []> = (set, get) => ({
  socketConnected: false,
  setSocketConnected: (v) => set({ socketConnected: v }, false, 'setSocketConnected' as any),

  bidLockMap: {},
  lockBid: (itemId) =>
    set(
      (s) => ({ bidLockMap: { ...s.bidLockMap, [itemId]: true } }),
      false,
      'lockBid' as any
    ),
  unlockBid: (itemId) =>
    set(
      (s) => ({ bidLockMap: { ...s.bidLockMap, [itemId]: false } }),
      false,
      'unlockBid' as any
    ),
  isBidLocked: (itemId) => get().bidLockMap[itemId] ?? false,
});

export const useAuctionLiveStore = IS_DEV
  ? create<AuctionLiveStore>()(
      devtools(
        subscribeWithSelector(storeCreator) as any,
        { name: 'AuctionLiveStore' }
      )
    )
  : create<AuctionLiveStore>()(
      subscribeWithSelector(storeCreator)
    );
