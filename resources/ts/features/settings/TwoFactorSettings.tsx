import { useState, useEffect } from 'react';
import {
  Box, Typography, Button, Alert, TextField, Paper, Chip,
  Dialog, DialogTitle, DialogContent, DialogActions, List, ListItem, ListItemText,
  CircularProgress,
} from '@mui/material';
import { Security, QrCode2, ContentCopy } from '@mui/icons-material';
import axios from '../../lib/axios';

interface TwoFactorStatus {
  enabled: boolean;
  confirmed_at: string | null;
}

export default function TwoFactorSettings() {
  const [status, setStatus] = useState<TwoFactorStatus | null>(null);
  const [loading, setLoading] = useState(true);

  // セットアップダイアログ
  const [setupOpen, setSetupOpen] = useState(false);
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [secret, setSecret] = useState('');
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [confirmCode, setConfirmCode] = useState('');
  const [setupStep, setSetupStep] = useState<'qr' | 'confirm' | 'recovery'>('qr');

  // 無効化ダイアログ
  const [disableOpen, setDisableOpen] = useState(false);
  const [disablePassword, setDisablePassword] = useState('');

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    fetchStatus();
  }, []);

  const fetchStatus = async () => {
    try {
      const res = await axios.get('/api/two-factor/status');
      setStatus(res.data.data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  const handleSetup = async () => {
    setError('');
    try {
      const res = await axios.post('/api/two-factor/setup');
      setQrCodeUrl(res.data.data.qr_code_url);
      setSecret(res.data.data.secret);
      setRecoveryCodes(res.data.data.recovery_codes);
      setSetupStep('qr');
      setSetupOpen(true);
    } catch (err: any) {
      setError(err.response?.data?.message || 'セットアップに失敗しました');
    }
  };

  const handleConfirm = async () => {
    setError('');
    try {
      await axios.post('/api/two-factor/confirm', { code: confirmCode });
      setSetupStep('recovery');
      setSuccess('二段階認証が有効になりました');
      fetchStatus();
    } catch (err: any) {
      setError(err.response?.data?.message || 'コードが正しくありません');
    }
  };

  const handleDisable = async () => {
    setError('');
    try {
      await axios.delete('/api/two-factor/disable', { data: { password: disablePassword } });
      setSuccess('二段階認証を無効にしました');
      setDisableOpen(false);
      setDisablePassword('');
      fetchStatus();
    } catch (err: any) {
      setError(err.response?.data?.message || '無効化に失敗しました');
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  if (loading) return <CircularProgress />;

  return (
    <Paper sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        <Security color="primary" />
        <Typography variant="h6">二段階認証（2FA）</Typography>
        {status?.enabled && <Chip label="有効" color="success" size="small" />}
      </Box>

      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        認証アプリ（Google Authenticator, Authy等）を使って、ログイン時のセキュリティを強化します。
      </Typography>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>{success}</Alert>}

      {status?.enabled ? (
        <Button variant="outlined" color="error" onClick={() => setDisableOpen(true)}>
          二段階認証を無効にする
        </Button>
      ) : (
        <Button variant="contained" startIcon={<QrCode2 />} onClick={handleSetup}>
          二段階認証を設定する
        </Button>
      )}

      {/* セットアップダイアログ */}
      <Dialog open={setupOpen} onClose={() => setSetupOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>二段階認証のセットアップ</DialogTitle>
        <DialogContent>
          {setupStep === 'qr' && (
            <Box sx={{ textAlign: 'center' }}>
              <Typography variant="body2" sx={{ mb: 2 }}>
                認証アプリで下記のQRコードをスキャンするか、シークレットキーを手動入力してください。
              </Typography>
              {qrCodeUrl && (
                <Box sx={{ mb: 2 }}>
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrCodeUrl)}`}
                    alt="QR Code"
                    width={200}
                    height={200}
                  />
                </Box>
              )}
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1, mb: 2 }}>
                <TextField
                  value={secret}
                  size="small"
                  InputProps={{ readOnly: true, sx: { fontFamily: 'monospace', fontSize: '0.85rem' } }}
                />
                <Button size="small" onClick={() => copyToClipboard(secret)} startIcon={<ContentCopy />}>
                  コピー
                </Button>
              </Box>
              <Button variant="contained" onClick={() => setSetupStep('confirm')}>
                次へ
              </Button>
            </Box>
          )}

          {setupStep === 'confirm' && (
            <Box sx={{ textAlign: 'center' }}>
              <Typography variant="body2" sx={{ mb: 2 }}>
                認証アプリに表示されている6桁のコードを入力してください。
              </Typography>
              <TextField
                value={confirmCode}
                onChange={(e) => setConfirmCode(e.target.value)}
                placeholder="000000"
                inputProps={{ maxLength: 6, style: { textAlign: 'center', fontSize: '1.5rem' } }}
                sx={{ mb: 2 }}
                autoFocus
              />
              {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
            </Box>
          )}

          {setupStep === 'recovery' && (
            <Box>
              <Alert severity="warning" sx={{ mb: 2 }}>
                以下のリカバリーコードを安全な場所に保存してください。
                認証アプリが使えなくなった場合にログインするために必要です。
              </Alert>
              <Paper variant="outlined" sx={{ p: 2, mb: 2, bgcolor: 'grey.50' }}>
                <List dense>
                  {recoveryCodes.map((code, i) => (
                    <ListItem key={i}>
                      <ListItemText
                        primary={code}
                        primaryTypographyProps={{ fontFamily: 'monospace' }}
                      />
                    </ListItem>
                  ))}
                </List>
              </Paper>
              <Button
                variant="outlined"
                fullWidth
                startIcon={<ContentCopy />}
                onClick={() => copyToClipboard(recoveryCodes.join('\n'))}
              >
                全てコピー
              </Button>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          {setupStep === 'confirm' && (
            <>
              <Button onClick={() => setSetupStep('qr')}>戻る</Button>
              <Button
                variant="contained"
                onClick={handleConfirm}
                disabled={confirmCode.length !== 6}
              >
                有効にする
              </Button>
            </>
          )}
          {setupStep === 'recovery' && (
            <Button variant="contained" onClick={() => setSetupOpen(false)}>
              完了
            </Button>
          )}
        </DialogActions>
      </Dialog>

      {/* 無効化ダイアログ */}
      <Dialog open={disableOpen} onClose={() => setDisableOpen(false)}>
        <DialogTitle>二段階認証の無効化</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 2 }}>
            無効にするにはパスワードを入力してください。
          </Typography>
          <TextField
            type="password"
            fullWidth
            label="パスワード"
            value={disablePassword}
            onChange={(e) => setDisablePassword(e.target.value)}
            autoFocus
          />
          {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDisableOpen(false)}>キャンセル</Button>
          <Button
            variant="contained"
            color="error"
            onClick={handleDisable}
            disabled={!disablePassword}
          >
            無効にする
          </Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
}
