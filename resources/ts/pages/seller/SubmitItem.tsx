import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  TextField,
  Grid,
  Divider,
  Alert,
  Stepper,
  Step,
  StepLabel,
  FormControlLabel,
  Checkbox,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Chip,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableRow,
  TableHead,
  CircularProgress,
  Snackbar,
  IconButton,
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  ArrowForward as ArrowForwardIcon,
  Check as CheckIcon,
  Pets as PetsIcon,
  Edit as EditIcon,
  CheckCircle as CheckCircleIcon,
  Add as AddIcon,
  Delete as DeleteIcon,
  ContentCopy as CopyIcon,
} from '@mui/icons-material';
import axios from '../../lib/axios';

const steps = ['出品情報', '確認'];

interface AvailableAuction {
  id: number;
  title: string;
  event_date: string;
  status: string;
  upload_deadline: string | null;
}

interface ItemFormData {
  species_name: string;
  species_type_id: number | '';
  quantity: string;
  quantity_unit: string;
  is_premium: boolean;
  is_anonymous: boolean;
  individual_info: string;
  age_months: string;
}

type Carrier = 'yu_pack' | 'sagawa' | 'yamato';

interface ShipmentInput {
  carrier: Carrier | '';
  tracking_number: string;
}

const CARRIER_OPTIONS: { value: Carrier; label: string }[] = [
  { value: 'yu_pack', label: 'ゆうパック' },
  { value: 'sagawa', label: '佐川' },
  { value: 'yamato', label: 'ヤマト' },
];

const MAX_SHIPMENTS = 10;

interface SellerSpeciesType {
  id: number;
  code: string;
  name: string;
  calculation_mode: 'auto' | 'manual';
  allowed_quantity_units: ('fish' | 'kg' | 'bag')[];
  is_default: boolean;
  sort_order: number;
}

const createEmptyItem = (defaults?: { species_type_id?: number; quantity_unit?: string }): ItemFormData => ({
  species_name: '',
  species_type_id: defaults?.species_type_id ?? '',
  quantity: '',
  quantity_unit: defaults?.quantity_unit ?? 'fish',
  is_premium: false,
  is_anonymous: false,
  individual_info: '',
  age_months: '',
});

export default function SubmitItem() {
  const navigate = useNavigate();
  const [activeStep, setActiveStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [fetchLoading, setFetchLoading] = useState(true);
  const [availableAuctions, setAvailableAuctions] = useState<AvailableAuction[]>([]);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' });
  
  const [auctionId, setAuctionId] = useState('');
  const [items, setItems] = useState<ItemFormData[]>([createEmptyItem()]);
  const [speciesTypes, setSpeciesTypes] = useState<SellerSpeciesType[]>([]);
  const [shipments, setShipments] = useState<ShipmentInput[]>([{ carrier: '', tracking_number: '' }]);

  const updateShipment = (index: number, field: keyof ShipmentInput, value: string) => {
    setShipments((prev) => prev.map((s, i) => (i === index ? { ...s, [field]: value } : s)));
  };
  const addShipment = () => {
    setShipments((prev) => (prev.length >= MAX_SHIPMENTS ? prev : [...prev, { carrier: '', tracking_number: '' }]));
  };
  const removeShipment = (index: number) => {
    setShipments((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== index)));
  };
  const validShipments = shipments
    .map((s) => ({ carrier: s.carrier as Carrier, tracking_number: s.tracking_number.trim() }))
    .filter((s) => s.carrier && s.tracking_number.length > 0);
  const isShipmentsValid = validShipments.length > 0
    && shipments.every((s) => {
      const hasCarrier = !!s.carrier;
      const hasNumber = s.tracking_number.trim().length > 0;
      // どちらか片方だけ入力された不完全行は不可
      return (hasCarrier && hasNumber) || (!hasCarrier && !hasNumber);
    });

  useEffect(() => {
    fetchAvailableAuctions();
    fetchSpeciesTypes();
  }, []);

  const fetchSpeciesTypes = async () => {
    try {
      const res = await axios.get('/api/seller/species-types');
      const types: SellerSpeciesType[] = res.data.data ?? [];
      setSpeciesTypes(types);
      const def = types.find((t) => t.is_default) ?? types[0];
      if (def) {
        setItems((prev) => prev.map((it) => it.species_type_id === '' ? {
          ...it,
          species_type_id: def.id,
          quantity_unit: def.allowed_quantity_units[0] ?? 'fish',
        } : it));
      }
    } catch (err) {
      console.error('種別一覧取得エラー:', err);
    }
  };

  const getSpeciesById = (id: number | '') => speciesTypes.find((t) => t.id === id);
  const unitLabel = (u: string) => (u === 'fish' ? '匹' : u === 'kg' ? 'kg' : '袋');

  const fetchAvailableAuctions = async () => {
    try {
      setFetchLoading(true);
      const response = await axios.get('/api/seller/items/auctions');
      if (response.data.success) {
        setAvailableAuctions(response.data.data.auctions);
      }
    } catch (err) {
      console.error('オークション取得エラー:', err);
      setSnackbar({ open: true, message: 'オークション情報の取得に失敗しました', severity: 'error' });
    } finally {
      setFetchLoading(false);
    }
  };

  const updateItem = (index: number, field: keyof ItemFormData, value: any) => {
    setItems(prev => prev.map((item, i) => i === index ? { ...item, [field]: value } : item));
  };

  const addItem = () => {
    const def = speciesTypes.find((t) => t.is_default) ?? speciesTypes[0];
    setItems(prev => [...prev, createEmptyItem({
      species_type_id: def?.id,
      quantity_unit: def?.allowed_quantity_units[0] ?? 'fish',
    })]);
  };

  const duplicateItem = (index: number) => {
    setItems(prev => {
      const copy = { ...prev[index] };
      return [...prev.slice(0, index + 1), copy, ...prev.slice(index + 1)];
    });
  };

  const removeItem = (index: number) => {
    if (items.length <= 1) return;
    setItems(prev => prev.filter((_, i) => i !== index));
  };

  const handleNext = () => {
    setActiveStep((prev) => prev + 1);
  };

  const handleBack = () => {
    setActiveStep((prev) => prev - 1);
  };

  const isFormValid = () => {
    if (!auctionId) return false;
    return items.every(item => item.species_name && item.quantity && item.species_type_id !== '');
  };

  const handleSubmit = async () => {
    try {
      setLoading(true);
      
      const promises = items.map(item => {
        const individualInfo = [
          item.age_months ? `生体月数: ${item.age_months}` : '',
          item.individual_info,
        ].filter(Boolean).join('\n');
        
        return axios.post('/api/seller/items', {
          auction_id: parseInt(auctionId),
          species_name: item.species_name,
          species_type_id: item.species_type_id || null,
          quantity: parseInt(item.quantity),
          quantity_unit: item.quantity_unit,
          start_price: 100,
          is_premium: item.is_premium,
          is_anonymous: item.is_anonymous,
          individual_info: individualInfo || null,
          inspection_info: null,
          notes: null,
          unsold_action: 'return',
        });
      });

      await Promise.all(promises);

      // 伝票番号の登録（出品作成成功後にまとめて送信）
      try {
        await axios.post(`/api/seller/auctions/${parseInt(auctionId)}/shipments`, {
          shipments: validShipments,
        });
      } catch (err: any) {
        console.error('伝票番号登録エラー:', err);
        setSnackbar({
          open: true,
          message: '出品は登録されましたが、伝票番号の登録に失敗しました。出品履歴から再登録してください。',
          severity: 'error',
        });
        return;
      }

      setSnackbar({
        open: true,
        message: `${items.length}件の出品申込を送信しました！管理者の審査をお待ちください。`,
        severity: 'success',
      });
      setTimeout(() => {
        navigate('/seller/items');
      }, 2000);
    } catch (err: any) {
      console.error('出品申込エラー:', err);
      setSnackbar({ 
        open: true, 
        message: err.response?.data?.message || '出品申込に失敗しました', 
        severity: 'error' 
      });
    } finally {
      setLoading(false);
    }
  };

  const selectedAuction = availableAuctions.find(a => a.id.toString() === auctionId);

  if (fetchLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      {/* ヘッダー */}
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 4 }}>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate('/seller/dashboard')}
          sx={{ mr: 2 }}
        >
          戻る
        </Button>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 700 }}>
            出品申込
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            オークションに出品する生体の情報を入力してください（複数同時登録可）
          </Typography>
        </Box>
      </Box>

      {availableAuctions.length === 0 ? (
        <Alert severity="warning">
          現在、出品可能なオークションがありません。
        </Alert>
      ) : (
        <>
          {/* ステッパー */}
          <Card sx={{ mb: 3 }}>
            <CardContent sx={{ p: 3 }}>
              <Stepper activeStep={activeStep}>
                {steps.map((label) => (
                  <Step key={label}>
                    <StepLabel
                      sx={{
                        '& .MuiStepLabel-label.Mui-active': { color: '#059669', fontWeight: 600 },
                        '& .MuiStepLabel-label.Mui-completed': { color: '#059669' },
                      }}
                    >
                      {label}
                    </StepLabel>
                  </Step>
                ))}
              </Stepper>
            </CardContent>
          </Card>

          {/* Step 1: 出品情報 */}
          {activeStep === 0 && (
            <>
              {/* オークション選択（共通） */}
              <Card sx={{ mb: 3 }}>
                <CardContent sx={{ p: 3 }}>
                  <FormControl fullWidth required>
                    <InputLabel>出品するオークション</InputLabel>
                    <Select
                      value={auctionId}
                      label="出品するオークション"
                      onChange={(e) => setAuctionId(e.target.value)}
                    >
                      {availableAuctions.map((auction) => (
                        <MenuItem key={auction.id} value={auction.id.toString()}>
                          {auction.title} ({new Date(auction.event_date).toLocaleDateString('ja-JP')})
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                  {selectedAuction && selectedAuction.upload_deadline && (
                    <Alert severity="info" sx={{ mt: 1 }}>
                      出品申込締切: {new Date(selectedAuction.upload_deadline).toLocaleString('ja-JP')}
                    </Alert>
                  )}
                </CardContent>
              </Card>

              {/* 生体リスト */}
              {items.map((item, index) => (
                <Card key={index} sx={{ mb: 2, border: '1px solid', borderColor: 'divider' }}>
                  <CardContent sx={{ p: 3 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <PetsIcon sx={{ color: '#059669' }} />
                        <Typography variant="h6" sx={{ fontWeight: 600 }}>
                          生体 {index + 1}
                        </Typography>
                        <Chip label={`${index + 1}/${items.length}`} size="small" variant="outlined" />
                      </Box>
                      <Box sx={{ display: 'flex', gap: 0.5 }}>
                        <IconButton
                          size="small"
                          onClick={() => duplicateItem(index)}
                          title="複製"
                          sx={{ color: 'primary.main' }}
                        >
                          <CopyIcon fontSize="small" />
                        </IconButton>
                        {items.length > 1 && (
                          <IconButton
                            size="small"
                            onClick={() => removeItem(index)}
                            title="削除"
                            sx={{ color: 'error.main' }}
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        )}
                      </Box>
                    </Box>

                    <Grid container spacing={2}>
                      <Grid item xs={12} md={4}>
                        <FormControl fullWidth required size="small">
                          <InputLabel>種別</InputLabel>
                          <Select
                            value={item.species_type_id}
                            label="種別"
                            onChange={(e) => {
                              const newId = e.target.value as number;
                              const sp = speciesTypes.find((t) => t.id === newId);
                              const current = item.quantity_unit;
                              const unit = sp && !sp.allowed_quantity_units.includes(current as 'fish' | 'kg' | 'bag')
                                ? sp.allowed_quantity_units[0] ?? 'fish'
                                : current;
                              setItems(prev => prev.map((it, i) => i === index ? { ...it, species_type_id: newId, quantity_unit: unit } : it));
                            }}
                          >
                            {speciesTypes.map((t) => (
                              <MenuItem key={t.id} value={t.id}>
                                {t.name}{t.calculation_mode === 'manual' ? '（送料手動）' : ''}
                              </MenuItem>
                            ))}
                          </Select>
                        </FormControl>
                      </Grid>

                      <Grid item xs={12} md={8}>
                        <TextField
                          fullWidth
                          required
                          label="品種名"
                          value={item.species_name}
                          onChange={(e) => updateItem(index, 'species_name', e.target.value)}
                          placeholder="例: 紅白ラメ、幹之フルボディ"
                          size="small"
                        />
                      </Grid>

                      <Grid item xs={6} md={3}>
                        <TextField
                          fullWidth
                          required
                          type="number"
                          label="数量"
                          value={item.quantity}
                          onChange={(e) => updateItem(index, 'quantity', e.target.value)}
                          size="small"
                        />
                      </Grid>

                      <Grid item xs={6} md={3}>
                        <FormControl fullWidth required size="small">
                          <InputLabel>単位</InputLabel>
                          <Select
                            value={item.quantity_unit}
                            label="単位"
                            onChange={(e) => updateItem(index, 'quantity_unit', e.target.value)}
                          >
                            {(getSpeciesById(item.species_type_id)?.allowed_quantity_units ?? ['fish']).map((u) => (
                              <MenuItem key={u} value={u}>{unitLabel(u)}</MenuItem>
                            ))}
                          </Select>
                        </FormControl>
                      </Grid>

                      <Grid item xs={6} md={3}>
                        <FormControl fullWidth size="small">
                          <InputLabel>生体月数</InputLabel>
                          <Select
                            value={item.age_months}
                            label="生体月数"
                            onChange={(e) => updateItem(index, 'age_months', e.target.value)}
                          >
                            <MenuItem value="">選択しない</MenuItem>
                            <MenuItem value="2ヶ月未満">2ヶ月未満</MenuItem>
                            <MenuItem value="2~5ヶ月">2~5ヶ月</MenuItem>
                            <MenuItem value="6ヶ月以上">6ヶ月以上</MenuItem>
                          </Select>
                        </FormControl>
                      </Grid>

                      {/* プレミアム機能は将来追加予定のため一旦非表示
                      <Grid item xs={6} md={3}>
                        <FormControlLabel
                          control={
                            <Checkbox
                              checked={item.is_premium}
                              onChange={(e) => updateItem(index, 'is_premium', e.target.checked)}
                              size="small"
                            />
                          }
                          label={<Typography variant="body2">プレミアム (+800円)</Typography>}
                        />
                      </Grid>
                      */}

                      <Grid item xs={12} md={6}>
                        <FormControlLabel
                          control={
                            <Checkbox
                              checked={item.is_anonymous}
                              onChange={(e) => updateItem(index, 'is_anonymous', e.target.checked)}
                              size="small"
                            />
                          }
                          label={<Typography variant="body2">匿名出品（出品者名を非公開にする）</Typography>}
                        />
                      </Grid>

                      <Grid item xs={12}>
                        <TextField
                          fullWidth
                          multiline
                          rows={2}
                          label="個体情報（任意）"
                          value={item.individual_info}
                          onChange={(e) => updateItem(index, 'individual_info', e.target.value)}
                          placeholder="体長、色、ラメの状態、健康状態など"
                          size="small"
                          helperText="出品個体について、お伝えしたいことがあればご記載ください。(記載がなくても出品可能です。)"
                        />
                      </Grid>
                    </Grid>
                  </CardContent>
                </Card>
              ))}

              {/* 追加ボタン */}
              <Button
                variant="outlined"
                fullWidth
                startIcon={<AddIcon />}
                onClick={addItem}
                sx={{
                  py: 1.5,
                  mb: 3,
                  borderStyle: 'dashed',
                  borderWidth: 2,
                  fontWeight: 600,
                  '&:hover': { borderStyle: 'dashed', borderWidth: 2 },
                }}
              >
                生体を追加（{items.length}件登録中）
              </Button>

              <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                <Button
                  variant="contained"
                  endIcon={<ArrowForwardIcon />}
                  onClick={handleNext}
                  disabled={!isFormValid()}
                >
                  確認へ（{items.length}件）
                </Button>
              </Box>
            </>
          )}

          {/* Step 2: 確認 */}
          {activeStep === 1 && (
            <Grid container spacing={3}>
              <Grid item xs={12} lg={8}>
                <Card>
                  <CardContent sx={{ p: 3 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
                      <CheckCircleIcon sx={{ color: '#059669' }} />
                      <Typography variant="h6" sx={{ fontWeight: 600 }}>
                        申込内容の確認（{items.length}件）
                      </Typography>
                    </Box>

                    <Alert severity="info" sx={{ mb: 3 }}>
                      以下の内容で{items.length}件の出品申込を送信します。内容をご確認ください。
                    </Alert>

                    {/* オークション情報 */}
                    <Paper sx={{ p: 2, mb: 3, bgcolor: 'grey.50' }}>
                      <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1, color: '#059669' }}>
                        出品先オークション
                      </Typography>
                      <Typography variant="body1" fontWeight={500}>{selectedAuction?.title}</Typography>
                    </Paper>

                    {/* 生体一覧テーブル */}
                    <Paper sx={{ mb: 3, overflow: 'auto' }}>
                      <Table size="small">
                        <TableHead>
                          <TableRow sx={{ bgcolor: 'grey.50' }}>
                            <TableCell sx={{ fontWeight: 600 }}>No.</TableCell>
                            <TableCell sx={{ fontWeight: 600 }}>種別</TableCell>
                            <TableCell sx={{ fontWeight: 600 }}>品種名</TableCell>
                            <TableCell sx={{ fontWeight: 600 }}>数量</TableCell>
                            <TableCell sx={{ fontWeight: 600 }}>月数</TableCell>
                            {/* プレミアム機能は将来追加予定のため一旦非表示
                            <TableCell sx={{ fontWeight: 600 }}>プレミアム</TableCell>
                            */}
                            <TableCell sx={{ fontWeight: 600 }}>匿名出品</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {items.map((item, index) => (
                            <TableRow key={index}>
                              <TableCell>{index + 1}</TableCell>
                              <TableCell>{getSpeciesById(item.species_type_id)?.name ?? '—'}</TableCell>
                              <TableCell sx={{ fontWeight: 500 }}>{item.species_name}</TableCell>
                              <TableCell>
                                {item.quantity}
                                {unitLabel(item.quantity_unit)}
                              </TableCell>
                              <TableCell>{item.age_months || '—'}</TableCell>
                              {/* プレミアム機能は将来追加予定のため一旦非表示
                              <TableCell>
                                {item.is_premium
                                  ? <Chip label="あり" size="small" color="warning" />
                                  : <Chip label="なし" size="small" variant="outlined" />}
                              </TableCell>
                              */}
                              <TableCell>
                                {item.is_anonymous
                                  ? <Chip label="あり" size="small" color="info" />
                                  : <Chip label="なし" size="small" variant="outlined" />}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </Paper>

                    <Alert severity="info" sx={{ mb: 3 }}>
                      画像・動画は管理者側で一括撮影いたしますので、アップロードは不要です。
                    </Alert>

                    <Divider sx={{ my: 3 }} />

                    {/* 伝票番号 */}
                    <Box sx={{ mb: 3 }}>
                      <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>
                        伝票番号 <Typography component="span" color="error" fontWeight={700}>*</Typography>
                      </Typography>
                      <Alert severity="info" sx={{ mb: 2 }}>
                        生体の発送に使用した伝票番号を入力してください。複数の伝票で発送した場合は「+ 伝票を追加」で増やせます（最大{MAX_SHIPMENTS}件）。伝票番号と各生体の紐付けは行いません。
                      </Alert>
                      {shipments.map((s, index) => (
                        <Grid container spacing={1.5} key={index} alignItems="center" sx={{ mb: 1 }}>
                          <Grid item xs={12} sm={4} md={3}>
                            <FormControl fullWidth size="small" required>
                              <InputLabel>配送業者</InputLabel>
                              <Select
                                value={s.carrier}
                                label="配送業者"
                                onChange={(e) => updateShipment(index, 'carrier', e.target.value as string)}
                              >
                                {CARRIER_OPTIONS.map((opt) => (
                                  <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
                                ))}
                              </Select>
                            </FormControl>
                          </Grid>
                          <Grid item xs={9} sm={6} md={7}>
                            <TextField
                              fullWidth
                              size="small"
                              required
                              label="伝票番号"
                              value={s.tracking_number}
                              onChange={(e) => updateShipment(index, 'tracking_number', e.target.value)}
                              placeholder="例: 1234-5678-9012"
                              inputProps={{ maxLength: 50 }}
                            />
                          </Grid>
                          <Grid item xs={3} sm={2} md={2} sx={{ textAlign: 'right' }}>
                            <IconButton
                              size="small"
                              onClick={() => removeShipment(index)}
                              disabled={shipments.length <= 1}
                              aria-label="伝票を削除"
                            >
                              <DeleteIcon />
                            </IconButton>
                          </Grid>
                        </Grid>
                      ))}
                      <Button
                        variant="outlined"
                        size="small"
                        startIcon={<AddIcon />}
                        onClick={addShipment}
                        disabled={shipments.length >= MAX_SHIPMENTS}
                        sx={{ mt: 1 }}
                      >
                        伝票を追加 ({shipments.length}/{MAX_SHIPMENTS})
                      </Button>
                    </Box>

                    <Divider sx={{ my: 3 }} />

                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Button onClick={handleBack} startIcon={<EditIcon />}>
                        修正する
                      </Button>
                      <Button
                        variant="contained"
                        color="success"
                        size="large"
                        startIcon={loading ? <CircularProgress size={20} color="inherit" /> : <CheckIcon />}
                        onClick={handleSubmit}
                        disabled={loading || !isShipmentsValid}
                      >
                        {items.length}件の出品申込を送信
                      </Button>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          )}
        </>
      )}

      {/* スナックバー */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={3000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert severity={snackbar.severity} onClose={() => setSnackbar({ ...snackbar, open: false })}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
