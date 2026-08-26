import React from 'react';
import { Box, Container, Typography, Paper, Divider, Table, TableBody, TableCell, TableContainer, TableRow } from '@mui/material';
import { LEGAL_CONTACT } from '@/lib/legalContact';

export default function SpecifiedCommercialTransaction() {
  const tableData = [
    { label: '販売業者', value: '日本メダカオンライン市場運営事務局' },
    { label: '運営統括責任者', value: LEGAL_CONTACT.operator },
    { label: '所在地', value: `${LEGAL_CONTACT.postalCode}\n${LEGAL_CONTACT.street}` },
    { label: '電話番号', value: LEGAL_CONTACT.tel },
    { label: 'メールアドレス', value: LEGAL_CONTACT.email },
    // { label: 'URL', value: 'https://medaka-auction.example.com' },
    { label: '販売価格', value: 'オークション形式のため、落札価格が販売価格となります。\n別途、システム利用手数料・配送料がかかります。' },
    { label: '商品代金以外の必要料金', value: '・システム利用手数料：落札価格の10%\n・配送料：実費（地域・サイズにより異なります）\n・振込手数料：お客様負担' },
    { label: '支払方法', value: '銀行振込、クレジットカード決済' },
    { label: '支払時期', value: '落札後7日以内' },
    { label: '商品の引渡時期', value: '入金確認後、5営業日以内に発送\n※生体の状態・天候により変動する場合があります' },
    { label: '返品・交換', value: '生体のため、お客様都合による返品・交換はお受けできません。\n到着時に死着があった場合は、到着日当日中にご連絡ください。\n写真確認の上、対応いたします。' },
    { label: '返品送料', value: '当社責任による返品の場合：当社負担\n死着補償対応の場合：当社負担' },
    { label: 'サービス利用上の注意', value: '・オークションへの参加には会員登録が必要です。\n・出品者・落札者間のトラブルについては、当事者間で解決していただきます。\n・不正行為が発覚した場合、アカウント停止等の措置を取ることがあります。' },
  ];

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Paper sx={{ p: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom sx={{ fontWeight: 600 }}>
          特定商取引法に基づく表記
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          最終更新日: 2026年5月19日
        </Typography>
        <Divider sx={{ mb: 4 }} />

        <TableContainer>
          <Table>
            <TableBody>
              {tableData.map((row, index) => (
                <TableRow key={index}>
                  <TableCell
                    component="th"
                    scope="row"
                    sx={{
                      width: '30%',
                      fontWeight: 600,
                      bgcolor: 'grey.50',
                      verticalAlign: 'top',
                      borderRight: '1px solid',
                      borderColor: 'divider',
                    }}
                  >
                    {row.label}
                  </TableCell>
                  <TableCell sx={{ whiteSpace: 'pre-line', lineHeight: 1.8 }}>
                    {row.value}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>

        <Divider sx={{ my: 4 }} />

        <Box>
          <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
            お問い合わせ先
          </Typography>
          <Typography variant="body2" sx={{ lineHeight: 2 }}>
            日本メダカオンライン市場運営事務局<br />
            {LEGAL_CONTACT.postalCode}<br />
            {LEGAL_CONTACT.street}
          </Typography>
        </Box>
      </Paper>
    </Container>
  );
}
