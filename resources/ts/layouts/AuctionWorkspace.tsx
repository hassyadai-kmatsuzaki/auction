import { useEffect, useMemo, useState } from 'react';
import { Link as RouterLink, Outlet, useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  Box,
  Breadcrumbs,
  Chip,
  CircularProgress,
  Link,
  Paper,
  Tab,
  Tabs,
  Typography,
} from '@mui/material';
import {
  Pets as PetsIcon,
  ViewKanban as LaneIcon,
  Storefront as SellerIcon,
  Gavel as LiveIcon,
  Receipt as WonIcon,
  LocalShipping as ShipIcon,
} from '@mui/icons-material';
import axios from '../lib/axios';

type AuctionStatus = 'preparing' | 'scheduled' | 'live' | 'finished' | 'cancelled';

interface AuctionSummary {
  id: number;
  title: string;
  event_date: string;
  start_time: string;
  status: AuctionStatus;
}

const STATUS_META: Record<AuctionStatus, { label: string; color: 'default' | 'warning' | 'success' | 'info' | 'error' }> = {
  preparing: { label: '準備中',     color: 'default' },
  scheduled: { label: '予定',       color: 'warning' },
  live:      { label: '開催中',     color: 'success' },
  finished:  { label: '終了',       color: 'info'    },
  cancelled: { label: 'キャンセル', color: 'error'   },
};

const TABS: { value: string; label: string; icon: React.ReactElement; match: string }[] = [
  { value: 'items',        label: '商品',         icon: <PetsIcon fontSize="small" />,   match: '/items' },
  { value: 'lanes',        label: 'レーン',       icon: <LaneIcon fontSize="small" />,   match: '/lanes' },
  { value: 'seller-order', label: '出品者順序',   icon: <SellerIcon fontSize="small" />, match: '/seller-order' },
  { value: 'shipments',    label: '伝票番号',     icon: <ShipIcon fontSize="small" />,   match: '/shipments' },
  { value: 'live',         label: 'ライブ',       icon: <LiveIcon fontSize="small" />,   match: '/live' },
  { value: 'won-items',    label: '落札者',       icon: <WonIcon fontSize="small" />,    match: '/won-items' },
];

export default function AuctionWorkspace() {
  const { auctionId } = useParams<{ auctionId: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const [auction, setAuction] = useState<AuctionSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!auctionId) return;
    setLoading(true);
    axios
      .get(`/api/admin/auctions/${auctionId}`)
      .then((res) => {
        const payload = res.data?.data?.auction ?? res.data?.data ?? null;
        setAuction(payload);
      })
      .catch(() => setAuction(null))
      .finally(() => setLoading(false));
  }, [auctionId]);

  const activeTab = useMemo(() => {
    const found = TABS.find((t) => location.pathname.endsWith(t.match));
    return found?.value ?? 'items';
  }, [location.pathname]);

  const handleTabChange = (_: unknown, value: string) => {
    navigate(`/admin/auctions/${auctionId}/${value}`);
  };

  const formatDate = (d?: string) =>
    d ? new Date(d).toLocaleDateString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit' }) : '';

  const formatTime = (t?: string) =>
    t ? new Date(`2000-01-01 ${t}`).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' }) : '';

  return (
    <Box>
      <Paper
        elevation={0}
        sx={{
          position: 'sticky',
          top: 0,
          zIndex: 10,
          borderRadius: 0,
          borderBottom: '1px solid',
          borderColor: 'divider',
          bgcolor: 'background.paper',
          px: { xs: 2, md: 3 },
          pt: 2,
        }}
      >
        <Breadcrumbs sx={{ mb: 1 }}>
          <Link component={RouterLink} to="/admin/auctions" underline="hover" color="text.secondary">
            オークション一覧
          </Link>
          <Typography color="text.primary" sx={{ fontSize: '0.875rem' }}>
            {loading ? '読み込み中…' : auction?.title ?? `オークション #${auctionId}`}
          </Typography>
        </Breadcrumbs>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap', mb: 1.5 }}>
          {loading ? (
            <CircularProgress size={18} />
          ) : (
            <>
              <Typography variant="h5" sx={{ fontWeight: 700 }}>
                {auction?.title ?? `オークション #${auctionId}`}
              </Typography>
              {auction && (
                <Chip
                  size="small"
                  label={STATUS_META[auction.status].label}
                  color={STATUS_META[auction.status].color}
                />
              )}
              {auction?.event_date && (
                <Typography variant="body2" color="text.secondary">
                  {formatDate(auction.event_date)}
                  {auction.start_time ? ` / ${formatTime(auction.start_time)} 開始` : ''}
                </Typography>
              )}
            </>
          )}
        </Box>

        <Tabs
          value={activeTab}
          onChange={handleTabChange}
          variant="scrollable"
          scrollButtons="auto"
          allowScrollButtonsMobile
        >
          {TABS.map((t) => (
            <Tab
              key={t.value}
              value={t.value}
              label={t.label}
              icon={t.icon}
              iconPosition="start"
              sx={{ minHeight: 48, textTransform: 'none', fontSize: '0.875rem' }}
            />
          ))}
        </Tabs>
      </Paper>

      <Box sx={{ px: { xs: 2, md: 3 }, py: 3 }}>
        <Outlet />
      </Box>
    </Box>
  );
}
