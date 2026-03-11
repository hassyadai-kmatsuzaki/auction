import axios from '../../../../lib/axios';

export interface SellerOrderItem {
  id: number;
  item_number: number;
  species_name: string;
  quantity: number;
  thumbnail_path: string | null;
  seller_display_order: number | null;
  is_premium: boolean;
  status: string;
}

export interface SellerOrder {
  id: number;
  seller_profile_id: number;
  seller_name: string;
  seller_code: string | null;
  display_order: number;
  item_count: number;
  items: SellerOrderItem[];
}

export interface SellerOrderResponse {
  success: boolean;
  data: {
    seller_orders: SellerOrder[];
    is_editable: boolean;
  };
}

export interface RandomizeResponse {
  success: boolean;
  message: string;
  data: {
    seller_orders: Array<{
      seller_profile_id: number;
      seller_name: string;
      display_order: number;
      item_count: number;
    }>;
  };
}

export const sellerOrderApi = {
  /**
   * 出品者順序一覧取得
   */
  getSellerOrders: async (auctionId: number): Promise<SellerOrderResponse> => {
    const response = await axios.get(`/api/admin/auctions/${auctionId}/seller-order`);
    return response.data;
  },

  /**
   * 出品者順序のランダム化
   */
  randomize: async (auctionId: number): Promise<RandomizeResponse> => {
    const response = await axios.post(`/api/admin/auctions/${auctionId}/seller-order/randomize`);
    return response.data;
  },

  /**
   * 出品者順序の手動更新
   */
  reorderSellers: async (
    auctionId: number,
    sellerOrders: Array<{ seller_profile_id: number; display_order: number }>
  ): Promise<{ success: boolean; message: string }> => {
    const response = await axios.put(`/api/admin/auctions/${auctionId}/seller-order/reorder`, {
      seller_orders: sellerOrders,
    });
    return response.data;
  },

  /**
   * 出品者内の生体順序の更新
   */
  reorderItems: async (
    auctionId: number,
    sellerProfileId: number,
    items: Array<{ item_id: number; seller_display_order: number }>
  ): Promise<{ success: boolean; message: string }> => {
    const response = await axios.put(
      `/api/admin/auctions/${auctionId}/seller-order/${sellerProfileId}/items/reorder`,
      { items }
    );
    return response.data;
  },
};
