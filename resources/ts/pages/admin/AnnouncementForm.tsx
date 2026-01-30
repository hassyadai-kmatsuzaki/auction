import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Box,
  Typography,
  Paper,
  TextField,
  Button,
  FormControl,
  FormControlLabel,
  FormGroup,
  Checkbox,
  RadioGroup,
  Radio,
  FormLabel,
  CircularProgress,
  Alert,
  Stack,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Divider,
} from '@mui/material';
import {
  Save as SaveIcon,
  ArrowBack as ArrowBackIcon,
  Visibility as VisibilityIcon,
  Send as SendIcon,
  AutoAwesome as AutoAwesomeIcon,
} from '@mui/icons-material';
import { LocalizationProvider, DateTimePicker } from '@mui/x-date-pickers';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { ja } from 'date-fns/locale';
import axios from '../../lib/axios';

interface FormData {
  title: string;
  content: string;
  target_roles: string[];
  is_important: boolean;
  publish_type: 'immediate' | 'scheduled' | 'draft';
  published_at: Date | null;
}

export default function AnnouncementForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = Boolean(id);

  const [formData, setFormData] = useState<FormData>({
    title: '',
    content: '',
    target_roles: ['participant'],
    is_important: false,
    publish_type: 'immediate',
    published_at: null,
  });

  const [loading, setLoading] = useState(false);
  const [fetchLoading, setFetchLoading] = useState(isEdit);
  const [error, setError] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [canEdit, setCanEdit] = useState(true);
  const [aiGenerating, setAiGenerating] = useState(false);

  useEffect(() => {
    if (isEdit) {
      fetchAnnouncement();
    }
  }, [id]);

  const fetchAnnouncement = async () => {
    try {
      setFetchLoading(true);
      const response = await axios.get(`/api/admin/announcements/${id}`);
      
      if (response.data.success) {
        const announcement = response.data.data.announcement;
        
        // 公開済みの場合は編集不可
        if (announcement.status === 'published') {
          setCanEdit(false);
        }
        
        let publishType: 'immediate' | 'scheduled' | 'draft' = 'draft';
        if (announcement.status === 'published') {
          publishType = 'immediate';
        } else if (announcement.status === 'scheduled') {
          publishType = 'scheduled';
        }
        
        setFormData({
          title: announcement.title,
          content: announcement.content,
          target_roles: announcement.target_roles,
          is_important: announcement.is_important,
          publish_type: publishType,
          published_at: announcement.published_at ? new Date(announcement.published_at) : null,
        });
      }
    } catch (err: any) {
      console.error('お知らせ取得エラー:', err);
      setError(err.response?.data?.message || 'お知らせの取得に失敗しました。');
    } finally {
      setFetchLoading(false);
    }
  };

  const handleTargetRoleChange = (role: string) => {
    setFormData((prev) => ({
      ...prev,
      target_roles: prev.target_roles.includes(role)
        ? prev.target_roles.filter((r) => r !== role)
        : [...prev.target_roles, role],
    }));
  };

  const validate = (): string | null => {
    if (!formData.title.trim()) {
      return 'タイトルを入力してください。';
    }
    if (formData.title.length > 200) {
      return 'タイトルは200文字以内で入力してください。';
    }
    if (!formData.content.trim()) {
      return '本文を入力してください。';
    }
    if (formData.target_roles.length === 0) {
      return '対象ユーザーを選択してください。';
    }
    if (formData.publish_type === 'scheduled' && !formData.published_at) {
      return '公開日時を選択してください。';
    }
    return null;
  };

  const handleSubmit = async (asDraft: boolean = false) => {
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      let status = 'draft';
      let publishedAt = null;

      if (!asDraft) {
        if (formData.publish_type === 'immediate') {
          status = 'published';
          publishedAt = new Date().toISOString();
        } else if (formData.publish_type === 'scheduled') {
          status = 'scheduled';
          publishedAt = formData.published_at?.toISOString() || null;
        }
      }

      const payload = {
        title: formData.title,
        content: formData.content,
        target_roles: formData.target_roles,
        is_important: formData.is_important,
        status,
        published_at: publishedAt,
      };

      if (isEdit) {
        await axios.put(`/api/admin/announcements/${id}`, payload);
      } else {
        await axios.post('/api/admin/announcements', payload);
      }

      navigate('/admin/announcements');
    } catch (err: any) {
      console.error('保存エラー:', err);
      setError(err.response?.data?.message || '保存に失敗しました。');
    } finally {
      setLoading(false);
    }
  };

  const handlePreview = () => {
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }
    setPreviewOpen(true);
  };

  const handleAiGenerate = async () => {
    if (!formData.title.trim()) {
      setError('AIでコンテンツを生成するには、先にタイトルを入力してください。');
      return;
    }

    try {
      setAiGenerating(true);
      setError(null);

      const response = await axios.post('/api/admin/announcements/generate-content', {
        title: formData.title,
        target_roles: formData.target_roles,
        is_important: formData.is_important,
      });

      if (response.data.success) {
        setFormData((prev) => ({
          ...prev,
          content: response.data.data.content,
        }));
      }
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } };
      setError(axiosErr.response?.data?.message || 'AI生成に失敗しました。');
    } finally {
      setAiGenerating(false);
    }
  };

  if (fetchLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!canEdit) {
    return (
      <Box>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
          <Button
            startIcon={<ArrowBackIcon />}
            onClick={() => navigate('/admin/announcements')}
            sx={{ mr: 2 }}
          >
            戻る
          </Button>
          <Typography variant="h4">お知らせ詳細</Typography>
        </Box>

        <Alert severity="warning" sx={{ mb: 3 }}>
          公開済みのお知らせは編集できません。非表示にする場合は、お知らせ一覧から操作してください。
        </Alert>

        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom>
            {formData.title}
          </Typography>
          <Divider sx={{ my: 2 }} />
          <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap' }}>
            {formData.content}
          </Typography>
        </Paper>
      </Box>
    );
  }

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={ja}>
      <Box>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
          <Button
            startIcon={<ArrowBackIcon />}
            onClick={() => navigate('/admin/announcements')}
            sx={{ mr: 2 }}
          >
            戻る
          </Button>
          <Typography variant="h4">
            {isEdit ? 'お知らせ編集' : 'お知らせ作成'}
          </Typography>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        <Paper sx={{ p: 3 }}>
          <Stack spacing={3}>
            {/* タイトル */}
            <TextField
              label="タイトル"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              required
              fullWidth
              inputProps={{ maxLength: 200 }}
              helperText={`${formData.title.length}/200文字`}
            />

            {/* 本文 */}
            <Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                <Typography variant="body2" color="text.secondary">
                  本文 *
                </Typography>
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={aiGenerating ? <CircularProgress size={16} /> : <AutoAwesomeIcon />}
                  onClick={handleAiGenerate}
                  disabled={aiGenerating || !formData.title.trim()}
                  sx={{ 
                    borderColor: 'primary.main',
                    '&:hover': { borderColor: 'primary.dark' },
                  }}
                >
                  {aiGenerating ? 'AI生成中...' : 'AIで生成'}
                </Button>
              </Box>
              <TextField
                value={formData.content}
                onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                required
                fullWidth
                multiline
                rows={10}
                placeholder="お知らせの本文を入力してください。タイトルを入力後「AIで生成」ボタンを押すと自動生成できます。"
              />
            </Box>

            {/* 対象ユーザー */}
            <FormControl component="fieldset">
              <FormLabel component="legend">対象ユーザー *</FormLabel>
              <FormGroup row>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={formData.target_roles.includes('admin')}
                      onChange={() => handleTargetRoleChange('admin')}
                    />
                  }
                  label="管理者"
                />
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={formData.target_roles.includes('seller')}
                      onChange={() => handleTargetRoleChange('seller')}
                    />
                  }
                  label="出品者"
                />
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={formData.target_roles.includes('participant')}
                      onChange={() => handleTargetRoleChange('participant')}
                    />
                  }
                  label="参加者"
                />
              </FormGroup>
            </FormControl>

            {/* 重要度 */}
            <FormControlLabel
              control={
                <Checkbox
                  checked={formData.is_important}
                  onChange={(e) => setFormData({ ...formData, is_important: e.target.checked })}
                />
              }
              label="重要なお知らせとして表示"
            />

            <Divider />

            {/* 公開設定 */}
            <FormControl component="fieldset">
              <FormLabel component="legend">公開設定</FormLabel>
              <RadioGroup
                value={formData.publish_type}
                onChange={(e) =>
                  setFormData({ ...formData, publish_type: e.target.value as any })
                }
              >
                <FormControlLabel
                  value="immediate"
                  control={<Radio />}
                  label="すぐに公開"
                />
                <FormControlLabel
                  value="scheduled"
                  control={<Radio />}
                  label="公開日時を指定"
                />
                <FormControlLabel value="draft" control={<Radio />} label="下書き保存" />
              </RadioGroup>
            </FormControl>

            {/* 公開日時 */}
            {formData.publish_type === 'scheduled' && (
              <DateTimePicker
                label="公開日時"
                value={formData.published_at}
                onChange={(date) => setFormData({ ...formData, published_at: date })}
                slotProps={{
                  textField: {
                    fullWidth: true,
                    required: true,
                  },
                }}
                minDateTime={new Date()}
              />
            )}

            {/* ボタン */}
            <Stack direction="row" spacing={2} justifyContent="flex-end">
              <Button onClick={handlePreview} startIcon={<VisibilityIcon />}>
                プレビュー
              </Button>
              
              {formData.publish_type !== 'draft' && (
                <Button
                  variant="outlined"
                  onClick={() => handleSubmit(true)}
                  disabled={loading}
                >
                  下書き保存
                </Button>
              )}
              
              <Button
                variant="contained"
                onClick={() => handleSubmit(false)}
                disabled={loading}
                startIcon={
                  loading ? (
                    <CircularProgress size={20} />
                  ) : formData.publish_type === 'draft' ? (
                    <SaveIcon />
                  ) : (
                    <SendIcon />
                  )
                }
              >
                {formData.publish_type === 'draft'
                  ? '下書き保存'
                  : formData.publish_type === 'immediate'
                  ? '公開'
                  : '公開予約'}
              </Button>
            </Stack>
          </Stack>
        </Paper>

        {/* プレビューダイアログ */}
        <Dialog
          open={previewOpen}
          onClose={() => setPreviewOpen(false)}
          maxWidth="md"
          fullWidth
        >
          <DialogTitle>
            プレビュー
            {formData.is_important && (
              <Alert severity="error" sx={{ mt: 1 }}>
                重要なお知らせ
              </Alert>
            )}
          </DialogTitle>
          <DialogContent dividers>
            <Typography variant="h6" gutterBottom>
              {formData.title}
            </Typography>
            <Typography
              variant="body2"
              color="text.secondary"
              gutterBottom
              sx={{ mb: 2 }}
            >
              対象: {formData.target_roles.map((r) => {
                if (r === 'admin') return '管理者';
                if (r === 'seller') return '出品者';
                if (r === 'participant') return '参加者';
                return r;
              }).join(', ')}
            </Typography>
            <Divider sx={{ my: 2 }} />
            <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap' }}>
              {formData.content}
            </Typography>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setPreviewOpen(false)}>閉じる</Button>
          </DialogActions>
        </Dialog>
      </Box>
    </LocalizationProvider>
  );
}
