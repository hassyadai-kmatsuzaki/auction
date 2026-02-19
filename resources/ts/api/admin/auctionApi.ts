import axios from '@/lib/axios';

export const adminAuctionApi = {
  getList: async () => {
    const res = await axios.get('/api/admin/auctions');
    return res.data.data;
  },
  getOne: async (id: number) => {
    const res = await axios.get(`/api/admin/auctions/${id}`);
    return res.data.data;
  },
  create: async (payload: Record<string, unknown>) => {
    const res = await axios.post('/api/admin/auctions', payload);
    return res.data;
  },
  update: async (id: number, payload: Record<string, unknown>) => {
    const res = await axios.put(`/api/admin/auctions/${id}`, payload);
    return res.data;
  },

  // ライブ管理
  getLiveState: async (id: number) => {
    const res = await axios.get(`/api/admin/auctions/${id}/live`);
    return res.data.data;
  },
  start: async (id: number) => {
    const res = await axios.post(`/api/admin/auctions/${id}/live/start`);
    return res.data;
  },
  pause: async (id: number) => {
    const res = await axios.post(`/api/admin/auctions/${id}/live/pause`);
    return res.data;
  },
  resume: async (id: number) => {
    const res = await axios.post(`/api/admin/auctions/${id}/live/resume`);
    return res.data;
  },
  finish: async (id: number) => {
    const res = await axios.post(`/api/admin/auctions/${id}/live/finish`);
    return res.data;
  },

  // 待機室手動公開
  getEntranceStatus: async (id: number): Promise<{ entrance_opened: boolean; auction_status: string }> => {
    const res = await axios.get(`/api/admin/auctions/${id}/entrance-status`);
    return res.data.data;
  },
  openEntrance: async (id: number) => {
    const res = await axios.post(`/api/admin/auctions/${id}/entrance/open`);
    return res.data;
  },
  closeEntrance: async (id: number) => {
    const res = await axios.post(`/api/admin/auctions/${id}/entrance/close`);
    return res.data;
  },
};
