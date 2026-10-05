/**
 * 画面に変化が出る機能の表示スイッチ。サーバーの .env（config/features.php）を
 * app.blade.php の <meta name="app-features"> で受け取る。読めなければすべて OFF（従来の画面）。
 */
type FeatureFlags = {
  pedigree_certificate?: boolean;
  announcement_read?: boolean;
  google_login?: boolean;
  subscription_self_service?: boolean;
  settlement_mark_paid?: boolean;
  packing_material_edit?: boolean;
  tutorial?: boolean;
  item_search?: boolean;
  campaign_schedule?: boolean;
  bid_history?: boolean;
  seller_rating?: boolean;
  item_detail_fields?: boolean;
  seller_csv?: boolean;
  seller_review_buyer?: boolean;
  pickup_request?: boolean;
  item_category?: boolean;
  escrow_view?: boolean;
};

const read = (): FeatureFlags => {
  try {
    const raw = document.querySelector('meta[name="app-features"]')?.getAttribute('content');
    return raw ? (JSON.parse(raw) as FeatureFlags) : {};
  } catch {
    return {};
  }
};

const flags = read();

export const features = {
  pedigreeCertificate: flags.pedigree_certificate === true,
  announcementRead: flags.announcement_read === true,
  googleLogin: flags.google_login === true,
  subscriptionSelfService: flags.subscription_self_service === true,
  settlementMarkPaid: flags.settlement_mark_paid === true,
  packingMaterialEdit: flags.packing_material_edit === true,
  tutorial: flags.tutorial === true,
  itemSearch: flags.item_search === true,
  campaignSchedule: flags.campaign_schedule === true,
  bidHistory: flags.bid_history === true,
  sellerRating: flags.seller_rating === true,
  itemDetailFields: flags.item_detail_fields === true,
  sellerCsv: flags.seller_csv === true,
  sellerReviewBuyer: flags.seller_review_buyer === true,
  pickupRequest: flags.pickup_request === true,
  itemCategory: flags.item_category === true,
  escrowView: flags.escrow_view === true,
};
