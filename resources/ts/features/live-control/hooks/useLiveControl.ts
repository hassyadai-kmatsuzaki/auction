import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from '@/lib/axios';
import { adminAuctionApi } from '@/api/admin/auctionApi';

export const ADMIN_LIVE_QUERY_KEY = (auctionId: number) =>
  ['admin-live-state', auctionId] as const;

export const ENTRANCE_STATUS_QUERY_KEY = (auctionId: number) =>
  ['admin-entrance-status', auctionId] as const;

export function useLiveControl(auctionId: number) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ADMIN_LIVE_QUERY_KEY(auctionId),
    queryFn: () => adminAuctionApi.getLiveState(auctionId),
    refetchInterval: 3000,
    staleTime: 500,
  });

  // 待機室の手動公開状態
  const entranceQuery = useQuery({
    queryKey: ENTRANCE_STATUS_QUERY_KEY(auctionId),
    queryFn: () => adminAuctionApi.getEntranceStatus(auctionId),
    staleTime: 5000,
    // scheduled ステータスの時のみポーリング
    refetchInterval: (query) =>
      query.state.data?.auction_status === 'scheduled' ? 10000 : false,
  });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ADMIN_LIVE_QUERY_KEY(auctionId) });

  const invalidateEntrance = () =>
    queryClient.invalidateQueries({ queryKey: ENTRANCE_STATUS_QUERY_KEY(auctionId) });

  const pauseMutation  = useMutation({ mutationFn: () => adminAuctionApi.pause(auctionId),  onSuccess: invalidate });
  const resumeMutation = useMutation({ mutationFn: () => adminAuctionApi.resume(auctionId), onSuccess: invalidate });
  const finishMutation = useMutation({ mutationFn: () => adminAuctionApi.finish(auctionId), onSuccess: invalidate });

  const nextItemMutation = useMutation({
    mutationFn: (laneId: number) =>
      axios.post(`/api/admin/lanes/${laneId}/next-item`).then(r => r.data),
    onSuccess: invalidate,
  });

  // 待機室公開/閉鎖
  const openEntranceMutation = useMutation({
    mutationFn: () => adminAuctionApi.openEntrance(auctionId),
    onSuccess: invalidateEntrance,
  });
  const closeEntranceMutation = useMutation({
    mutationFn: () => adminAuctionApi.closeEntrance(auctionId),
    onSuccess: invalidateEntrance,
  });

  return {
    liveState: query.data,
    isLoading: query.isLoading,
    refetch: invalidate,
    pause:  pauseMutation.mutate,
    resume: resumeMutation.mutate,
    finish: finishMutation.mutate,
    nextItem: (laneId: number) => nextItemMutation.mutate(laneId),
    isPausing:   pauseMutation.isPending,
    isResuming:  resumeMutation.isPending,
    isFinishing: finishMutation.isPending,
    isNextItem:  nextItemMutation.isPending,

    // 待機室
    entranceOpened:       entranceQuery.data?.entrance_opened ?? false,
    isEntranceLoading:    openEntranceMutation.isPending || closeEntranceMutation.isPending,
    openEntrance:         () => openEntranceMutation.mutate(),
    closeEntrance:        () => closeEntranceMutation.mutate(),
  };
}
