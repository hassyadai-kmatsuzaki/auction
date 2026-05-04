import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  Stack,
  Alert,
  Divider,
} from '@mui/material';
import { AccountBalance } from '@mui/icons-material';

interface Props {
  open: boolean;
  onClose: () => void;
  /**
   * 閉じるボタン・バックドロップクリック・Escでの閉じる操作を許可するか。
   * SubscriptionGate のように管理者の入金確認まで強制表示したい場面では false。
   */
  dismissible?: boolean;
}

const BANK_INFO = {
  bankName: 'GMOあおぞらネット銀行',
  bankCode: '0310',
  branchName: '法人第二営業部',
  branchCode: '102',
  accountType: '普通',
  accountNumber: '2434493',
  accountHolder: 'カ）ネプ ニホンメダカオンラインイチバ',
};

export default function BankTransferInfoModal({ open, onClose, dismissible = true }: Props) {
  return (
    <Dialog
      open={open}
      onClose={(_e, reason) => {
        if (!dismissible && (reason === 'backdropClick' || reason === 'escapeKeyDown')) return;
        onClose();
      }}
      disableEscapeKeyDown={!dismissible}
      fullWidth
      maxWidth="sm"
      slotProps={{
        backdrop: {
          sx: {
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            backgroundColor: 'rgba(0,0,0,0.45)',
          },
        },
      }}
    >
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, pb: 1 }}>
        <AccountBalance fontSize="small" />
        <span>お振込先のご案内</span>
      </DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          <Alert severity="warning" variant="outlined">
            振込手数料はお客様のご負担となります。あらかじめご了承ください。
          </Alert>

          <Typography variant="body2" color="text.secondary">
            下記の口座に<Box component="span" sx={{ fontWeight: 700, color: 'text.primary' }}>5月18日までに</Box>ご入金ください。
          </Typography>

          <Box
            sx={{
              p: 2.5,
              borderRadius: 2,
              bgcolor: 'rgba(0,0,0,0.03)',
              border: '1px solid rgba(0,0,0,0.08)',
            }}
          >
            <Stack divider={<Divider flexItem />} spacing={1.25}>
              <Row label="金融機関" value={`${BANK_INFO.bankName}（${BANK_INFO.bankCode}）`} />
              <Row label="支店" value={`${BANK_INFO.branchName}（${BANK_INFO.branchCode}）`} />
              <Row label="預金種別" value={BANK_INFO.accountType} />
              <Row label="口座番号" value={BANK_INFO.accountNumber} mono />
              <Row label="口座名義" value={BANK_INFO.accountHolder} />
            </Stack>
          </Box>

          <Typography variant="body2" color="text.secondary">
            振り込み後に公式LINEにご報告いただけますと幸いです。
          </Typography>

          <Typography variant="caption" color="text.secondary">
            振込が確認されますと、本ご案内は次回ログイン以降表示されなくなります。
          </Typography>
        </Stack>
      </DialogContent>
      {dismissible && (
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={onClose} variant="contained">
            閉じる
          </Button>
        </DialogActions>
      )}
    </Dialog>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 2 }}>
      <Typography
        variant="caption"
        sx={{ minWidth: 88, color: 'text.secondary', letterSpacing: '0.04em' }}
      >
        {label}
      </Typography>
      <Typography
        variant="body1"
        sx={{
          fontWeight: 600,
          fontFamily: mono ? 'ui-monospace, SFMono-Regular, Menlo, monospace' : undefined,
          letterSpacing: mono ? '0.05em' : undefined,
        }}
      >
        {value}
      </Typography>
    </Box>
  );
}
