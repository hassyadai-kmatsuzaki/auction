import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Container,
  Divider,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import {
  Verified as VerifiedIcon,
  Block as BlockIcon,
  HelpOutline as HelpOutlineIcon,
} from '@mui/icons-material';
import axios from '../../lib/axios';

interface PublicCertificate {
  certificate_number: string;
  status: 'issued' | 'revoked';
  breed_name: string;
  breed_type: string | null;
  fixation_rate: string | null;
  expression: string | null;
  parent_male: Record<string, string> | null;
  parent_female: Record<string, string> | null;
  lineage: Record<string, string | string[]> | null;
  issued_at: string | null;
  item: { species_name: string; item_number: number | null; auction_title: string | null } | null;
}

const formatPairs = (obj: Record<string, string | string[]> | null) =>
  obj ? Object.entries(obj).map(([k, v]) => `${k === 'name' ? '' : `${k}: `}${Array.isArray(v) ? v.join(' / ') : v}`).join(' ／ ') : '';

/**
 * 血統証明書の真正性確認（認証不要）。PDF の QR コードからここに着地する
 */
export default function PedigreeVerify() {
  const { certificateNumber } = useParams<{ certificateNumber?: string }>();
  const navigate = useNavigate();
  const [input, setInput] = useState(certificateNumber ?? '');
  const [loading, setLoading] = useState(false);
  const [certificate, setCertificate] = useState<PublicCertificate | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    setInput(certificateNumber ?? '');
    setCertificate(null);
    setNotFound(false);
    if (!certificateNumber) return;

    setLoading(true);
    // 該当なし(404)は画面内で案内するのでトーストは出さない
    axios.get(`/api/pedigree/verify/${encodeURIComponent(certificateNumber)}`, { silent: true })
      .then((res) => setCertificate(res.data.data))
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [certificateNumber]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const value = input.trim().toUpperCase();
    if (value) navigate(`/pedigree/verify/${value}`);
  };

  const rows: [string, string][] = certificate ? [
    ['証明書番号', certificate.certificate_number],
    ['品種名', certificate.breed_name],
    ['品種タイプ', certificate.breed_type ?? ''],
    ['固定率', certificate.fixation_rate ? `${Number(certificate.fixation_rate)}%` : ''],
    ['表現型', certificate.expression ?? ''],
    ['父魚（オス）', formatPairs(certificate.parent_male)],
    ['母魚（メス）', formatPairs(certificate.parent_female)],
    ['血統', formatPairs(certificate.lineage)],
    ['出品', certificate.item ? [certificate.item.auction_title, certificate.item.item_number ? `No.${certificate.item.item_number}` : null].filter(Boolean).join(' ') : ''],
    ['発行日', certificate.issued_at ? new Date(certificate.issued_at).toLocaleDateString('ja-JP') : ''],
  ].filter(([, v]) => v !== '') as [string, string][] : [];

  return (
    <Container maxWidth="sm" sx={{ py: 4 }}>
      <Paper sx={{ p: { xs: 2.5, sm: 4 } }}>
        <Typography variant="h5" component="h1" sx={{ fontWeight: 700, mb: 1 }}>
          血統証明書の確認
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          日本メダカオンライン市場が発行したデジタル血統証明書かどうかを、証明書番号で確認できます。
        </Typography>

        <Box component="form" onSubmit={handleSubmit} sx={{ display: 'flex', gap: 1, mb: 3 }}>
          <TextField
            size="small"
            fullWidth
            label="証明書番号"
            placeholder="PD-20261001-ABC123"
            value={input}
            onChange={(e) => setInput(e.target.value)}
          />
          <Button type="submit" variant="contained" disabled={!input.trim()} sx={{ whiteSpace: 'nowrap' }}>
            確認する
          </Button>
        </Box>

        {loading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress />
          </Box>
        )}

        {notFound && (
          <Alert severity="warning" icon={<HelpOutlineIcon />}>
            該当する証明書は見つかりませんでした。番号に誤りがないかご確認ください。
          </Alert>
        )}

        {certificate && (
          <>
            {certificate.status === 'issued' ? (
              <Alert severity="success" icon={<VerifiedIcon />} sx={{ mb: 2 }}>
                <strong>有効な証明書です。</strong>当市場が発行した血統証明書であることを確認しました。
              </Alert>
            ) : (
              <Alert severity="error" icon={<BlockIcon />} sx={{ mb: 2 }}>
                <strong>この証明書は取り消されています。</strong>現在は有効ではありません。
              </Alert>
            )}
            <Divider sx={{ mb: 1 }} />
            <Table size="small">
              <TableBody>
                {rows.map(([label, value]) => (
                  <TableRow key={label}>
                    <TableCell component="th" sx={{ width: '32%', color: 'text.secondary', fontWeight: 600, pl: 0 }}>
                      {label}
                    </TableCell>
                    <TableCell sx={{ wordBreak: 'break-all' }}>{value}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </>
        )}
      </Paper>
    </Container>
  );
}
