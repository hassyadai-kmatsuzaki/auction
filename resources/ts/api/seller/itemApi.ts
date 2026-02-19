import axios from '@/lib/axios';

export const sellerItemApi = {
  getMyItems: async (params?: Record<string, unknown>) => {
    const res = await axios.get('/api/seller/items', { params });
    return res.data.data;
  },
  getOne: async (id: number) => {
    const res = await axios.get(`/api/seller/items/${id}`);
    return res.data.data;
  },
  submit: async (data: FormData) => {
    const res = await axios.post('/api/seller/items', data, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data;
  },
};
