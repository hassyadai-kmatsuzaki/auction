import { useMutation, useQueryClient } from '@tanstack/react-query';
import { bidApi } from '@/api/participant/bidApi';
import { useAuctionLiveStore } from '@/stores/auctionLiveStore';
import { useNotificationStore } from '@/stores/notificationStore';
import { LIVE_STATE_QUERY_KEY } from './useAuctionLive';
import type { LiveState } from '@/types';

export function useBidToggle(auctionId: number) {
  const queryClient = useQueryClient();
  const { lockBid, unlockBid, isBidLocked } = useAuctionLiveStore();
  const showSnackbar = useNotificationStore((s) => s.showSnackbar);

  const mutation = useMutation({
    mutationFn: ({ itemId, isActive }: { itemId: number; isActive: boolean }) =>
      bidApi.toggle(itemId, isActive),

    // 楽観的更新: APIレスポンスを待たずにUIを即時更新
    onMutate: async ({ itemId, isActive }) => {
      lockBid(itemId);
      // 進行中のクエリをキャンセル（競合防止）
      await queryClient.cancelQueries({ queryKey: LIVE_STATE_QUERY_KEY(auctionId) });

      // スナップショット（ロールバック用）
      const previousData = queryClient.getQueryData<LiveState>(
        LIVE_STATE_QUERY_KEY(auctionId)
      );

      // 楽観的にUIを更新
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
                    my_bid_status: isActive ? 'active' : 'inactive',
                  },
                }
              : lane
          ),
        };
      });

      return { previousData };
    },

    onSuccess: (result, { isActive }) => {
      if (result.success) {
        showSnackbar(
          isActive ? '入札に参加しました' : '入札から離脱しました',
          'success'
        );
      } else {
        showSnackbar(result.message || '入札の切り替えに失敗しました', 'error');
      }
    },

    // 失敗時: 楽観的更新をロールバック
    onError: (err: any, _variables, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(LIVE_STATE_QUERY_KEY(auctionId), context.previousData);
      }
      showSnackbar(
        err?.response?.data?.message || '入札の切り替えに失敗しました',
        'error'
      );
    },

    // 成功・失敗どちらの場合も最新状態を再取得してサーバーと同期
    onSettled: (_data, _err, variables) => {
      unlockBid(variables.itemId);
      queryClient.invalidateQueries({ queryKey: LIVE_STATE_QUERY_KEY(auctionId) });
    },
  });

  const toggle = (itemId: number, currentStatus: 'active' | 'inactive' | null) => {
    if (isBidLocked(itemId)) return; // 処理中の二重押し防止
    const isActive = currentStatus !== 'active';
    mutation.mutate({ itemId, isActive });
  };

  return {
    toggle,
    isPending: mutation.isPending,
    isLocked: isBidLocked,
  };
}
