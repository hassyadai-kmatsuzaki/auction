import React, { useState, useEffect, useRef } from 'react';
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
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Tooltip,
  Autocomplete,
  Slider,
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
import { sellerSpeciesNameApi } from '../../api/seller/speciesNameApi';

const steps = ['出品情報', '確認'];

// 数量の上限（スライダー / 入力共通）
const QTY_MIN = 1;
const QTY_MAX = 100;

// 全角数字を半角へ変換し、数字以外を除去する（全角/半角の混入事故を防ぐ）
const toHalfWidthDigits = (s: string): string =>
  s
    .replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/[^0-9]/g, '');

// 入力途中の空文字は許容しつつ、上限だけ即時クランプ（下限は onBlur で正規化）
const sanitizeQty = (raw: string): string => {
  const digits = toHalfWidthDigits(raw);
  if (digits === '') return '';
  const n = parseInt(digits, 10);
  if (Number.isNaN(n)) return '';
  return String(Math.min(QTY_MAX, n));
};

// スライダー用に必ず 1〜100 の数値へ丸める
const clampQty = (str: string): number => {
  const n = parseInt(str || String(QTY_MIN), 10);
  if (Number.isNaN(n)) return QTY_MIN;
  return Math.min(QTY_MAX, Math.max(QTY_MIN, n));
};

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
  quantity: '1',
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
  // 連打ガード: state は React のバッチング待ちで一瞬空くため、ref で同期的に弾く
  const submittingRef = useRef(false);
  const [availableAuctions, setAvailableAuctions] = useState<AvailableAuction[]>([]);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' });
  
  const [auctionId, setAuctionId] = useState('');
  const [items, setItems] = useState<ItemFormData[]>([createEmptyItem()]);
  const [speciesTypes, setSpeciesTypes] = useState<SellerSpeciesType[]>([]);
  // 品種名（生体名）の入力補助候補（管理画面の品種名マスタから取得）
  const [speciesNameOptions, setSpeciesNameOptions] = useState<string[]>([]);
  const [shipments, setShipments] = useState<ShipmentInput[]>([{ carrier: '', tracking_number: '' }]);
  // 当該オークションで既に登録済みの自分の伝票（追加登録時に重複チェック・上限管理に利用）
  const [existingShipments, setExistingShipments] = useState<{ id: number; carrier: Carrier; carrier_label: string; tracking_number: string }[]>([]);
  const [completedItems, setCompletedItems] = useState<{ id: number; species_name: string; item_number?: string }[]>([]);
  const [resultDialogOpen, setResultDialogOpen] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const copyToClipboard = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey((k) => (k === key ? null : k)), 1500);
    } catch (err) {
      console.error('クリップボードへのコピーに失敗:', err);
      setSnackbar({ open: true, message: 'コピーに失敗しました', severity: 'error' });
    }
  };

  const remainingShipmentSlots = Math.max(0, MAX_SHIPMENTS - existingShipments.length);

  const updateShipment = (index: number, field: keyof ShipmentInput, value: string) => {
    setShipments((prev) => prev.map((s, i) => (i === index ? { ...s, [field]: value } : s)));
  };
  const addShipment = () => {
    setShipments((prev) => (prev.length >= remainingShipmentSlots ? prev : [...prev, { carrier: '', tracking_number: '' }]));
  };
  const removeShipment = (index: number) => {
    // 既に登録済みの伝票がある場合は新規入力欄を全削除可能（任意化）。なければ最低1行を残す。
    const minRows = existingShipments.length > 0 ? 0 : 1;
    setShipments((prev) => (prev.length <= minRows ? prev : prev.filter((_, i) => i !== index)));
  };
  const validShipments = shipments
    .map((s) => ({ carrier: s.carrier as Carrier, tracking_number: s.tracking_number.trim() }))
    .filter((s) => s.carrier && s.tracking_number.length > 0);
  // 既存伝票が1件以上あれば新規入力は任意。なければ従来通り最低1件必須。
  // 空行（carrier/tracking_number どちらも空）は許容するが、片方だけ入力された不完全行は不可。
  const allRowsConsistent = shipments.every((s) => {
    const hasCarrier = !!s.carrier;
    const hasNumber = s.tracking_number.trim().length > 0;
    return (hasCarrier && hasNumber) || (!hasCarrier && !hasNumber);
  });
  // 伝票番号は任意。未入力でも送信可能。ただし片方だけ埋まった不完全行（業者のみ/番号のみ）は不可。
  const isShipmentsValid = allRowsConsistent;

  useEffect(() => {
    fetchAvailableAuctions();
    fetchSpeciesTypes();
    fetchSpeciesNames();
  }, []);

  const fetchSpeciesNames = async () => {
    try {
      setSpeciesNameOptions(await sellerSpeciesNameApi.list());
    } catch (err) {
      console.error('品種名候補の取得に失敗:', err);
    }
  };

  // auction が選択されたら既存伝票を取得（同一オークションへの再出品時に過去登録分を表示・上限計算に使う）
  useEffect(() => {
    if (!auctionId) {
      setExistingShipments([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await axios.get(`/api/seller/auctions/${parseInt(auctionId)}/shipments`);
        if (cancelled) return;
        const list = res.data?.data?.shipments ?? [];
        setExistingShipments(list);
        // 既存が10件に達している場合は新規入力欄を消す
        if (list.length >= MAX_SHIPMENTS) {
          setShipments([]);
        } else if (list.length > 0) {
          // 既存が1件以上あれば新規入力は任意なので、空の初期行も削除（必要なら「+ 伝票を追加」で増やせる）
          setShipments([]);
        }
      } catch (err) {
        if (!cancelled) {
          console.error('既存伝票の取得に失敗:', err);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [auctionId]);

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
    // 同期ガード: 1 回目の onClick がまだ state 反映前でも、2 回目以降は即座に弾く
    if (submittingRef.current) return;
    submittingRef.current = true;
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

      const responses = await Promise.all(promises);
      const created = responses
        .map((r) => r.data?.data?.item)
        .filter((it) => it && typeof it.id === 'number')
        .map((it) => ({
          id: it.id as number,
          species_name: it.species_name as string,
          item_number: it.item_number as string | undefined,
        }));

      // 伝票番号の登録（出品作成成功後にまとめて送信）。既存伝票のみで新規ゼロなら送信スキップ。
      if (validShipments.length > 0) {
        try {
          await axios.post(`/api/seller/auctions/${parseInt(auctionId)}/shipments`, {
            shipments: validShipments,
          });
        } catch (err: any) {
          console.error('伝票番号登録エラー:', err);
          setSnackbar({
            open: true,
            message: err.response?.data?.message
              || '出品は登録されましたが、伝票番号の登録に失敗しました。出品履歴から再登録してください。',
            severity: 'error',
          });
          return;
        }
      }

      setCompletedItems(created);
      setResultDialogOpen(true);
      setSnackbar({
        open: true,
        message: `${items.length}件の出品申込を送信しました！管理者の審査をお待ちください。`,
        severity: 'success',
      });
    } catch (err: any) {
      console.error('出品申込エラー:', err);
      const validationErrors = err.response?.data?.errors;
      const errorMessage = validationErrors && typeof validationErrors === 'object'
        ? Object.values(validationErrors).flat().join('\n')
        : (err.response?.data?.message || '出品申込に失敗しました');
      setSnackbar({
        open: true,
        message: errorMessage,
        severity: 'error'
      });
      // 出品作成自体が失敗した場合のみ再送可能にする。
      // 成功 / shipments 失敗（早期 return）パスでは loading/ガードとも維持し、navigate まで disabled を保つ。
      submittingRef.current = false;
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
                        <Autocomplete
                          freeSolo
                          fullWidth
                          size="small"
                          options={speciesNameOptions}
                          inputValue={item.species_name}
                          onInputChange={(_, value) => updateItem(index, 'species_name', value)}
                          renderInput={(params) => (
                            <TextField
                              {...params}
                              required
                              label="品種名"
                              placeholder="例: 紅白ラメ、幹之フルボディ"
                              helperText="入力すると候補が表示されます。候補を選んでも、自由に編集してもOKです。"
                            />
                          )}
                        />
                      </Grid>

                      <Grid item xs={12} md={6}>
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                          数量（{QTY_MIN}〜{QTY_MAX}{unitLabel(item.quantity_unit)}）
                        </Typography>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                          <Slider
                            value={clampQty(item.quantity)}
                            min={QTY_MIN}
                            max={QTY_MAX}
                            size="small"
                            valueLabelDisplay="auto"
                            onChange={(_, v) => updateItem(index, 'quantity', String(v))}
                            sx={{ flex: 1 }}
                          />
                          <TextField
                            required
                            size="small"
                            value={item.quantity}
                            onChange={(e) => updateItem(index, 'quantity', sanitizeQty(e.target.value))}
                            onBlur={() => updateItem(index, 'quantity', String(clampQty(item.quantity)))}
                            inputProps={{
                              inputMode: 'numeric',
                              'aria-label': '数量',
                              style: { width: 56, textAlign: 'right' },
                            }}
                          />
                        </Box>
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
                        伝票番号（任意）
                      </Typography>
                      <Alert severity="info" sx={{ mb: 2 }}>
                        {existingShipments.length > 0
                          ? `このオークションには既に${existingShipments.length}件の伝票番号を登録済みです。追加で発送した分があれば下に入力してください（合計最大${MAX_SHIPMENTS}件まで）。新規追加が無い場合は空のまま送信できます。`
                          : `伝票番号の入力は任意です。生体を発送済みで伝票番号が分かる場合はご入力ください（後から出品履歴でも登録できます）。複数の伝票で発送した場合は「+ 伝票を追加」で増やせます（最大${MAX_SHIPMENTS}件）。伝票番号と各生体の紐付けは行いません。`}
                      </Alert>
                      {existingShipments.length > 0 && (
                        <Box sx={{ mb: 2 }}>
                          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                            登録済み（{existingShipments.length}/{MAX_SHIPMENTS}）
                          </Typography>
                          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                            {existingShipments.map((es) => (
                              <Chip
                                key={es.id}
                                size="small"
                                label={`${es.carrier_label} / ${es.tracking_number}`}
                                variant="outlined"
                              />
                            ))}
                          </Box>
                        </Box>
                      )}
                      {shipments.map((s, index) => (
                        <Grid container spacing={1.5} key={index} alignItems="center" sx={{ mb: 1 }}>
                          <Grid item xs={12} sm={4} md={3}>
                            <FormControl fullWidth size="small">
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
                              disabled={shipments.length <= (existingShipments.length > 0 ? 0 : 1)}
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
                        disabled={shipments.length >= remainingShipmentSlots}
                        sx={{ mt: 1 }}
                      >
                        伝票を追加 ({existingShipments.length + shipments.length}/{MAX_SHIPMENTS})
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

      {/* 登録完了ダイアログ（出品ID提示・郵送照合用） */}
      <Dialog
        open={resultDialogOpen}
        onClose={(_event, reason) => {
          // 誤閉じ防止：背景クリック/ESC では閉じない（ボタン操作のみ）
          if (reason === 'backdropClick' || reason === 'escapeKeyDown') return;
          setResultDialogOpen(false);
        }}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <CheckCircleIcon sx={{ color: '#059669' }} />
          出品申込を受け付けました
        </DialogTitle>
        <DialogContent dividers>
          <Alert severity="info" sx={{ mb: 2 }}>
            郵送時に生体を識別できるよう、下記の出品IDを各生体（袋・ケース等）に貼付してご発送ください。
          </Alert>
          <Paper variant="outlined" sx={{ overflow: 'auto', mb: 2 }}>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ bgcolor: 'grey.50' }}>
                  <TableCell sx={{ fontWeight: 600, width: 100 }}>出品ID</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>品種名</TableCell>
                  <TableCell sx={{ fontWeight: 600, width: 56 }} align="right">操作</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {completedItems.map((ci) => (
                  <TableRow key={ci.id}>
                    <TableCell sx={{ fontFamily: 'monospace', fontWeight: 600 }}>{ci.id}</TableCell>
                    <TableCell>{ci.species_name}</TableCell>
                    <TableCell align="right">
                      <Tooltip title={copiedKey === `row-${ci.id}` ? 'コピーしました' : 'IDをコピー'}>
                        <IconButton
                          size="small"
                          onClick={() => copyToClipboard(String(ci.id), `row-${ci.id}`)}
                          aria-label="出品IDをコピー"
                        >
                          <CopyIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Paper>
          {completedItems.length > 1 && (
            <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
              <Button
                size="small"
                startIcon={<CopyIcon />}
                onClick={() =>
                  copyToClipboard(
                    completedItems.map((ci) => ci.id).join(', '),
                    'all-ids',
                  )
                }
              >
                {copiedKey === 'all-ids' ? 'コピーしました' : 'IDを全件コピー'}
              </Button>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button
            variant="contained"
            color="success"
            onClick={() => {
              setResultDialogOpen(false);
              navigate('/seller/items');
            }}
          >
            出品履歴へ
          </Button>
        </DialogActions>
      </Dialog>

      {/* スナックバー */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={3000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert
          severity={snackbar.severity}
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          sx={{ whiteSpace: 'pre-line' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
