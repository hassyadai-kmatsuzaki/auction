import React from 'react';
import { Box, Container, Typography, Paper, Divider } from '@mui/material';

export default function PrivacyPolicy() {
  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Paper sx={{ p: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom sx={{ fontWeight: 600 }}>
          プライバシーポリシー
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          最終更新日: 2025年1月1日
        </Typography>
        <Divider sx={{ mb: 4 }} />

        <Box sx={{ '& > section': { mb: 4 } }}>
          <section>
            <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
              1. 個人情報の収集について
            </Typography>
            <Typography variant="body2" paragraph sx={{ lineHeight: 1.8 }}>
              メダカオークション運営事務局（以下「当社」）は、本サービスの提供にあたり、以下の個人情報を収集することがあります。
            </Typography>
            <Typography component="ul" variant="body2" sx={{ pl: 2, lineHeight: 2 }}>
              <li>氏名、住所、電話番号、メールアドレス等の連絡先情報</li>
              <li>銀行口座情報</li>
              <li>本人確認書類の情報</li>
              <li>サービス利用履歴、取引履歴</li>
              <li>端末情報、IPアドレス、Cookie情報</li>
            </Typography>
          </section>

          <section>
            <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
              2. 個人情報の利用目的
            </Typography>
            <Typography variant="body2" paragraph sx={{ lineHeight: 1.8 }}>
              当社は、収集した個人情報を以下の目的で利用いたします。
            </Typography>
            <Typography component="ul" variant="body2" sx={{ pl: 2, lineHeight: 2 }}>
              <li>本サービスの提供、運営、維持</li>
              <li>ユーザー登録、本人確認</li>
              <li>取引の成立、代金決済、商品の配送</li>
              <li>お問い合わせへの対応</li>
              <li>サービスの改善、新サービスの開発</li>
              <li>利用規約違反行為への対応</li>
              <li>法令に基づく対応</li>
            </Typography>
          </section>

          <section>
            <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
              3. 個人情報の第三者提供
            </Typography>
            <Typography variant="body2" paragraph sx={{ lineHeight: 1.8 }}>
              当社は、以下の場合を除き、お客様の個人情報を第三者に提供することはありません。
            </Typography>
            <Typography component="ul" variant="body2" sx={{ pl: 2, lineHeight: 2 }}>
              <li>お客様の同意がある場合</li>
              <li>法令に基づく場合</li>
              <li>人の生命、身体または財産の保護のために必要な場合</li>
              <li>取引の相手方に対し、取引の履行に必要な範囲で提供する場合</li>
              <li>業務委託先に対し、委託業務の遂行に必要な範囲で提供する場合</li>
            </Typography>
          </section>

          <section>
            <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
              4. 個人情報の管理
            </Typography>
            <Typography variant="body2" paragraph sx={{ lineHeight: 1.8 }}>
              当社は、お客様の個人情報を正確かつ最新の状態に保ち、個人情報への不正アクセス、紛失、破損、改ざん、漏洩などを防止するため、セキュリティシステムの維持、管理体制の整備、社員教育の徹底等の必要な措置を講じ、安全対策を実施し個人情報の厳重な管理を行います。
            </Typography>
          </section>

          <section>
            <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
              5. 個人情報の開示・訂正・削除
            </Typography>
            <Typography variant="body2" paragraph sx={{ lineHeight: 1.8 }}>
              お客様は、当社に対し、ご自身の個人情報の開示、訂正、削除を求めることができます。ご希望の場合は、下記の連絡先までお問い合わせください。本人確認の上、対応いたします。
            </Typography>
          </section>

          <section>
            <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
              6. Cookieの使用について
            </Typography>
            <Typography variant="body2" paragraph sx={{ lineHeight: 1.8 }}>
              当社のウェブサイトでは、サービス向上のためCookieを使用しています。Cookieとは、ウェブサイトがお客様のコンピュータに送信する小さなテキストファイルで、サイトの利用状況の分析や、ログイン状態の維持に使用されます。ブラウザの設定により、Cookieを無効にすることも可能ですが、一部のサービスが利用できなくなる場合があります。
            </Typography>
          </section>

          <section>
            <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
              7. プライバシーポリシーの変更
            </Typography>
            <Typography variant="body2" paragraph sx={{ lineHeight: 1.8 }}>
              当社は、必要に応じて本プライバシーポリシーを変更することがあります。変更後のプライバシーポリシーは、本ウェブサイト上に掲載した時点から効力を生じるものとします。
            </Typography>
          </section>

          <Divider sx={{ my: 4 }} />

          <section>
            <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
              お問い合わせ先
            </Typography>
            <Typography variant="body2" sx={{ lineHeight: 2 }}>
              メダカオークション運営事務局<br />
              〒104-0061<br />
              東京都中央区銀座1-12-4 N&E BLD.7階<br />
              TEL: 03-1234-5678
            </Typography>
          </section>
        </Box>
      </Paper>
    </Container>
  );
}

