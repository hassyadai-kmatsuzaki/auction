import { Card, CardContent, CardMedia, Typography, Chip, Box } from '@mui/material';
import { Star as StarIcon, DragIndicator as DragIndicatorIcon } from '@mui/icons-material';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { SellerOrderItem } from '../api/sellerOrderApi';

interface ItemCardProps {
  item: SellerOrderItem;
}

export default function ItemCard({ item }: ItemCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const thumbnailUrl = item.thumbnail_path
    ? `/storage/${item.thumbnail_path}`
    : '/images/no-image.png';

  return (
    <Card
      ref={setNodeRef}
      style={style}
      sx={{
        minWidth: 180,
        maxWidth: 180,
        cursor: isDragging ? 'grabbing' : 'grab',
        position: 'relative',
      }}
    >
      <Box
        {...attributes}
        {...listeners}
        sx={{
          position: 'absolute',
          top: 8,
          left: 8,
          zIndex: 1,
          backgroundColor: 'rgba(255, 255, 255, 0.9)',
          borderRadius: 1,
          padding: 0.5,
          cursor: 'grab',
          '&:active': {
            cursor: 'grabbing',
          },
        }}
      >
        <DragIndicatorIcon fontSize="small" />
      </Box>

      {item.is_premium && (
        <Chip
          icon={<StarIcon />}
          label="プレミアム"
          color="warning"
          size="small"
          sx={{
            position: 'absolute',
            top: 8,
            right: 8,
            zIndex: 1,
          }}
        />
      )}

      <CardMedia
        component="img"
        height="140"
        image={thumbnailUrl}
        alt={item.species_name}
        sx={{ objectFit: 'cover' }}
      />

      <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
        <Typography variant="caption" color="text.secondary" display="block">
          #{item.item_number}
        </Typography>
        <Typography variant="body2" fontWeight="medium" noWrap>
          {item.species_name}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {item.quantity}匹
        </Typography>
      </CardContent>
    </Card>
  );
}
