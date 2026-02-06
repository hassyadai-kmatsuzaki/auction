import { useNavigate } from 'react-router-dom';
import { Box, Button, Container, Typography } from '@mui/material';
import BlockIcon from '@mui/icons-material/Block';
import HomeIcon from '@mui/icons-material/Home';

export default function Forbidden() {
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
        <BlockIcon
          sx={{
            fontSize: 120,
            color: 'warning.main',
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
          403
        </Typography>

        <Typography
          variant="h5"
          sx={{
            fontWeight: 'medium',
            color: 'text.primary',
            mb: 2,
          }}
        >
          アクセス権限がありません
        </Typography>

        <Typography
          variant="body1"
          color="text.secondary"
          sx={{ mb: 4, maxWidth: 500 }}
        >
          このページを表示する権限がありません。
          <br />
          適切な権限を持つアカウントでログインしてください。
        </Typography>

        <Button
          variant="outlined"
          startIcon={<HomeIcon />}
          onClick={() => navigate('/')}
          size="large"
        >
          ホームへ
        </Button>
      </Box>
    </Container>
  );
}
