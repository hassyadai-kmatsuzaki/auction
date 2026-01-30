import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Menu,
  MenuItem,
  IconButton,
  Typography,
  Box,
  Tooltip,
  Divider,
} from '@mui/material';
import {
  SwapHoriz as SwapHorizIcon,
  AdminPanelSettings as AdminIcon,
  Store as SellerIcon,
  Person as ParticipantIcon,
} from '@mui/icons-material';

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

  // 各ロールの有無をチェック
  const hasAdmin = roles.some(r => r.name === 'admin');
  const hasSeller = roles.some(r => r.name === 'seller');
  const hasParticipant = roles.some(r => r.name === 'participant');

  // 切り替え可能なロールの数をカウント
  const availableRoles = [hasAdmin, hasSeller, hasParticipant].filter(Boolean).length;

  // 2つ以上のロールがない場合は表示しない
  if (availableRoles < 2) {
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
    
    if (roleName === 'admin') {
      navigate('/admin/dashboard');
    } else if (roleName === 'seller') {
      navigate('/seller/dashboard');
    } else if (roleName === 'participant') {
      navigate('/participant/home');
    }
  };

  // 現在の画面を判定
  const isAdminScreen = currentPath.startsWith('/admin');
  const isSellerScreen = currentPath.startsWith('/seller');
  const isParticipantScreen = !isAdminScreen && !isSellerScreen;

  const roleItems = [
    {
      name: 'admin',
      label: '管理者画面',
      description: 'システム管理・設定',
      icon: <AdminIcon sx={{ color: 'primary.main' }} />,
      available: hasAdmin,
      selected: isAdminScreen,
    },
    {
      name: 'seller',
      label: '出品者画面',
      description: '商品管理・売上確認',
      icon: <SellerIcon sx={{ color: 'success.main' }} />,
      available: hasSeller,
      selected: isSellerScreen,
    },
    {
      name: 'participant',
      label: '参加者画面',
      description: 'オークション参加・落札管理',
      icon: <ParticipantIcon sx={{ color: 'info.main' }} />,
      available: hasParticipant,
      selected: isParticipantScreen,
    },
  ].filter(item => item.available);

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
        PaperProps={{
          sx: { minWidth: 220 },
        }}
      >
        <Box sx={{ px: 2, py: 1 }}>
          <Typography variant="caption" color="text.secondary" fontWeight={600}>
            画面を切り替え
          </Typography>
        </Box>
        <Divider />
        {roleItems.map((item, index) => (
          <MenuItem
            key={item.name}
            onClick={() => handleSwitch(item.name)}
            selected={item.selected}
            sx={{
              py: 1.5,
              '&.Mui-selected': {
                backgroundColor: 'action.selected',
              },
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              {item.icon}
              <Box>
                <Typography variant="body2" fontWeight={item.selected ? 600 : 400}>
                  {item.label}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {item.description}
                </Typography>
              </Box>
            </Box>
          </MenuItem>
        ))}
      </Menu>
    </>
  );
};

export default RoleSwitcher;
