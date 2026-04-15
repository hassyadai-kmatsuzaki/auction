import axios from '@/lib/axios';

export type InvoiceRow = {
  auction_id: number;
  winner_id: number;
  invoice_number: string;
  buyer: { id: number; name: string; email: string };
  auction: string;
  items_count: number;
  total_amount: number;
  status: 'paid' | 'pending' | 'overdue';
  issued_at: string | null;
  paid_at: string | null;
};

export type PaymentNoticeRow = {
  auction_id: number;
  seller_id: number;
  notice_number: string;
  seller: { id: number; name: string; email: string };
  auction: string;
  items_count: number;
  sales_amount: number;
  commission: number;
  net_amount: number;
  status: 'sent' | 'draft';
  issued_at: string | null;
  transfer_scheduled: string | null;
};

export type DeliveryNoteRow = {
  auction_id: number;
  winner_id: number;
  delivery_note_number: string;
  buyer: { id: number; name: string; email: string };
  auction: string;
  items_count: number;
  total_quantity: number;
  status: 'preparing' | 'shipped' | 'completed';
  shipped_at: string | null;
  issued_at: string | null;
};

const downloadPdf = async (url: string, filename: string) => {
  const res = await axios.get(url, { responseType: 'blob' });
  const blobUrl = URL.createObjectURL(res.data);
  const a = document.createElement('a');
  a.href = blobUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(blobUrl);
};

export const adminDocumentApi = {
  getInvoices: async (): Promise<InvoiceRow[]> => {
    const res = await axios.get('/api/admin/documents/invoices');
    return res.data.data;
  },
  getPaymentNotices: async (): Promise<PaymentNoticeRow[]> => {
    const res = await axios.get('/api/admin/documents/payment-notices');
    return res.data.data;
  },
  getDeliveryNotes: async (): Promise<DeliveryNoteRow[]> => {
    const res = await axios.get('/api/admin/documents/delivery-notes');
    return res.data.data;
  },
  downloadInvoice: (auctionId: number, winnerId: number) =>
    downloadPdf(
      `/api/admin/auctions/${auctionId}/winners/${winnerId}/invoice`,
      `invoice_auction_${auctionId}_winner_${winnerId}.pdf`,
    ),
  downloadPaymentNotice: (auctionId: number, sellerId: number) =>
    downloadPdf(
      `/api/admin/auctions/${auctionId}/sellers/${sellerId}/payment-notice`,
      `payment_notice_auction_${auctionId}_seller_${sellerId}.pdf`,
    ),
  downloadDeliveryNote: (auctionId: number, winnerId: number) =>
    downloadPdf(
      `/api/admin/auctions/${auctionId}/winners/${winnerId}/delivery-note`,
      `delivery_note_auction_${auctionId}_winner_${winnerId}.pdf`,
    ),
};
