import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Box,
  Typography,
  Paper,
  TextField,
  Button,
  Grid,
  Card,
  CardContent,
  Divider,
  InputAdornment,
  Alert,
  FormHelperText,
  Switch,
  FormControlLabel,
  Tabs,
  Tab,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Select,
  MenuItem,
  FormControl,
} from '@mui/material';
import {
  Save as SaveIcon,
  ArrowBack as ArrowBackIcon,
  Event as EventIcon,
  AttachMoney as MoneyIcon,
  Info as InfoIcon,
  Gavel as GavelIcon,
  ViewColumn as LaneIcon,
  Add as AddIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
} from '@mui/icons-material';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel({ children, value, index }: TabPanelProps) {
  return (
    <div hidden={value !== index}>
      {value === index && <Box sx={{ py: 3 }}>{children}</Box>}
    </div>
  );
}

export default function AuctionForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = Boolean(id);
  const [tabValue, setTabValue] = useState(0);

  const [formData, setFormData] = useState({
    title: '',
    event_date: '',
    start_time: '10:00',
    description: '',
    commission_rate: '10',
    buyer_fee_rate: '5',
    min_commission: '500',
    notes: '',
  });

  // デフォルト設定を使用するかどうか
  const [useDefaultBidRules, setUseDefaultBidRules] = useState(true);
  const [useDefaultSellerFees, setUseDefaultSellerFees] = useState(true);
  const [useDefaultBuyerFees, setUseDefaultBuyerFees] = useState(true);

  // 入札ルール（オークション個別設定）
  const [bidRules, setBidRules] = useState({
    price_increment_rate: '10',
    price_increment_min: '50',
    countdown_seconds: '3',
    auto_extend_seconds: '10',
  });

  // 出品者向け料金（オークション個別設定）
  const [sellerFees, setSellerFees] = useState({
    base_listing_fee: '500',
    premium_listing_fee: '800',
    seller_commission_rate: '10',
    seller_commission_min: '500',
  });

  // 買受者向け料金（オークション個別設定）
  const [buyerFees, setBuyerFees] = useState({
    buyer_commission_rate: '5',
    buyer_commission_min: '300',
  });

  // レーン設定
  // bidder_display: 'count' = 何人入札中, 'simple' = 入札中, 'hidden' = 非表示
  const [lanes, setLanes] = useState([
    { id: 1, name: 'レーン1', description: '', bidder_display: 'count' as 'count' | 'simple' | 'hidden' },
    { id: 2, name: 'レーン2', description: '', bidder_display: 'count' as 'count' | 'simple' | 'hidden' },
    { id: 3, name: 'レーン3', description: '', bidder_display: 'count' as 'count' | 'simple' | 'hidden' },
    { id: 4, name: 'レーン4', description: '', bidder_display: 'count' as 'count' | 'simple' | 'hidden' },
    { id: 5, name: 'レーン5', description: '', bidder_display: 'count' as 'count' | 'simple' | 'hidden' },
    { id: 6, name: 'レーン6', description: '', bidder_display: 'count' as 'count' | 'simple' | 'hidden' },
  ]);

  const handleBidRuleChange = (field: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setBidRules({ ...bidRules, [field]: e.target.value });
  };

  const handleSellerFeeChange = (field: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setSellerFees({ ...sellerFees, [field]: e.target.value });
  };

  const handleBuyerFeeChange = (field: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setBuyerFees({ ...buyerFees, [field]: e.target.value });
  };

  const handleLaneChange = (id: number, field: string, value: string) => {
    setLanes(lanes.map(lane => 
      lane.id === id ? { ...lane, [field]: value } : lane
    ));
  };

  const addLane = () => {
    const newId = Math.max(...lanes.map(l => l.id)) + 1;
    setLanes([...lanes, { id: newId, name: `レーン${newId}`, description: '', bidder_display: 'count' as 'count' | 'simple' | 'hidden' }]);
  };

  const removeLane = (id: number) => {
    if (lanes.length > 1) {
      setLanes(lanes.filter(lane => lane.id !== id));
    }
  };

  const handleChange = (field: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [field]: e.target.value });
  };

  const handleSubmit = () => {
    // 設定内容をまとめて保存
    const auctionData = {
      ...formData,
      bidRules: useDefaultBidRules ? null : bidRules,
      sellerFees: useDefaultSellerFees ? null : sellerFees,
      buyerFees: useDefaultBuyerFees ? null : buyerFees,
      lanes,
    };
    console.log('Saving auction:', auctionData);
    alert('オークションを保存しました');
    navigate('/admin/auctions');
  };

  // 手数料の計算例を表示
  const calculateCommissionExample = (price: number) => {
    const rate = useDefaultSellerFees 
      ? parseFloat(formData.commission_rate) 
      : parseFloat(sellerFees.seller_commission_rate);
    const minFee = useDefaultSellerFees 
      ? parseFloat(formData.min_commission) 
      : parseFloat(sellerFees.seller_commission_min);
    const commission = Math.max(
      price * (rate / 100),
      minFee || 0
    );
    return commission;
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 4 }}>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate('/admin/auctions')}
          sx={{ mr: 2 }}
        >
          戻る
        </Button>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 700 }}>
            {isEdit ? 'オークション編集' : 'オークション新規作成'}
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            オークションの基本情報と手数料を設定します
          </Typography>
        </Box>
      </Box>

      <Grid container spacing={3}>
        {/* メインコンテンツ */}
        <Grid item xs={12} lg={8}>
          <Paper sx={{ mb: 3 }}>
            <Tabs value={tabValue} onChange={(_, v) => setTabValue(v)}>
              <Tab icon={<EventIcon />} iconPosition="start" label="基本情報" />
              <Tab icon={<GavelIcon />} iconPosition="start" label="入札ルール" />
              <Tab icon={<MoneyIcon />} iconPosition="start" label="料金設定" />
              <Tab icon={<LaneIcon />} iconPosition="start" label="レーン設定" />
            </Tabs>
          </Paper>

          {/* 基本情報タブ */}
          <TabPanel value={tabValue} index={0}>
            <Card>
              <CardContent sx={{ p: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
                  <EventIcon sx={{ color: 'primary.main' }} />
                  <Typography variant="h6" sx={{ fontWeight: 600 }}>
                    基本情報
                  </Typography>
                </Box>

                <Grid container spacing={3}>
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      required
                      label="オークション名"
                      value={formData.title}
                      onChange={handleChange('title')}
                      placeholder="2025年12月オークション"
                    />
                  </Grid>

                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      required
                      type="date"
                      label="開催日"
                      value={formData.event_date}
                      onChange={handleChange('event_date')}
                      InputLabelProps={{ shrink: true }}
                    />
                  </Grid>

                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      required
                      type="time"
                      label="開始時刻"
                      value={formData.start_time}
                      onChange={handleChange('start_time')}
                      InputLabelProps={{ shrink: true }}
                    />
                  </Grid>

                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      label="説明"
                      value={formData.description}
                      onChange={handleChange('description')}
                      multiline
                      rows={4}
                      placeholder="オークションの説明を入力..."
                    />
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          </TabPanel>

          {/* 入札ルールタブ */}
          <TabPanel value={tabValue} index={1}>
            <Card>
              <CardContent sx={{ p: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <GavelIcon sx={{ color: '#7C3AED' }} />
                    <Typography variant="h6" sx={{ fontWeight: 600 }}>
                      入札ルール
                    </Typography>
                  </Box>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={useDefaultBidRules}
                        onChange={(e) => setUseDefaultBidRules(e.target.checked)}
                      />
                    }
                    label="システムデフォルトを使用"
                  />
                </Box>

                {useDefaultBidRules ? (
                  <Alert severity="info">
                    システム設定のデフォルト入札ルールが適用されます。このオークション専用のルールを設定する場合は、スイッチをオフにしてください。
                  </Alert>
                ) : (
                  <Grid container spacing={3}>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        fullWidth
                        type="number"
                        label="価格上昇率"
                        value={bidRules.price_increment_rate}
                        onChange={handleBidRuleChange('price_increment_rate')}
                        InputProps={{
                          endAdornment: <InputAdornment position="end">%</InputAdornment>,
                        }}
                        helperText="複数人入札時の価格上昇率"
                      />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        fullWidth
                        type="number"
                        label="最低上昇金額"
                        value={bidRules.price_increment_min}
                        onChange={handleBidRuleChange('price_increment_min')}
                        InputProps={{
                          startAdornment: <InputAdornment position="start">¥</InputAdornment>,
                        }}
                        helperText="最低でもこの金額は上昇"
                      />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        fullWidth
                        type="number"
                        label="カウントダウン秒数"
                        value={bidRules.countdown_seconds}
                        onChange={handleBidRuleChange('countdown_seconds')}
                        InputProps={{
                          endAdornment: <InputAdornment position="end">秒</InputAdornment>,
                        }}
                        helperText="価格上昇までの待機時間"
                      />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        fullWidth
                        type="number"
                        label="自動延長秒数"
                        value={bidRules.auto_extend_seconds}
                        onChange={handleBidRuleChange('auto_extend_seconds')}
                        InputProps={{
                          endAdornment: <InputAdornment position="end">秒</InputAdornment>,
                        }}
                        helperText="終了直前の入札で延長"
                      />
                    </Grid>
                  </Grid>
                )}
              </CardContent>
            </Card>
          </TabPanel>

          {/* 料金設定タブ */}
          <TabPanel value={tabValue} index={2}>
            <Grid container spacing={3}>
              {/* 出品者向け料金 */}
              <Grid item xs={12}>
                <Card>
                  <CardContent sx={{ p: 3 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <MoneyIcon sx={{ color: '#059669' }} />
                        <Typography variant="h6" sx={{ fontWeight: 600 }}>
                          出品者向け料金
                        </Typography>
                      </Box>
                      <FormControlLabel
                        control={
                          <Switch
                            checked={useDefaultSellerFees}
                            onChange={(e) => setUseDefaultSellerFees(e.target.checked)}
                          />
                        }
                        label="システムデフォルトを使用"
                      />
                    </Box>

                    {useDefaultSellerFees ? (
                      <Alert severity="info">
                        システム設定のデフォルト料金が適用されます。このオークション専用の料金を設定する場合は、スイッチをオフにしてください。
                      </Alert>
                    ) : (
                      <Grid container spacing={3}>
                        <Grid item xs={12} sm={6}>
                          <TextField
                            fullWidth
                            type="number"
                            label="基本出品料"
                            value={sellerFees.base_listing_fee}
                            onChange={handleSellerFeeChange('base_listing_fee')}
                            InputProps={{
                              startAdornment: <InputAdornment position="start">¥</InputAdornment>,
                            }}
                            helperText="1点あたりの出品料"
                          />
                        </Grid>
                        <Grid item xs={12} sm={6}>
                          <TextField
                            fullWidth
                            type="number"
                            label="プレミアム出品料"
                            value={sellerFees.premium_listing_fee}
                            onChange={handleSellerFeeChange('premium_listing_fee')}
                            InputProps={{
                              startAdornment: <InputAdornment position="start">¥</InputAdornment>,
                            }}
                            helperText="個別撮影付きの出品料"
                          />
                        </Grid>
                        <Grid item xs={12} sm={6}>
                          <TextField
                            fullWidth
                            type="number"
                            label="販売手数料率"
                            value={sellerFees.seller_commission_rate}
                            onChange={handleSellerFeeChange('seller_commission_rate')}
                            InputProps={{
                              endAdornment: <InputAdornment position="end">%</InputAdornment>,
                            }}
                            helperText="落札金額に対する手数料"
                          />
                        </Grid>
                        <Grid item xs={12} sm={6}>
                          <TextField
                            fullWidth
                            type="number"
                            label="最低手数料"
                            value={sellerFees.seller_commission_min}
                            onChange={handleSellerFeeChange('seller_commission_min')}
                            InputProps={{
                              startAdornment: <InputAdornment position="start">¥</InputAdornment>,
                            }}
                            helperText="1点あたりの最低手数料"
                          />
                        </Grid>
                      </Grid>
                    )}
                  </CardContent>
                </Card>
              </Grid>

              {/* 買受者向け料金 */}
              <Grid item xs={12}>
                <Card>
                  <CardContent sx={{ p: 3 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <MoneyIcon sx={{ color: '#3B82F6' }} />
                        <Typography variant="h6" sx={{ fontWeight: 600 }}>
                          買受者向け料金
                        </Typography>
                      </Box>
                      <FormControlLabel
                        control={
                          <Switch
                            checked={useDefaultBuyerFees}
                            onChange={(e) => setUseDefaultBuyerFees(e.target.checked)}
                          />
                        }
                        label="システムデフォルトを使用"
                      />
                    </Box>

                    {useDefaultBuyerFees ? (
                      <Alert severity="info">
                        システム設定のデフォルト料金が適用されます。このオークション専用の料金を設定する場合は、スイッチをオフにしてください。
                      </Alert>
                    ) : (
                      <Grid container spacing={3}>
                        <Grid item xs={12} sm={6}>
                          <TextField
                            fullWidth
                            type="number"
                            label="落札手数料率"
                            value={buyerFees.buyer_commission_rate}
                            onChange={handleBuyerFeeChange('buyer_commission_rate')}
                            InputProps={{
                              endAdornment: <InputAdornment position="end">%</InputAdornment>,
                            }}
                            helperText="落札金額に対する手数料"
                          />
                        </Grid>
                        <Grid item xs={12} sm={6}>
                          <TextField
                            fullWidth
                            type="number"
                            label="最低手数料"
                            value={buyerFees.buyer_commission_min}
                            onChange={handleBuyerFeeChange('buyer_commission_min')}
                            InputProps={{
                              startAdornment: <InputAdornment position="start">¥</InputAdornment>,
                            }}
                            helperText="1点あたりの最低手数料"
                          />
                        </Grid>
                      </Grid>
                    )}
                  </CardContent>
                </Card>
              </Grid>
            </Grid>

            {/* 手数料計算例 */}
            {(!useDefaultSellerFees || !useDefaultBuyerFees) && (
              <Card sx={{ mt: 3 }}>
                <CardContent sx={{ p: 3 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 2 }}>
                    手数料計算例
                  </Typography>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    {[5000, 10000, 30000, 50000].map((price) => (
                      <Box
                        key={price}
                        sx={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          p: 1.5,
                          bgcolor: 'grey.50',
                          borderRadius: 1,
                        }}
                      >
                        <Typography variant="body2">
                          落札価格 ¥{price.toLocaleString()}
                        </Typography>
                        <Typography variant="body2" sx={{ fontWeight: 600, color: '#059669' }}>
                          手数料 ¥{calculateCommissionExample(price).toLocaleString()}
                        </Typography>
                      </Box>
                    ))}
                  </Box>
                </CardContent>
              </Card>
            )}
          </TabPanel>

          {/* レーン設定タブ */}
          <TabPanel value={tabValue} index={3}>
            <Card>
              <CardContent sx={{ p: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <LaneIcon sx={{ color: '#F59E0B' }} />
                    <Typography variant="h6" sx={{ fontWeight: 600 }}>
                      レーン設定
                    </Typography>
                  </Box>
                  <Button
                    variant="outlined"
                    startIcon={<AddIcon />}
                    onClick={addLane}
                    size="small"
                  >
                    レーン追加
                  </Button>
                </Box>

                <Alert severity="info" sx={{ mb: 3 }}>
                  レーン名をカスタマイズして、品種や出品カテゴリを分かりやすく表示できます。
                </Alert>

                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell width={60}>番号</TableCell>
                        <TableCell>レーン名</TableCell>
                        <TableCell>説明（任意）</TableCell>
                        <TableCell width={160}>入札者数表示</TableCell>
                        <TableCell width={60} align="center">操作</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {lanes.map((lane, index) => (
                        <TableRow key={lane.id}>
                          <TableCell>
                            <Typography variant="body2" sx={{ fontWeight: 600 }}>
                              {index + 1}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <TextField
                              fullWidth
                              size="small"
                              value={lane.name}
                              onChange={(e) => handleLaneChange(lane.id, 'name', e.target.value)}
                              placeholder={`レーン${index + 1}`}
                            />
                          </TableCell>
                          <TableCell>
                            <TextField
                              fullWidth
                              size="small"
                              value={lane.description}
                              onChange={(e) => handleLaneChange(lane.id, 'description', e.target.value)}
                              placeholder="例: 幹之系、楊貴妃系など"
                            />
                          </TableCell>
                          <TableCell>
                            <FormControl fullWidth size="small">
                              <Select
                                value={lane.bidder_display}
                                onChange={(e) => handleLaneChange(lane.id, 'bidder_display', e.target.value)}
                              >
                                <MenuItem value="count">何人入札中</MenuItem>
                                <MenuItem value="simple">入札中</MenuItem>
                                <MenuItem value="hidden">非表示</MenuItem>
                              </Select>
                            </FormControl>
                          </TableCell>
                          <TableCell align="center">
                            <IconButton
                              size="small"
                              color="error"
                              onClick={() => removeLane(lane.id)}
                              disabled={lanes.length <= 1}
                            >
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </CardContent>
            </Card>
          </TabPanel>
        </Grid>

        {/* サイドバー */}
        <Grid item xs={12} lg={4}>
          <Card sx={{ position: 'sticky', top: 80 }}>
            <CardContent sx={{ p: 3 }}>
              <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
                アクション
              </Typography>

              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <Button
                  type="submit"
                  variant="contained"
                  size="large"
                  startIcon={<SaveIcon />}
                  fullWidth
                  onClick={handleSubmit}
                >
                  {isEdit ? '変更を保存' : 'オークションを作成'}
                </Button>
                <Button
                  variant="outlined"
                  onClick={() => navigate('/admin/auctions')}
                  fullWidth
                >
                  キャンセル
                </Button>
              </Box>

              <Divider sx={{ my: 3 }} />

              <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, mb: 2 }}>
                <InfoIcon sx={{ color: 'text.secondary', fontSize: 18, mt: 0.2 }} />
                <Box>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5 }}>
                    設定について
                  </Typography>
                  <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
                    「システムデフォルトを使用」がオンの場合、システム設定画面の値が適用されます。
                    オークションごとに異なる設定が必要な場合はオフにして個別設定してください。
                  </Typography>
                </Box>
              </Box>

              <Divider sx={{ my: 3 }} />

              <TextField
                fullWidth
                multiline
                rows={3}
                label="管理者メモ"
                value={formData.notes}
                onChange={handleChange('notes')}
                placeholder="内部向けのメモを入力..."
                size="small"
              />
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}
