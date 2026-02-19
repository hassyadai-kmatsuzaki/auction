import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Select, MenuItem, Box } from '@mui/material';
import {
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

const ROLE_CONFIG = {
  admin:       { label: '管理者画面',   icon: <AdminIcon sx={{ fontSize: 18, color: '#2563EB' }} />, path: '/admin/dashboard' },
  seller:      { label: '出品者画面',   icon: <SellerIcon sx={{ fontSize: 18, color: '#059669' }} />, path: '/seller/dashboard' },
  participant: { label: '参加者画面',   icon: <ParticipantIcon sx={{ fontSize: 18, color: '#6366F1' }} />, path: '/participant/home' },
} as const;

const RoleSwitcher: React.FC<RoleSwitcherProps> = ({ roles, currentPath }) => {
  const navigate = useNavigate();

  const hasAdmin       = roles.some(r => r.name === 'admin');
  const hasSeller      = roles.some(r => r.name === 'seller');
  const hasParticipant = roles.some(r => r.name === 'participant');

  const availableRoles = [
    hasAdmin       && 'admin',
    hasSeller      && 'seller',
    hasParticipant && 'participant',
  ].filter(Boolean) as string[];

  if (availableRoles.length < 2) return null;

  const currentRole = currentPath.startsWith('/admin')
    ? 'admin'
    : currentPath.startsWith('/seller')
      ? 'seller'
      : 'participant';

  const handleChange = (roleName: string) => {
    if (roleName === currentRole) return;
    const config = ROLE_CONFIG[roleName as keyof typeof ROLE_CONFIG];
    if (config) navigate(config.path);
  };

  return (
    <Select
      value={currentRole}
      onChange={(e) => handleChange(e.target.value)}
      size="small"
      variant="outlined"
      sx={{
        minWidth: 150,
        fontSize: '0.8125rem',
        fontWeight: 600,
        bgcolor: 'background.paper',
        '& .MuiSelect-select': {
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          py: 0.75,
        },
        '& .MuiOutlinedInput-notchedOutline': {
          borderColor: 'divider',
        },
      }}
      renderValue={(value) => {
        const config = ROLE_CONFIG[value as keyof typeof ROLE_CONFIG];
        return (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
            {config?.icon}
            {config?.label}
          </Box>
        );
      }}
    >
      {availableRoles.map((roleName) => {
        const config = ROLE_CONFIG[roleName as keyof typeof ROLE_CONFIG];
        return (
          <MenuItem key={roleName} value={roleName} sx={{ gap: 1 }}>
            {config.icon}
            {config.label}
          </MenuItem>
        );
      })}
    </Select>
  );
};

export default RoleSwitcher;
