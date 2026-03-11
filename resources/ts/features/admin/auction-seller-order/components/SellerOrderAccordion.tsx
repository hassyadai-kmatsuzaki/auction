import {
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Typography,
  Box,
  Chip,
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  DragIndicator as DragIndicatorIcon,
  Store as StoreIcon,
} from '@mui/icons-material';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { SellerOrder } from '../api/sellerOrderApi';
import SellerItemsList from './SellerItemsList';

interface SellerOrderAccordionProps {
  auctionId: number;
  seller: SellerOrder;
  isEditable: boolean;
  expanded: boolean;
  onExpand: (sellerId: number) => void;
}

export default function SellerOrderAccordion({
  auctionId,
  seller,
  isEditable,
  expanded,
  onExpand,
}: SellerOrderAccordionProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: seller.seller_profile_id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <Box ref={setNodeRef} style={style}>
      <Accordion
        expanded={expanded}
        onChange={() => onExpand(seller.seller_profile_id)}
        sx={{
          mb: 1,
          '&:before': { display: 'none' },
          boxShadow: 1,
        }}
      >
        <AccordionSummary
          expandIcon={<ExpandMoreIcon />}
          sx={{
            '& .MuiAccordionSummary-content': {
              alignItems: 'center',
              gap: 2,
            },
          }}
        >
          <Box
            {...attributes}
            {...listeners}
            sx={{
              display: 'flex',
              alignItems: 'center',
              cursor: 'grab',
              '&:active': {
                cursor: 'grabbing',
              },
              mr: 1,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <DragIndicatorIcon />
          </Box>

          <Chip
            label={seller.display_order}
            size="small"
            color="primary"
            sx={{ minWidth: 40, fontWeight: 'bold' }}
          />

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flex: 1 }}>
            <StoreIcon color="action" />
            <Typography variant="h6" component="div">
              {seller.seller_name}
            </Typography>
            {seller.seller_code && (
              <Chip label={seller.seller_code} size="small" variant="outlined" />
            )}
          </Box>

          <Chip label={`${seller.item_count}点`} size="small" variant="outlined" />
        </AccordionSummary>

        <AccordionDetails sx={{ p: 0 }}>
          <SellerItemsList
            auctionId={auctionId}
            sellerProfileId={seller.seller_profile_id}
            items={seller.items}
            isEditable={isEditable}
          />
        </AccordionDetails>
      </Accordion>
    </Box>
  );
}
