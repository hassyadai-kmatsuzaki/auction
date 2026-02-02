import React, { useState } from 'react';
import {
  IconButton,
  Popover,
  Box,
  Typography,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Divider,
} from '@mui/material';
import {
  MenuBook as GuideIcon,
  QuestionAnswer as FAQIcon,
  Article as DocsIcon,
  Phone as PhoneIcon,
  OpenInNew as OpenInNewIcon,
  HelpOutline as HelpIcon,
} from '@mui/icons-material';

interface HeaderHelpProps {
  role: 'admin' | 'seller' | 'participant';
}

export default function HeaderHelp({ role }: HeaderHelpProps) {
  const [anchorEl, setAnchorEl] = useState<HTMLButtonElement | null>(null);

  const open = Boolean(anchorEl);

  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const helpItems = [
    {
      icon: <GuideIcon />,
      title: '利用ガイド',
      description: role === 'seller' ? '出品の流れを確認' : role === 'participant' ? '入札方法を確認' : '管理機能の使い方',
      action: () => {
        handleClose();
        // ガイドページへ遷移または外部リンク
        window.open('/legal/terms', '_blank');
      },
    },
    {
      icon: <FAQIcon />,
      title: 'よくある質問',
      description: '困ったときはこちら',
      action: () => {
        handleClose();
        window.open('/legal/terms', '_blank');
      },
    },
    {
      icon: <DocsIcon />,
      title: '利用規約',
      description: 'サービス利用規約を確認',
      action: () => {
        handleClose();
        window.open('/legal/terms', '_blank');
      },
    },
  ];

  return (
    <>
      <IconButton
        size="small"
        sx={{ color: 'text.secondary' }}
        onClick={handleClick}
      >
        <HelpIcon sx={{ fontSize: 20 }} />
      </IconButton>

      <Popover
        open={open}
        anchorEl={anchorEl}
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
          sx: { width: 320 },
        }}
      >
        <Box sx={{ p: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
            ヘルプ・サポート
          </Typography>
        </Box>

        <List disablePadding>
          {helpItems.map((item, index) => (
            <React.Fragment key={index}>
              <ListItem disablePadding>
                <ListItemButton onClick={item.action} sx={{ py: 1.5, px: 2 }}>
                  <ListItemIcon sx={{ minWidth: 40 }}>
                    {item.icon}
                  </ListItemIcon>
                  <ListItemText
                    primary={item.title}
                    secondary={item.description}
                    primaryTypographyProps={{ variant: 'body2', fontWeight: 500 }}
                    secondaryTypographyProps={{ variant: 'caption' }}
                  />
                  <OpenInNewIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                </ListItemButton>
              </ListItem>
              {index < helpItems.length - 1 && <Divider />}
            </React.Fragment>
          ))}
        </List>

        <Divider />

        <Box sx={{ p: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
            <PhoneIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
            <Typography variant="caption" color="text.secondary">
              03-XXXX-XXXX（平日 10:00-18:00）
            </Typography>
          </Box>
        </Box>
      </Popover>
    </>
  );
}
