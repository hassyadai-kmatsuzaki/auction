import axios from '@/lib/axios';

type ExportParams = {
  from?: string | null;
  to?: string | null;
  include_test?: boolean;
};

type AuctionItemsParams = ExportParams & {
  auction_id?: number | null;
};

const downloadCsv = async (url: string, params: Record<string, unknown>, fallbackName: string) => {
  const res = await axios.get(url, { params, responseType: 'blob' });

  let filename = fallbackName;
  const disposition = res.headers['content-disposition'] as string | undefined;
  if (disposition) {
    const m = disposition.match(/filename="?([^"]+)"?/);
    if (m?.[1]) filename = m[1];
  }

  const blobUrl = URL.createObjectURL(res.data);
  const a = document.createElement('a');
  a.href = blobUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(blobUrl);
};

const cleanParams = <T extends Record<string, unknown>>(p: T): Record<string, unknown> => {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(p)) {
    if (v === null || v === undefined || v === '' || v === false) continue;
    out[k] = v === true ? 1 : v;
  }
  return out;
};

export const adminCsvExportApi = {
  auctionsSummary: (params: ExportParams) =>
    downloadCsv(
      '/api/admin/exports/auctions-summary.csv',
      cleanParams(params),
      'auction_summary.csv',
    ),
  auctionItems: (params: AuctionItemsParams) =>
    downloadCsv(
      '/api/admin/exports/auction-items.csv',
      cleanParams(params),
      'auction_items.csv',
    ),
  members: () =>
    downloadCsv(
      '/api/admin/exports/members.csv',
      {},
      'members.csv',
    ),
  wonItemsShipping: (auctionId: number) =>
    downloadCsv(
      '/api/admin/exports/won-items-shipping.csv',
      cleanParams({ auction_id: auctionId }),
      `auction_${auctionId}_shipping_list.csv`,
    ),
  favorites: (auctionId: number) =>
    downloadCsv(
      '/api/admin/exports/favorites.csv',
      cleanParams({ auction_id: auctionId }),
      `auction_${auctionId}_favorites.csv`,
    ),
  bidLimits: (auctionId: number) =>
    downloadCsv(
      '/api/admin/exports/bid-limits.csv',
      cleanParams({ auction_id: auctionId }),
      `auction_${auctionId}_bid_limits.csv`,
    ),
};
