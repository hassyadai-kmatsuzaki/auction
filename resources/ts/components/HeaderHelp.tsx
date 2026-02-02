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
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Alert,
  Snackbar,
} from '@mui/material';
import {
  HelpOutline as HelpIcon,
  MenuBook as GuideIcon,
  QuestionAnswer as FAQIcon,
  Email as ContactIcon,
  Article as DocsIcon,
  Phone as PhoneIcon,
  OpenInNew as OpenInNewIcon,
} from '@mui/icons-material';
import axios from '../lib/axios';

interface HeaderHelpProps {
  role: 'admin' | 'seller' | 'participant';
}

export default function HeaderHelp({ role }: HeaderHelpProps) {
  const [anchorEl, setAnchorEl] = useState<HTMLButtonElement | null>(null);
  const [contactDialogOpen, setContactDialogOpen] = useState(false);
  const [contactForm, setContactForm] = useState({ subject: '', message: '' });
  const [sending, setSending] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' });

  const open = Boolean(anchorEl);

  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleOpenContact = () => {
    handleClose();
    setContactDialogOpen(true);
  };

  const handleCloseContact = () => {
    setContactDialogOpen(false);
    setContactForm({ subject: '', message: '' });
  };

  const handleSendInquiry = async () => {
    if (!contactForm.subject || !contactForm.message) {
      setSnackbar({ open: true, message: '件名と内容を入力してください。', severity: 'error' });
      return;
    }

    setSending(true);
    try {
      // お問い合わせAPI（実装がない場合はスキップ）
      // await axios.post('/api/contact', contactForm);
      setSnackbar({ open: true, message: 'お問い合わせを送信しました。', severity: 'success' });
      handleCloseContact();
    } catch (err) {
      setSnackbar({ open: true, message: '送信に失敗しました。', severity: 'error' });
    } finally {
      setSending(false);
    }
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
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5 }}>
            お困りの際はお気軽にご連絡ください
          </Typography>
          <Button
            fullWidth
            variant="outlined"
            startIcon={<ContactIcon />}
            onClick={handleOpenContact}
            sx={{ mb: 1 }}
          >
            お問い合わせ
          </Button>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1, mt: 1 }}>
            <PhoneIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
            <Typography variant="caption" color="text.secondary">
              03-XXXX-XXXX（平日 10:00-18:00）
            </Typography>
          </Box>
        </Box>
      </Popover>

      {/* お問い合わせダイアログ */}
      <Dialog open={contactDialogOpen} onClose={handleCloseContact} maxWidth="sm" fullWidth>
        <DialogTitle>
          <Typography variant="h6" sx={{ fontWeight: 600 }}>
            お問い合わせ
          </Typography>
        </DialogTitle>
        <DialogContent>
          <Alert severity="info" sx={{ mb: 3 }}>
            営業時間内（平日 10:00-18:00）にご返信いたします。
          </Alert>
          <TextField
            fullWidth
            label="件名"
            value={contactForm.subject}
            onChange={(e) => setContactForm({ ...contactForm, subject: e.target.value })}
            sx={{ mb: 2 }}
          />
          <TextField
            fullWidth
            multiline
            rows={5}
            label="お問い合わせ内容"
            value={contactForm.message}
            onChange={(e) => setContactForm({ ...contactForm, message: e.target.value })}
            placeholder="お問い合わせ内容をご記入ください..."
          />
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={handleCloseContact}>キャンセル</Button>
          <Button
            variant="contained"
            onClick={handleSendInquiry}
            disabled={sending}
          >
            {sending ? '送信中...' : '送信する'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* スナックバー */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={3000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity={snackbar.severity} onClose={() => setSnackbar({ ...snackbar, open: false })}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </>
  );
}
