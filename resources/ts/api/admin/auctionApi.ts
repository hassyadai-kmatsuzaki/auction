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
    const res = await axios.get(`/api/admin/live/${id}`);
    return res.data.data;
  },
  start: async (id: number) => {
    const res = await axios.post(`/api/admin/live/${id}/start`);
    return res.data;
  },
  pause: async (id: number) => {
    const res = await axios.post(`/api/admin/live/${id}/pause`);
    return res.data;
  },
  resume: async (id: number) => {
    const res = await axios.post(`/api/admin/live/${id}/resume`);
    return res.data;
  },
  finish: async (id: number) => {
    const res = await axios.post(`/api/admin/live/${id}/finish`);
    return res.data;
  },
};
