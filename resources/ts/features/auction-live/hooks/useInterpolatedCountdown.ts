import { useRef, useState, useEffect } from 'react';

/**
 * サーバーからの1秒間隔tickをクライアント側で滑らかに補間するフック
 *
 * サーバー tick (1秒間隔) の間をローカルタイマーで補間し、
 * UI上は滑らかに1秒ずつカウントダウンする。
 * サーバーからの tick 受信時にサーバー値で補正（ドリフト防止）。
 *
 * @param serverSeconds サーバーから受信した remaining_seconds
 * @param phase 現在のフェーズ ('bidding' | 'freeze' | 'pre_bid')
 * @returns 補間されたカウントダウン秒数（整数）
 */
export function useInterpolatedCountdown(
  serverSeconds: number,
  phase?: 'bidding' | 'freeze' | 'pre_bid',
): number {
  // サーバーから受信した時刻と値を保持
  const lastServerTickRef = useRef<{ seconds: number; receivedAt: number }>({
    seconds: serverSeconds,
    receivedAt: Date.now(),
  });

  const [displaySeconds, setDisplaySeconds] = useState<number>(
    Math.ceil(serverSeconds),
  );

  const rafRef = useRef<number | null>(null);

  // サーバー値が更新されたら基準点を更新
  useEffect(() => {
    lastServerTickRef.current = {
      seconds: serverSeconds,
      receivedAt: Date.now(),
    };
    // サーバー値で即時補正（ドリフト防止）
    setDisplaySeconds(Math.ceil(serverSeconds));
  }, [serverSeconds]);

  // ローカル補間タイマー
  useEffect(() => {
    // freeze フェーズでは補間不要（「ブロック中」表示のみ）
    if (phase === 'freeze') {
      return;
    }

    // 停止中（0以下）は補間不要
    if (serverSeconds <= 0) {
      setDisplaySeconds(0);
      return;
    }

    const tick = () => {
      const { seconds: baseSeconds, receivedAt } = lastServerTickRef.current;
      const elapsed = (Date.now() - receivedAt) / 1000;
      const interpolated = Math.max(0, baseSeconds - elapsed);
      const ceiled = Math.ceil(interpolated);

      setDisplaySeconds((prev) => {
        // 値が変わった時のみ更新（不要な再レンダリング防止）
        if (prev !== ceiled) return ceiled;
        return prev;
      });

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [serverSeconds, phase]);

  return displaySeconds;
}
