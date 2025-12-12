import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Button,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  IconButton,
  Menu,
  MenuItem,
} from '@mui/material';
import {
  Add as AddIcon,
  MoreVert as MoreVertIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
} from '@mui/icons-material';

// Mock データ
const announcements = [
  {
    id: 1,
    title: '11月12日オークション開催のお知らせ',
    priority: 'high',
    is_published: true,
    published_at: '2025-11-11T17:00:00Z',
    created_at: '2025-11-11T16:00:00Z',
  },
  {
    id: 2,
    title: 'プレミアムプランのご案内',
    priority: 'normal',
    is_published: true,
    published_at: '2025-11-10T10:00:00Z',
    created_at: '2025-11-10T09:00:00Z',
  },
  {
    id: 3,
    title: '新規ユーザー登録方法について',
    priority: 'low',
    is_published: false,
    created_at: '2025-11-09T15:00:00Z',
  },
];

export default function AnnouncementManagement() {
  const navigate = useNavigate();
  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);
  const [selectedId, setSelectedId] = React.useState<number | null>(null);

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>, id: number) => {
    setAnchorEl(event.currentTarget);
    setSelectedId(id);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
    setSelectedId(null);
  };

  const getPriorityLabel = (priority: string) => {
    switch (priority) {
      case 'high': return '重要';
      case 'normal': return '通常';
      case 'low': return '参考';
      default: return '';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'error';
      case 'normal': return 'primary';
      case 'low': return 'default';
      default: return 'default';
    }
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">お知らせ管理</Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => navigate('/admin/announcements/create')}
        >
          新規作成
        </Button>
      </Box>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>タイトル</TableCell>
              <TableCell align="center">優先度</TableCell>
              <TableCell align="center">公開状態</TableCell>
              <TableCell>公開日時</TableCell>
              <TableCell>作成日時</TableCell>
              <TableCell align="center">操作</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {announcements.map((announcement) => (
              <TableRow key={announcement.id} hover>
                <TableCell>{announcement.title}</TableCell>
                <TableCell align="center">
                  <Chip
                    label={getPriorityLabel(announcement.priority)}
                    color={getPriorityColor(announcement.priority)}
                    size="small"
                  />
                </TableCell>
                <TableCell align="center">
                  <Chip
                    label={announcement.is_published ? '公開中' : '下書き'}
                    color={announcement.is_published ? 'success' : 'default'}
                    size="small"
                  />
                </TableCell>
                <TableCell>
                  {announcement.published_at
                    ? new Date(announcement.published_at).toLocaleString('ja-JP')
                    : '-'}
                </TableCell>
                <TableCell>
                  {new Date(announcement.created_at).toLocaleString('ja-JP')}
                </TableCell>
                <TableCell align="center">
                  <IconButton
                    size="small"
                    onClick={(e) => handleMenuOpen(e, announcement.id)}
                  >
                    <MoreVertIcon />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
      >
        <MenuItem
          onClick={() => {
            navigate(`/admin/announcements/${selectedId}/edit`);
            handleMenuClose();
          }}
        >
          <EditIcon sx={{ mr: 1 }} /> 編集
        </MenuItem>
        <MenuItem onClick={handleMenuClose}>
          <DeleteIcon sx={{ mr: 1 }} /> 削除
        </MenuItem>
      </Menu>
    </Box>
  );
}

