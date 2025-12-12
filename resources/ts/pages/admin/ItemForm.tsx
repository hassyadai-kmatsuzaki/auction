import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Box,
  Typography,
  Paper,
  TextField,
  Button,
  Grid,
  FormControlLabel,
  Checkbox,
  Card,
  CardContent,
  Autocomplete,
  Divider,
  Alert,
  Chip,
  Avatar,
} from '@mui/material';
import {
  Save as SaveIcon,
  ArrowBack as ArrowBackIcon,
  Upload as UploadIcon,
  Store as StoreIcon,
  Pets as PetsIcon,
  Info as InfoIcon,
  Close as CloseIcon,
  Image as ImageIcon,
} from '@mui/icons-material';

// Mock 出品者データ
const sellers = [
  {
    id: 1,
    name: '田中養魚場',
    representative: '田中太郎',
    email: 'tanaka@example.com',
    phone: '090-1234-5678',
    commission_rate: 10,
  },
  {
    id: 2,
    name: 'メダカの佐藤',
    representative: '佐藤花子',
    email: 'sato@example.com',
    phone: '090-2345-6789',
    commission_rate: 10,
  },
  {
    id: 3,
    name: '鈴木メダカファーム',
    representative: '鈴木一郎',
    email: 'suzuki@example.com',
    phone: '090-3456-7890',
    commission_rate: 8,
  },
];

// Mock 出品者からの出品申請データ（転記元）
const sellerSubmissions = [
  {
    seller_id: 1,
    species_name: '紅白ラメ',
    quantity: '3ペア',
    individual_info: '親魚は自家繁殖2代目。体長約4cm、ラメの乗りが良好。オス・メスともに健康状態良好。',
    seller_notes: '発送は落札日から3日以内に対応可能です。',
    submitted_at: '2025-11-10',
  },
  {
    seller_id: 1,
    species_name: '幹之フルボディ',
    quantity: '5匹',
    individual_info: '当歳魚、体長3-3.5cm。フルボディタイプ、背中の光がしっかり入っています。',
    seller_notes: '元気な個体を厳選してお送りします。',
    submitted_at: '2025-11-10',
  },
  {
    seller_id: 3,
    species_name: '三色ラメ',
    quantity: '2ペア',
    individual_info: '自家繁殖3代目。赤・黒・白のバランスが良い個体。ラメも綺麗に乗っています。体長約3.5cm。',
    seller_notes: '死着保証あり。到着後24時間以内にご連絡ください。',
    submitted_at: '2025-11-08',
  },
];

export default function ItemForm() {
  const navigate = useNavigate();
  const { auctionId, id } = useParams();
  const isEdit = Boolean(id);

  const [selectedSeller, setSelectedSeller] = useState<typeof sellers[0] | null>(null);
  const [selectedSubmission, setSelectedSubmission] = useState<typeof sellerSubmissions[0] | null>(null);
  const [formData, setFormData] = useState({
    species_name: '',
    quantity: '',
    start_price: '',
    estimated_price: '',
    inspection_info: '',
    individual_info: '',
    seller_notes: '',
    admin_notes: '',
    is_premium: false,
  });

  // 画像アップロード用の状態
  const [uploadedImages, setUploadedImages] = useState<{ file: File; preview: string }[]>([]);
  const MAX_IMAGES = 20;

  // 画像ファイル選択時の処理
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const newImages: { file: File; preview: string }[] = [];
    const remainingSlots = MAX_IMAGES - uploadedImages.length;
    const filesToAdd = Math.min(files.length, remainingSlots);

    for (let i = 0; i < filesToAdd; i++) {
      const file = files[i];
      if (file.type.startsWith('image/')) {
        newImages.push({
          file,
          preview: URL.createObjectURL(file),
        });
      }
    }

    setUploadedImages([...uploadedImages, ...newImages]);
    // inputをリセット
    e.target.value = '';
  };

  // 画像削除時の処理
  const handleRemoveImage = (index: number) => {
    const newImages = [...uploadedImages];
    URL.revokeObjectURL(newImages[index].preview); // メモリリーク防止
    newImages.splice(index, 1);
    setUploadedImages(newImages);
  };

  // 出品者選択時の処理
  const handleSellerChange = (seller: typeof sellers[0] | null) => {
    setSelectedSeller(seller);
    setSelectedSubmission(null);
    // 出品者が変わったらフォームをリセット
    setFormData({
      ...formData,
      species_name: '',
      quantity: '',
      individual_info: '',
      seller_notes: '',
    });
  };

  // 出品申請データ選択時の処理（転記）
  const handleSubmissionSelect = (submission: typeof sellerSubmissions[0] | null) => {
    setSelectedSubmission(submission);
    if (submission) {
      // 出品者からの情報を転記
      setFormData({
        ...formData,
        species_name: submission.species_name,
        quantity: submission.quantity,
        individual_info: submission.individual_info,
        seller_notes: submission.seller_notes,
      });
    }
  };

  // 選択中の出品者の出品申請データをフィルタ
  const filteredSubmissions = selectedSeller
    ? sellerSubmissions.filter((s) => s.seller_id === selectedSeller.id)
    : [];

  const handleChange = (field: string) => (e: any) => {
    setFormData({ ...formData, [field]: e.target.value });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    navigate(`/admin/auctions/${auctionId}/items`);
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 4 }}>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate(`/admin/auctions/${auctionId}/items`)}
          sx={{ mr: 2 }}
        >
          戻る
        </Button>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 700 }}>
            {isEdit ? '生体編集' : '生体新規登録'}
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            出品者からの申請情報を元に生体を登録します
          </Typography>
        </Box>
      </Box>

      <Grid container spacing={3}>
        <Grid item xs={12} lg={8}>
          {/* 出品者選択 */}
          <Card sx={{ mb: 3 }}>
            <CardContent sx={{ p: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
                <StoreIcon sx={{ color: '#059669' }} />
                <Typography variant="h6" sx={{ fontWeight: 600 }}>
                  出品者選択
                </Typography>
              </Box>

              <Grid container spacing={3}>
                <Grid item xs={12} md={6}>
                  <Autocomplete
                    options={sellers}
                    getOptionLabel={(option) => `${option.name} (${option.representative})`}
                    value={selectedSeller}
                    onChange={(_, value) => handleSellerChange(value)}
                    renderOption={(props, option) => (
                      <Box component="li" {...props}>
                        <Avatar sx={{ width: 32, height: 32, mr: 1.5, bgcolor: '#F0FDF4', color: '#059669', fontSize: '0.875rem' }}>
                          {option.name.charAt(0)}
                        </Avatar>
                        <Box>
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>{option.name}</Typography>
                          <Typography variant="caption" sx={{ color: 'text.secondary' }}>{option.representative}</Typography>
                        </Box>
                      </Box>
                    )}
                    renderInput={(params) => (
                      <TextField {...params} label="出品者を選択" required />
                    )}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <Autocomplete
                    options={filteredSubmissions}
                    getOptionLabel={(option) => `${option.species_name} (${option.quantity})`}
                    value={selectedSubmission}
                    onChange={(_, value) => handleSubmissionSelect(value)}
                    disabled={!selectedSeller}
                    renderOption={(props, option) => (
                      <Box component="li" {...props}>
                        <Box>
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>{option.species_name}</Typography>
                          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                            {option.quantity} - 申請日: {option.submitted_at}
                          </Typography>
                        </Box>
                      </Box>
                    )}
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        label="出品申請データを選択（転記）"
                        placeholder={selectedSeller ? '選択してください' : '先に出品者を選択'}
                      />
                    )}
                  />
                </Grid>
              </Grid>

              {selectedSeller && (
                <Box sx={{ mt: 2, p: 2, bgcolor: 'grey.50', borderRadius: 2 }}>
                  <Typography variant="subtitle2" sx={{ mb: 1, color: 'text.secondary' }}>
                    出品者情報
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                    <Typography variant="body2">
                      <strong>連絡先:</strong> {selectedSeller.email}
                    </Typography>
                    <Typography variant="body2">
                      <strong>電話:</strong> {selectedSeller.phone}
                    </Typography>
                    <Typography variant="body2">
                      <strong>手数料率:</strong> {selectedSeller.commission_rate}%
                    </Typography>
                  </Box>
                </Box>
              )}
            </CardContent>
          </Card>

          {/* 個体情報（出品者からの転記） */}
          <Card sx={{ mb: 3 }}>
            <CardContent sx={{ p: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <PetsIcon sx={{ color: '#3B82F6' }} />
                <Typography variant="h6" sx={{ fontWeight: 600 }}>
                  個体情報
                </Typography>
                <Chip label="出品者からの転記" size="small" sx={{ ml: 1, bgcolor: '#DBEAFE', color: '#2563EB' }} />
              </Box>
              <Typography variant="body2" sx={{ color: 'text.secondary', mb: 3 }}>
                出品者から申請された情報です。必要に応じて編集できます。
              </Typography>

              {selectedSubmission && (
                <Alert severity="info" sx={{ mb: 3 }}>
                  <Typography variant="body2">
                    「{selectedSubmission.species_name}」の申請データを転記しました。内容を確認・編集してください。
                  </Typography>
                </Alert>
              )}

              <Box component="form" onSubmit={handleSubmit}>
                <Grid container spacing={3}>
                  <Grid item xs={12} md={6}>
                    <TextField
                      fullWidth
                      required
                      label="品種名"
                      value={formData.species_name}
                      onChange={handleChange('species_name')}
                      placeholder="幹之メダカ"
                    />
                  </Grid>

                  <Grid item xs={12} md={6}>
                    <TextField
                      fullWidth
                      required
                      label="匹数・数量"
                      value={formData.quantity}
                      onChange={handleChange('quantity')}
                      placeholder="5匹 または 3ペア"
                    />
                  </Grid>

                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      label="個体情報（出品者からの説明）"
                      value={formData.individual_info}
                      onChange={handleChange('individual_info')}
                      multiline
                      rows={4}
                      placeholder="体長、色、特徴など出品者からの個体説明"
                      helperText="出品者から申請された個体の詳細情報です"
                    />
                  </Grid>

                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      label="出品者メモ・備考"
                      value={formData.seller_notes}
                      onChange={handleChange('seller_notes')}
                      multiline
                      rows={2}
                      placeholder="発送対応、死着保証など出品者からの備考"
                      helperText="出品者からの備考・連絡事項"
                    />
                  </Grid>

                  <Divider sx={{ width: '100%', my: 2 }} />

                  <Grid item xs={12} md={4}>
                    <TextField
                      fullWidth
                      required
                      type="number"
                      label="開始価格"
                      value={formData.start_price}
                      onChange={handleChange('start_price')}
                      InputProps={{
                        startAdornment: <Typography sx={{ mr: 1, color: 'text.secondary' }}>¥</Typography>,
                      }}
                    />
                  </Grid>

                  <Grid item xs={12} md={4}>
                    <TextField
                      fullWidth
                      type="number"
                      label="落札想定金額"
                      value={formData.estimated_price}
                      onChange={handleChange('estimated_price')}
                      InputProps={{
                        startAdornment: <Typography sx={{ mr: 1, color: 'text.secondary' }}>¥</Typography>,
                      }}
                    />
                  </Grid>

                  <Grid item xs={12} md={4}>
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={formData.is_premium}
                          onChange={(e) =>
                            setFormData({ ...formData, is_premium: e.target.checked })
                          }
                        />
                      }
                      label="プレミアムプラン（+300円）"
                      sx={{ mt: 1 }}
                    />
                  </Grid>

                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      label="審査情報（管理者記入）"
                      value={formData.inspection_info}
                      onChange={handleChange('inspection_info')}
                      multiline
                      rows={2}
                      placeholder="審査時の確認事項など"
                    />
                  </Grid>

                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      label="管理者メモ"
                      value={formData.admin_notes}
                      onChange={handleChange('admin_notes')}
                      multiline
                      rows={2}
                      placeholder="内部向けメモ"
                    />
                  </Grid>
                </Grid>
              </Box>
            </CardContent>
          </Card>

          {/* アクションボタン */}
          <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
            <Button
              variant="outlined"
              onClick={() => navigate(`/admin/auctions/${auctionId}/items`)}
            >
              キャンセル
            </Button>
            <Button
              type="submit"
              variant="contained"
              startIcon={<SaveIcon />}
              onClick={handleSubmit}
            >
              {isEdit ? '変更を保存' : '生体を登録'}
            </Button>
          </Box>
        </Grid>

        {/* 右サイドバー - メディアアップロード */}
        <Grid item xs={12} lg={4}>
          <Card sx={{ position: 'sticky', top: 80 }}>
            <CardContent sx={{ p: 3 }}>
              <Typography variant="h6" sx={{ fontWeight: 600, mb: 3 }}>
                メディア
              </Typography>

              <Box sx={{ mb: 3 }}>
                <Typography variant="subtitle2" sx={{ mb: 1 }}>
                  上見動画（30秒）
                </Typography>
                <Button
                  variant="outlined"
                  fullWidth
                  startIcon={<UploadIcon />}
                  component="label"
                  sx={{ py: 1.5, borderStyle: 'dashed' }}
                >
                  動画をアップロード
                  <input type="file" accept="video/*" hidden />
                </Button>
              </Box>

              <Box sx={{ mb: 3 }}>
                <Typography variant="subtitle2" sx={{ mb: 1 }}>
                  横見動画（30秒）
                </Typography>
                <Button
                  variant="outlined"
                  fullWidth
                  startIcon={<UploadIcon />}
                  component="label"
                  sx={{ py: 1.5, borderStyle: 'dashed' }}
                >
                  動画をアップロード
                  <input type="file" accept="video/*" hidden />
                </Button>
              </Box>

              <Divider sx={{ my: 3 }} />

              {/* 画像アップロードセクション */}
              <Box sx={{ mb: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <ImageIcon sx={{ fontSize: 20, color: '#059669' }} />
                    <Typography variant="subtitle2">
                      画像
                    </Typography>
                  </Box>
                  <Chip 
                    label={`${uploadedImages.length} / ${MAX_IMAGES}`} 
                    size="small" 
                    color={uploadedImages.length >= MAX_IMAGES ? 'error' : 'default'}
                  />
                </Box>
                
                <Button
                  variant="outlined"
                  fullWidth
                  startIcon={<UploadIcon />}
                  component="label"
                  disabled={uploadedImages.length >= MAX_IMAGES}
                  sx={{ py: 1.5, borderStyle: 'dashed', mb: 2 }}
                >
                  画像をアップロード（最大{MAX_IMAGES}枚）
                  <input 
                    type="file" 
                    accept="image/*" 
                    multiple 
                    hidden 
                    onChange={handleImageUpload}
                  />
                </Button>

                {/* アップロード済み画像のプレビュー */}
                {uploadedImages.length > 0 && (
                  <Box sx={{ 
                    display: 'grid', 
                    gridTemplateColumns: 'repeat(3, 1fr)', 
                    gap: 1,
                    maxHeight: 300,
                    overflowY: 'auto',
                    p: 1,
                    bgcolor: 'grey.50',
                    borderRadius: 2,
                  }}>
                    {uploadedImages.map((image, index) => (
                      <Box 
                        key={index} 
                        sx={{ 
                          position: 'relative',
                          aspectRatio: '1',
                          borderRadius: 1,
                          overflow: 'hidden',
                          border: '1px solid',
                          borderColor: 'grey.200',
                        }}
                      >
                        <Box
                          component="img"
                          src={image.preview}
                          alt={`uploaded-${index}`}
                          sx={{
                            width: '100%',
                            height: '100%',
                            objectFit: 'cover',
                          }}
                        />
                        <Box
                          onClick={() => handleRemoveImage(index)}
                          sx={{
                            position: 'absolute',
                            top: 2,
                            right: 2,
                            width: 20,
                            height: 20,
                            borderRadius: '50%',
                            bgcolor: 'rgba(0,0,0,0.6)',
                            color: 'white',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            '&:hover': {
                              bgcolor: 'error.main',
                            },
                          }}
                        >
                          <CloseIcon sx={{ fontSize: 14 }} />
                        </Box>
                        <Box
                          sx={{
                            position: 'absolute',
                            bottom: 2,
                            left: 2,
                            bgcolor: 'rgba(0,0,0,0.6)',
                            color: 'white',
                            fontSize: '0.65rem',
                            px: 0.5,
                            borderRadius: 0.5,
                          }}
                        >
                          {index + 1}
                        </Box>
                      </Box>
                    ))}
                  </Box>
                )}
              </Box>

              <Divider sx={{ my: 3 }} />

              <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, mb: 1 }}>
                <InfoIcon sx={{ color: 'text.secondary', fontSize: 18, mt: 0.2 }} />
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                  動画は30秒以内、ファイルサイズ50MB以下でアップロードしてください。
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                <InfoIcon sx={{ color: 'text.secondary', fontSize: 18, mt: 0.2 }} />
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                  画像は最大{MAX_IMAGES}枚まで、1枚あたり10MB以下でアップロードしてください。
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}
