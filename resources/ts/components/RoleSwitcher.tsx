import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Menu,
  MenuItem,
  IconButton,
  Typography,
  Box,
  Tooltip,
} from '@mui/material';
import { SwapHoriz as SwapHorizIcon } from '@mui/icons-material';

interface Role {
  name: string;
  display_name: string;
}

interface RoleSwitcherProps {
  roles: Role[];
  currentPath: string;
}

const RoleSwitcher: React.FC<RoleSwitcherProps> = ({ roles, currentPath }) => {
  const navigate = useNavigate();
  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);

  // seller と participant の両方を持っている場合のみ表示
  const hasSeller = roles.some(r => r.name === 'seller');
  const hasParticipant = roles.some(r => r.name === 'participant');
  const hasBothRoles = hasSeller && hasParticipant;

  if (!hasBothRoles) {
    return null;
  }

  const handleClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleSwitch = (roleName: string) => {
    handleClose();
    
    if (roleName === 'seller') {
      navigate('/seller');
    } else if (roleName === 'participant') {
      navigate('/');
    }
  };

  // 現在の画面を判定
  const isParticipantScreen = !currentPath.startsWith('/admin') && !currentPath.startsWith('/seller');
  const isSellerScreen = currentPath.startsWith('/seller');

  return (
    <>
      <Tooltip title="画面切り替え">
        <IconButton
          onClick={handleClick}
          size="small"
          sx={{ ml: 2 }}
          aria-label="画面切り替え"
          color="inherit"
        >
          <SwapHorizIcon />
        </IconButton>
      </Tooltip>

      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleClose}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'right',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'right',
        }}
      >
        <MenuItem
          onClick={() => handleSwitch('participant')}
          selected={isParticipantScreen}
        >
          <Box>
            <Typography variant="body1">参加者画面</Typography>
            <Typography variant="caption" color="text.secondary">
              オークション参加・落札管理
            </Typography>
          </Box>
        </MenuItem>

        <MenuItem
          onClick={() => handleSwitch('seller')}
          selected={isSellerScreen}
        >
          <Box>
            <Typography variant="body1">出品者画面</Typography>
            <Typography variant="caption" color="text.secondary">
              商品管理・売上確認
            </Typography>
          </Box>
        </MenuItem>
      </Menu>
    </>
  );
};

export default RoleSwitcher;
