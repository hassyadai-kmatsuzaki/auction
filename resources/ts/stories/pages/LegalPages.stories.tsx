import type { Meta, StoryObj } from '@storybook/react-vite';
import React from 'react';
import { Box, Typography, Container, Paper, Divider, Stack, Table, TableBody, TableCell, TableRow } from '@mui/material';

const meta: Meta = { title: 'Pages/法務', tags: ['autodocs'] };
export default meta;

/** 利用規約 */
export const TermsOfService: StoryObj = {
  name: '利用規約',
  render: () => (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Typography variant="h4" fontWeight="bold" gutterBottom>利用規約</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>最終更新日: 2026年1月1日</Typography>
      <Paper sx={{ p: 4 }}>
        <Stack spacing={3}>
          {[
            { t: '第1条（総則）', d: '本規約は、当社が提供するオークションサービス（以下「本サービス」）の利用条件を定めるものです。本サービスを利用するすべてのユーザーは、本規約に同意したものとみなします。' },
            { t: '第2条（会員登録）', d: '本サービスの利用には会員登録が必要です。登録情報は正確かつ最新のものを入力してください。' },
            { t: '第3条（出品・入札）', d: '出品者は、出品物について必要な情報を正確に申告するものとします。買受者は、入札の意思表示が落札確定前であっても撤回できないことに同意します。' },
            { t: '第4条（手数料）', d: '本サービスの利用にあたり、所定の手数料が発生する場合があります。詳細は別途料金表に従います。' },
            { t: '第5条（禁止事項）', d: '法令違反、不正アクセス、虚偽の情報登録、他のユーザーへの迷惑行為等を禁止します。' },
            { t: '第6条（免責事項）', d: '当社は、本サービス利用中に発生したトラブルについて、一切の責任を負いません。' },
            { t: '第7条（規約変更）', d: '当社は、必要に応じて本規約を変更することができます。変更後の規約は、本サービス上に掲示された時点で効力を生じます。' },
          ].map((s) => (
            <Box key={s.t}>
              <Typography variant="h6" fontWeight="bold" gutterBottom>{s.t}</Typography>
              <Typography variant="body2">{s.d}</Typography>
            </Box>
          ))}
        </Stack>
      </Paper>
    </Container>
  ),
};

/** プライバシーポリシー */
export const PrivacyPolicy: StoryObj = {
  name: 'プライバシーポリシー',
  render: () => (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Typography variant="h4" fontWeight="bold" gutterBottom>プライバシーポリシー</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>最終更新日: 2026年1月1日</Typography>
      <Paper sx={{ p: 4 }}>
        <Stack spacing={3}>
          {[
            { t: '1. 取得する情報', d: '会員登録時にご提供いただく氏名・連絡先・住所・口座情報など、サービスの提供に必要な情報を取得します。' },
            { t: '2. 利用目的', d: '取得した情報は、本人確認、サービス提供、料金決済、お知らせの配信、サービス改善のために使用します。' },
            { t: '3. 第三者提供', d: '法令に基づく場合や、本人の同意を得た場合を除き、第三者に提供することはありません。' },
            { t: '4. 安全管理', d: '取得した情報は、漏えい・改ざん・不正アクセスを防ぐための安全管理措置を講じます。' },
            { t: '5. 開示・訂正・削除', d: '本人からの開示・訂正・削除の請求には、適切に対応します。' },
            { t: '6. お問い合わせ窓口', d: '個人情報の取り扱いに関するお問い合わせは、サポート窓口までご連絡ください。' },
          ].map((s) => (
            <Box key={s.t}>
              <Typography variant="h6" fontWeight="bold" gutterBottom>{s.t}</Typography>
              <Typography variant="body2">{s.d}</Typography>
            </Box>
          ))}
        </Stack>
      </Paper>
    </Container>
  ),
};

/** 特定商取引法に基づく表記 */
export const SpecifiedCommercialTransaction: StoryObj = {
  name: '特定商取引法に基づく表記',
  render: () => (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Typography variant="h4" fontWeight="bold" gutterBottom>特定商取引法に基づく表記</Typography>
      <Paper sx={{ p: 4, mt: 3 }}>
        <Table>
          <TableBody>
            {[
              ['販売事業者', '株式会社○○'],
              ['代表責任者', '山田 太郎'],
              ['所在地', '〒100-0001 東京都千代田区千代田1-1'],
              ['電話番号', '03-0000-0000（受付時間: 平日 10:00〜17:00）'],
              ['メールアドレス', 'support@example.com'],
              ['販売価格', '各オークションページに表示'],
              ['送料', '別途送料を申し受けます（地域別）'],
              ['支払方法', '銀行振込、クレジットカード'],
              ['支払時期', '落札確定後3営業日以内'],
              ['引渡時期', '入金確認後、5営業日以内に発送'],
              ['返品・交換', '生体の特性上、原則として返品・交換はお受けできません'],
            ].map(([k, v]) => (
              <TableRow key={k}>
                <TableCell sx={{ width: 200, fontWeight: 'bold', bgcolor: 'grey.50' }}>{k}</TableCell>
                <TableCell>{v}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Paper>
    </Container>
  ),
};
