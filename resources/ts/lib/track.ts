import axios from '@/lib/axios';

export type TrackEvent = 'daily_access' | 'venue_enter' | 'item_view';

/**
 * ユーザー行動計測を送る。副作用計測なので失敗は握りつぶし、UI を一切阻害しない。
 *
 * 重複排除・ゲート判定（ライブ中停止 / 生体閲覧は開始前のみ / 1日1行 など）は
 * すべてサーバ側（ActivityLogger）で行う。フロントは「起きた事実」を投げるだけ。
 */
export function trackEvent(
  event: TrackEvent,
  params: { auction_id?: number; item_id?: number } = {},
): void {
  try {
    void axios.post('/api/participant/track', { event, ...params }).catch(() => {
      /* 計測失敗は無視 */
    });
  } catch {
    /* 計測失敗は無視 */
  }
}
