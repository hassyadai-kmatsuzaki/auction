import { useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { adminAuctionApi } from '@/api/admin/auctionApi';
import { useNotificationStore } from '@/stores/notificationStore';

export interface AuctionFormData {
  title: string;
  event_date: Date | null;
  start_time: Date | null;
  description: string;
  default_bid_increment: number;
  countdown_seconds: number;
  deposit_required: boolean;
  upload_deadline: Date | null;
  payment_deadline_hours: number;
  shipping_deadline_hours: number;
  use_custom_settings: boolean;
  custom_auction_settings: {
    price_increment_rate: number;
    price_increment_min: number;
    countdown_seconds: number;
    countdown_seconds_default: number;
    countdown_seconds_competitive: number;
    venue_open_minutes_before_start: number;
    item_switch_delay_seconds: number;
    freeze_countdown_seconds: number;
    bid_countdown_seconds: number;
    post_sale_display_seconds: number;
    auction_start_countdown_seconds: number;
    price_increment_tiers: Array<{ from_price: number; to_price: number | null; increment_amount: number }>;
    countdown_tiers: Array<{ from_price: number; to_price: number | null; bid_countdown_seconds: number; freeze_countdown_seconds: number }>;
  };
  custom_fee_settings: {
    seller_commission_rate: number;
    seller_commission_min: number;
    buyer_commission_rate: number;
    buyer_commission_min: number;
    base_listing_fee: number;
    premium_listing_fee: number;
  };
  custom_shipping_settings: {
    packaging_fee: number;
    handling_fee: number;
    insurance_fee_rate: number;
    cooling_fee_summer: number;
    heating_fee_winter: number;
    shipping_discount_rate: number;
  };
}

const DEFAULT_FORM_DATA: AuctionFormData = {
  title: '',
  event_date: null,
  start_time: new Date(0, 0, 0, 10, 0),
  description: '',
  default_bid_increment: 100,
  countdown_seconds: 3,
  deposit_required: false,
  upload_deadline: null,
  payment_deadline_hours: 24,
  shipping_deadline_hours: 48,
  use_custom_settings: false,
  custom_auction_settings: {
    price_increment_rate: 10,
    price_increment_min: 50,
    countdown_seconds: 3,
    countdown_seconds_default: 10,
    countdown_seconds_competitive: 1,
    venue_open_minutes_before_start: 30,
    item_switch_delay_seconds: 5,
    freeze_countdown_seconds: 1,
    bid_countdown_seconds: 5,
    post_sale_display_seconds: 2,
    auction_start_countdown_seconds: 10,
    price_increment_tiers: [
      { from_price: 0, to_price: 999, increment_amount: 50 },
      { from_price: 1000, to_price: 4999, increment_amount: 100 },
      { from_price: 5000, to_price: 9999, increment_amount: 500 },
      { from_price: 10000, to_price: 49999, increment_amount: 1000 },
      { from_price: 50000, to_price: null, increment_amount: 5000 },
    ],
    countdown_tiers: [],
  },
  custom_fee_settings: {
    seller_commission_rate: 10,
    seller_commission_min: 500,
    buyer_commission_rate: 5,
    buyer_commission_min: 300,
    base_listing_fee: 500,
    premium_listing_fee: 800,
  },
  custom_shipping_settings: {
    packaging_fee: 500,
    handling_fee: 300,
    insurance_fee_rate: 3,
    cooling_fee_summer: 300,
    heating_fee_winter: 300,
    shipping_discount_rate: 0,
  },
};

export function useAuctionForm(auctionId?: number) {
  const queryClient = useQueryClient();
  const showSnackbar = useNotificationStore((s) => s.showSnackbar);
  const isEdit = Boolean(auctionId);

  const [formData, setFormData] = useState<AuctionFormData>(DEFAULT_FORM_DATA);
  const [canEdit, setCanEdit] = useState(true);

  // 既存データ取得（編集時）
  const { data: existingData, isLoading: fetchLoading } = useQuery({
    queryKey: ['admin-auction-edit', auctionId],
    queryFn: () => adminAuctionApi.getOne(auctionId!),
    enabled: isEdit,
  });

  useEffect(() => {
    if (!existingData) return;
    const auction = existingData.auction;
    if (!['preparing', 'scheduled'].includes(auction.status)) {
      setCanEdit(false);
    }
    const startTime = new Date(0, 0, 0);
    if (auction.start_time) {
      const [h, m] = auction.start_time.split(':');
      startTime.setHours(parseInt(h), parseInt(m));
    }
    setFormData({
      ...DEFAULT_FORM_DATA,
      title: auction.title,
      event_date: auction.event_date ? new Date(auction.event_date) : null,
      start_time: startTime,
      description: auction.description || '',
      default_bid_increment: parseFloat(auction.default_bid_increment),
      countdown_seconds: auction.countdown_seconds,
      deposit_required: auction.deposit_required,
      upload_deadline: auction.upload_deadline ? new Date(auction.upload_deadline) : null,
      payment_deadline_hours: auction.payment_deadline_hours,
      shipping_deadline_hours: auction.shipping_deadline_hours,
      use_custom_settings: auction.use_custom_settings || false,
      custom_auction_settings: auction.custom_auction_settings || DEFAULT_FORM_DATA.custom_auction_settings,
      custom_fee_settings: auction.custom_fee_settings || DEFAULT_FORM_DATA.custom_fee_settings,
      custom_shipping_settings: auction.custom_shipping_settings || DEFAULT_FORM_DATA.custom_shipping_settings,
    });
  }, [existingData]);

  // 保存
  const saveMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      isEdit ? adminAuctionApi.update(auctionId!, payload) : adminAuctionApi.create(payload),
    onSuccess: () => {
      showSnackbar(isEdit ? 'オークションを更新しました' : 'オークションを作成しました', 'success');
      queryClient.invalidateQueries({ queryKey: ['admin-auctions'] });
    },
    onError: (err: any) => {
      showSnackbar(err?.response?.data?.message || '保存に失敗しました', 'error');
    },
  });

  const buildPayload = (): Record<string, unknown> => {
    const formatLocalDate = (date: Date | null) => {
      if (!date) return null;
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    };
    const formatLocalDateTime = (date: Date | null) => {
      if (!date) return null;
      const d = formatLocalDate(date);
      const h = String(date.getHours()).padStart(2, '0');
      const m = String(date.getMinutes()).padStart(2, '0');
      const s = String(date.getSeconds()).padStart(2, '0');
      return `${d}T${h}:${m}:${s}`;
    };
    const startTime = formData.start_time
      ? `${String(formData.start_time.getHours()).padStart(2, '0')}:${String(formData.start_time.getMinutes()).padStart(2, '0')}`
      : '10:00';

    return {
      title:                    formData.title,
      event_date:               formatLocalDate(formData.event_date),
      start_time:               startTime,
      description:              formData.description,
      default_bid_increment:    formData.default_bid_increment,
      countdown_seconds:        formData.countdown_seconds,
      deposit_required:         false,
      upload_deadline:          formatLocalDateTime(formData.upload_deadline),
      payment_deadline_hours:   24,
      shipping_deadline_hours:  48,
      use_custom_settings:      formData.use_custom_settings,
      custom_auction_settings:  formData.use_custom_settings ? formData.custom_auction_settings : null,
      custom_fee_settings:      formData.use_custom_settings ? formData.custom_fee_settings : null,
      custom_shipping_settings: formData.use_custom_settings ? formData.custom_shipping_settings : null,
    };
  };

  return {
    formData,
    setFormData,
    canEdit,
    fetchLoading,
    isSaving: saveMutation.isPending,
    save: () => saveMutation.mutate(buildPayload()),
  };
}
