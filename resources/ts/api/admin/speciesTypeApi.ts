import axios from '@/lib/axios';

export type CalculationMode = 'auto' | 'manual';
export type QuantityUnit = 'fish' | 'kg' | 'bag';

export interface SpeciesType {
  id: number;
  code: string;
  name: string;
  calculation_mode: CalculationMode;
  is_mixable: boolean;
  is_default: boolean;
  is_active: boolean;
  allowed_quantity_units: QuantityUnit[];
  sort_order: number;
  created_at?: string;
  updated_at?: string;
}

export interface BagSpec {
  id: number;
  species_type_id: number;
  bag_size: string;
  model: string | null;
  min_qty: number;
  max_qty: number | null;
  weight_kg: number;
}

export interface BoxCapacity {
  id: number;
  species_type_id: number;
  box_size: number;
  bag_size: string;
  max_count: number;
}

export interface BagMixRestriction {
  id: number;
  species_type_id: number | null;
  box_size: number | null;
  bag_size_a: string;
  bag_size_b: string;
}

const BASE = '/api/admin/masters/species-types';

export const adminSpeciesTypeApi = {
  list: async (): Promise<SpeciesType[]> => {
    const res = await axios.get(BASE);
    return res.data.data;
  },
  get: async (id: number) => {
    const res = await axios.get(`${BASE}/${id}`);
    return res.data.data as SpeciesType & {
      bag_specs: BagSpec[];
      box_capacities: BoxCapacity[];
      bag_mix_restrictions: BagMixRestriction[];
    };
  },
  create: async (data: Partial<SpeciesType>) => {
    const res = await axios.post(BASE, data);
    return res.data.data as SpeciesType;
  },
  update: async (id: number, data: Partial<SpeciesType>) => {
    const res = await axios.patch(`${BASE}/${id}`, data);
    return res.data.data as SpeciesType;
  },
  remove: async (id: number) => {
    await axios.delete(`${BASE}/${id}`);
  },
  reorder: async (orders: { id: number; sort_order: number }[]) => {
    await axios.post(`${BASE}/reorder`, { orders });
  },

  bagSpecs: {
    list: async (id: number): Promise<BagSpec[]> => {
      const res = await axios.get(`${BASE}/${id}/bag-specs`);
      return res.data.data;
    },
    create: async (id: number, data: Omit<BagSpec, 'id' | 'species_type_id'>) => {
      const res = await axios.post(`${BASE}/${id}/bag-specs`, data);
      return res.data.data as BagSpec;
    },
    update: async (id: number, specId: number, data: Partial<BagSpec>) => {
      const res = await axios.patch(`${BASE}/${id}/bag-specs/${specId}`, data);
      return res.data.data as BagSpec;
    },
    remove: async (id: number, specId: number) => {
      await axios.delete(`${BASE}/${id}/bag-specs/${specId}`);
    },
  },

  boxCapacities: {
    list: async (id: number): Promise<BoxCapacity[]> => {
      const res = await axios.get(`${BASE}/${id}/box-capacities`);
      return res.data.data;
    },
    upsert: async (id: number, capacities: Pick<BoxCapacity, 'box_size' | 'bag_size' | 'max_count'>[]) => {
      await axios.put(`${BASE}/${id}/box-capacities`, { capacities });
    },
    remove: async (id: number, capId: number) => {
      await axios.delete(`${BASE}/${id}/box-capacities/${capId}`);
    },
  },

  mixRestrictions: {
    list: async (id: number): Promise<BagMixRestriction[]> => {
      const res = await axios.get(`${BASE}/${id}/mix-restrictions`);
      return res.data.data;
    },
    create: async (id: number, data: { box_size: number | null; bag_size_a: string; bag_size_b: string }) => {
      const res = await axios.post(`${BASE}/${id}/mix-restrictions`, data);
      return res.data.data as BagMixRestriction;
    },
    remove: async (id: number, rowId: number) => {
      await axios.delete(`${BASE}/${id}/mix-restrictions/${rowId}`);
    },
  },
};
