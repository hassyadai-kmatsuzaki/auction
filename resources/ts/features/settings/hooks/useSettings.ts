import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from '@/lib/axios';
import { useNotificationStore } from '@/stores/notificationStore';

const SETTINGS_QUERY_KEY = ['admin-settings'] as const;

const fetchSettings = async () => {
  const res = await axios.get('/api/admin/settings');
  return res.data.data.settings;
};

const saveSettings = async (settings: Record<string, unknown>) => {
  const res = await axios.put('/api/admin/settings', { settings });
  return res.data;
};

export function useSettings() {
  const queryClient = useQueryClient();
  const showSnackbar = useNotificationStore((s) => s.showSnackbar);

  const query = useQuery({
    queryKey: SETTINGS_QUERY_KEY,
    queryFn: fetchSettings,
    staleTime: 5 * 60_000,
  });

  const mutation = useMutation({
    mutationFn: saveSettings,
    onSuccess: () => {
      showSnackbar('設定を保存しました', 'success');
      queryClient.invalidateQueries({ queryKey: SETTINGS_QUERY_KEY });
    },
    onError: () => showSnackbar('設定の保存に失敗しました', 'error'),
  });

  return {
    rawSettings: query.data,
    isLoading: query.isLoading,
    isSaving: mutation.isPending,
    save: (settings: Record<string, unknown>) => mutation.mutate(settings),
  };
}
