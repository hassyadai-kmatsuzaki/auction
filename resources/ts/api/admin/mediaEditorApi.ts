import axios from '@/lib/axios';

export interface MediaEditorAuction {
  id: number;
  title: string;
  event_date: string | null;
  status: 'preparing' | 'scheduled';
  items_count: number;
  is_test: boolean;
}

export interface MediaEditorMedia {
  id: number;
  media_type: string;
  file_path: string;
  file_url: string | null;
  is_thumbnail: boolean;
  display_order: number;
}

export interface MediaEditorItem {
  id: number;
  item_number: number;
  species_name: string;
  thumbnail_path: string | null;
  media_count: number;
  status: string;
}

export const mediaEditorApi = {
  listAuctions: async (params?: { page?: number; per_page?: number; search?: string }) => {
    const res = await axios.get('/api/media-editor/auctions', { params });
    return res.data.data as {
      auctions: MediaEditorAuction[];
      pagination: { total: number; per_page: number; current_page: number; last_page: number };
    };
  },

  listItems: async (
    auctionId: number,
    params?: { page?: number; per_page?: number; search?: string }
  ) => {
    const res = await axios.get(`/api/media-editor/auctions/${auctionId}/items`, { params });
    return res.data.data;
  },

  getItem: async (auctionId: number, itemId: number) => {
    const res = await axios.get(`/api/media-editor/auctions/${auctionId}/items/${itemId}`);
    return res.data.data.item;
  },

  uploadMedia: async (
    auctionId: number,
    itemId: number,
    file: File,
    mediaType: 'image' | 'video',
    isThumbnail: boolean,
    onUploadProgress?: (progress: number) => void
  ) => {
    const fd = new FormData();
    fd.append('file', file);
    fd.append('media_type', mediaType);
    fd.append('is_thumbnail', isThumbnail.toString());

    const res = await axios.post(
      `/api/media-editor/auctions/${auctionId}/items/${itemId}/media`,
      fd,
      {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (e) => {
          if (onUploadProgress && e.total) {
            onUploadProgress(Math.round((e.loaded * 100) / e.total));
          }
        },
      }
    );
    return res.data;
  },

  deleteMedia: async (auctionId: number, itemId: number, mediaId: number) => {
    const res = await axios.delete(
      `/api/media-editor/auctions/${auctionId}/items/${itemId}/media/${mediaId}`
    );
    return res.data;
  },

  setThumbnail: async (auctionId: number, itemId: number, mediaId: number) => {
    const res = await axios.patch(
      `/api/media-editor/auctions/${auctionId}/items/${itemId}/media/${mediaId}/thumbnail`
    );
    return res.data;
  },
};
