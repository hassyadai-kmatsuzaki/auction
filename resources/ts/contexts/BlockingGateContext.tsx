import { createContext, useContext, useState, useCallback, ReactNode } from 'react';

interface BlockingGateContextValue {
  /** 必須ゲート（強制モーダル）が表示中かどうかを key ごとに登録する */
  setBlocking: (key: string, blocking: boolean) => void;
  /** いずれかの必須ゲートが表示中なら true */
  isBlocking: boolean;
}

// Provider 未設置でも安全に動くデフォルト（抑制なし）。
const BlockingGateContext = createContext<BlockingGateContextValue>({
  setBlocking: () => {},
  isBlocking: false,
});

/**
 * サブスク登録・配送先住所などの「閉じられない必須ゲート」が表示中であることを
 * 共有するためのコンテキスト。これにより、後発の任意ポップアップ（LINE連携など）が
 * 必須ゲートに重なって表示されるのを防ぐ。
 */
export function BlockingGateProvider({ children }: { children: ReactNode }) {
  const [active, setActive] = useState<Record<string, boolean>>({});

  const setBlocking = useCallback((key: string, blocking: boolean) => {
    setActive((prev) => (prev[key] === blocking ? prev : { ...prev, [key]: blocking }));
  }, []);

  const isBlocking = Object.values(active).some(Boolean);

  return (
    <BlockingGateContext.Provider value={{ setBlocking, isBlocking }}>
      {children}
    </BlockingGateContext.Provider>
  );
}

export function useBlockingGate() {
  return useContext(BlockingGateContext);
}
