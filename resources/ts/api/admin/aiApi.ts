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

// ─── 自動カテゴリ分類（ベータ） ─────────────────────
export interface CategoryResult {
  category: 'premium' | 'improved' | 'standard';
  label: string;
  source: 'ai' | 'rule';
}

export interface CategorizedItem {
  item_id: number;
  item_number: number | null;
  species_name: string;
  quantity: number | null;
  quantity_unit: string | null;
  category: CategoryResult['category'] | null;
  label: string | null;
  source: CategoryResult['source'] | null;
}

export const aiCategoryApi = {
  classify: async (speciesName: string, description?: string): Promise<CategoryResult> => {
    const res = await axios.post('/api/admin/ai/categories/classify', { species_name: speciesName, description });
    return res.data.data;
  },
  classifyAuction: async (auctionId: number): Promise<{
    items: CategorizedItem[];
    summary: { category: CategoryResult['category']; label: string; count: number }[];
    ai_enabled: boolean;
  }> => {
    const res = await axios.get(`/api/admin/ai/categories/auction/${auctionId}`);
    return res.data.data;
  },
};

// ─── マッチング（基本版） ───────────────────────────
export interface MatchedBuyer {
  user_id: number;
  name: string;
  score: number;
  reasons: string[];
  wins: number;
  breakdown: { species: number; seller: number; price: number; recency: number };
}

export const aiMatchingApi = {
  buyersForItem: async (itemId: number): Promise<{
    item: { id: number; item_number: number | null; species_name: string; start_price: number; expected_price: number; expected_price_source: string };
    buyers: MatchedBuyer[];
  }> => {
    const res = await axios.get(`/api/admin/ai/matching/items/${itemId}/buyers`);
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
