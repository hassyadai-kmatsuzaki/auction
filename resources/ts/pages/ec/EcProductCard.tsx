import { Box, Card, CardMedia, CardContent, Typography, Chip } from '@mui/material';
import type { EcProduct } from './ecData';

interface EcProductCardProps {
  product: EcProduct;
  onClick: (product: EcProduct) => void;
}

export default function EcProductCard({ product, onClick }: EcProductCardProps) {
  return (
    <Card
      onClick={() => onClick(product)}
      sx={{
        cursor: 'pointer',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        border: '1px solid',
        borderColor: 'grey.200',
        overflow: 'hidden',
        '&:hover': {
          transform: 'translateY(-4px)',
          boxShadow: '0 20px 40px rgba(0,0,0,0.08)',
          '& .product-image': {
            transform: 'scale(1.05)',
          },
        },
      }}
    >
      <Box sx={{ position: 'relative', overflow: 'hidden' }}>
        <CardMedia
          component="img"
          height={220}
          image={product.image}
          alt={product.name}
          className="product-image"
          sx={{
            objectFit: 'cover',
            transition: 'transform 0.5s cubic-bezier(0.4, 0, 0.2, 1)',
            filter: 'brightness(0.85)',
          }}
        />
        <Chip
          label="SOLD OUT"
          sx={{
            position: 'absolute',
            top: 12,
            right: 12,
            bgcolor: 'rgba(220, 38, 38, 0.9)',
            color: '#fff',
            fontWeight: 700,
            fontSize: '0.75rem',
            letterSpacing: '0.05em',
            backdropFilter: 'blur(4px)',
          }}
        />
        <Chip
          label={product.category}
          size="small"
          sx={{
            position: 'absolute',
            bottom: 12,
            left: 12,
            bgcolor: 'rgba(255,255,255,0.9)',
            color: 'text.primary',
            fontWeight: 600,
            fontSize: '0.7rem',
            backdropFilter: 'blur(4px)',
          }}
        />
      </Box>
      <CardContent sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', gap: 1, p: 2.5 }}>
        <Typography
          variant="body1"
          sx={{
            fontWeight: 600,
            lineHeight: 1.4,
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {product.name}
        </Typography>
        <Typography
          variant="body2"
          sx={{
            color: 'text.secondary',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
            fontSize: '0.8rem',
          }}
        >
          {product.description}
        </Typography>
        <Box sx={{ mt: 'auto', pt: 1 }}>
          <Typography
            sx={{
              fontWeight: 700,
              fontSize: '1.2rem',
              color: 'text.secondary',
              textDecoration: 'line-through',
            }}
          >
            ¥{product.price.toLocaleString()}
          </Typography>
        </Box>
      </CardContent>
    </Card>
  );
}
