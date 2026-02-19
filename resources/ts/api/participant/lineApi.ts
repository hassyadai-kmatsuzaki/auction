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
  getRedirectUrl: async (): Promise<string> => {
    const res = await axios.get('/api/participant/settings/line/redirect');
    return res.data.data.url;
  },

  getStatus: async (): Promise<LineStatus> => {
    const res = await axios.get('/api/participant/settings/line/status');
    return res.data.data;
  },

  unlink: async () => {
    const res = await axios.delete('/api/participant/settings/line/unlink');
    return res.data;
  },

  getNotifications: async (): Promise<LineNotificationSetting[]> => {
    const res = await axios.get('/api/participant/settings/line/notifications');
    return res.data.data.notifications;
  },

  updateNotifications: async (settings: { type: string; is_enabled: boolean }[]) => {
    const res = await axios.put('/api/participant/settings/line/notifications', { settings });
    return res.data;
  },
};
