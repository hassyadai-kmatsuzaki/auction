import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminAuctionApi } from '@/api/admin/auctionApi';

export const ADMIN_LIVE_QUERY_KEY = (auctionId: number) =>
  ['admin-live-state', auctionId] as const;

export function useLiveControl(auctionId: number) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ADMIN_LIVE_QUERY_KEY(auctionId),
    queryFn: () => adminAuctionApi.getLiveState(auctionId),
    refetchInterval: 3000,
    staleTime: 500,
  });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ADMIN_LIVE_QUERY_KEY(auctionId) });

  const pauseMutation  = useMutation({ mutationFn: () => adminAuctionApi.pause(auctionId),  onSuccess: invalidate });
  const resumeMutation = useMutation({ mutationFn: () => adminAuctionApi.resume(auctionId), onSuccess: invalidate });
  const finishMutation = useMutation({ mutationFn: () => adminAuctionApi.finish(auctionId), onSuccess: invalidate });

  const nextItemMutation = useMutation({
    mutationFn: (laneId: number) =>
      fetch(`/api/admin/live/lanes/${laneId}/next-item`, { method: 'POST', headers: { 'X-Requested-With': 'XMLHttpRequest', 'Content-Type': 'application/json' } }).then(r => r.json()),
    onSuccess: invalidate,
  });

  return {
    liveState: query.data,
    isLoading: query.isLoading,
    refetch: invalidate,
    pause:  pauseMutation.mutate,
    resume: resumeMutation.mutate,
    finish: finishMutation.mutate,
    nextItem: (laneId: number) => nextItemMutation.mutate(laneId),
    isPausing:  pauseMutation.isPending,
    isResuming: resumeMutation.isPending,
    isFinishing: finishMutation.isPending,
    isNextItem: nextItemMutation.isPending,
  };
}
