import {
  Dialog,
  DialogContent,
  Box,
  Typography,
  Chip,
  Button,
  IconButton,
  Divider,
  Grid,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import LocalShippingOutlinedIcon from '@mui/icons-material/LocalShippingOutlined';
import VerifiedOutlinedIcon from '@mui/icons-material/VerifiedOutlined';
import type { EcProduct } from './ecData';

interface EcProductDetailProps {
  product: EcProduct | null;
  onClose: () => void;
}

export default function EcProductDetail({ product, onClose }: EcProductDetailProps) {
  if (!product) return null;

  const specRows = [
    ['サイズ', product.specs.size],
    ['月齢', product.specs.age],
    ['性別', product.specs.gender],
    ['産地', product.specs.origin],
  ];

  return (
    <Dialog
      open={!!product}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      scroll="paper"
      PaperProps={{
        sx: { borderRadius: 3, overflow: 'hidden' },
      }}
    >
      <IconButton
        onClick={onClose}
        sx={{
          position: 'absolute',
          top: 12,
          right: 12,
          zIndex: 10,
          bgcolor: 'rgba(255,255,255,0.9)',
          backdropFilter: 'blur(4px)',
          '&:hover': { bgcolor: 'rgba(255,255,255,1)' },
        }}
      >
        <CloseIcon />
      </IconButton>

      <DialogContent sx={{ p: 0 }}>
        <Grid container>
          <Grid item xs={12} md={6}>
            <Box sx={{ position: 'relative' }}>
              <Box
                component="img"
                src={product.image}
                alt={product.name}
                sx={{
                  width: '100%',
                  height: { xs: 280, md: 420 },
                  objectFit: 'cover',
                  display: 'block',
                  filter: 'brightness(0.85)',
                }}
              />
              <Chip
                label="SOLD OUT"
                sx={{
                  position: 'absolute',
                  top: 16,
                  left: 16,
                  bgcolor: 'rgba(220, 38, 38, 0.9)',
                  color: '#fff',
                  fontWeight: 700,
                  fontSize: '0.85rem',
                  py: 0.5,
                  backdropFilter: 'blur(4px)',
                }}
              />
            </Box>
          </Grid>

          <Grid item xs={12} md={6}>
            <Box sx={{ p: { xs: 3, md: 4 }, display: 'flex', flexDirection: 'column', height: '100%' }}>
              <Chip
                label={product.category}
                size="small"
                sx={{
                  alignSelf: 'flex-start',
                  mb: 2,
                  bgcolor: 'grey.100',
                  fontWeight: 600,
                  fontSize: '0.75rem',
                }}
              />

              <Typography variant="h5" sx={{ fontWeight: 700, mb: 1, lineHeight: 1.3 }}>
                {product.name}
              </Typography>

              <Typography
                sx={{
                  fontWeight: 700,
                  fontSize: '1.5rem',
                  color: 'text.secondary',
                  textDecoration: 'line-through',
                  mb: 2,
                }}
              >
                ¥{product.price.toLocaleString()}
                <Typography component="span" sx={{ fontSize: '0.85rem', ml: 0.5 }}>
                  (税込)
                </Typography>
              </Typography>

              <Typography variant="body2" sx={{ color: 'text.secondary', mb: 3, lineHeight: 1.7 }}>
                {product.description}
              </Typography>

              <Divider sx={{ mb: 2 }} />

              <Box sx={{ mb: 3 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1.5, color: 'text.primary', fontSize: '0.85rem' }}>
                  商品スペック
                </Typography>
                {specRows.map(([label, value]) => (
                  <Box key={label} sx={{ display: 'flex', py: 0.5 }}>
                    <Typography variant="body2" sx={{ color: 'text.secondary', minWidth: 80, fontSize: '0.8rem' }}>
                      {label}
                    </Typography>
                    <Typography variant="body2" sx={{ fontWeight: 500, fontSize: '0.8rem' }}>
                      {value}
                    </Typography>
                  </Box>
                ))}
              </Box>

              <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <LocalShippingOutlinedIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
                  <Typography variant="body2" sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>
                    安心の生体配送
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <VerifiedOutlinedIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
                  <Typography variant="body2" sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>
                    死着保証あり
                  </Typography>
                </Box>
              </Box>

              <Box sx={{ mt: 'auto' }}>
                <Button
                  fullWidth
                  variant="contained"
                  disabled
                  sx={{
                    py: 1.5,
                    fontSize: '1rem',
                    fontWeight: 700,
                    borderRadius: 2,
                    bgcolor: 'grey.300',
                    color: 'grey.500',
                    '&.Mui-disabled': {
                      bgcolor: 'grey.200',
                      color: 'grey.500',
                    },
                  }}
                >
                  現在売り切れ中です
                </Button>
              </Box>
            </Box>
          </Grid>
        </Grid>
      </DialogContent>
    </Dialog>
  );
}
