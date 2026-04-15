import axios from '@/lib/axios';

export interface LineStatus {
  linked: boolean;
  is_active: boolean;
  display_name: string | null;
  picture_url: string | null;
  linked_at: string | null;
}

export interface LineNotificationSetting {
  type: string;
  label: string;
  is_enabled: boolean;
}

export const lineApi = {
  getRedirectUrl: async (returnTo?: string): Promise<string> => {
    const res = await axios.get('/api/line/settings/redirect', {
      params: returnTo ? { return_to: returnTo } : undefined,
    });
    return res.data.data.url;
  },

  getStatus: async (): Promise<LineStatus> => {
    const res = await axios.get('/api/line/settings/status');
    return res.data.data;
  },

  unlink: async () => {
    const res = await axios.delete('/api/line/settings/unlink');
    return res.data;
  },

  getNotifications: async (): Promise<LineNotificationSetting[]> => {
    const res = await axios.get('/api/line/settings/notifications');
    return res.data.data.notifications;
  },

  updateNotifications: async (settings: { type: string; is_enabled: boolean }[]) => {
    const res = await axios.put('/api/line/settings/notifications', { settings });
    return res.data;
  },

  sendTest: async (type: string) => {
    const res = await axios.post('/api/line/settings/test', { type });
    return res.data;
  },
};
