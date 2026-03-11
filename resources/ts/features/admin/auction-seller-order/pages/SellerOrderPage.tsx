import { useNavigate, useParams } from 'react-router-dom';
import {
  Box,
  Typography,
  Button,
  Paper,
  CircularProgress,
  Alert,
  Snackbar,
  Breadcrumbs,
  Link,
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  AutoAwesome as AutoAwesomeIcon,
} from '@mui/icons-material';
import { useState } from 'react';
import { useSellerOrder } from '../hooks/useSellerOrder';
import SellerOrderList from '../components/SellerOrderList';
import RandomizeButton from '../components/RandomizeButton';

export default function SellerOrderPage() {
  const navigate = useNavigate();
  const { auctionId } = useParams<{ auctionId: string }>();
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' });

  const { data, isLoading, error, refetch } = useSellerOrder(Number(auctionId));

  const handleAutoAssign = () => {
    navigate(`/admin/auctions/${auctionId}/lanes`);
  };

  const handleRandomizeSuccess = () => {
    setSnackbar({
      open: true,
      message: '出品者順序をランダムに設定しました',
      severity: 'success',
    });
    refetch();
  };

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '50vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">データの取得に失敗しました</Alert>
      </Box>
    );
  }

  const sellers = data?.data.seller_orders || [];
  const isEditable = data?.data.is_editable ?? false;

  return (
    <Box sx={{ p: 3 }}>
      {/* ヘッダー */}
      <Box sx={{ mb: 3 }}>
        <Breadcrumbs sx={{ mb: 2 }}>
          <Link
            component="button"
            variant="body2"
            onClick={() => navigate('/admin/auctions')}
            sx={{ textDecoration: 'none', cursor: 'pointer' }}
          >
            オークション管理
          </Link>
          <Link
            component="button"
            variant="body2"
            onClick={() => navigate(`/admin/auctions/${auctionId}/items`)}
            sx={{ textDecoration: 'none', cursor: 'pointer' }}
          >
            生体管理
          </Link>
          <Typography color="text.primary">出品者順序管理</Typography>
        </Breadcrumbs>

        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Button
              startIcon={<ArrowBackIcon />}
              onClick={() => navigate(`/admin/auctions/${auctionId}/items`)}
            >
              戻る
            </Button>
            <Typography variant="h4" component="h1">
              出品者表示順序管理
            </Typography>
          </Box>

          <Box sx={{ display: 'flex', gap: 2 }}>
            <RandomizeButton
              auctionId={Number(auctionId)}
              disabled={!isEditable}
              onSuccess={handleRandomizeSuccess}
            />
            <Button
              variant="contained"
              startIcon={<AutoAwesomeIcon />}
              onClick={handleAutoAssign}
            >
              レーンに自動割り当て
            </Button>
          </Box>
        </Box>

        {!isEditable && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            オークションが開始済みのため、出品者順序を変更できません。
          </Alert>
        )}

        {sellers.length === 0 && (
          <Alert severity="info" sx={{ mb: 2 }}>
            出品者順序が設定されていません。「ランダム化」ボタンをクリックして順序を設定してください。
          </Alert>
        )}
      </Box>

      {/* 出品者リスト */}
      <Paper sx={{ p: 3 }}>
        {sellers.length > 0 ? (
          <>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              ドラッグ&ドロップで出品者の順序を変更できます。
              出品者をクリックすると、その出品者の生体一覧が表示され、生体の順序も変更できます。
            </Typography>
            <SellerOrderList
              auctionId={Number(auctionId)}
              sellers={sellers}
              isEditable={isEditable}
            />
          </>
        ) : (
          <Box sx={{ textAlign: 'center', py: 8 }}>
            <Typography variant="h6" color="text.secondary" gutterBottom>
              出品者順序が未設定です
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              「ランダム化」ボタンをクリックして、出品者の表示順序を設定してください。
            </Typography>
          </Box>
        )}
      </Paper>

      {/* スナックバー */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          severity={snackbar.severity}
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
