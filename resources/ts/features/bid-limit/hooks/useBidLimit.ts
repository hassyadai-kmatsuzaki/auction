import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { bidLimitApi } from '@/api/participant/bidLimitApi';
import { useNotificationStore } from '@/stores/notificationStore';
import { LIVE_STATE_QUERY_KEY } from '@/features/auction-live/hooks/useAuctionLive';

export const BID_LIMIT_QUERY_KEY = (itemId: number) =>
  ['bid-limit', itemId] as const;

/**
 * @param itemId       対象商品ID（0の場合はクエリ無効）
 * @param auctionId    設定変更後にライブ状態も再取得する場合に指定
 */
export function useBidLimit(itemId: number, auctionId?: number) {
  const queryClient = useQueryClient();
  const showSnackbar = useNotificationStore((s) => s.showSnackbar);

  const query = useQuery({
    queryKey: BID_LIMIT_QUERY_KEY(itemId),
    queryFn: () => bidLimitApi.getOne(itemId),
    enabled: itemId > 0,
    staleTime: 30_000,
  });

  /**
   * 実装書 F13: invalidate を最低限に絞る方針。
   *   - 設定成功時: BID_LIMIT_QUERY_KEY と LIVE_STATE_QUERY_KEY を invalidate。
   *     LIVE_STATE は LaneCard の `my_limit_price` 表示を駆動しており、
   *     これを更新する WS イベントは存在しないため、自分の操作後は必ず再取得が必要。
   *     旧版は is_triggered のときだけ invalidate していたため、通常設定時にチップが
   *     反映されない事故になっていた（指値を入れたのに「上限: ¥X」が出ない）。
   *   - 解除時: 同じく両方 invalidate（active なら自動離脱、my_limit_price を null に）
   *
   *   ※ ここで invalidate されるのは「自分自身のクライアント」のみ。
   *     他のユーザーが同時に設定しても各自のクライアントが各自で invalidate するだけなので、
   *     N 人が同時設定 → サーバーへの refetch は N 件（120 名負荷でも問題なし）。
   *     旧コメント「30 名が指値設定すると 30 回の全体 refetch がサーバーに殺到」は誤読で、
   *     実際は「自分の操作 1 回 → 自分のクライアントが 1 回 refetch」する分散負荷。
   */
  const invalidateBidLimit = () => {
    queryClient.invalidateQueries({ queryKey: BID_LIMIT_QUERY_KEY(itemId) });
  };

  const invalidateLiveState = () => {
    if (auctionId) {
      queryClient.invalidateQueries({ queryKey: LIVE_STATE_QUERY_KEY(auctionId) });
    }
  };

  const setMutation = useMutation({
    mutationFn: (limitPrice: number) => bidLimitApi.set(itemId, limitPrice),
    retry: 0, // 実装書 F12: リトライ抑制
    onSuccess: (data) => {
      invalidateBidLimit();
      // LaneCard のチップ表示を更新するため、即発動の有無にかかわらず必ず LIVE_STATE を再取得
      invalidateLiveState();
      if (data.data?.is_triggered) {
        showSnackbar(
          `現在価格が上限に達しているため入札オフ・上限設定が解除されました`,
          'warning'
        );
      } else {
        showSnackbar('上限価格を設定しました', 'success');
      }
    },
    onError: (err: any) => {
      showSnackbar(err?.response?.data?.message || '上限価格の設定に失敗しました', 'error');
    },
  });

  const removeMutation = useMutation({
    mutationFn: () => bidLimitApi.remove(itemId),
    retry: 0, // 実装書 F12: リトライ抑制
    onSuccess: () => {
      invalidateBidLimit();
      // 解除時は active なら自動離脱するため LIVE_STATE も再取得
      invalidateLiveState();
      showSnackbar('上限価格の設定を解除しました', 'info');
    },
    onError: () => {
      showSnackbar('上限価格の解除に失敗しました', 'error');
    },
  });

  return {
    limitPrice:    query.data?.limit_price ?? null,
    isTriggered:   query.data?.is_triggered ?? false,
    quickOptions:  query.data?.quick_options ?? null,
    isLoading:     query.isLoading,
    setLimit:      setMutation.mutate,
    removeLimit:   removeMutation.mutate,
    isSetting:     setMutation.isPending,
    isRemoving:    removeMutation.isPending,
  };
}
