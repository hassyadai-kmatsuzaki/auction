/**
 * デモモード選択画面
 * 「ガイド付きデモ」と「ガイドなしデモ」を選択できる
 */
import {
  Box, Container, Typography, Card, CardContent, CardActionArea,
  Grid, Chip,
} from '@mui/material';
import {
  School as SchoolIcon,
  SportsEsports as GameIcon,
  PlayArrow as PlayArrowIcon,
  ArrowForward as ArrowForwardIcon,
} from '@mui/icons-material';

interface DemoModeSelectorProps {
  onSelectGuided: () => void;
  onSelectFree: () => void;
}

export function DemoModeSelector({ onSelectGuided, onSelectFree }: DemoModeSelectorProps) {
  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      {/* Hero */}
      <Box sx={{
        background: 'linear-gradient(135deg, #1976d2 0%, #0d47a1 100%)',
        color: 'white', py: { xs: 6, md: 10 }, px: 2,
        textAlign: 'center',
      }}>
        <Container maxWidth="md">
          <Typography variant="h3" fontWeight="bold" sx={{ mb: 2, fontSize: { xs: '1.8rem', md: '2.5rem' } }}>
            メダカオークション デモ体験
          </Typography>
          <Typography variant="h6" sx={{ opacity: 0.9, mb: 1, fontSize: { xs: '0.95rem', md: '1.15rem' } }}>
            ログイン不要でオークションの全機能を体験できます
          </Typography>
          <Typography variant="body2" sx={{ opacity: 0.7 }}>
            お好みのデモモードを選択してください
          </Typography>
        </Container>
      </Box>

      {/* Mode selection cards */}
      <Container maxWidth="md" sx={{ py: { xs: 4, md: 6 }, mt: { xs: -3, md: -4 } }}>
        <Grid container spacing={3}>
          {/* ガイド付きデモ */}
          <Grid item xs={12} md={6}>
            <Card sx={{
              height: '100%',
              border: '2px solid',
              borderColor: 'primary.main',
              transition: 'transform 0.2s, box-shadow 0.2s',
              '&:hover': { transform: 'translateY(-4px)', boxShadow: 6 },
            }}>
              <CardActionArea onClick={onSelectGuided} sx={{ height: '100%', p: 0 }}>
                <CardContent sx={{ p: { xs: 3, md: 4 }, height: '100%', display: 'flex', flexDirection: 'column' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
                    <Box sx={{
                      width: 56, height: 56, borderRadius: 2,
                      bgcolor: 'primary.50', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <SchoolIcon sx={{ fontSize: 32, color: 'primary.main' }} />
                    </Box>
                    <Box>
                      <Typography variant="h5" fontWeight="bold" sx={{ fontSize: { xs: '1.2rem', md: '1.4rem' } }}>
                        ガイド付きデモ
                      </Typography>
                      <Chip label="おすすめ" size="small" color="primary" sx={{ fontWeight: 700, fontSize: '0.7rem' }} />
                    </Box>
                  </Box>

                  <Typography variant="body1" color="text.secondary" sx={{ mb: 2, lineHeight: 1.8 }}>
                    画面の案内に沿って、オークションの基本操作を一通り体験できます。初めての方はこちらがおすすめです。
                  </Typography>

                  <Box sx={{ mt: 'auto' }}>
                    <Typography variant="subtitle2" fontWeight="bold" sx={{ mb: 1 }}>体験できる内容：</Typography>
                    <Box component="ul" sx={{ pl: 2, m: 0, '& li': { mb: 0.5, fontSize: '0.875rem', color: 'text.secondary' } }}>
                      <li>ホーム画面の確認</li>
                      <li>出品一覧の閲覧</li>
                      <li>待機室への入室とカウントダウン</li>
                      <li>入札・指値の操作体験</li>
                      <li>落札管理・通知設定の確認</li>
                    </Box>
                  </Box>

                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1, mt: 3, py: 1.5, bgcolor: 'primary.main', color: 'white', borderRadius: 2, fontWeight: 700 }}>
                    <PlayArrowIcon />
                    ガイド付きデモを開始
                  </Box>
                </CardContent>
              </CardActionArea>
            </Card>
          </Grid>

          {/* ガイドなしデモ */}
          <Grid item xs={12} md={6}>
            <Card sx={{
              height: '100%',
              border: '2px solid',
              borderColor: 'grey.300',
              transition: 'transform 0.2s, box-shadow 0.2s',
              '&:hover': { transform: 'translateY(-4px)', boxShadow: 6 },
            }}>
              <CardActionArea onClick={onSelectFree} sx={{ height: '100%', p: 0 }}>
                <CardContent sx={{ p: { xs: 3, md: 4 }, height: '100%', display: 'flex', flexDirection: 'column' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
                    <Box sx={{
                      width: 56, height: 56, borderRadius: 2,
                      bgcolor: 'warning.50', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <GameIcon sx={{ fontSize: 32, color: 'warning.main' }} />
                    </Box>
                    <Box>
                      <Typography variant="h5" fontWeight="bold" sx={{ fontSize: { xs: '1.2rem', md: '1.4rem' } }}>
                        ガイドなしデモ
                      </Typography>
                      <Chip label="上級者向け" size="small" variant="outlined" sx={{ fontWeight: 700, fontSize: '0.7rem' }} />
                    </Box>
                  </Box>

                  <Typography variant="body1" color="text.secondary" sx={{ mb: 2, lineHeight: 1.8 }}>
                    2レーン各3匹のリアルなオークションを体験。10人のCPU参加者と競り合いながら、自由に入札できます。
                  </Typography>

                  <Box sx={{ mt: 'auto' }}>
                    <Typography variant="subtitle2" fontWeight="bold" sx={{ mb: 1 }}>特徴：</Typography>
                    <Box component="ul" sx={{ pl: 2, m: 0, '& li': { mb: 0.5, fontSize: '0.875rem', color: 'text.secondary' } }}>
                      <li>2レーン x 各3匹 = 計6匹</li>
                      <li>10人のCPU参加者がリアルに入札</li>
                      <li>指値（上限価格）の自由な設定</li>
                      <li>オークション終了後、落札管理を体験</li>
                    </Box>
                  </Box>

                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1, mt: 3, py: 1.5, bgcolor: 'grey.800', color: 'white', borderRadius: 2, fontWeight: 700 }}>
                    <ArrowForwardIcon />
                    ガイドなしデモを開始
                  </Box>
                </CardContent>
              </CardActionArea>
            </Card>
          </Grid>
        </Grid>
      </Container>
    </Box>
  );
}
