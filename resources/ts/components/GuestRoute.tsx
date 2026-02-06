import { Navigate } from 'react-router-dom';
import { CircularProgress, Box } from '@mui/material';
import { useAuth } from '../contexts/AuthContext';

interface GuestRouteProps {
  children: React.ReactElement;
}

/**
 * 認証済みユーザーが認証ページ（login/register等）にアクセスした場合、
 * ロール別ダッシュボードにリダイレクトする。
 * 未認証ユーザーはそのまま子コンポーネントを表示する。
 */
const GuestRoute: React.FC<GuestRouteProps> = ({ children }) => {
  const { isAuthenticated, loading, user } = useAuth();

  if (loading) {
    return (
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '100vh',
        }}
      >
        <CircularProgress />
      </Box>
    );
  }

  if (isAuthenticated && user) {
    // ロールに応じてリダイレクト
    if (user.roles.some(r => r.name === 'admin')) {
      return <Navigate to="/admin" replace />;
    } else if (user.roles.some(r => r.name === 'seller')) {
      return <Navigate to="/seller" replace />;
    } else {
      return <Navigate to="/participant/home" replace />;
    }
  }

  return children;
};

export default GuestRoute;
