import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Box,
  Typography,
  Paper,
  TextField,
  Button,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormControlLabel,
  Switch,
} from '@mui/material';
import { Save as SaveIcon, ArrowBack as ArrowBackIcon } from '@mui/icons-material';

export default function AnnouncementForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = Boolean(id);

  const [formData, setFormData] = useState({
    title: '',
    content: '',
    priority: 'normal',
    is_published: false,
    published_at: '',
    expires_at: '',
  });

  const handleChange = (field: string) => (e: any) => {
    setFormData({ ...formData, [field]: e.target.value });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Mock: 実際はAPIを呼び出す
    navigate('/admin/announcements');
  };

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
        <Typography variant="h4">
          {isEdit ? 'お知らせ編集' : 'お知らせ新規作成'}
        </Typography>
      </Box>

      <Paper sx={{ p: 3 }}>
        <Box component="form" onSubmit={handleSubmit}>
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                required
                label="タイトル"
                value={formData.title}
                onChange={handleChange('title')}
              />
            </Grid>

            <Grid item xs={12}>
              <TextField
                fullWidth
                required
                label="本文"
                value={formData.content}
                onChange={handleChange('content')}
                multiline
                rows={10}
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>優先度</InputLabel>
                <Select
                  value={formData.priority}
                  label="優先度"
                  onChange={handleChange('priority')}
                >
                  <MenuItem value="low">参考</MenuItem>
                  <MenuItem value="normal">通常</MenuItem>
                  <MenuItem value="high">重要</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} sm={6}>
              <FormControlLabel
                control={
                  <Switch
                    checked={formData.is_published}
                    onChange={(e) =>
                      setFormData({ ...formData, is_published: e.target.checked })
                    }
                  />
                }
                label="公開する"
              />
            </Grid>

            {formData.is_published && (
              <>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    type="datetime-local"
                    label="公開開始日時"
                    value={formData.published_at}
                    onChange={handleChange('published_at')}
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>

                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    type="datetime-local"
                    label="公開終了日時"
                    value={formData.expires_at}
                    onChange={handleChange('expires_at')}
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>
              </>
            )}

            <Grid item xs={12}>
              <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
                <Button onClick={() => navigate('/admin/announcements')}>
                  キャンセル
                </Button>
                <Button type="submit" variant="contained" startIcon={<SaveIcon />}>
                  保存
                </Button>
              </Box>
            </Grid>
          </Grid>
        </Box>
      </Paper>
    </Box>
  );
}

