import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Box } from '@mui/material';

// Auth pages
import Login from './pages/auth/Login';
import Register from './pages/auth/Register';

// Participant pages
import ParticipantLayout from './layouts/ParticipantLayout';
import ParticipantHome from './pages/participant/Home';
import AuctionLive from './pages/participant/AuctionLive';
import WonItems from './pages/participant/WonItems';

// Admin pages
import AdminLayout from './layouts/AdminLayout';
import AdminDashboard from './pages/admin/Dashboard';
import AnnouncementManagement from './pages/admin/AnnouncementManagement';
import AnnouncementForm from './pages/admin/AnnouncementForm';
import AuctionManagement from './pages/admin/AuctionManagement';
import AuctionForm from './pages/admin/AuctionForm';
import ItemManagement from './pages/admin/ItemManagement';
import ItemForm from './pages/admin/ItemForm';
import LiveControl from './pages/admin/LiveControl';
import WonItemManagement from './pages/admin/WonItemManagement';
import UserManagement from './pages/admin/UserManagement';
import UserDetail from './pages/admin/UserDetail';
import Settings from './pages/admin/Settings';
import SellerManagement from './pages/admin/SellerManagement';
import SellerDetail from './pages/admin/SellerDetail';
import BuyerManagement from './pages/admin/BuyerManagement';
import BuyerDetail from './pages/admin/BuyerDetail';
import DocumentManagement from './pages/admin/DocumentManagement';

// AI pages
import AIAnalytics from './pages/admin/AIAnalytics';
import AIImageRecognition from './pages/admin/AIImageRecognition';
import AIPricePrediction from './pages/admin/AIPricePrediction';
import AIFraudDetection from './pages/admin/AIFraudDetection';
import AIRecommendations from './pages/admin/AIRecommendations';
import Reports from './pages/admin/Reports';

// Seller pages
import SellerLayout from './layouts/SellerLayout';
import SellerDashboard from './pages/seller/Dashboard';
import SubmitItem from './pages/seller/SubmitItem';
import SellerProfile from './pages/seller/Profile';
import SellerShipping from './pages/seller/Shipping';
import ItemHistory from './pages/seller/ItemHistory';
import SalesSettlement from './pages/seller/SalesSettlement';

// Legal pages
import PrivacyPolicy from './pages/legal/PrivacyPolicy';
import SpecifiedCommercialTransaction from './pages/legal/SpecifiedCommercialTransaction';
import TermsOfService from './pages/legal/TermsOfService';

// Mock: ログイン状態とユーザータイプを管理（実際はContextやReduxを使用）
const mockUser = {
  isLoggedIn: true,
  userType: 'participant' as 'admin' | 'participant' | 'seller',
};

function App() {
  return (
    <Router>
      <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
        <Routes>
          {/* 認証ページ */}
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

          {/* 法的ページ */}
          <Route path="/legal/privacy" element={<PrivacyPolicy />} />
          <Route path="/legal/tokushoho" element={<SpecifiedCommercialTransaction />} />
          <Route path="/legal/terms" element={<TermsOfService />} />

          {/* 参加者（買受者）ページ */}
          <Route path="/participant" element={<ParticipantLayout />}>
            <Route index element={<Navigate to="/participant/home" replace />} />
            <Route path="home" element={<ParticipantHome />} />
            <Route path="auction/:auctionId/live" element={<AuctionLive />} />
            <Route path="won-items" element={<WonItems />} />
          </Route>

          {/* 出品者ページ */}
          <Route path="/seller" element={<SellerLayout />}>
            <Route index element={<Navigate to="/seller/dashboard" replace />} />
            <Route path="dashboard" element={<SellerDashboard />} />
            <Route path="submit" element={<SubmitItem />} />
            <Route path="items" element={<ItemHistory />} />
            <Route path="sales" element={<SalesSettlement />} />
            <Route path="shipping" element={<SellerShipping />} />
            <Route path="profile" element={<SellerProfile />} />
            <Route path="bank" element={<SellerProfile />} /> {/* 口座情報（プロフィールで代用） */}
            <Route path="settings" element={<SellerProfile />} /> {/* 設定（プロフィールで代用） */}
          </Route>

          {/* 管理者ページ */}
          <Route path="/admin" element={<AdminLayout />}>
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
            <Route path="auctions/:auctionId/items" element={<ItemManagement />} />
            <Route path="auctions/:auctionId/items/create" element={<ItemForm />} />
            <Route path="auctions/:auctionId/items/:id/edit" element={<ItemForm />} />
            
            {/* ライブ管理 */}
            <Route path="auctions/:auctionId/live" element={<LiveControl />} />
            
            {/* 落札者管理 */}
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
            
            {/* AI・分析 */}
            <Route path="ai-analytics" element={<AIAnalytics />} />
            <Route path="ai/image-recognition" element={<AIImageRecognition />} />
            <Route path="ai/price-prediction" element={<AIPricePrediction />} />
            <Route path="ai/fraud-detection" element={<AIFraudDetection />} />
            <Route path="ai/recommendations" element={<AIRecommendations />} />
            <Route path="reports" element={<Reports />} />
            
            {/* ユーザー管理（旧） */}
            <Route path="users" element={<UserManagement />} />
            <Route path="users/:id" element={<UserDetail />} />
            
            {/* 設定 */}
            <Route path="settings" element={<Settings />} />
          </Route>

          {/* デフォルトリダイレクト */}
          <Route path="/" element={
            mockUser.isLoggedIn 
              ? <Navigate to={
                  mockUser.userType === 'admin' ? '/admin' 
                  : mockUser.userType === 'seller' ? '/seller'
                  : '/participant'
                } replace />
              : <Navigate to="/login" replace />
          } />
        </Routes>
      </Box>
    </Router>
  );
}

export default App;
