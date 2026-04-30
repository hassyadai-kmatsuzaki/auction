import axios from '@/lib/axios';

export type CampaignStatus = 'draft' | 'queued' | 'sending' | 'sent' | 'cancelled' | 'failed';
export type TargetType = 'all' | 'filter' | 'manual';

export interface CampaignTargetFilter {
  role?: string | string[];
  has_won?: boolean;
  last_login_after?: string;
  last_login_before?: string;
  bank_transfer_unconfirmed?: boolean;
}

export interface EmailCampaign {
  id: number;
  subject: string;
  body_markdown: string;
  target_type: TargetType;
  target_filter: CampaignTargetFilter | null;
  target_user_ids: number[] | null;
  status: CampaignStatus;
  created_by: number;
  scheduled_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  total_recipients: number;
  sent_count: number;
  failed_count: number;
  created_at: string;
  updated_at: string;
  creator?: { id: number; name: string };
}

export interface CampaignRecipient {
  id: number;
  email_campaign_id: number;
  user_id: number;
  email: string;
  status: 'queued' | 'sent' | 'failed' | 'bounced' | 'complained' | 'skipped';
  sent_at: string | null;
  error: string | null;
  user?: { id: number; name: string; email: string };
}

export interface CampaignFormPayload {
  subject: string;
  body_markdown: string;
  target_type: TargetType;
  target_filter?: CampaignTargetFilter | null;
  target_user_ids?: number[] | null;
  scheduled_at?: string | null;
}

export interface PaginationMeta {
  total: number;
  per_page: number;
  current_page: number;
  last_page: number;
}

export const emailCampaignApi = {
  async list(params: { status?: string; per_page?: number; page?: number } = {}) {
    const res = await axios.get('/api/admin/email-campaigns', { params });
    return res.data.data as { campaigns: EmailCampaign[]; pagination: PaginationMeta };
  },

  async get(id: number) {
    const res = await axios.get(`/api/admin/email-campaigns/${id}`);
    return res.data.data as {
      campaign: EmailCampaign;
      recipients_sample: CampaignRecipient[];
      recipients_summary: Record<string, number>;
    };
  },

  async preview(payload: Omit<CampaignFormPayload, 'subject' | 'body_markdown'> & { subject?: string; body_markdown?: string }) {
    const res = await axios.post('/api/admin/email-campaigns/preview', payload);
    return res.data.data as { count: number; sample: { id: number; name: string; email: string }[] };
  },

  async testSend(payload: CampaignFormPayload) {
    const res = await axios.post('/api/admin/email-campaigns/test-send', payload);
    return res.data as { success: boolean; message: string };
  },

  async create(payload: CampaignFormPayload) {
    const res = await axios.post('/api/admin/email-campaigns', payload);
    return res.data.data.campaign as EmailCampaign;
  },

  async cancel(id: number) {
    const res = await axios.post(`/api/admin/email-campaigns/${id}/cancel`);
    return res.data as { success: boolean; message: string };
  },
};
