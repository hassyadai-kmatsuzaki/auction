import axios from '../../lib/axios';

// ─── 画像認識 ──────────────────────────────────────
export const aiImageApi = {
  analyze: async (itemId: number) => {
    const res = await axios.post(`/api/admin/ai/image-analysis/${itemId}`);
    return res.data;
  },
  batchAnalyze: async (auctionId: number) => {
    const res = await axios.post(`/api/admin/ai/image-analysis/batch/${auctionId}`);
    return res.data;
  },
  getResults: async (itemId: number) => {
    const res = await axios.get(`/api/admin/ai/image-analysis/${itemId}/results`);
    return res.data.data;
  },
};

// ─── 価格予測 ──────────────────────────────────────
export const aiPriceApi = {
  predict: async (itemId: number) => {
    const res = await axios.post(`/api/admin/ai/price-prediction/${itemId}`);
    return res.data.data;
  },
  getMarketTrends: async () => {
    const res = await axios.get('/api/admin/ai/market-trends');
    return res.data.data;
  },
};

// ─── 不正検知 ──────────────────────────────────────
export const aiFraudApi = {
  runDetection: async (auctionId: number) => {
    const res = await axios.post(`/api/admin/ai/fraud-detection/${auctionId}`);
    return res.data.data;
  },
  getAlerts: async (params?: { status?: string; severity?: string }) => {
    const res = await axios.get('/api/admin/ai/fraud-alerts', { params });
    return res.data.data;
  },
  resolveAlert: async (id: number, data: { status: string; notes?: string }) => {
    const res = await axios.patch(`/api/admin/ai/fraud-alerts/${id}`, data);
    return res.data.data;
  },
};

// ─── レコメンド ────────────────────────────────────
export const aiRecommendApi = {
  generate: async (userId: number) => {
    const res = await axios.post(`/api/admin/ai/recommendations/${userId}`);
    return res.data.data;
  },
};

// ─── NLP ───────────────────────────────────────────
export const aiNlpApi = {
  extract: async (text: string) => {
    const res = await axios.post('/api/admin/ai/nlp/extract', { text });
    return res.data.data;
  },
  classify: async (speciesName: string, description?: string) => {
    const res = await axios.post('/api/admin/ai/nlp/classify', { species_name: speciesName, description });
    return res.data.data;
  },
};

// ─── ダッシュボード ────────────────────────────────
export const aiDashboardApi = {
  getSummary: async () => {
    const res = await axios.get('/api/admin/ai/dashboard');
    return res.data.data;
  },
};

// ─── ユーティリティ（オークション・商品取得） ───────
export const adminDataApi = {
  getAuctions: async () => {
    const res = await axios.get('/api/admin/auctions');
    return res.data.data.auctions ?? res.data.data ?? [];
  },
  getItems: async (auctionId: number) => {
    const res = await axios.get(`/api/admin/auctions/${auctionId}/items`, { params: { per_page: 100 } });
    return res.data.data.items ?? res.data.data ?? [];
  },
};
