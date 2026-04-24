import axios from '@/lib/axios';
import type { SpeciesType } from '@/api/admin/speciesTypeApi';

export const sellerSpeciesTypeApi = {
  list: async (): Promise<SpeciesType[]> => {
    const res = await axios.get('/api/seller/species-types');
    return res.data.data;
  },
};
