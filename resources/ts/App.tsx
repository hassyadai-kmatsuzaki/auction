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
import SetPassword from './pages/auth/SetPassword';
import ForgotPassword from './pages/auth/ForgotPassword';
import ResetPassword from './pages/auth/ResetPassword';

// Layouts（同期ロード）
import ParticipantLayout from './layouts/ParticipantLayout';
import AdminLayout from './layouts/AdminLayout';
import SellerLayout from './layouts/SellerLayout';

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
const ParticipantDemo        = lazy(() => import('./pages/participant/Demo'));

// Admin
const AdminDashboard         = lazy(() => import('./pages/admin/Dashboard'));
const AnnouncementManagement = lazy(() => import('./pages/admin/AnnouncementManagement'));
const AnnouncementForm       = lazy(() => import('./pages/admin/AnnouncementForm'));
const AuctionManagement      = lazy(() => import('./pages/admin/AuctionManagement'));
const AuctionForm            = lazy(() => import('./pages/admin/AuctionForm'));
const ItemManagement         = lazy(() => import('./pages/admin/ItemManagement'));
const ItemManagementAuctions = lazy(() => import('./pages/admin/ItemManagementAuctions'));
const ItemForm               = lazy(() => import('./pages/admin/ItemForm'));
const LiveControl            = lazy(() => import('./pages/admin/LiveControl'));
const LiveAuctions           = lazy(() => import('./pages/admin/LiveAuctions'));
const WonItemManagement      = lazy(() => import('./pages/admin/WonItemManagement'));
const WonItemAuctions        = lazy(() => import('./pages/admin/WonItemAuctions'));
const UserManagement         = lazy(() => import('./pages/admin/UserManagement'));
const UserDetail             = lazy(() => import('./pages/admin/UserDetail'));
const UserCreate             = lazy(() => import('./pages/admin/UserCreate'));
const Settings               = lazy(() => import('./pages/admin/Settings'));
const SellerManagement       = lazy(() => import('./pages/admin/SellerManagement'));
const SellerDetail           = lazy(() => import('./pages/admin/SellerDetail'));
const BuyerManagement        = lazy(() => import('./pages/admin/BuyerManagement'));
const BuyerDetail            = lazy(() => import('./pages/admin/BuyerDetail'));
const DocumentManagement     = lazy(() => import('./pages/admin/DocumentManagement'));
const AdminManual            = lazy(() => import('./pages/admin/Manual'));
const LaneAssignment         = lazy(() => import('./pages/admin/LaneAssignment'));
const Reports                = lazy(() => import('./pages/admin/Reports'));
const DesignSystem           = lazy(() => import('./pages/admin/DesignSystem'));
const AIAnalytics            = lazy(() => import('./pages/admin/AIAnalytics'));
const AIImageRecognition     = lazy(() => import('./pages/admin/AIImageRecognition'));
const AIPricePrediction      = lazy(() => import('./pages/admin/AIPricePrediction'));
const AIFraudDetection       = lazy(() => import('./pages/admin/AIFraudDetection'));
const AIRecommendations      = lazy(() => import('./pages/admin/AIRecommendations'));

// Seller
const SellerDashboard        = lazy(() => import('./pages/seller/Dashboard'));
const SubmitItem             = lazy(() => import('./pages/seller/SubmitItem'));
const SellerProfile          = lazy(() => import('./pages/seller/Profile'));
const SellerShipping         = lazy(() => import('./pages/seller/Shipping'));
const ItemHistory            = lazy(() => import('./pages/seller/ItemHistory'));
const SellerItemDetail       = lazy(() => import('./pages/seller/ItemDetail'));
const SalesSettlement        = lazy(() => import('./pages/seller/SalesSettlement'));
const SellerManual           = lazy(() => import('./pages/seller/Manual'));

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
            <Route path="/auth/set-password" element={<SetPassword />} />
            <Route path="/auth/forgot-password" element={<GuestRoute><ForgotPassword /></GuestRoute>} />
            <Route path="/auth/reset-password" element={<GuestRoute><ResetPassword /></GuestRoute>} />

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
            <Route path="demo" element={<ParticipantDemo />} />
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
            <Route path="manual" element={<SellerManual />} />
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
            
            {/* オークション管理 */}
            <Route path="auctions" element={<AuctionManagement />} />
            <Route path="auctions/create" element={<AuctionForm />} />
            <Route path="auctions/:id/edit" element={<AuctionForm />} />
            
            {/* 生体管理 */}
            <Route path="items" element={<ItemManagementAuctions />} />
            <Route path="auctions/:auctionId/items" element={<ItemManagement />} />
            <Route path="auctions/:auctionId/items/create" element={<ItemForm />} />
            <Route path="auctions/:auctionId/items/:id/edit" element={<ItemForm />} />
            
            {/* レーン割当 */}
            <Route path="auctions/:auctionId/lanes" element={<LaneAssignment />} />
            
            {/* ライブ管理 */}
            <Route path="live" element={<LiveAuctions />} />
            <Route path="auctions/:auctionId/live" element={<LiveControl />} />
            
            {/* 落札者管理 */}
            <Route path="won-items" element={<WonItemAuctions />} />
            <Route path="auctions/:auctionId/won-items" element={<WonItemManagement />} />
            
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
            
            {/* マニュアル */}
            <Route path="manual" element={<AdminManual />} />
            
            {/* AI・分析 */}
            <Route path="ai-analytics" element={<AIAnalytics />} />
            <Route path="ai/image-recognition" element={<AIImageRecognition />} />
            <Route path="ai/price-prediction" element={<AIPricePrediction />} />
            <Route path="ai/fraud-detection" element={<AIFraudDetection />} />
            <Route path="ai/recommendations" element={<AIRecommendations />} />
            <Route path="reports" element={<Reports />} />
            
            {/* ユーザー管理 */}
            <Route path="users" element={<UserManagement />} />
            <Route path="users/create" element={<UserCreate />} />
            <Route path="users/:id" element={<UserDetail />} />
            
            {/* 設定 */}
            <Route path="settings" element={<Settings />} />
            
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
