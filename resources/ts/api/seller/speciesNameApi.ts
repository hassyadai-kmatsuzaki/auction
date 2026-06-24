import axios from '@/lib/axios';

/**
 * 出品申込フォームの入力補助に使う品種名（生体名）候補の取得（読み取り専用）。
 */
export const sellerSpeciesNameApi = {
  list: async (): Promise<string[]> => {
    const res = await axios.get('/api/seller/species-names');
    return res.data.data ?? [];
  },
};
