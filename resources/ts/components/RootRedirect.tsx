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
  // - admin を含む場合は管理画面（admin 兼任の media_editor も含む）
  // - media_editor 単独の場合はメディア編集者ホーム
  // - それ以外は参加者画面
  const roleNames = user?.roles.map(r => r.name) ?? [];
  if (roleNames.includes('admin')) {
    return <Navigate to="/admin" replace />;
  }
  if (roleNames.includes('media_editor')) {
    return <Navigate to="/admin/media-editor" replace />;
  }
  return <Navigate to="/participant/home" replace />;
};

export default RootRedirect;
