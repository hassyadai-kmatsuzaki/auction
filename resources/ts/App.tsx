import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Box } from '@mui/material';
import { AuthProvider } from './contexts/AuthContext';
import PrivateRoute from './components/PrivateRoute';
import GuestRoute from './components/GuestRoute';
import RootRedirect from './components/RootRedirect';

// Auth pages
import Login from './pages/auth/Login';
import Register from './pages/auth/Register';
import SetPassword from './pages/auth/SetPassword';
import ForgotPassword from './pages/auth/ForgotPassword';
import ResetPassword from './pages/auth/ResetPassword';

// Participant pages
import ParticipantLayout from './layouts/ParticipantLayout';
import ParticipantHome from './pages/participant/Home';
import AuctionList from './pages/participant/AuctionList';
import AuctionItems from './pages/participant/AuctionItems';
import AuctionLive from './pages/participant/AuctionLive';
import WonItems from './pages/participant/WonItems';
import ParticipantSettings from './pages/participant/Settings';
import ParticipantManual from './pages/participant/Manual';

// Admin pages
import AdminLayout from './layouts/AdminLayout';
import AdminDashboard from './pages/admin/Dashboard';
import AnnouncementManagement from './pages/admin/AnnouncementManagement';
import AnnouncementForm from './pages/admin/AnnouncementForm';
import AuctionManagement from './pages/admin/AuctionManagement';
import AuctionForm from './pages/admin/AuctionForm';
import ItemManagement from './pages/admin/ItemManagement';
import ItemManagementAuctions from './pages/admin/ItemManagementAuctions';
import ItemForm from './pages/admin/ItemForm';
import LiveControl from './pages/admin/LiveControl';
import LiveAuctions from './pages/admin/LiveAuctions';
import WonItemManagement from './pages/admin/WonItemManagement';
import WonItemAuctions from './pages/admin/WonItemAuctions';
import UserManagement from './pages/admin/UserManagement';
import UserDetail from './pages/admin/UserDetail';
import UserCreate from './pages/admin/UserCreate';
import Settings from './pages/admin/Settings';
import SellerManagement from './pages/admin/SellerManagement';
import SellerDetail from './pages/admin/SellerDetail';
import BuyerManagement from './pages/admin/BuyerManagement';
import BuyerDetail from './pages/admin/BuyerDetail';
import DocumentManagement from './pages/admin/DocumentManagement';
import AdminManual from './pages/admin/Manual';

// AI pages
import AIAnalytics from './pages/admin/AIAnalytics';
import AIImageRecognition from './pages/admin/AIImageRecognition';
import AIPricePrediction from './pages/admin/AIPricePrediction';
import AIFraudDetection from './pages/admin/AIFraudDetection';
import AIRecommendations from './pages/admin/AIRecommendations';
import Reports from './pages/admin/Reports';
import DesignSystem from './pages/admin/DesignSystem';
import LaneAssignment from './pages/admin/LaneAssignment';

// Seller pages
import SellerLayout from './layouts/SellerLayout';
import SellerDashboard from './pages/seller/Dashboard';
import SubmitItem from './pages/seller/SubmitItem';
import SellerProfile from './pages/seller/Profile';
import SellerShipping from './pages/seller/Shipping';
import ItemHistory from './pages/seller/ItemHistory';
import SellerItemDetail from './pages/seller/ItemDetail';
import SalesSettlement from './pages/seller/SalesSettlement';
import SellerManual from './pages/seller/Manual';

// Legal pages
import PrivacyPolicy from './pages/legal/PrivacyPolicy';
import SpecifiedCommercialTransaction from './pages/legal/SpecifiedCommercialTransaction';
import TermsOfService from './pages/legal/TermsOfService';

// Error pages
import NotFound from './pages/NotFound';

function App() {
  return (
    <AuthProvider>
      <Router>
        <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
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
            <Route path="won-items" element={<WonItems />} />
            <Route path="won-items/:id" element={<NotFound />} /> {/* 落札詳細は未実装のため404 */}
            <Route path="manual" element={<ParticipantManual />} />
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
      </Box>
    </Router>
    </AuthProvider>
  );
}

export default App;
