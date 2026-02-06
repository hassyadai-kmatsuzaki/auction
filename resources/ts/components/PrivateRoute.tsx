import { Navigate, useLocation } from 'react-router-dom';
import { CircularProgress, Box } from '@mui/material';
import { useAuth } from '../contexts/AuthContext';
import Forbidden from '../pages/Forbidden';

interface PrivateRouteProps {
  children: React.ReactElement;
  requiredRoles?: string[];
}

const PrivateRoute: React.FC<PrivateRouteProps> = ({ children, requiredRoles }) => {
  const { isAuthenticated, loading, hasRole } = useAuth();
  const location = useLocation();

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

  if (!isAuthenticated) {
    // ログインしていない場合はログインページにリダイレクト（元のURLを保持）
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (requiredRoles && requiredRoles.length > 0) {
    // 必要なロールのいずれかを持っているかチェック
    const hasRequiredRole = requiredRoles.some(role => hasRole(role));

    if (!hasRequiredRole) {
      // 権限がない場合は403ページを表示
      return <Forbidden />;
    }
  }

  return children;
};

export default PrivateRoute;
