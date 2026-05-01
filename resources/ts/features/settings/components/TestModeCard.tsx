import { useEffect, useState } from 'react';
import {
  Card,
  CardContent,
  Typography,
  Switch,
  FormControlLabel,
  Alert,
  Stack,
  CircularProgress,
  Box,
} from '@mui/material';
import { Science as ScienceIcon } from '@mui/icons-material';
import axios from '../../../lib/axios';

/**
 * テストモードのトグル UI。
 *
 * - Switch を切り替えると即座に PUT /api/admin/settings で反映する（保存ボタン不要）
 * - 切り替え時には注意喚起の警告を出す
 * - サイト全体のオークション可視性を切り替える「危険な」スイッチであることを赤字で明示
 */
export default function TestModeCard() {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  // 初期値読み込み
  useEffect(() => {
    (async () => {
      try {
        const res = await axios.get('/api/admin/settings');
        const value = res.data?.data?.general?.test_mode_enabled?.value;
        // SystemSetting 側は文字列で返ってくるので boolean に正規化
        setEnabled(value === true || value === '1' || value === 'true');
      } catch {
        setEnabled(false);
      }
    })();
  }, []);

  const handleToggle = async (next: boolean) => {
    if (next) {
      const ok = window.confirm(
        'テストモードを ON にしますか？\n\n' +
        '・is_test=true のユーザーだけがオークション・出品・落札を見られるようになります\n' +
        '・それ以外のユーザーには空一覧が返されます\n' +
        '・先行登録ユーザーへの限定公開などに使ってください'
      );
      if (!ok) return;
    } else {
      const ok = window.confirm(
        'テストモードを OFF にしますか？\n\n' +
        '全ユーザーがオークションを通常通り見られるようになります。'
      );
      if (!ok) return;
    }

    setSaving(true);
    setError(null);
    setInfo(null);
    try {
      await axios.put('/api/admin/settings', {
        settings: { test_mode_enabled: next },
      });
      setEnabled(next);
      setInfo(next ? 'テストモードを ON にしました' : 'テストモードを OFF にしました');
    } catch (e: any) {
      setError(e?.response?.data?.message ?? 'テストモードの切り替えに失敗しました');
    } finally {
      setSaving(false);
    }
  };

  if (enabled === null) {
    return (
      <Card>
        <CardContent><CircularProgress size={20} /></CardContent>
      </Card>
    );
  }

  return (
    <Card sx={{ borderLeft: enabled ? '4px solid #f59e0b' : '4px solid transparent' }}>
      <CardContent sx={{ p: 3 }}>
        <Stack direction="row" spacing={2} alignItems="center" mb={2}>
          <ScienceIcon color={enabled ? 'warning' : 'disabled'} />
          <Box flex={1}>
            <Typography variant="h6" sx={{ fontWeight: 600 }}>テストモード</Typography>
            <Typography variant="caption" color="text.secondary">
              ON にすると is_test フラグの立ったユーザー同士でしか相互可視にならない閉じた運用に切り替わります
            </Typography>
          </Box>
          <FormControlLabel
            label={enabled ? 'ON' : 'OFF'}
            labelPlacement="start"
            control={
              <Switch
                checked={enabled}
                disabled={saving}
                onChange={(e) => handleToggle(e.target.checked)}
                color="warning"
              />
            }
          />
        </Stack>

        {enabled && (
          <Alert severity="warning" sx={{ mt: 1 }}>
            <strong>テストモードが有効です。</strong> is_test=false のユーザーにはオークション・出品・落札が一切表示されません。
            一般公開する前に必ず OFF にしてください。
          </Alert>
        )}

        {error && <Alert severity="error" sx={{ mt: 1 }}>{error}</Alert>}
        {info && <Alert severity="success" sx={{ mt: 1 }}>{info}</Alert>}
      </CardContent>
    </Card>
  );
}
