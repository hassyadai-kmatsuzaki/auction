import axios from '@/lib/axios';

export type LpType = 'buyer' | 'seller';

export interface LpCvrSetting {
  id: number;
  lp_type: LpType;
  rid: string;
  cta_url: string;
  note: string | null;
  created_at: string;
  updated_at: string;
}

export interface LpCvrIndexResponse {
  lp_type: LpType;
  default_cta_url: string;
  failsafe_cta_url: string;
  preview_base_url: string;
  items: LpCvrSetting[];
}

export interface LpCvrPayload {
  rid: string;
  cta_url: string;
  note?: string | null;
}

export const lpCvrApi = {
  async list(lpType: LpType) {
    const res = await axios.get(`/api/admin/lp-cvr/${lpType}`);
    return res.data.data as LpCvrIndexResponse;
  },

  async create(lpType: LpType, payload: LpCvrPayload) {
    const res = await axios.post(`/api/admin/lp-cvr/${lpType}`, payload);
    return res.data.data.item as LpCvrSetting;
  },

  async update(lpType: LpType, id: number, payload: LpCvrPayload) {
    const res = await axios.put(`/api/admin/lp-cvr/${lpType}/${id}`, payload);
    return res.data.data.item as LpCvrSetting;
  },

  async remove(lpType: LpType, id: number) {
    const res = await axios.delete(`/api/admin/lp-cvr/${lpType}/${id}`);
    return res.data as { success: boolean };
  },

  async updateDefault(lpType: LpType, defaultCtaUrl: string) {
    const res = await axios.put(`/api/admin/lp-cvr/${lpType}/default`, {
      default_cta_url: defaultCtaUrl,
    });
    return res.data.data as { lp_type: LpType; default_cta_url: string };
  },
};
