import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Divider,
  Chip,
  Alert,
  CircularProgress,
  Paper,
  Breadcrumbs,
  Link as MuiLink,
  Drawer,
  useMediaQuery,
  useTheme,
  IconButton,
} from '@mui/material';
import {
  MenuBook as MenuBookIcon,
  AdminPanelSettings as AdminIcon,
  Store as SellerIcon,
  Person as ParticipantIcon,
  ArrowForward as ArrowForwardIcon,
  Home as HomeIcon,
  Dashboard as DashboardIcon,
  AddBox as AddBoxIcon,
  History as HistoryIcon,
  AccountBalance as AccountBalanceIcon,
  LocalShipping as LocalShippingIcon,
  Settings as SettingsIcon,
  Announcement as AnnouncementIcon,
  Gavel as GavelIcon,
  ShoppingCart as ShoppingCartIcon,
  Menu as MenuIcon,
  ChevronLeft as ChevronLeftIcon,
} from '@mui/icons-material';
import ReactMarkdown from 'react-markdown';
import axios from '../lib/axios';

interface ManualSection {
  id: string;
  title: string;
  icon: React.ReactNode;
  content: string;
}

interface Manual {
  id: string;
  title: string;
  role: 'admin' | 'seller' | 'participant' | 'all';
  description: string;
  content?: string;
  icon: React.ReactNode;
  badge?: string;
  sections?: ManualSection[];
}

interface ManualViewerProps {
  userRole: 'admin' | 'seller' | 'participant';
}

// 出品者マニュアルのセクション定義
const SELLER_SECTIONS: Omit<ManualSection, 'content'>[] = [
  { id: 'dashboard', title: 'ダッシュボードの確認', icon: <DashboardIcon /> },
  { id: 'submit', title: '出品申込', icon: <AddBoxIcon /> },
  { id: 'items', title: '出品履歴', icon: <HistoryIcon /> },
  { id: 'sales', title: '売上・精算', icon: <AccountBalanceIcon /> },
  { id: 'shipping', title: '配送状況', icon: <LocalShippingIcon /> },
  { id: 'profile', title: '出品者情報・設定', icon: <SettingsIcon /> },
];

// 管理者マニュアルのセクション定義
const ADMIN_SECTIONS: Omit<ManualSection, 'content'>[] = [
  { id: 'dashboard', title: 'ダッシュボードの確認', icon: <DashboardIcon /> },
  { id: 'announcements', title: 'お知らせ管理', icon: <AnnouncementIcon /> },
  { id: 'auctions', title: 'オークション管理', icon: <GavelIcon /> },
  { id: 'items', title: '商品管理', icon: <ShoppingCartIcon /> },
  { id: 'users', title: 'ユーザー管理', icon: <ParticipantIcon /> },
  { id: 'settings', title: 'システム設定', icon: <SettingsIcon /> },
];

// 参加者マニュアルのセクション定義
const PARTICIPANT_SECTIONS: Omit<ManualSection, 'content'>[] = [
  { id: 'home', title: 'ホーム画面', icon: <HomeIcon /> },
  { id: 'auctions', title: 'オークション一覧', icon: <GavelIcon /> },
  { id: 'live', title: 'ライブオークション', icon: <MenuBookIcon /> },
  { id: 'won-items', title: '落札一覧', icon: <ShoppingCartIcon /> },
  { id: 'settings', title: '設定', icon: <SettingsIcon /> },
];

const MANUALS: Manual[] = [
  {
    id: 'seller',
    title: '出品者マニュアル',
    role: 'seller',
    description: '商品出品から精算までの完全な手順',
    icon: <SellerIcon />,
    badge: '出品者',
  },
  {
    id: 'announcements',
    title: 'お知らせ管理マニュアル',
    role: 'admin',
    description: 'お知らせの作成、編集、削除の詳細手順',
    icon: <AdminIcon />,
    badge: '管理者',
  },
  {
    id: 'participant',
    title: '参加者マニュアル',
    role: 'participant',
    description: 'オークション参加から落札確認までの手順',
    icon: <ParticipantIcon />,
    badge: '参加者',
  },
];

const DRAWER_WIDTH = 280;

export default function ManualViewer({ userRole }: ManualViewerProps) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [selectedManual, setSelectedManual] = useState<string | null>(null);
  const [selectedSection, setSelectedSection] = useState<string | null>(null);
  const [manualContent, setManualContent] = useState<string>('');
  const [parsedSections, setParsedSections] = useState<ManualSection[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);

  // ユーザーロールに応じたマニュアルをフィルタリング
  const availableManuals = MANUALS.filter(
    (manual) => manual.role === 'all' || manual.role === userRole
  );

  // ロールに応じたセクション定義を取得
  const getSectionDefinitions = () => {
    switch (userRole) {
      case 'seller':
        return SELLER_SECTIONS;
      case 'admin':
        return ADMIN_SECTIONS;
      case 'participant':
        return PARTICIPANT_SECTIONS;
      default:
        return [];
    }
  };

  useEffect(() => {
    if (selectedManual) {
      loadManual(selectedManual);
    }
  }, [selectedManual]);

  // マークダウンをセクションに分割
  const parseMarkdownSections = (content: string, sectionDefs: Omit<ManualSection, 'content'>[]) => {
    const sections: ManualSection[] = [];
    const lines = content.split('\n');
    let currentSection: ManualSection | null = null;
    let currentContent: string[] = [];
    let overviewContent: string[] = [];
    let inOverview = true;

    for (const line of lines) {
      // ## から始まる見出しを検出
      if (line.startsWith('## ')) {
        // 前のセクションを保存
        if (currentSection) {
          currentSection.content = currentContent.join('\n');
          sections.push(currentSection);
        } else if (inOverview) {
          inOverview = false;
        }

        // 新しいセクションを開始
        const title = line.replace('## ', '').replace(/ステップ \d+: /, '').trim();
        
        // セクション定義からマッチするものを探す
        const matchedDef = sectionDefs.find(def => 
          title.includes(def.title) || 
          def.title.includes(title.split('（')[0]) ||
          matchSectionByKeywords(title, def.id)
        );

        if (matchedDef) {
          currentSection = {
            ...matchedDef,
            content: '',
          };
        } else {
          // マッチしない場合は新しいセクションとして追加
          currentSection = {
            id: title.toLowerCase().replace(/\s+/g, '-'),
            title: title,
            icon: <MenuBookIcon />,
            content: '',
          };
        }
        currentContent = [];
      } else {
        if (currentSection) {
          currentContent.push(line);
        } else if (inOverview) {
          overviewContent.push(line);
        }
      }
    }

    // 最後のセクションを保存
    if (currentSection) {
      currentSection.content = currentContent.join('\n');
      sections.push(currentSection);
    }

    // 概要セクションを先頭に追加
    if (overviewContent.length > 0) {
      sections.unshift({
        id: 'overview',
        title: '概要',
        icon: <MenuBookIcon />,
        content: overviewContent.join('\n'),
      });
    }

    return sections;
  };

  // セクションIDとキーワードのマッチング
  const matchSectionByKeywords = (title: string, sectionId: string): boolean => {
    const keywords: Record<string, string[]> = {
      dashboard: ['ダッシュボード', '統計', 'ホーム'],
      submit: ['出品申請', '出品申込', '申請', '品種名', 'オークション選択'],
      items: ['出品履歴', '商品一覧', '出品詳細', '履歴'],
      sales: ['売上', '精算', '収益'],
      shipping: ['発送', '配送', '出荷'],
      profile: ['プロフィール', '設定', '情報'],
      announcements: ['お知らせ', '通知'],
      auctions: ['オークション', '入札'],
      users: ['ユーザー', '会員'],
      home: ['ホーム', 'トップ'],
      live: ['ライブ', 'リアルタイム'],
      'won-items': ['落札', '購入', '落札一覧'],
      settings: ['設定'],
    };

    const matchKeywords = keywords[sectionId] || [];
    return matchKeywords.some(kw => title.includes(kw));
  };

  const loadManual = async (manualId: string) => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await axios.get(`/api/manuals/${manualId}`);
      
      if (response.data.success) {
        const content = response.data.data.content;
        setManualContent(content);
        
        // セクションに分割
        const sectionDefs = getSectionDefinitions();
        const sections = parseMarkdownSections(content, sectionDefs);
        setParsedSections(sections);
        
        // 最初のセクションを選択
        if (sections.length > 0) {
          setSelectedSection(sections[0].id);
        }
      }
    } catch (err: any) {
      console.error('マニュアル取得エラー:', err);
      setError('マニュアルの読み込みに失敗しました');
      
      // フォールバック
      const manual = MANUALS.find(m => m.id === manualId);
      if (manual) {
        const content = getSampleContent(manual);
        setManualContent(content);
        setParsedSections([{
          id: 'overview',
          title: '概要',
          icon: <MenuBookIcon />,
          content: content,
        }]);
        setSelectedSection('overview');
      }
    } finally {
      setLoading(false);
    }
  };

  const getSampleContent = (manual: Manual): string => {
    return `# ${manual.title}

**自動生成日**: ${new Date().toLocaleDateString('ja-JP')}

> このマニュアルはE2Eテストから自動生成されています。

---

## 📋 概要

${manual.description}

---

## 🎬 動画マニュアル

各機能の操作動画が用意されています。

---

## 📸 スクリーンショット付き手順

各ステップごとに詳細なスクリーンショットが用意されています。

---

## 📝 注意事項

- このマニュアルは常に最新の画面に基づいて自動生成されています
- 不明な点がある場合は、動画を参照してください
- 実際の操作と異なる場合は、管理者にお問い合わせください

---

## 🚀 次のステップ

実際の画面で操作を試してみましょう！
`;
  };

  // 現在選択されているセクションのコンテンツを取得
  const getCurrentSectionContent = (): string => {
    if (!selectedSection) return manualContent;
    const section = parsedSections.find(s => s.id === selectedSection);
    return section?.content || manualContent;
  };

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  // サイドナビゲーションのコンテンツ
  const drawerContent = (
    <Box>
      {/* ヘッダー */}
      <Box
        sx={{
          p: 2,
          borderBottom: '1px solid',
          borderColor: 'divider',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Typography variant="h6" sx={{ fontWeight: 600, fontSize: '1rem' }}>
          📚 目次
        </Typography>
        {isMobile && (
          <IconButton onClick={handleDrawerToggle} size="small">
            <ChevronLeftIcon />
          </IconButton>
        )}
      </Box>

      {/* セクション一覧 */}
      <List sx={{ p: 1 }}>
        {parsedSections.map((section) => (
          <ListItem key={section.id} disablePadding sx={{ mb: 0.5 }}>
            <ListItemButton
              selected={selectedSection === section.id}
              onClick={() => {
                setSelectedSection(section.id);
                if (isMobile) setMobileOpen(false);
              }}
              sx={{
                borderRadius: 1,
                py: 1.5,
                '&.Mui-selected': {
                  bgcolor: 'primary.main',
                  color: 'white',
                  '&:hover': {
                    bgcolor: 'primary.dark',
                  },
                  '& .MuiListItemIcon-root': {
                    color: 'white',
                  },
                },
              }}
            >
              <ListItemIcon sx={{ minWidth: 40 }}>
                {section.icon}
              </ListItemIcon>
              <ListItemText 
                primary={section.title}
                primaryTypographyProps={{
                  fontSize: '0.9rem',
                  fontWeight: selectedSection === section.id ? 600 : 400,
                }}
              />
            </ListItemButton>
          </ListItem>
        ))}
      </List>

      {/* 戻るボタン */}
      <Divider sx={{ my: 2 }} />
      <Box sx={{ px: 2, pb: 2 }}>
        <ListItemButton
          onClick={() => {
            setSelectedManual(null);
            setSelectedSection(null);
            setParsedSections([]);
          }}
          sx={{
            borderRadius: 1,
            bgcolor: 'grey.100',
            '&:hover': {
              bgcolor: 'grey.200',
            },
          }}
        >
          <ListItemIcon sx={{ minWidth: 40 }}>
            <ChevronLeftIcon />
          </ListItemIcon>
          <ListItemText 
            primary="マニュアル一覧に戻る"
            primaryTypographyProps={{ fontSize: '0.85rem' }}
          />
        </ListItemButton>
      </Box>
    </Box>
  );

  if (selectedManual) {
    const manual = MANUALS.find(m => m.id === selectedManual);
    const currentSection = parsedSections.find(s => s.id === selectedSection);
    
    return (
      <Box sx={{ display: 'flex', minHeight: 'calc(100vh - 200px)' }}>
        {/* モバイル用ドロワー */}
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={handleDrawerToggle}
          ModalProps={{ keepMounted: true }}
          sx={{
            display: { xs: 'block', md: 'none' },
            '& .MuiDrawer-paper': { 
              boxSizing: 'border-box', 
              width: DRAWER_WIDTH,
            },
          }}
        >
          {drawerContent}
        </Drawer>

        {/* デスクトップ用サイドバー */}
        <Card
          sx={{
            display: { xs: 'none', md: 'block' },
            width: DRAWER_WIDTH,
            flexShrink: 0,
            mr: 3,
            height: 'fit-content',
            position: 'sticky',
            top: 20,
          }}
        >
          {drawerContent}
        </Card>

        {/* メインコンテンツ */}
        <Box sx={{ flexGrow: 1, minWidth: 0 }}>
          {/* モバイル用ヘッダー */}
          {isMobile && (
            <Card sx={{ mb: 2, p: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <IconButton onClick={handleDrawerToggle} edge="start">
                  <MenuIcon />
                </IconButton>
                <Typography variant="h6" sx={{ fontWeight: 600 }}>
                  {currentSection?.title || manual?.title}
                </Typography>
              </Box>
            </Card>
          )}

          {/* パンくずリスト（デスクトップ） */}
          {!isMobile && (
            <Breadcrumbs sx={{ mb: 3 }}>
              <MuiLink
                component="button"
                variant="body1"
                onClick={() => {
                  setSelectedManual(null);
                  setSelectedSection(null);
                  setParsedSections([]);
                }}
                sx={{ display: 'flex', alignItems: 'center', textDecoration: 'none' }}
              >
                <HomeIcon sx={{ mr: 0.5, fontSize: 20 }} />
                マニュアル一覧
              </MuiLink>
              <Typography color="text.secondary">{manual?.title}</Typography>
              {currentSection && (
                <Typography color="text.primary">{currentSection.title}</Typography>
              )}
            </Breadcrumbs>
          )}

          {/* マニュアルコンテンツ */}
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
              <CircularProgress />
            </Box>
          ) : error ? (
            <Alert severity="error" sx={{ mb: 3 }}>
              {error}
            </Alert>
          ) : (
            <Card>
              <CardContent sx={{ p: { xs: 2, md: 4 } }}>
                {/* セクションタイトル */}
                {currentSection && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
                    <Box
                      sx={{
                        width: 48,
                        height: 48,
                        borderRadius: 2,
                        bgcolor: 'primary.main',
                        color: 'white',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      {currentSection.icon}
                    </Box>
                    <Box>
                      <Typography variant="h5" sx={{ fontWeight: 700 }}>
                        {currentSection.title}
                      </Typography>
                      <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                        {manual?.title}
                      </Typography>
                    </Box>
                  </Box>
                )}
                
                <Divider sx={{ mb: 3 }} />

                <Paper
                  elevation={0}
                  sx={{
                    '& h1': { fontSize: '1.75rem', fontWeight: 700, mb: 2 },
                    '& h2': { fontSize: '1.5rem', fontWeight: 600, mt: 4, mb: 2, color: '#059669' },
                    '& h3': { fontSize: '1.25rem', fontWeight: 600, mt: 3, mb: 1.5 },
                    '& p': { mb: 2, lineHeight: 1.8 },
                    '& ul, & ol': { mb: 2, pl: 3 },
                    '& li': { mb: 1 },
                    '& code': { 
                      bgcolor: 'grey.100', 
                      px: 1, 
                      py: 0.5, 
                      borderRadius: 1,
                      fontSize: '0.875rem',
                    },
                    '& pre': { 
                      bgcolor: 'grey.900', 
                      color: 'white', 
                      p: 2, 
                      borderRadius: 1, 
                      overflow: 'auto',
                      mb: 2,
                    },
                    '& blockquote': {
                      borderLeft: '4px solid #059669',
                      pl: 2,
                      py: 1,
                      bgcolor: 'grey.50',
                      mb: 2,
                    },
                    '& img': {
                      maxWidth: '100%',
                      height: 'auto',
                      borderRadius: 1,
                      boxShadow: 1,
                      my: 2,
                    },
                    '& hr': {
                      my: 3,
                      borderColor: 'grey.300',
                    },
                  }}
                >
                  <ReactMarkdown>{getCurrentSectionContent()}</ReactMarkdown>
                </Paper>
              </CardContent>
            </Card>
          )}

          {/* 前後のセクションへのナビゲーション */}
          {parsedSections.length > 1 && (
            <Card sx={{ mt: 3, p: 2 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                {(() => {
                  const currentIndex = parsedSections.findIndex(s => s.id === selectedSection);
                  const prevSection = currentIndex > 0 ? parsedSections[currentIndex - 1] : null;
                  const nextSection = currentIndex < parsedSections.length - 1 ? parsedSections[currentIndex + 1] : null;

                  return (
                    <>
                      {prevSection ? (
                        <ListItemButton
                          onClick={() => setSelectedSection(prevSection.id)}
                          sx={{ borderRadius: 1, maxWidth: '45%' }}
                        >
                          <ChevronLeftIcon sx={{ mr: 1 }} />
                          <Box>
                            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                              前へ
                            </Typography>
                            <Typography variant="body2" sx={{ fontWeight: 600 }}>
                              {prevSection.title}
                            </Typography>
                          </Box>
                        </ListItemButton>
                      ) : (
                        <Box />
                      )}
                      {nextSection ? (
                        <ListItemButton
                          onClick={() => setSelectedSection(nextSection.id)}
                          sx={{ borderRadius: 1, maxWidth: '45%', textAlign: 'right' }}
                        >
                          <Box>
                            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                              次へ
                            </Typography>
                            <Typography variant="body2" sx={{ fontWeight: 600 }}>
                              {nextSection.title}
                            </Typography>
                          </Box>
                          <ArrowForwardIcon sx={{ ml: 1 }} />
                        </ListItemButton>
                      ) : (
                        <Box />
                      )}
                    </>
                  );
                })()}
              </Box>
            </Card>
          )}
        </Box>
      </Box>
    );
  }

  // マニュアル一覧
  return (
    <Box>
      {/* ヘッダー */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" sx={{ fontWeight: 700, mb: 1 }}>
          操作マニュアル
        </Typography>
        <Typography variant="body1" sx={{ color: 'text.secondary' }}>
          各機能の使い方を動画とスクリーンショット付きで確認できます
        </Typography>
      </Box>

      {/* 特徴 */}
      <Alert severity="info" sx={{ mb: 4 }}>
        <Typography variant="body2" sx={{ fontWeight: 600, mb: 1 }}>
          📚 E2Eテストから自動生成
        </Typography>
        <Typography variant="body2">
          このマニュアルは実際の操作テストから自動生成されているため、常に最新の画面と手順が反映されています。
        </Typography>
      </Alert>

      {/* マニュアル一覧 */}
      <Card>
        <CardContent sx={{ p: 0 }}>
          <List sx={{ p: 0 }}>
            {availableManuals.map((manual, index) => (
              <React.Fragment key={manual.id}>
                {index > 0 && <Divider />}
                <ListItem disablePadding>
                  <ListItemButton
                    onClick={() => setSelectedManual(manual.id)}
                    sx={{
                      py: 2.5,
                      px: 3,
                      '&:hover': {
                        bgcolor: 'grey.50',
                      },
                    }}
                  >
                    <ListItemIcon sx={{ minWidth: 48 }}>
                      <Box
                        sx={{
                          width: 40,
                          height: 40,
                          borderRadius: 2,
                          bgcolor: 'primary.main',
                          color: 'white',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        {manual.icon}
                      </Box>
                    </ListItemIcon>
                    <ListItemText
                      primary={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                          <Typography variant="h6" sx={{ fontWeight: 600 }}>
                            {manual.title}
                          </Typography>
                          {manual.badge && (
                            <Chip
                              label={manual.badge}
                              size="small"
                              color={
                                manual.role === 'admin' ? 'error' :
                                manual.role === 'seller' ? 'warning' :
                                manual.role === 'participant' ? 'info' : 'default'
                              }
                            />
                          )}
                        </Box>
                      }
                      secondary={
                        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                          {manual.description}
                        </Typography>
                      }
                    />
                    <ArrowForwardIcon sx={{ color: 'text.secondary' }} />
                  </ListItemButton>
                </ListItem>
              </React.Fragment>
            ))}
          </List>
        </CardContent>
      </Card>

      {/* フッター情報 */}
      <Card sx={{ mt: 3, bgcolor: 'grey.50' }}>
        <CardContent>
          <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
            💡 マニュアルの特徴
          </Typography>
          <List dense>
            <ListItem sx={{ py: 0.5 }}>
              <Typography variant="body2">
                • 動画とスクリーンショット付きで視覚的にわかりやすい
              </Typography>
            </ListItem>
            <ListItem sx={{ py: 0.5 }}>
              <Typography variant="body2">
                • 実際に動作する手順のみを掲載（E2Eテストで検証済み）
              </Typography>
            </ListItem>
            <ListItem sx={{ py: 0.5 }}>
              <Typography variant="body2">
                • UI変更時に自動更新されるため、常に最新
              </Typography>
            </ListItem>
          </List>
        </CardContent>
      </Card>
    </Box>
  );
}
