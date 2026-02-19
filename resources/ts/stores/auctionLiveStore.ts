import { create } from 'zustand';
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

export const useAuctionLiveStore = create<AuctionLiveStore>()(
  devtools(
    subscribeWithSelector((set, get) => ({
      socketConnected: false,
      setSocketConnected: (v) => set({ socketConnected: v }, false, 'setSocketConnected'),

      bidLockMap: {},
      lockBid: (itemId) =>
        set(
          (s) => ({ bidLockMap: { ...s.bidLockMap, [itemId]: true } }),
          false,
          'lockBid'
        ),
      unlockBid: (itemId) =>
        set(
          (s) => ({ bidLockMap: { ...s.bidLockMap, [itemId]: false } }),
          false,
          'unlockBid'
        ),
      isBidLocked: (itemId) => get().bidLockMap[itemId] ?? false,
    })),
    { name: 'AuctionLiveStore' }
  )
);
