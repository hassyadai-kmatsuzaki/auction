import { useMutation, useQueryClient } from '@tanstack/react-query';
import { bidApi } from '@/api/participant/bidApi';
import { useAuctionLiveStore } from '@/stores/auctionLiveStore';
import { useNotificationStore } from '@/stores/notificationStore';
import { LIVE_STATE_QUERY_KEY } from './useAuctionLive';
import type { LiveState } from '@/types';

/**
 * 単方向入札仕様: ON のリクエストだけを送信する。
 * 旧仕様の「もう一度押すと OFF（離脱）」動線は廃止。落札権利者・非権利者を問わず
 * ユーザー操作からは離脱できない。サーバー側でも `is_active=false` は 403 で拒否される。
 */
export function useBidToggle(auctionId: number) {
  const queryClient = useQueryClient();
  const { lockBid, unlockBid, isBidLocked } = useAuctionLiveStore();
  const showSnackbar = useNotificationStore((s) => s.showSnackbar);

  const mutation = useMutation({
    mutationFn: ({ itemId }: { itemId: number }) => bidApi.toggle(itemId, true),

    // 楽観的更新: APIレスポンスを待たずに UI を 'active' に切り替える
    onMutate: async ({ itemId }) => {
      lockBid(itemId);
      await queryClient.cancelQueries({ queryKey: LIVE_STATE_QUERY_KEY(auctionId) });

      const previousData = queryClient.getQueryData<LiveState>(
        LIVE_STATE_QUERY_KEY(auctionId)
      );

      queryClient.setQueryData<LiveState>(LIVE_STATE_QUERY_KEY(auctionId), (prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          lanes: prev.lanes.map((lane) =>
            lane.current_item?.id === itemId
              ? {
                  ...lane,
                  current_item: {
                    ...lane.current_item,
                    my_bid_status: 'active',
                  },
                }
              : lane
          ),
        };
      });

      return { previousData };
    },

    onSuccess: (result) => {
      if (result.success) {
        showSnackbar(result.message || '入札に参加しました', 'success');
      } else {
        showSnackbar(result.message || '入札に失敗しました', 'error');
      }
    },

    // 失敗時: 楽観的更新をロールバック
    onError: (err: any, _variables, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(LIVE_STATE_QUERY_KEY(auctionId), context.previousData);
      }
      showSnackbar(
        err?.response?.data?.message || '入札に失敗しました',
        'error'
      );
    },

    onSettled: (_data, _err, variables) => {
      unlockBid(variables.itemId);
      queryClient.invalidateQueries({ queryKey: LIVE_STATE_QUERY_KEY(auctionId) });
    },
  });

  // 旧 API 互換: BidButton から呼ばれる関数名は `toggle` のまま残すが、
  // 動作は単方向（ON のみ送信）。既に自分が active なら no-op。
  const toggle = (itemId: number, currentStatus: 'active' | 'inactive' | null) => {
    if (isBidLocked(itemId)) return;
    if (currentStatus === 'active') return;
    mutation.mutate({ itemId });
  };

  return {
    toggle,
    isPending: mutation.isPending,
    isLocked: isBidLocked,
  };
}
