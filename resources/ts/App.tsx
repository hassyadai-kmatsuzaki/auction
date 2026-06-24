import { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Box, CircularProgress } from '@mui/material';
import { AuthProvider } from './contexts/AuthContext';
import PrivateRoute from './components/PrivateRoute';
import GuestRoute from './components/GuestRoute';
import RootRedirect from './components/RootRedirect';

// Auth pages（小さいので同期ロード）
import Login from './pages/auth/Login';
import Register from './pages/auth/Register';
import RegisterSeller from './pages/auth/RegisterSeller';
import SetPassword from './pages/auth/SetPassword';
import ForgotPassword from './pages/auth/ForgotPassword';
import ResetPassword from './pages/auth/ResetPassword';
import TwoFactorVerify from './pages/auth/TwoFactorVerify';
import GoogleCallback from './pages/auth/GoogleCallback';

// Layouts（同期ロード）
import ParticipantLayout from './layouts/ParticipantLayout';
import AdminLayout from './layouts/AdminLayout';
import SellerLayout from './layouts/SellerLayout';
import AuctionWorkspace from './layouts/AuctionWorkspace';
import MediaEditorLayout from './layouts/MediaEditorLayout';

// Legal（同期ロード）
import PrivacyPolicy from './pages/legal/PrivacyPolicy';
import SpecifiedCommercialTransaction from './pages/legal/SpecifiedCommercialTransaction';
import TermsOfService from './pages/legal/TermsOfService';

// Error pages
import NotFound from './pages/NotFound';

// ─── 遅延読み込み（重いページ群） ────────────────────────────────────────────

// Participant
const ParticipantHome        = lazy(() => import('./pages/participant/Home'));
const AuctionList            = lazy(() => import('./pages/participant/AuctionList'));
const AuctionItems           = lazy(() => import('./pages/participant/AuctionItems'));
const AuctionLive            = lazy(() => import('./pages/participant/AuctionLive'));
const WonItems               = lazy(() => import('./pages/participant/WonItems'));
const Favorites              = lazy(() => import('./pages/participant/Favorites'));
const ParticipantSettings    = lazy(() => import('./pages/participant/Settings'));
const ParticipantManual      = lazy(() => import('./pages/participant/Manual'));

// Admin
const AdminDashboard         = lazy(() => import('./pages/admin/Dashboard'));
const AnnouncementManagement = lazy(() => import('./pages/admin/AnnouncementManagement'));
const AnnouncementForm       = lazy(() => import('./pages/admin/AnnouncementForm'));
const EmailCampaignManagement = lazy(() => import('./pages/admin/EmailCampaignManagement'));
const EmailCampaignForm      = lazy(() => import('./pages/admin/EmailCampaignForm'));
const EmailCampaignDetail    = lazy(() => import('./pages/admin/EmailCampaignDetail'));
const AuctionManagement      = lazy(() => import('./pages/admin/AuctionManagement'));
const AuctionForm            = lazy(() => import('./pages/admin/AuctionForm'));
const AuctionShipments       = lazy(() => import('./pages/admin/AuctionShipments'));
const ItemManagement         = lazy(() => import('./pages/admin/ItemManagement'));
const ItemForm               = lazy(() => import('./pages/admin/ItemForm'));
const LiveControl            = lazy(() => import('./pages/admin/LiveControl'));
const WonItemManagement      = lazy(() => import('./pages/admin/WonItemManagement'));
const UserManagement         = lazy(() => import('./pages/admin/UserManagement'));
const UserDetail             = lazy(() => import('./pages/admin/UserDetail'));
const UserCreate             = lazy(() => import('./pages/admin/UserCreate'));
const Settings               = lazy(() => import('./pages/admin/Settings'));
const SpeciesTypeManagement  = lazy(() => import('./pages/admin/SpeciesTypeManagement'));
const SpeciesNameManagement  = lazy(() => import('./pages/admin/SpeciesNameManagement'));
const LpCvrSettings          = lazy(() => import('./pages/admin/LpCvrSettings'));
const Scaling                = lazy(() => import('./pages/admin/Scaling'));
const SellerManagement       = lazy(() => import('./pages/admin/SellerManagement'));
const SellerDetail           = lazy(() => import('./pages/admin/SellerDetail'));
const BuyerManagement        = lazy(() => import('./pages/admin/BuyerManagement'));
const BuyerDetail            = lazy(() => import('./pages/admin/BuyerDetail'));
const DocumentManagement     = lazy(() => import('./pages/admin/DocumentManagement'));
const LaneAssignment         = lazy(() => import('./pages/admin/LaneAssignment'));
const SellerOrderPage        = lazy(() => import('./features/admin/auction-seller-order/pages/SellerOrderPage'));
const Reports                = lazy(() => import('./pages/admin/Reports'));
const CsvExports             = lazy(() => import('./pages/admin/CsvExports'));
const DesignSystem           = lazy(() => import('./pages/admin/DesignSystem'));
const AIAnalytics            = lazy(() => import('./pages/admin/AIAnalytics'));
const AIImageRecognition     = lazy(() => import('./pages/admin/AIImageRecognition'));
const AIPricePrediction      = lazy(() => import('./pages/admin/AIPricePrediction'));
const AIFraudDetection       = lazy(() => import('./pages/admin/AIFraudDetection'));
const AIRecommendations      = lazy(() => import('./pages/admin/AIRecommendations'));
const PlanManagement         = lazy(() => import('./pages/admin/PlanManagement'));
const SubscriptionManagement = lazy(() => import('./pages/admin/SubscriptionManagement'));
const PaymentManagement      = lazy(() => import('./pages/admin/PaymentManagement'));

// Media Editor (admin / media_editor 共用、メディアのみ編集)
const MediaEditorAuctionList = lazy(() => import('./pages/admin/MediaEditor/AuctionList'));
const MediaEditorItemList    = lazy(() => import('./pages/admin/MediaEditor/ItemList'));
const MediaEditorItemMediaEdit = lazy(() => import('./pages/admin/MediaEditor/ItemMediaEdit'));

// Seller
const SellerDashboard        = lazy(() => import('./pages/seller/Dashboard'));
const SubmitItem             = lazy(() => import('./pages/seller/SubmitItem'));
const SellerProfile          = lazy(() => import('./pages/seller/Profile'));
const SellerShipping         = lazy(() => import('./pages/seller/Shipping'));
const ItemHistory            = lazy(() => import('./pages/seller/ItemHistory'));
const SellerItemDetail       = lazy(() => import('./pages/seller/ItemDetail'));
const SalesSettlement        = lazy(() => import('./pages/seller/SalesSettlement'));

// Presentation（認証不要）
const Presentation           = lazy(() => import('./pages/presentation/Presentation'));

// ローディングフォールバック
const PageLoader = () => (
  <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
    <CircularProgress />
  </Box>
);

function App() {
  return (
    <AuthProvider>
      <Router>
        <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
          <Suspense fallback={<PageLoader />}>
          <Routes>
            {/* 認証ページ（認証済みユーザーはダッシュボードにリダイレクト） */}
            <Route path="/login" element={<GuestRoute><Login /></GuestRoute>} />
            <Route path="/register" element={<GuestRoute><Register /></GuestRoute>} />
            <Route path="/register/seller" element={<GuestRoute><RegisterSeller /></GuestRoute>} />
            <Route path="/auth/set-password" element={<SetPassword />} />
            <Route path="/auth/forgot-password" element={<GuestRoute><ForgotPassword /></GuestRoute>} />
            <Route path="/auth/reset-password" element={<GuestRoute><ResetPassword /></GuestRoute>} />
            <Route path="/auth/two-factor" element={<TwoFactorVerify />} />
            <Route path="/auth/google-callback" element={<GoogleCallback />} />

          {/* プレゼンテーション（認証不要） */}
          <Route path="/presentation" element={<Presentation />} />

          {/* 法的ページ */}
          <Route path="/legal/privacy" element={<PrivacyPolicy />} />
          <Route path="/legal/tokushoho" element={<SpecifiedCommercialTransaction />} />
          <Route path="/legal/terms" element={<TermsOfService />} />

          {/* 参加者（買受者）ページ */}
          <Route path="/participant" element={
            <PrivateRoute requiredRoles={['participant']}>
              <ParticipantLayout />
            </PrivateRoute>
          }>
            <Route index element={<Navigate to="/participant/home" replace />} />
            <Route path="home" element={<ParticipantHome />} />
            <Route path="auctions" element={<AuctionList />} />
            <Route path="auction/:auctionId/items" element={<AuctionItems />} />
            <Route path="auction/:auctionId/live" element={<AuctionLive />} />
            <Route path="favorites" element={<Favorites />} />
            <Route path="won-items" element={<WonItems />} />
            <Route path="manual" element={<ParticipantManual />} />
            <Route path="demo" element={<Navigate to="/presentation" replace />} />
            <Route path="settings" element={<ParticipantSettings />} />
          </Route>

          {/* 出品者ページ */}
          <Route path="/seller" element={
            <PrivateRoute requiredRoles={['seller']}>
              <SellerLayout />
            </PrivateRoute>
          }>
            <Route index element={<Navigate to="/seller/dashboard" replace />} />
            <Route path="dashboard" element={<SellerDashboard />} />
            <Route path="submit" element={<SubmitItem />} />
            <Route path="items" element={<ItemHistory />} />
            <Route path="items/create" element={<SubmitItem />} />
            <Route path="items/:id" element={<SellerItemDetail />} />
            <Route path="sales" element={<SalesSettlement />} />
            <Route path="shipping" element={<SellerShipping />} />
            <Route path="profile" element={<SellerProfile />} />
            <Route path="bank" element={<SellerProfile />} /> {/* 口座情報（プロフィールで代用） */}
            <Route path="settings" element={<SellerProfile />} /> {/* 設定（プロフィールで代用） */}
          </Route>

          {/* メディア編集（admin / media_editor 共用、商品メディアのみ） */}
          {/* 注意: /admin ルート（admin 専用）より先に置く必要あり */}
          <Route path="/admin/media-editor" element={
            <PrivateRoute requiredRoles={['admin', 'media_editor']}>
              <MediaEditorLayout />
            </PrivateRoute>
          }>
            <Route index element={<MediaEditorAuctionList />} />
            <Route path="auctions/:auctionId/items" element={<MediaEditorItemList />} />
            <Route path="auctions/:auctionId/items/:id" element={<MediaEditorItemMediaEdit />} />
          </Route>

          {/* 管理者ページ */}
          <Route path="/admin" element={
            <PrivateRoute requiredRoles={['admin']}>
              <AdminLayout />
            </PrivateRoute>
          }>
            <Route index element={<Navigate to="/admin/dashboard" replace />} />
            <Route path="dashboard" element={<AdminDashboard />} />
            
            {/* お知らせ管理 */}
            <Route path="announcements" element={<AnnouncementManagement />} />
            <Route path="announcements/create" element={<AnnouncementForm />} />
            <Route path="announcements/:id/edit" element={<AnnouncementForm />} />

            {/* メール配信 */}
            <Route path="email-campaigns" element={<EmailCampaignManagement />} />
            <Route path="email-campaigns/create" element={<EmailCampaignForm />} />
            <Route path="email-campaigns/:id" element={<EmailCampaignDetail />} />
            
            {/* オークション管理 */}
            <Route path="auctions" element={<AuctionManagement />} />
            <Route path="auctions/create" element={<AuctionForm />} />
            <Route path="auctions/:id/edit" element={<AuctionForm />} />

            {/* 旧入口 → オークション一覧に統合 */}
            <Route path="items"      element={<Navigate to="/admin/auctions" replace />} />
            <Route path="live"       element={<Navigate to="/admin/auctions" replace />} />
            <Route path="won-items"  element={<Navigate to="/admin/auctions" replace />} />

            {/* アイテム作成・編集は従来どおり（ワークスペース外の独立画面） */}
            <Route path="auctions/:auctionId/items/create" element={<ItemForm />} />
            <Route path="auctions/:auctionId/items/:id/edit" element={<ItemForm />} />

            {/* オークションごとのワークスペース（タブ式） */}
            <Route path="auctions/:auctionId" element={<AuctionWorkspace />}>
              <Route index element={<Navigate to="items" replace />} />
              <Route path="items"        element={<ItemManagement />} />
              <Route path="lanes"        element={<LaneAssignment />} />
              <Route path="seller-order" element={<SellerOrderPage />} />
              <Route path="shipments"    element={<AuctionShipments />} />
              <Route path="live"         element={<LiveControl />} />
              <Route path="won-items"    element={<WonItemManagement />} />
            </Route>
            
            {/* 出品者管理 */}
            <Route path="sellers" element={<SellerManagement />} />
            <Route path="sellers/:id" element={<SellerDetail />} />
            <Route path="sellers/:id/edit" element={<SellerDetail />} />
            
            {/* 買受者管理 */}
            <Route path="buyers" element={<BuyerManagement />} />
            <Route path="buyers/:id" element={<BuyerDetail />} />
            <Route path="buyers/:id/edit" element={<BuyerDetail />} />
            
            {/* 帳票管理 */}
            <Route path="documents" element={<DocumentManagement />} />

            {/* AI・分析 */}
            <Route path="ai-analytics" element={<AIAnalytics />} />
            <Route path="ai/image-recognition" element={<AIImageRecognition />} />
            <Route path="ai/price-prediction" element={<AIPricePrediction />} />
            <Route path="ai/fraud-detection" element={<AIFraudDetection />} />
            <Route path="ai/recommendations" element={<AIRecommendations />} />
            <Route path="reports" element={<Reports />} />
            <Route path="exports" element={<CsvExports />} />
            
            {/* ユーザー管理 */}
            <Route path="users" element={<UserManagement />} />
            <Route path="users/create" element={<UserCreate />} />
            <Route path="users/:id" element={<UserDetail />} />

            {/* 年会費プラン・決済管理 */}
            <Route path="plans" element={<PlanManagement />} />
            <Route path="subscriptions" element={<SubscriptionManagement />} />
            <Route path="payments" element={<PaymentManagement />} />
            
            {/* 設定 */}
            <Route path="settings" element={<Settings />} />
            <Route path="masters/species-types" element={<SpeciesTypeManagement />} />
            <Route path="masters/species-names" element={<SpeciesNameManagement />} />
            <Route path="lp-cvr" element={<LpCvrSettings />} />

            {/* インフラスケーリング */}
            <Route path="scaling" element={<Scaling />} />
            
            {/* デザインシステム */}
            <Route path="design-system" element={<DesignSystem />} />
          </Route>

          {/* デフォルトリダイレクト（認証必須） */}
          <Route path="/" element={<RootRedirect />} />
          
          {/* 404 Not Found */}
          <Route path="*" element={<NotFound />} />
        </Routes>
          </Suspense>
      </Box>
    </Router>
    </AuthProvider>
  );
}

export default App;
