import React from 'react';
import { Navigate } from 'react-router-dom';
import { CircularProgress, Box } from '@mui/material';
import { useAuth } from '../contexts/AuthContext';

const RootRedirect: React.FC = () => {
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

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // ロールに応じてリダイレクト
  // 管理者のみの場合は管理画面へ、それ以外は参加者画面へ
  if (user?.roles.length === 1 && user?.roles.some(r => r.name === 'admin')) {
    return <Navigate to="/admin" replace />;
  } else {
    return <Navigate to="/participant/home" replace />;
  }
};

export default RootRedirect;
