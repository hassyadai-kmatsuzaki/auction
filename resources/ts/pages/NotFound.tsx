import { useNavigate } from 'react-router-dom';
import { Box, Button, Container, Typography } from '@mui/material';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import HomeIcon from '@mui/icons-material/Home';

export default function NotFound() {
  const navigate = useNavigate();

  return (
    <Container maxWidth="md">
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          textAlign: 'center',
          py: 8,
        }}
      >
        <ErrorOutlineIcon
          sx={{
            fontSize: 120,
            color: 'error.main',
            mb: 2,
          }}
        />
        
        <Typography
          variant="h1"
          sx={{
            fontSize: { xs: '4rem', md: '6rem' },
            fontWeight: 'bold',
            color: 'text.primary',
            mb: 2,
          }}
        >
          404
        </Typography>
        
        <Typography
          variant="h5"
          sx={{
            fontWeight: 'medium',
            color: 'text.primary',
            mb: 2,
          }}
        >
          ページが見つかりません
        </Typography>
        
        <Typography
          variant="body1"
          color="text.secondary"
          sx={{ mb: 4, maxWidth: 500 }}
        >
          お探しのページは存在しないか、削除された可能性があります。
          <br />
          URLをご確認いただくか、<br />以下のボタンからホームへ移動してください。
        </Typography>
        
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', justifyContent: 'center' }}>
          <Button
            variant="outlined"
            startIcon={<HomeIcon />}
            onClick={() => navigate('/')}
            size="large"
          >
            ホームへ
          </Button>
        </Box>
      </Box>
    </Container>
  );
}
