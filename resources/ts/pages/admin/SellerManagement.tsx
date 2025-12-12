import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  IconButton,
  Button,
  TextField,
  InputAdornment,
  Card,
  CardContent,
  Avatar,
  Tabs,
  Tab,
  Menu,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import {
  Search as SearchIcon,
  Visibility as VisibilityIcon,
  Edit as EditIcon,
  MoreVert as MoreVertIcon,
  CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon,
  Store as StoreIcon,
  Add as AddIcon,
  FileDownload as ExportIcon,
} from '@mui/icons-material';

// Mock データ
const sellers = [
  {
    id: 1,
    name: '田中養魚場',
    representative: '田中太郎',
    email: 'tanaka@example.com',
    phone: '090-1234-5678',
    address: '東京都品川区xxx',
    status: 'approved',
    commission_rate: 10,
    total_items: 45,
    total_sales: 580000,
    created_at: '2025-08-15T10:00:00Z',
  },
  {
    id: 2,
    name: 'メダカの佐藤',
    representative: '佐藤花子',
    email: 'sato@example.com',
    phone: '090-2345-6789',
    address: '埼玉県さいたま市xxx',
    status: 'pending',
    commission_rate: 10,
    total_items: 0,
    total_sales: 0,
    created_at: '2025-11-10T15:00:00Z',
  },
  {
    id: 3,
    name: '鈴木メダカファーム',
    representative: '鈴木一郎',
    email: 'suzuki@example.com',
    phone: '090-3456-7890',
    address: '千葉県千葉市xxx',
    status: 'approved',
    commission_rate: 8,
    total_items: 120,
    total_sales: 1250000,
    created_at: '2025-06-20T11:00:00Z',
  },
  {
    id: 4,
    name: '高橋養殖',
    representative: '高橋美咲',
    email: 'takahashi@example.com',
    phone: '090-4567-8901',
    address: '神奈川県横浜市xxx',
    status: 'suspended',
    commission_rate: 10,
    total_items: 30,
    total_sales: 320000,
    created_at: '2025-07-05T09:00:00Z',
  },
];

// KPIカードコンポーネント
function StatCard({ title, value, icon, color }: { title: string; value: string | number; icon: React.ReactNode; color: string }) {
  return (
    <Card sx={{ height: '100%' }}>
      <CardContent sx={{ p: 2.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box>
            <Typography variant="body2" sx={{ color: 'text.secondary', mb: 0.5 }}>
              {title}
            </Typography>
            <Typography variant="h4" sx={{ fontWeight: 700 }}>
              {value}
            </Typography>
          </Box>
          <Box
            sx={{
              width: 48,
              height: 48,
              borderRadius: 2,
              bgcolor: `${color}15`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: color,
            }}
          >
            {icon}
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
}

export default function SellerManagement() {
  const navigate = useNavigate();
  const [tabValue, setTabValue] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [selectedSeller, setSelectedSeller] = useState<typeof sellers[0] | null>(null);
  const [approveDialogOpen, setApproveDialogOpen] = useState(false);

  const filteredSellers = sellers.filter((seller) => {
    const matchesSearch =
      seller.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      seller.representative.toLowerCase().includes(searchQuery.toLowerCase()) ||
      seller.email.toLowerCase().includes(searchQuery.toLowerCase());

    if (tabValue === 0) return matchesSearch;
    if (tabValue === 1) return matchesSearch && seller.status === 'pending';
    if (tabValue === 2) return matchesSearch && seller.status === 'approved';
    if (tabValue === 3) return matchesSearch && seller.status === 'suspended';
    return matchesSearch;
  });

  const pendingCount = sellers.filter((s) => s.status === 'pending').length;
  const approvedCount = sellers.filter((s) => s.status === 'approved').length;
  const suspendedCount = sellers.filter((s) => s.status === 'suspended').length;

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>, seller: typeof sellers[0]) => {
    setAnchorEl(event.currentTarget);
    setSelectedSeller(seller);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleApprove = () => {
    setApproveDialogOpen(true);
    handleMenuClose();
  };

  const getStatusChip = (status: string) => {
    const config = {
      pending: { label: '承認待ち', color: '#F59E0B', bgcolor: '#FEF3C7' },
      approved: { label: '有効', color: '#059669', bgcolor: '#ECFDF5' },
      suspended: { label: '停止中', color: '#DC2626', bgcolor: '#FEF2F2' },
    }[status] || { label: status, color: '#64748B', bgcolor: '#F1F5F9' };

    return (
      <Chip
        size="small"
        label={config.label}
        sx={{
          bgcolor: config.bgcolor,
          color: config.color,
          fontWeight: 600,
          fontSize: '0.75rem',
        }}
      />
    );
  };

  return (
    <Box>
      {/* ヘッダー */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 4 }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 700, mb: 0.5 }}>
            出品者登録一覧
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            出品者の登録情報を管理します
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1.5 }}>
          <Button variant="outlined" startIcon={<ExportIcon />}>
            エクスポート
          </Button>
          <Button variant="contained" startIcon={<AddIcon />}>
            新規登録
          </Button>
        </Box>
      </Box>

      {/* KPIカード */}
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 3, mb: 4 }}>
        <StatCard title="総出品者数" value={sellers.length} icon={<StoreIcon />} color="#3B82F6" />
        <StatCard title="承認待ち" value={pendingCount} icon={<CheckCircleIcon />} color="#F59E0B" />
        <StatCard title="有効" value={approvedCount} icon={<CheckCircleIcon />} color="#059669" />
        <StatCard title="停止中" value={suspendedCount} icon={<CancelIcon />} color="#DC2626" />
      </Box>

      {/* フィルター・検索 */}
      <Card sx={{ mb: 3 }}>
        <Box sx={{ borderBottom: '1px solid', borderColor: 'divider' }}>
          <Tabs value={tabValue} onChange={(_, v) => setTabValue(v)}>
            <Tab label={`すべて (${sellers.length})`} />
            <Tab label={`承認待ち (${pendingCount})`} />
            <Tab label={`有効 (${approvedCount})`} />
            <Tab label={`停止中 (${suspendedCount})`} />
          </Tabs>
        </Box>
        <Box sx={{ p: 2 }}>
          <TextField
            size="small"
            placeholder="出品者名、代表者名、メールアドレスで検索..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            sx={{ width: 350 }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon sx={{ color: 'text.secondary', fontSize: 20 }} />
                </InputAdornment>
              ),
            }}
          />
        </Box>
      </Card>

      {/* テーブル */}
      <Card>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>出品者名</TableCell>
                <TableCell>代表者</TableCell>
                <TableCell>連絡先</TableCell>
                <TableCell align="center">手数料率</TableCell>
                <TableCell align="right">出品数</TableCell>
                <TableCell align="right">総売上</TableCell>
                <TableCell align="center">ステータス</TableCell>
                <TableCell align="center">操作</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredSellers.map((seller) => (
                <TableRow key={seller.id} hover sx={{ cursor: 'pointer' }}>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                      <Avatar
                        sx={{
                          width: 36,
                          height: 36,
                          bgcolor: '#F0FDF4',
                          color: '#059669',
                          fontSize: '0.875rem',
                        }}
                      >
                        {seller.name.charAt(0)}
                      </Avatar>
                      <Box>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                          {seller.name}
                        </Typography>
                        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                          ID: {seller.id}
                        </Typography>
                      </Box>
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">{seller.representative}</Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">{seller.email}</Typography>
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                      {seller.phone}
                    </Typography>
                  </TableCell>
                  <TableCell align="center">
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {seller.commission_rate}%
                    </Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {seller.total_items}点
                    </Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      ¥{seller.total_sales.toLocaleString()}
                    </Typography>
                  </TableCell>
                  <TableCell align="center">{getStatusChip(seller.status)}</TableCell>
                  <TableCell align="center">
                    <IconButton
                      size="small"
                      onClick={() => navigate(`/admin/sellers/${seller.id}`)}
                    >
                      <VisibilityIcon sx={{ fontSize: 18 }} />
                    </IconButton>
                    <IconButton
                      size="small"
                      onClick={() => navigate(`/admin/sellers/${seller.id}/edit`)}
                    >
                      <EditIcon sx={{ fontSize: 18 }} />
                    </IconButton>
                    <IconButton size="small" onClick={(e) => handleMenuOpen(e, seller)}>
                      <MoreVertIcon sx={{ fontSize: 18 }} />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Card>

      {/* アクションメニュー */}
      <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={handleMenuClose}>
        {selectedSeller?.status === 'pending' && (
          <MenuItem onClick={handleApprove}>
            <CheckCircleIcon sx={{ mr: 1, fontSize: 18, color: 'success.main' }} />
            承認する
          </MenuItem>
        )}
        {selectedSeller?.status === 'approved' && (
          <MenuItem onClick={handleMenuClose}>
            <CancelIcon sx={{ mr: 1, fontSize: 18, color: 'error.main' }} />
            停止する
          </MenuItem>
        )}
        {selectedSeller?.status === 'suspended' && (
          <MenuItem onClick={handleMenuClose}>
            <CheckCircleIcon sx={{ mr: 1, fontSize: 18, color: 'success.main' }} />
            再有効化
          </MenuItem>
        )}
      </Menu>

      {/* 承認ダイアログ */}
      <Dialog open={approveDialogOpen} onClose={() => setApproveDialogOpen(false)}>
        <DialogTitle>出品者を承認</DialogTitle>
        <DialogContent>
          <Typography>
            「{selectedSeller?.name}」を承認しますか？承認後、出品者はオークションに出品できるようになります。
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setApproveDialogOpen(false)}>キャンセル</Button>
          <Button variant="contained" color="success" onClick={() => setApproveDialogOpen(false)}>
            承認する
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

