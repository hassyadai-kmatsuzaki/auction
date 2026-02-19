import axios from '@/lib/axios';

export const adminItemApi = {
  getList: async (params?: Record<string, unknown>) => {
    const res = await axios.get('/api/admin/items', { params });
    return res.data.data;
  },
  getOne: async (id: number) => {
    const res = await axios.get(`/api/admin/items/${id}`);
    return res.data.data;
  },
  create: async (data: FormData) => {
    const res = await axios.post('/api/admin/items', data, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data;
  },
  update: async (id: number, data: FormData) => {
    const res = await axios.post(`/api/admin/items/${id}`, data, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data;
  },
  delete: async (id: number) => {
    const res = await axios.delete(`/api/admin/items/${id}`);
    return res.data;
  },
};
