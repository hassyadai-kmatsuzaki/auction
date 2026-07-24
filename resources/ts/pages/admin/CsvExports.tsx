import { useEffect, useState } from 'react';
import {
  Box, Typography, Paper, Grid, Button, TextField, FormControl, InputLabel,
  Select, MenuItem, FormControlLabel, Switch, Alert, CircularProgress, Divider,
} from '@mui/material';
import { Download as DownloadIcon, FileDownload as FileDownloadIcon } from '@mui/icons-material';
import axios from '../../lib/axios';
import { adminCsvExportApi } from '../../api/admin/csvExportApi';

interface AuctionOption {
  id: number;
  title: string;
  event_date: string;
  status: string;
}

export default function CsvExports() {
  // 1つ目: オークション一覧サマリー
  const [summaryFrom, setSummaryFrom] = useState<string>('');
  const [summaryTo, setSummaryTo] = useState<string>('');
  const [summaryIncludeTest, setSummaryIncludeTest] = useState(false);
  const [downloadingSummary, setDownloadingSummary] = useState(false);

  // 2つ目: 出品生体軸
  const [itemsAuctionId, setItemsAuctionId] = useState<number | ''>('');
  const [itemsFrom, setItemsFrom] = useState<string>('');
  const [itemsTo, setItemsTo] = useState<string>('');
  const [itemsIncludeTest, setItemsIncludeTest] = useState(false);
  const [downloadingItems, setDownloadingItems] = useState(false);

  // 3つ目: 会員情報・年会費（統合）
  const [downloadingMembers, setDownloadingMembers] = useState(false);

  const [auctions, setAuctions] = useState<AuctionOption[]>([]);
  const [loadingAuctions, setLoadingAuctions] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadAuctions = async () => {
      setLoadingAuctions(true);
      try {
        const res = await axios.get('/api/admin/auctions', {
          params: { per_page: 500, sort_by: 'event_date', sort_order: 'desc' },
        });
        if (res.data.success) {
          const list: AuctionOption[] = (res.data.data.auctions || []).map((a: any) => ({
            id: a.id,
            title: a.title,
            event_date: a.event_date,
            status: a.status,
          }));
          setAuctions(list);
        }
      } catch (e: any) {
        setError(e.response?.data?.message || 'オークション一覧の取得に失敗しました。');
      } finally {
        setLoadingAuctions(false);
      }
    };
    loadAuctions();
  }, []);

  const handleDownloadSummary = async () => {
    setDownloadingSummary(true);
    setError('');
    try {
      await adminCsvExportApi.auctionsSummary({
        from: summaryFrom || null,
        to: summaryTo || null,
        include_test: summaryIncludeTest,
      });
    } catch (e: any) {
      setError(e.response?.data?.message || 'CSVダウンロードに失敗しました。');
    } finally {
      setDownloadingSummary(false);
    }
  };

  const handleDownloadItems = async () => {
    setDownloadingItems(true);
    setError('');
    try {
      await adminCsvExportApi.auctionItems({
        auction_id: itemsAuctionId === '' ? null : Number(itemsAuctionId),
        from: itemsFrom || null,
        to: itemsTo || null,
        include_test: itemsIncludeTest,
      });
    } catch (e: any) {
      setError(e.response?.data?.message || 'CSVダウンロードに失敗しました。');
    } finally {
      setDownloadingItems(false);
    }
  };

  const handleDownloadMembers = async () => {
    setDownloadingMembers(true);
    setError('');
    try {
      await adminCsvExportApi.members();
    } catch (e: any) {
      setError(e.response?.data?.message || 'CSVダウンロードに失敗しました。');
    } finally {
      setDownloadingMembers(false);
    }
  };

  return (
    <Box>
      <Box display="flex" alignItems="center" gap={1} mb={3}>
        <FileDownloadIcon color="primary" />
        <Typography variant="h5" fontWeight="bold">CSVエクスポート</Typography>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>オークション一覧サマリー</Typography>
        <Typography variant="body2" color="text.secondary" gutterBottom>
          1行=1オークション。期間内のオークションについて、出品/落札/参加の件数・会員数（全体スナップショット）に加え、落札金額・買手/売手手数料・送料（税抜）、消費税3区分（落札者・インボイス有出品者・インボイス無出品者）、落札者請求合計・出品者支払合計（税込）を出力します。消費税は請求書・支払通知書と同じ単位で丸めるため帳票合計と一致します。
        </Typography>
        <Divider sx={{ my: 2 }} />
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} sm={4}>
            <TextField
              label="開催日 From"
              type="date"
              fullWidth
              value={summaryFrom}
              onChange={(e) => setSummaryFrom(e.target.value)}
              InputLabelProps={{ shrink: true }}
            />
          </Grid>
          <Grid item xs={12} sm={4}>
            <TextField
              label="開催日 To"
              type="date"
              fullWidth
              value={summaryTo}
              onChange={(e) => setSummaryTo(e.target.value)}
              InputLabelProps={{ shrink: true }}
            />
          </Grid>
          <Grid item xs={12} sm={4}>
            <FormControlLabel
              control={
                <Switch
                  checked={summaryIncludeTest}
                  onChange={(e) => setSummaryIncludeTest(e.target.checked)}
                />
              }
              label="テストオークションを含める"
            />
          </Grid>
          <Grid item xs={12}>
            <Button
              variant="contained"
              startIcon={downloadingSummary ? <CircularProgress size={16} color="inherit" /> : <DownloadIcon />}
              onClick={handleDownloadSummary}
              disabled={downloadingSummary}
            >
              CSVをダウンロード
            </Button>
          </Grid>
        </Grid>
      </Paper>

      <Paper sx={{ p: 3 }}>
        <Typography variant="h6" gutterBottom>出品生体明細</Typography>
        <Typography variant="body2" color="text.secondary" gutterBottom>
          全出品（未落札含む）を出品単位で出力。オークションを選択するか、期間で絞り込めます。落札済みの行のみ落札者名・落札金額・送料・税金・手数料が入ります。
        </Typography>
        <Divider sx={{ my: 2 }} />
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} sm={6}>
            <FormControl fullWidth>
              <InputLabel id="export-auction-label">オークション（任意）</InputLabel>
              <Select
                labelId="export-auction-label"
                label="オークション（任意）"
                value={itemsAuctionId}
                onChange={(e) => setItemsAuctionId(e.target.value as number | '')}
                disabled={loadingAuctions}
              >
                <MenuItem value=""><em>未選択（期間で絞り込み）</em></MenuItem>
                {auctions.map((a) => (
                  <MenuItem key={a.id} value={a.id}>
                    {a.event_date} / {a.title} ({a.status})
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={6} sm={3}>
            <TextField
              label="開催日 From"
              type="date"
              fullWidth
              value={itemsFrom}
              onChange={(e) => setItemsFrom(e.target.value)}
              InputLabelProps={{ shrink: true }}
              disabled={itemsAuctionId !== ''}
            />
          </Grid>
          <Grid item xs={6} sm={3}>
            <TextField
              label="開催日 To"
              type="date"
              fullWidth
              value={itemsTo}
              onChange={(e) => setItemsTo(e.target.value)}
              InputLabelProps={{ shrink: true }}
              disabled={itemsAuctionId !== ''}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <FormControlLabel
              control={
                <Switch
                  checked={itemsIncludeTest}
                  onChange={(e) => setItemsIncludeTest(e.target.checked)}
                />
              }
              label="テストオークションを含める"
            />
          </Grid>
          <Grid item xs={12}>
            <Button
              variant="contained"
              startIcon={downloadingItems ? <CircularProgress size={16} color="inherit" /> : <DownloadIcon />}
              onClick={handleDownloadItems}
              disabled={downloadingItems}
            >
              CSVをダウンロード
            </Button>
          </Grid>
        </Grid>
      </Paper>

      <Paper sx={{ p: 3, mt: 3 }}>
        <Typography variant="h6" gutterBottom>会員情報・年会費</Typography>
        <Typography variant="body2" color="text.secondary" gutterBottom>
          全会員1行ずつ。基本情報（ID・氏名・屋号・メールアドレス・住所・電話番号・ロール・ステータス・登録日）に加え、年会費登録状況・プラン・年会費・サブスク状態・現在の課金期間終了日・最終支払日を出力します。
        </Typography>
        <Divider sx={{ my: 2 }} />
        <Button
          variant="contained"
          startIcon={downloadingMembers ? <CircularProgress size={16} color="inherit" /> : <DownloadIcon />}
          onClick={handleDownloadMembers}
          disabled={downloadingMembers}
        >
          CSVをダウンロード
        </Button>
      </Paper>
    </Box>
  );
}
