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
   * 実装書 F13: invalidate を BidLimit のみに絞る（条件付きで LIVE_STATE）
   *   旧: 指値設定のたびに LIVE_STATE_QUERY_KEY 全体を invalidate
   *       → 30 名が指値設定すると 30 回の全体 refetch がサーバーに殺到
   *   新: BID_LIMIT_QUERY_KEY のみ invalidate
   *       LaneCard の状態変更は WebSocket イベント (BidderUpdated / PriceUpdated) で同期
   *       LIVE_STATE は is_triggered=true（即発動）の時のみ invalidate
   */
  const invalidateBidLimit = () => {
    queryClient.invalidateQueries({ queryKey: BID_LIMIT_QUERY_KEY(itemId) });
  };

  const invalidateLiveStateForTriggered = () => {
    if (auctionId) {
      queryClient.invalidateQueries({ queryKey: LIVE_STATE_QUERY_KEY(auctionId) });
    }
  };

  const setMutation = useMutation({
    mutationFn: (limitPrice: number) => bidLimitApi.set(itemId, limitPrice),
    retry: 0, // 実装書 F12: リトライ抑制
    onSuccess: (data) => {
      invalidateBidLimit();
      if (data.data?.is_triggered) {
        // 即発動 → 自動離脱が走るので LIVE_STATE を再取得して反映
        invalidateLiveStateForTriggered();
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
      invalidateLiveStateForTriggered();
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
