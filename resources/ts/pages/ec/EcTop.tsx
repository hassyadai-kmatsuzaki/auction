import { useState, useMemo } from 'react';
import {
  Box,
  Container,
  Typography,
  Grid,
  Chip,
  AppBar,
  Toolbar,
  IconButton,
  InputBase,
  Fade,
  Link as MuiLink,
  Divider,
  useMediaQuery,
  useTheme,
  Drawer,
  List,
  ListItemButton,
  ListItemText,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import MenuIcon from '@mui/icons-material/Menu';
import StorefrontIcon from '@mui/icons-material/Storefront';
import WaterDropOutlinedIcon from '@mui/icons-material/WaterDropOutlined';
import LocalShippingOutlinedIcon from '@mui/icons-material/LocalShippingOutlined';
import VerifiedOutlinedIcon from '@mui/icons-material/VerifiedOutlined';
import SupportAgentOutlinedIcon from '@mui/icons-material/SupportAgentOutlined';
import { EC_PRODUCTS, EC_CATEGORIES } from './ecData';
import type { EcProduct } from './ecData';
import EcProductCard from './EcProductCard';
import EcProductDetail from './EcProductDetail';
import EcLegalModals from './EcLegalModals';

type LegalType = 'tokushoho' | 'privacy' | 'terms' | 'refund' | null;

export default function EcTop() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [selectedCategory, setSelectedCategory] = useState('すべて');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<EcProduct | null>(null);
  const [legalModal, setLegalModal] = useState<LegalType>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const filteredProducts = useMemo(() => {
    return EC_PRODUCTS.filter((p) => {
      const matchCategory = selectedCategory === 'すべて' || p.category === selectedCategory;
      const matchSearch =
        !searchQuery ||
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.category.toLowerCase().includes(searchQuery.toLowerCase());
      return matchCategory && matchSearch;
    });
  }, [selectedCategory, searchQuery]);

  const features = [
    { icon: <WaterDropOutlinedIcon />, title: '厳選された個体', desc: '品質にこだわった個体のみを出品' },
    { icon: <LocalShippingOutlinedIcon />, title: '安心の生体配送', desc: '専用パッキングで安全にお届け' },
    { icon: <VerifiedOutlinedIcon />, title: '死着保証', desc: '万が一の場合も安心の保証付き' },
    { icon: <SupportAgentOutlinedIcon />, title: '飼育サポート', desc: '初心者の方もお気軽にご相談' },
  ];

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#FAFBFC' }}>
      {/* Header */}
      <AppBar
        position="sticky"
        elevation={0}
        sx={{
          bgcolor: '#fff',
          borderBottom: '1px solid',
          borderColor: 'grey.200',
        }}
      >
        <Container maxWidth="lg">
          <Toolbar disableGutters sx={{ height: 64, gap: 2 }}>
            {isMobile && (
              <IconButton edge="start" onClick={() => setMobileMenuOpen(true)}>
                <MenuIcon />
              </IconButton>
            )}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <StorefrontIcon sx={{ color: '#0F172A', fontSize: 28 }} />
              <Typography
                variant="h6"
                sx={{
                  fontWeight: 800,
                  color: '#0F172A',
                  letterSpacing: '-0.02em',
                  fontSize: { xs: '1rem', sm: '1.15rem' },
                }}
              >
                MEDAKA AUCTION
              </Typography>
            </Box>

            <Box sx={{ flexGrow: 1 }} />

            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                bgcolor: 'grey.100',
                borderRadius: 2,
                px: 1.5,
                py: 0.5,
                width: { xs: 160, sm: 280 },
              }}
            >
              <SearchIcon sx={{ color: 'grey.500', fontSize: 20, mr: 1 }} />
              <InputBase
                placeholder="品種を検索..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                sx={{ fontSize: '0.875rem', width: '100%' }}
              />
            </Box>
          </Toolbar>
        </Container>
      </AppBar>

      {/* Mobile Drawer */}
      <Drawer
        anchor="left"
        open={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
        PaperProps={{ sx: { width: 260 } }}
      >
        <Box sx={{ p: 2 }}>
          <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>カテゴリ</Typography>
          <List>
            {EC_CATEGORIES.map((cat) => (
              <ListItemButton
                key={cat}
                selected={selectedCategory === cat}
                onClick={() => {
                  setSelectedCategory(cat);
                  setMobileMenuOpen(false);
                }}
                sx={{ borderRadius: 2, mb: 0.5 }}
              >
                <ListItemText primary={cat} />
              </ListItemButton>
            ))}
          </List>
        </Box>
      </Drawer>

      {/* Hero */}
      <Box
        sx={{
          background: 'linear-gradient(135deg, #0F172A 0%, #1E293B 50%, #334155 100%)',
          color: '#fff',
          py: { xs: 6, md: 10 },
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            background: 'radial-gradient(circle at 70% 30%, rgba(59,130,246,0.15) 0%, transparent 50%), radial-gradient(circle at 20% 80%, rgba(5,150,105,0.1) 0%, transparent 50%)',
          }}
        />
        <Container maxWidth="lg" sx={{ position: 'relative', zIndex: 1 }}>
          <Fade in timeout={800}>
            <Box sx={{ textAlign: 'center', maxWidth: 700, mx: 'auto' }}>
              <Typography
                variant="h2"
                sx={{
                  fontWeight: 800,
                  mb: 2,
                  fontSize: { xs: '1.75rem', sm: '2.5rem', md: '3rem' },
                  letterSpacing: '-0.03em',
                  lineHeight: 1.2,
                }}
              >
                厳選されたメダカを
                <br />
                あなたのもとへ
              </Typography>
              <Typography
                sx={{
                  color: 'rgba(255,255,255,0.7)',
                  fontSize: { xs: '0.9rem', sm: '1.1rem' },
                  lineHeight: 1.7,
                  mb: 4,
                }}
              >
                MEDAKA AUCTIONが厳選した高品質なメダカをお届けします。
                <br />
                希少品種から定番品種まで、幅広いラインナップをご用意。
              </Typography>

              <Grid container spacing={2} justifyContent="center">
                {features.map((f) => (
                  <Grid item xs={6} sm={3} key={f.title}>
                    <Box
                      sx={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: 1,
                        p: 2,
                        borderRadius: 2,
                        bgcolor: 'rgba(255,255,255,0.06)',
                        backdropFilter: 'blur(8px)',
                        border: '1px solid rgba(255,255,255,0.1)',
                      }}
                    >
                      <Box sx={{ color: 'rgba(255,255,255,0.8)' }}>{f.icon}</Box>
                      <Typography sx={{ fontWeight: 600, fontSize: '0.8rem' }}>{f.title}</Typography>
                      <Typography sx={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.5)', lineHeight: 1.4 }}>
                        {f.desc}
                      </Typography>
                    </Box>
                  </Grid>
                ))}
              </Grid>
            </Box>
          </Fade>
        </Container>
      </Box>

      {/* Category Filter */}
      <Container maxWidth="lg" sx={{ mt: 4, mb: 2 }}>
        <Box
          sx={{
            display: 'flex',
            gap: 1,
            flexWrap: 'wrap',
            justifyContent: 'center',
          }}
        >
          {EC_CATEGORIES.map((cat) => (
            <Chip
              key={cat}
              label={cat}
              onClick={() => setSelectedCategory(cat)}
              variant={selectedCategory === cat ? 'filled' : 'outlined'}
              sx={{
                fontWeight: 600,
                fontSize: '0.8rem',
                borderRadius: '20px',
                px: 1,
                ...(selectedCategory === cat
                  ? {
                      bgcolor: '#0F172A',
                      color: '#fff',
                      '&:hover': { bgcolor: '#1E293B' },
                    }
                  : {
                      borderColor: 'grey.300',
                      color: 'text.secondary',
                      '&:hover': { bgcolor: 'grey.100' },
                    }),
              }}
            />
          ))}
        </Box>
      </Container>

      {/* Products */}
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Typography variant="h5" sx={{ fontWeight: 700 }}>
            {selectedCategory === 'すべて' ? '全商品' : selectedCategory}
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            {filteredProducts.length}件の商品
          </Typography>
        </Box>

        {filteredProducts.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 8 }}>
            <Typography variant="h6" sx={{ color: 'text.secondary', mb: 1 }}>
              該当する商品が見つかりませんでした
            </Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              別のカテゴリや検索キーワードをお試しください
            </Typography>
          </Box>
        ) : (
          <Grid container spacing={3}>
            {filteredProducts.map((product) => (
              <Grid item xs={12} sm={6} md={4} lg={3} key={product.id}>
                <Fade in timeout={500}>
                  <Box>
                    <EcProductCard product={product} onClick={setSelectedProduct} />
                  </Box>
                </Fade>
              </Grid>
            ))}
          </Grid>
        )}
      </Container>

      {/* Footer */}
      <Box
        sx={{
          bgcolor: '#0F172A',
          color: '#fff',
          mt: 8,
        }}
      >
        <Container maxWidth="lg" sx={{ py: 6 }}>
          <Grid container spacing={4}>
            <Grid item xs={12} md={4}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <StorefrontIcon sx={{ fontSize: 24 }} />
                <Typography sx={{ fontWeight: 800, fontSize: '1.1rem' }}>MEDAKA AUCTION</Typography>
              </Box>
              <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.6)', lineHeight: 1.7, fontSize: '0.8rem' }}>
                厳選されたメダカを安心・安全にお届けする
                オンラインショップです。希少品種から定番品種まで、
                幅広いラインナップをご用意しております。
              </Typography>
            </Grid>

            <Grid item xs={6} md={2}>
              <Typography sx={{ fontWeight: 600, mb: 2, fontSize: '0.85rem' }}>ショップ</Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                <MuiLink
                  component="button"
                  onClick={() => {
                    setSelectedCategory('すべて');
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  sx={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.8rem', textAlign: 'left', textDecoration: 'none', '&:hover': { color: '#fff' } }}
                >
                  全商品
                </MuiLink>
              </Box>
            </Grid>

            <Grid item xs={6} md={3}>
              <Typography sx={{ fontWeight: 600, mb: 2, fontSize: '0.85rem' }}>法的情報</Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                {([
                  ['tokushoho', '特定商取引法に基づく表記'],
                  ['privacy', 'プライバシーポリシー'],
                  ['terms', '利用規約'],
                  ['refund', '返金ポリシー'],
                ] as const).map(([key, label]) => (
                  <MuiLink
                    key={key}
                    component="button"
                    onClick={() => setLegalModal(key)}
                    sx={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.8rem', textAlign: 'left', textDecoration: 'none', '&:hover': { color: '#fff' } }}
                  >
                    {label}
                  </MuiLink>
                ))}
              </Box>
            </Grid>

            <Grid item xs={12} md={3}>
              <Typography sx={{ fontWeight: 600, mb: 2, fontSize: '0.85rem' }}>お問い合わせ</Typography>
              <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.8rem', lineHeight: 1.7 }}>
                info@medaka-auction.com
                <br />
                受付時間：平日 10:00〜17:00
              </Typography>
            </Grid>
          </Grid>

          <Divider sx={{ borderColor: 'rgba(255,255,255,0.1)', my: 4 }} />

          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.75rem' }}>
              © {new Date().getFullYear()} MEDAKA AUCTION. All rights reserved.
            </Typography>
            <Box sx={{ display: 'flex', gap: 2 }}>
              {([
                ['tokushoho', '特商法'],
                ['privacy', 'プライバシー'],
                ['terms', '利用規約'],
                ['refund', '返金'],
              ] as const).map(([key, label]) => (
                <MuiLink
                  key={key}
                  component="button"
                  onClick={() => setLegalModal(key)}
                  sx={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.7rem', textDecoration: 'none', '&:hover': { color: '#fff' } }}
                >
                  {label}
                </MuiLink>
              ))}
            </Box>
          </Box>
        </Container>
      </Box>

      {/* Modals */}
      <EcProductDetail product={selectedProduct} onClose={() => setSelectedProduct(null)} />
      <EcLegalModals open={legalModal} onClose={() => setLegalModal(null)} />
    </Box>
  );
}
