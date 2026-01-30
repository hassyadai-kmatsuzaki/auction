import React, { useState } from 'react';
import {
  Container,
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  Button,
  IconButton,
  TextField,
  Chip,
  Avatar,
  Badge,
  Switch,
  Checkbox,
  Radio,
  RadioGroup,
  FormControlLabel,
  FormControl,
  FormLabel,
  Select,
  MenuItem,
  InputLabel,
  Slider,
  LinearProgress,
  CircularProgress,
  Alert,
  AlertTitle,
  Snackbar,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Tabs,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  ListItemButton,
  Divider,
  Tooltip,
  Breadcrumbs,
  Link,
  Pagination,
  Rating,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Stepper,
  Step,
  StepLabel,
  useTheme,
} from '@mui/material';
import {
  Home as HomeIcon,
  Settings as SettingsIcon,
  Person as PersonIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Add as AddIcon,
  Search as SearchIcon,
  Notifications as NotificationsIcon,
  Check as CheckIcon,
  Close as CloseIcon,
  ExpandMore as ExpandMoreIcon,
  Info as InfoIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
  CheckCircle as CheckCircleIcon,
  Star as StarIcon,
  Favorite as FavoriteIcon,
  Download as DownloadIcon,
  Upload as UploadIcon,
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon,
  ArrowForward as ArrowForwardIcon,
  ArrowBack as ArrowBackIcon,
  Menu as MenuIcon,
  MoreVert as MoreVertIcon,
} from '@mui/icons-material';

export default function DesignSystem() {
  const theme = useTheme();
  const [tabValue, setTabValue] = useState(0);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [sliderValue, setSliderValue] = useState(30);
  const [selectValue, setSelectValue] = useState('option1');
  const [switchChecked, setSwitchChecked] = useState(false);

  const colorPalette = [
    { name: 'Primary', main: theme.palette.primary.main, light: theme.palette.primary.light, dark: theme.palette.primary.dark },
    { name: 'Secondary', main: theme.palette.secondary.main, light: theme.palette.secondary.light, dark: theme.palette.secondary.dark },
    { name: 'Error', main: theme.palette.error.main, light: theme.palette.error.light, dark: theme.palette.error.dark },
    { name: 'Warning', main: theme.palette.warning.main, light: theme.palette.warning.light, dark: theme.palette.warning.dark },
    { name: 'Info', main: theme.palette.info.main, light: theme.palette.info.light, dark: theme.palette.info.dark },
    { name: 'Success', main: theme.palette.success.main, light: theme.palette.success.light, dark: theme.palette.success.dark },
  ];

  const greyScale = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900];

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      {/* ヘッダー */}
      <Box sx={{ mb: 6 }}>
        <Typography variant="h3" gutterBottom fontWeight="bold">
          デザインシステム
        </Typography>
        <Typography variant="body1" color="text.secondary">
          メダカライブオークションシステムで使用されるデザインコンポーネント一覧
        </Typography>
      </Box>

      {/* タブナビゲーション */}
      <Paper sx={{ mb: 4 }}>
        <Tabs value={tabValue} onChange={(_, v) => setTabValue(v)} variant="scrollable" scrollButtons="auto">
          <Tab label="カラー" />
          <Tab label="タイポグラフィ" />
          <Tab label="ボタン" />
          <Tab label="入力フォーム" />
          <Tab label="フィードバック" />
          <Tab label="データ表示" />
          <Tab label="ナビゲーション" />
          <Tab label="レイアウト" />
        </Tabs>
      </Paper>

      {/* カラー */}
      {tabValue === 0 && (
        <Box>
          <Typography variant="h5" gutterBottom fontWeight="bold">カラーパレット</Typography>
          <Grid container spacing={3} sx={{ mb: 4 }}>
            {colorPalette.map((color) => (
              <Grid item xs={12} sm={6} md={4} key={color.name}>
                <Card>
                  <CardContent>
                    <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                      {color.name}
                    </Typography>
                    <Grid container spacing={1}>
                      <Grid item xs={4}>
                        <Box sx={{ bgcolor: color.light, height: 60, borderRadius: 1 }} />
                        <Typography variant="caption" display="block" sx={{ mt: 0.5 }}>Light</Typography>
                        <Typography variant="caption" sx={{ fontFamily: 'monospace' }}>{color.light}</Typography>
                      </Grid>
                      <Grid item xs={4}>
                        <Box sx={{ bgcolor: color.main, height: 60, borderRadius: 1 }} />
                        <Typography variant="caption" display="block" sx={{ mt: 0.5 }}>Main</Typography>
                        <Typography variant="caption" sx={{ fontFamily: 'monospace' }}>{color.main}</Typography>
                      </Grid>
                      <Grid item xs={4}>
                        <Box sx={{ bgcolor: color.dark, height: 60, borderRadius: 1 }} />
                        <Typography variant="caption" display="block" sx={{ mt: 0.5 }}>Dark</Typography>
                        <Typography variant="caption" sx={{ fontFamily: 'monospace' }}>{color.dark}</Typography>
                      </Grid>
                    </Grid>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>

          <Typography variant="h5" gutterBottom fontWeight="bold">グレースケール</Typography>
          <Card sx={{ mb: 4 }}>
            <CardContent>
              <Grid container spacing={1}>
                {greyScale.map((shade) => (
                  <Grid item xs={6} sm={4} md={2.4} key={shade}>
                    <Box sx={{ bgcolor: theme.palette.grey[shade as keyof typeof theme.palette.grey], height: 60, borderRadius: 1, border: '1px solid #E2E8F0' }} />
                    <Typography variant="caption" display="block" sx={{ mt: 0.5 }}>Grey {shade}</Typography>
                    <Typography variant="caption" sx={{ fontFamily: 'monospace' }}>{theme.palette.grey[shade as keyof typeof theme.palette.grey]}</Typography>
                  </Grid>
                ))}
              </Grid>
            </CardContent>
          </Card>

          <Typography variant="h5" gutterBottom fontWeight="bold">背景色</Typography>
          <Card>
            <CardContent>
              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <Box sx={{ bgcolor: theme.palette.background.default, height: 60, borderRadius: 1, border: '1px solid #E2E8F0' }} />
                  <Typography variant="caption" display="block" sx={{ mt: 0.5 }}>Default</Typography>
                  <Typography variant="caption" sx={{ fontFamily: 'monospace' }}>{theme.palette.background.default}</Typography>
                </Grid>
                <Grid item xs={6}>
                  <Box sx={{ bgcolor: theme.palette.background.paper, height: 60, borderRadius: 1, border: '1px solid #E2E8F0' }} />
                  <Typography variant="caption" display="block" sx={{ mt: 0.5 }}>Paper</Typography>
                  <Typography variant="caption" sx={{ fontFamily: 'monospace' }}>{theme.palette.background.paper}</Typography>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Box>
      )}

      {/* タイポグラフィ */}
      {tabValue === 1 && (
        <Box>
          <Typography variant="h5" gutterBottom fontWeight="bold">見出し</Typography>
          <Card sx={{ mb: 4 }}>
            <CardContent>
              <Typography variant="h1" gutterBottom>h1. 見出し1 - DM Sans 700</Typography>
              <Typography variant="h2" gutterBottom>h2. 見出し2 - DM Sans 700</Typography>
              <Typography variant="h3" gutterBottom>h3. 見出し3 - DM Sans 600</Typography>
              <Typography variant="h4" gutterBottom>h4. 見出し4 - DM Sans 600</Typography>
              <Typography variant="h5" gutterBottom>h5. 見出し5 - DM Sans 600</Typography>
              <Typography variant="h6" gutterBottom>h6. 見出し6 - DM Sans 600</Typography>
            </CardContent>
          </Card>

          <Typography variant="h5" gutterBottom fontWeight="bold">本文</Typography>
          <Card sx={{ mb: 4 }}>
            <CardContent>
              <Typography variant="subtitle1" gutterBottom>subtitle1. サブタイトル1</Typography>
              <Typography variant="subtitle2" gutterBottom>subtitle2. サブタイトル2</Typography>
              <Typography variant="body1" gutterBottom>body1. 本文テキスト。メダカライブオークションシステムで使用される標準の本文テキストです。</Typography>
              <Typography variant="body2" gutterBottom>body2. 補足テキスト。より小さなサイズで補足情報を表示します。</Typography>
              <Typography variant="caption" display="block" gutterBottom>caption. キャプションテキスト</Typography>
              <Typography variant="overline" display="block">overline. オーバーライン</Typography>
            </CardContent>
          </Card>

          <Typography variant="h5" gutterBottom fontWeight="bold">フォントファミリー</Typography>
          <Card>
            <CardContent>
              <Typography variant="body1" gutterBottom>
                <strong>プライマリ:</strong> "DM Sans", "Noto Sans JP", sans-serif
              </Typography>
              <Typography variant="body1" sx={{ fontFamily: '"DM Sans", sans-serif' }}>
                English Text: The quick brown fox jumps over the lazy dog.
              </Typography>
              <Typography variant="body1" sx={{ fontFamily: '"Noto Sans JP", sans-serif' }}>
                日本語テキスト: いろはにほへとちりぬるをわかよたれそつねならむうゐのおくやまけふこえて
              </Typography>
            </CardContent>
          </Card>
        </Box>
      )}

      {/* ボタン */}
      {tabValue === 2 && (
        <Box>
          <Typography variant="h5" gutterBottom fontWeight="bold">ボタンバリエーション</Typography>
          <Card sx={{ mb: 4 }}>
            <CardContent>
              <Typography variant="subtitle1" gutterBottom fontWeight="bold">Contained</Typography>
              <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mb: 3 }}>
                <Button variant="contained">Primary</Button>
                <Button variant="contained" color="secondary">Secondary</Button>
                <Button variant="contained" color="error">Error</Button>
                <Button variant="contained" color="warning">Warning</Button>
                <Button variant="contained" color="info">Info</Button>
                <Button variant="contained" color="success">Success</Button>
                <Button variant="contained" disabled>Disabled</Button>
              </Box>

              <Typography variant="subtitle1" gutterBottom fontWeight="bold">Outlined</Typography>
              <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mb: 3 }}>
                <Button variant="outlined">Primary</Button>
                <Button variant="outlined" color="secondary">Secondary</Button>
                <Button variant="outlined" color="error">Error</Button>
                <Button variant="outlined" color="warning">Warning</Button>
                <Button variant="outlined" color="info">Info</Button>
                <Button variant="outlined" color="success">Success</Button>
                <Button variant="outlined" disabled>Disabled</Button>
              </Box>

              <Typography variant="subtitle1" gutterBottom fontWeight="bold">Text</Typography>
              <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mb: 3 }}>
                <Button variant="text">Primary</Button>
                <Button variant="text" color="secondary">Secondary</Button>
                <Button variant="text" color="error">Error</Button>
              </Box>
            </CardContent>
          </Card>

          <Typography variant="h5" gutterBottom fontWeight="bold">サイズ</Typography>
          <Card sx={{ mb: 4 }}>
            <CardContent>
              <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
                <Button variant="contained" size="small">Small</Button>
                <Button variant="contained" size="medium">Medium</Button>
                <Button variant="contained" size="large">Large</Button>
              </Box>
            </CardContent>
          </Card>

          <Typography variant="h5" gutterBottom fontWeight="bold">アイコンボタン</Typography>
          <Card sx={{ mb: 4 }}>
            <CardContent>
              <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mb: 3 }}>
                <Button variant="contained" startIcon={<AddIcon />}>作成</Button>
                <Button variant="contained" endIcon={<ArrowForwardIcon />}>次へ</Button>
                <Button variant="outlined" startIcon={<DownloadIcon />}>ダウンロード</Button>
                <Button variant="outlined" startIcon={<UploadIcon />}>アップロード</Button>
              </Box>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <IconButton><HomeIcon /></IconButton>
                <IconButton color="primary"><EditIcon /></IconButton>
                <IconButton color="error"><DeleteIcon /></IconButton>
                <IconButton color="secondary"><SettingsIcon /></IconButton>
              </Box>
            </CardContent>
          </Card>

          <Typography variant="h5" gutterBottom fontWeight="bold">チップ（タグ）</Typography>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2 }}>
                <Chip label="Default" />
                <Chip label="Primary" color="primary" />
                <Chip label="Secondary" color="secondary" />
                <Chip label="Error" color="error" />
                <Chip label="Warning" color="warning" />
                <Chip label="Info" color="info" />
                <Chip label="Success" color="success" />
              </Box>
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2 }}>
                <Chip label="Outlined" variant="outlined" />
                <Chip label="Clickable" onClick={() => {}} />
                <Chip label="Deletable" onDelete={() => {}} />
                <Chip avatar={<Avatar>M</Avatar>} label="Avatar" />
                <Chip icon={<StarIcon />} label="Icon" />
              </Box>
              <Typography variant="subtitle2" sx={{ mt: 2, mb: 1 }}>ステータスバッジ例</Typography>
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                <Chip label="承認済み" sx={{ bgcolor: '#ECFDF5', color: '#059669' }} icon={<CheckCircleIcon sx={{ color: '#059669' }} />} />
                <Chip label="審査中" sx={{ bgcolor: '#FEF3C7', color: '#D97706' }} icon={<InfoIcon sx={{ color: '#D97706' }} />} />
                <Chip label="却下" sx={{ bgcolor: '#FEE2E2', color: '#DC2626' }} icon={<ErrorIcon sx={{ color: '#DC2626' }} />} />
              </Box>
            </CardContent>
          </Card>
        </Box>
      )}

      {/* 入力フォーム */}
      {tabValue === 3 && (
        <Box>
          <Typography variant="h5" gutterBottom fontWeight="bold">テキストフィールド</Typography>
          <Card sx={{ mb: 4 }}>
            <CardContent>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6} md={4}>
                  <TextField label="標準" fullWidth />
                </Grid>
                <Grid item xs={12} sm={6} md={4}>
                  <TextField label="必須" required fullWidth />
                </Grid>
                <Grid item xs={12} sm={6} md={4}>
                  <TextField label="エラー" error helperText="エラーメッセージ" fullWidth />
                </Grid>
                <Grid item xs={12} sm={6} md={4}>
                  <TextField label="無効" disabled fullWidth />
                </Grid>
                <Grid item xs={12} sm={6} md={4}>
                  <TextField label="読み取り専用" InputProps={{ readOnly: true }} defaultValue="読み取り専用" fullWidth />
                </Grid>
                <Grid item xs={12} sm={6} md={4}>
                  <TextField label="パスワード" type="password" fullWidth />
                </Grid>
                <Grid item xs={12} sm={6} md={4}>
                  <TextField label="数値" type="number" fullWidth />
                </Grid>
                <Grid item xs={12} sm={6} md={4}>
                  <TextField label="日付" type="date" InputLabelProps={{ shrink: true }} fullWidth />
                </Grid>
                <Grid item xs={12} sm={6} md={4}>
                  <TextField
                    label="検索"
                    fullWidth
                    InputProps={{
                      startAdornment: <SearchIcon sx={{ mr: 1, color: 'text.secondary' }} />,
                    }}
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField label="複数行" multiline rows={3} fullWidth />
                </Grid>
              </Grid>
            </CardContent>
          </Card>

          <Typography variant="h5" gutterBottom fontWeight="bold">セレクト・ラジオ・チェックボックス</Typography>
          <Card sx={{ mb: 4 }}>
            <CardContent>
              <Grid container spacing={3}>
                <Grid item xs={12} sm={6} md={4}>
                  <FormControl fullWidth>
                    <InputLabel>セレクト</InputLabel>
                    <Select value={selectValue} label="セレクト" onChange={(e) => setSelectValue(e.target.value as string)}>
                      <MenuItem value="option1">オプション1</MenuItem>
                      <MenuItem value="option2">オプション2</MenuItem>
                      <MenuItem value="option3">オプション3</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} sm={6} md={4}>
                  <FormControl>
                    <FormLabel>ラジオボタン</FormLabel>
                    <RadioGroup defaultValue="radio1">
                      <FormControlLabel value="radio1" control={<Radio />} label="選択肢1" />
                      <FormControlLabel value="radio2" control={<Radio />} label="選択肢2" />
                      <FormControlLabel value="radio3" control={<Radio />} label="選択肢3" />
                    </RadioGroup>
                  </FormControl>
                </Grid>
                <Grid item xs={12} sm={6} md={4}>
                  <FormControl>
                    <FormLabel>チェックボックス</FormLabel>
                    <FormControlLabel control={<Checkbox defaultChecked />} label="チェック済み" />
                    <FormControlLabel control={<Checkbox />} label="未チェック" />
                    <FormControlLabel control={<Checkbox indeterminate />} label="不確定" />
                    <FormControlLabel control={<Checkbox disabled />} label="無効" />
                  </FormControl>
                </Grid>
              </Grid>
            </CardContent>
          </Card>

          <Typography variant="h5" gutterBottom fontWeight="bold">スイッチ・スライダー</Typography>
          <Card>
            <CardContent>
              <Grid container spacing={3}>
                <Grid item xs={12} sm={6}>
                  <Typography variant="subtitle1" gutterBottom fontWeight="bold">スイッチ</Typography>
                  <FormControlLabel control={<Switch checked={switchChecked} onChange={(e) => setSwitchChecked(e.target.checked)} />} label="トグル" />
                  <FormControlLabel control={<Switch defaultChecked />} label="オン" />
                  <FormControlLabel control={<Switch disabled />} label="無効" />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="subtitle1" gutterBottom fontWeight="bold">スライダー</Typography>
                  <Slider value={sliderValue} onChange={(_, v) => setSliderValue(v as number)} />
                  <Typography variant="body2">値: {sliderValue}</Typography>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Box>
      )}

      {/* フィードバック */}
      {tabValue === 4 && (
        <Box>
          <Typography variant="h5" gutterBottom fontWeight="bold">アラート</Typography>
          <Card sx={{ mb: 4 }}>
            <CardContent>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <Alert severity="error">
                  <AlertTitle>エラー</AlertTitle>
                  エラーメッセージの内容をここに表示します。
                </Alert>
                <Alert severity="warning">
                  <AlertTitle>警告</AlertTitle>
                  警告メッセージの内容をここに表示します。
                </Alert>
                <Alert severity="info">
                  <AlertTitle>情報</AlertTitle>
                  情報メッセージの内容をここに表示します。
                </Alert>
                <Alert severity="success">
                  <AlertTitle>成功</AlertTitle>
                  成功メッセージの内容をここに表示します。
                </Alert>
                <Alert severity="info" variant="outlined">Outlined バリエーション</Alert>
                <Alert severity="info" variant="filled">Filled バリエーション</Alert>
              </Box>
            </CardContent>
          </Card>

          <Typography variant="h5" gutterBottom fontWeight="bold">ダイアログ・スナックバー</Typography>
          <Card sx={{ mb: 4 }}>
            <CardContent>
              <Box sx={{ display: 'flex', gap: 2 }}>
                <Button variant="contained" onClick={() => setDialogOpen(true)}>ダイアログを開く</Button>
                <Button variant="outlined" onClick={() => setSnackbarOpen(true)}>スナックバーを表示</Button>
              </Box>
            </CardContent>
          </Card>

          <Typography variant="h5" gutterBottom fontWeight="bold">プログレス</Typography>
          <Card>
            <CardContent>
              <Grid container spacing={3}>
                <Grid item xs={12} sm={6}>
                  <Typography variant="subtitle1" gutterBottom fontWeight="bold">Linear Progress</Typography>
                  <LinearProgress sx={{ mb: 2 }} />
                  <LinearProgress variant="determinate" value={60} sx={{ mb: 2 }} />
                  <LinearProgress variant="buffer" value={60} valueBuffer={80} />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="subtitle1" gutterBottom fontWeight="bold">Circular Progress</Typography>
                  <Box sx={{ display: 'flex', gap: 2 }}>
                    <CircularProgress />
                    <CircularProgress variant="determinate" value={60} />
                    <CircularProgress color="secondary" />
                    <CircularProgress size={24} />
                  </Box>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Box>
      )}

      {/* データ表示 */}
      {tabValue === 5 && (
        <Box>
          <Typography variant="h5" gutterBottom fontWeight="bold">テーブル</Typography>
          <Card sx={{ mb: 4 }}>
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>ID</TableCell>
                    <TableCell>品種名</TableCell>
                    <TableCell align="right">数量</TableCell>
                    <TableCell align="right">価格</TableCell>
                    <TableCell align="center">ステータス</TableCell>
                    <TableCell align="center">操作</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {[
                    { id: 1, name: '幹之メダカ（フルボディ）', quantity: 5, price: 1500, status: '出品中' },
                    { id: 2, name: '楊貴妃メダカ（濃色）', quantity: 3, price: 800, status: '落札済' },
                    { id: 3, name: 'オロチメダカ', quantity: 4, price: 2000, status: '審査中' },
                  ].map((row) => (
                    <TableRow key={row.id} hover>
                      <TableCell>{row.id}</TableCell>
                      <TableCell>{row.name}</TableCell>
                      <TableCell align="right">{row.quantity}匹</TableCell>
                      <TableCell align="right">¥{row.price.toLocaleString()}</TableCell>
                      <TableCell align="center">
                        <Chip
                          label={row.status}
                          size="small"
                          color={row.status === '落札済' ? 'success' : row.status === '出品中' ? 'primary' : 'warning'}
                        />
                      </TableCell>
                      <TableCell align="center">
                        <IconButton size="small"><EditIcon fontSize="small" /></IconButton>
                        <IconButton size="small" color="error"><DeleteIcon fontSize="small" /></IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Card>

          <Typography variant="h5" gutterBottom fontWeight="bold">カード</Typography>
          <Grid container spacing={3} sx={{ mb: 4 }}>
            {[1, 2, 3].map((i) => (
              <Grid item xs={12} sm={6} md={4} key={i}>
                <Card>
                  <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                      <Avatar sx={{ bgcolor: 'primary.main' }}><PersonIcon /></Avatar>
                      <Box>
                        <Typography variant="subtitle1" fontWeight="bold">カードタイトル {i}</Typography>
                        <Typography variant="body2" color="text.secondary">サブタイトル</Typography>
                      </Box>
                    </Box>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                      カードの説明文がここに入ります。複数行のテキストも表示可能です。
                    </Typography>
                    <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
                      <Button size="small">キャンセル</Button>
                      <Button size="small" variant="contained">確定</Button>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>

          <Typography variant="h5" gutterBottom fontWeight="bold">リスト</Typography>
          <Card sx={{ mb: 4 }}>
            <List>
              <ListItemButton>
                <ListItemIcon><HomeIcon /></ListItemIcon>
                <ListItemText primary="ホーム" secondary="ダッシュボードに戻る" />
              </ListItemButton>
              <Divider />
              <ListItemButton selected>
                <ListItemIcon><SettingsIcon /></ListItemIcon>
                <ListItemText primary="設定" secondary="システム設定" />
              </ListItemButton>
              <Divider />
              <ListItemButton disabled>
                <ListItemIcon><PersonIcon /></ListItemIcon>
                <ListItemText primary="プロフィール" secondary="無効な項目" />
              </ListItemButton>
            </List>
          </Card>

          <Typography variant="h5" gutterBottom fontWeight="bold">アバター・バッジ</Typography>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
                <Avatar>A</Avatar>
                <Avatar sx={{ bgcolor: 'primary.main' }}>B</Avatar>
                <Avatar sx={{ bgcolor: 'secondary.main' }}>C</Avatar>
                <Avatar src="https://mui.com/static/images/avatar/1.jpg" />
                <Badge badgeContent={4} color="primary"><Avatar>D</Avatar></Badge>
                <Badge badgeContent={99} color="error" max={99}><NotificationsIcon /></Badge>
                <Badge variant="dot" color="success"><Avatar>E</Avatar></Badge>
              </Box>
            </CardContent>
          </Card>
        </Box>
      )}

      {/* ナビゲーション */}
      {tabValue === 6 && (
        <Box>
          <Typography variant="h5" gutterBottom fontWeight="bold">パンくずリスト</Typography>
          <Card sx={{ mb: 4 }}>
            <CardContent>
              <Breadcrumbs>
                <Link underline="hover" color="inherit" href="#">ホーム</Link>
                <Link underline="hover" color="inherit" href="#">オークション</Link>
                <Typography color="text.primary">詳細</Typography>
              </Breadcrumbs>
            </CardContent>
          </Card>

          <Typography variant="h5" gutterBottom fontWeight="bold">ページネーション</Typography>
          <Card sx={{ mb: 4 }}>
            <CardContent>
              <Pagination count={10} color="primary" sx={{ mb: 2 }} />
              <Pagination count={10} variant="outlined" sx={{ mb: 2 }} />
              <Pagination count={10} shape="rounded" />
            </CardContent>
          </Card>

          <Typography variant="h5" gutterBottom fontWeight="bold">ステッパー</Typography>
          <Card sx={{ mb: 4 }}>
            <CardContent>
              <Stepper activeStep={1}>
                <Step><StepLabel>基本情報</StepLabel></Step>
                <Step><StepLabel>詳細設定</StepLabel></Step>
                <Step><StepLabel>確認</StepLabel></Step>
              </Stepper>
            </CardContent>
          </Card>

          <Typography variant="h5" gutterBottom fontWeight="bold">アコーディオン</Typography>
          <Card>
            <Accordion>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography fontWeight="bold">セクション1</Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Typography>セクション1の内容がここに表示されます。</Typography>
              </AccordionDetails>
            </Accordion>
            <Accordion>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography fontWeight="bold">セクション2</Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Typography>セクション2の内容がここに表示されます。</Typography>
              </AccordionDetails>
            </Accordion>
          </Card>
        </Box>
      )}

      {/* レイアウト */}
      {tabValue === 7 && (
        <Box>
          <Typography variant="h5" gutterBottom fontWeight="bold">グリッドシステム</Typography>
          <Card sx={{ mb: 4 }}>
            <CardContent>
              <Grid container spacing={2}>
                {[12, 6, 6, 4, 4, 4, 3, 3, 3, 3, 2, 2, 2, 2, 2, 2].map((size, i) => (
                  <Grid item xs={size} key={i}>
                    <Paper sx={{ p: 2, textAlign: 'center', bgcolor: 'grey.100' }}>
                      xs={size}
                    </Paper>
                  </Grid>
                ))}
              </Grid>
            </CardContent>
          </Card>

          <Typography variant="h5" gutterBottom fontWeight="bold">シャドウ</Typography>
          <Card sx={{ mb: 4 }}>
            <CardContent>
              <Grid container spacing={2}>
                {[0, 1, 2, 3, 4, 5, 6].map((elevation) => (
                  <Grid item xs={6} sm={4} md={3} key={elevation}>
                    <Paper elevation={elevation} sx={{ p: 3, textAlign: 'center' }}>
                      elevation={elevation}
                    </Paper>
                  </Grid>
                ))}
              </Grid>
            </CardContent>
          </Card>

          <Typography variant="h5" gutterBottom fontWeight="bold">ボーダーラジウス</Typography>
          <Card>
            <CardContent>
              <Typography variant="body2" gutterBottom>
                標準ボーダーラジウス: {theme.shape.borderRadius}px
              </Typography>
              <Grid container spacing={2}>
                {[0, 4, 8, 12, 16, 24, 32].map((radius) => (
                  <Grid item xs={6} sm={4} md={3} key={radius}>
                    <Paper sx={{ p: 3, textAlign: 'center', bgcolor: 'grey.100', borderRadius: `${radius}px` }}>
                      {radius}px
                    </Paper>
                  </Grid>
                ))}
              </Grid>
            </CardContent>
          </Card>
        </Box>
      )}

      {/* ダイアログ */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>ダイアログタイトル</DialogTitle>
        <DialogContent>
          <Typography>
            これはダイアログの内容です。確認や入力を求める際に使用します。
          </Typography>
          <TextField label="入力フィールド" fullWidth sx={{ mt: 2 }} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>キャンセル</Button>
          <Button variant="contained" onClick={() => setDialogOpen(false)}>確定</Button>
        </DialogActions>
      </Dialog>

      {/* スナックバー */}
      <Snackbar
        open={snackbarOpen}
        autoHideDuration={3000}
        onClose={() => setSnackbarOpen(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert onClose={() => setSnackbarOpen(false)} severity="success">
          操作が完了しました
        </Alert>
      </Snackbar>
    </Container>
  );
}
