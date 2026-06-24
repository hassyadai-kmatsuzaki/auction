import axios from '@/lib/axios';

export interface SpeciesName {
  id: number;
  name: string;
  sort_order: number;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

const BASE = '/api/admin/masters/species-names';

export const adminSpeciesNameApi = {
  list: async (): Promise<SpeciesName[]> => {
    const res = await axios.get(BASE);
    return res.data.data;
  },
  create: async (data: { name: string; is_active?: boolean }): Promise<SpeciesName> => {
    const res = await axios.post(BASE, data);
    return res.data.data;
  },
  update: async (id: number, data: Partial<Pick<SpeciesName, 'name' | 'is_active' | 'sort_order'>>): Promise<SpeciesName> => {
    const res = await axios.patch(`${BASE}/${id}`, data);
    return res.data.data;
  },
  remove: async (id: number): Promise<void> => {
    await axios.delete(`${BASE}/${id}`);
  },
  reorder: async (orders: { id: number; sort_order: number }[]): Promise<void> => {
    await axios.post(`${BASE}/reorder`, { orders });
  },
};
