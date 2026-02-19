import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { bidLimitApi } from '@/api/participant/bidLimitApi';
import { useNotificationStore } from '@/stores/notificationStore';

export const BID_LIMIT_QUERY_KEY = (itemId: number) =>
  ['bid-limit', itemId] as const;

export function useBidLimit(itemId: number) {
  const queryClient = useQueryClient();
  const showSnackbar = useNotificationStore((s) => s.showSnackbar);

  const query = useQuery({
    queryKey: BID_LIMIT_QUERY_KEY(itemId),
    queryFn: () => bidLimitApi.getOne(itemId),
    enabled: itemId > 0, // itemId が 0 または null の場合はクエリを実行しない
    staleTime: 30_000,
  });

  const setMutation = useMutation({
    mutationFn: (limitPrice: number) => bidLimitApi.set(itemId, limitPrice),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: BID_LIMIT_QUERY_KEY(itemId) });
      if (data.data?.is_triggered) {
        showSnackbar(
          `上限価格を設定しました（現在価格が上限に達しているため自動的に入札オフになりました）`,
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: BID_LIMIT_QUERY_KEY(itemId) });
      showSnackbar('上限価格の設定を解除しました', 'info');
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
