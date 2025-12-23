import React from 'react';
import { Box, Container, Typography, Paper, Divider } from '@mui/material';

export default function TermsOfService() {
  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Paper sx={{ p: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom sx={{ fontWeight: 600 }}>
          利用規約
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          最終更新日: 2025年1月1日
        </Typography>
        <Divider sx={{ mb: 4 }} />

        <Box sx={{ '& > section': { mb: 4 } }}>
          <section>
            <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
              第1条（適用）
            </Typography>
            <Typography variant="body2" paragraph sx={{ lineHeight: 1.8 }}>
              本規約は、メダカオークション運営事務局（以下「当社」）が運営するメダカオークションサービス（以下「本サービス」）の利用に関する条件を、本サービスを利用するすべてのユーザー（以下「ユーザー」）と当社との間で定めるものです。
            </Typography>
          </section>

          <section>
            <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
              第2条（定義）
            </Typography>
            <Typography variant="body2" paragraph sx={{ lineHeight: 1.8 }}>
              本規約において使用する用語の定義は、以下の通りとします。
            </Typography>
            <Typography component="ol" variant="body2" sx={{ pl: 2, lineHeight: 2 }}>
              <li>「本サービス」とは、当社が運営するメダカ等の観賞魚のオンラインオークションサービスをいいます。</li>
              <li>「ユーザー」とは、本サービスに登録したすべての利用者をいいます。</li>
              <li>「出品者」とは、本サービスにおいて商品を出品するユーザーをいいます。</li>
              <li>「落札者」とは、本サービスにおいてオークションで商品を落札したユーザーをいいます。</li>
            </Typography>
          </section>

          <section>
            <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
              第3条（会員登録）
            </Typography>
            <Typography component="ol" variant="body2" sx={{ pl: 2, lineHeight: 2 }}>
              <li>本サービスの利用を希望する者は、本規約に同意の上、当社が定める方法により会員登録を行うものとします。</li>
              <li>当社は、会員登録の申請者に以下の事由があると判断した場合、登録を拒否することがあります。
                <ul>
                  <li>虚偽の情報を届け出た場合</li>
                  <li>過去に本規約に違反したことがある場合</li>
                  <li>反社会的勢力に該当する、または関係があると判断した場合</li>
                  <li>その他、当社が不適当と判断した場合</li>
                </ul>
              </li>
            </Typography>
          </section>

          <section>
            <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
              第4条（オークションへの参加）
            </Typography>
            <Typography component="ol" variant="body2" sx={{ pl: 2, lineHeight: 2 }}>
              <li>ユーザーは、当社が開催するオークションに参加することができます。</li>
              <li>入札は取り消すことができません。入札する際は、よくご確認の上、入札してください。</li>
              <li>最高入札者が落札者となります。落札者は、落札した商品を購入する義務を負います。</li>
            </Typography>
          </section>

          <section>
            <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
              第5条（出品）
            </Typography>
            <Typography component="ol" variant="body2" sx={{ pl: 2, lineHeight: 2 }}>
              <li>出品者は、当社が定める方法により商品を出品することができます。</li>
              <li>出品者は、出品する商品について正確な情報を提供する義務を負います。</li>
              <li>以下の商品は出品できません。
                <ul>
                  <li>法令により販売が禁止されている生体</li>
                  <li>特定外来生物に該当する生体</li>
                  <li>病気、奇形等により飼育が困難な個体</li>
                  <li>その他、当社が不適当と判断した商品</li>
                </ul>
              </li>
            </Typography>
          </section>

          <section>
            <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
              第6条（取引の成立）
            </Typography>
            <Typography component="ol" variant="body2" sx={{ pl: 2, lineHeight: 2 }}>
              <li>オークション終了時点で最高入札者がいる場合、出品者と落札者の間で売買契約が成立します。</li>
              <li>落札者は、落札後7日以内に代金を支払うものとします。</li>
              <li>出品者は、入金確認後5営業日以内に商品を発送するものとします。</li>
            </Typography>
          </section>

          <section>
            <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
              第7条（手数料）
            </Typography>
            <Typography component="ol" variant="body2" sx={{ pl: 2, lineHeight: 2 }}>
              <li>出品者は、落札価格の10%を出品手数料として当社に支払うものとします。</li>
              <li>落札者は、落札価格の10%をシステム利用手数料として当社に支払うものとします。</li>
              <li>配送料は落札者の負担とします。</li>
            </Typography>
          </section>

          <section>
            <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
              第8条（禁止事項）
            </Typography>
            <Typography variant="body2" paragraph sx={{ lineHeight: 1.8 }}>
              ユーザーは、本サービスの利用にあたり、以下の行為をしてはなりません。
            </Typography>
            <Typography component="ul" variant="body2" sx={{ pl: 2, lineHeight: 2 }}>
              <li>法令または公序良俗に違反する行為</li>
              <li>犯罪行為に関連する行為</li>
              <li>当社または第三者の知的財産権を侵害する行為</li>
              <li>当社または第三者の名誉・信用を毀損する行為</li>
              <li>虚偽の情報を登録する行為</li>
              <li>不正な入札行為（自己入札、つり上げ行為等）</li>
              <li>落札後のキャンセル</li>
              <li>本サービスの運営を妨害する行為</li>
              <li>その他、当社が不適当と判断する行為</li>
            </Typography>
          </section>

          <section>
            <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
              第9条（サービスの停止・中断）
            </Typography>
            <Typography variant="body2" paragraph sx={{ lineHeight: 1.8 }}>
              当社は、以下の場合には、ユーザーに事前に通知することなく本サービスの全部または一部の提供を停止または中断することがあります。
            </Typography>
            <Typography component="ul" variant="body2" sx={{ pl: 2, lineHeight: 2 }}>
              <li>システムの保守点検または更新を行う場合</li>
              <li>地震、落雷、火災等の不可抗力により本サービスの提供が困難となった場合</li>
              <li>その他、当社が停止または中断を必要と判断した場合</li>
            </Typography>
          </section>

          <section>
            <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
              第10条（免責事項）
            </Typography>
            <Typography component="ol" variant="body2" sx={{ pl: 2, lineHeight: 2 }}>
              <li>当社は、本サービスを通じて行われる取引について、その成立、履行を保証するものではありません。</li>
              <li>ユーザー間のトラブルについては、当事者間で解決するものとし、当社は一切の責任を負いません。</li>
              <li>生体の状態については、出品者の責任において情報提供されるものであり、当社は保証しません。</li>
              <li>配送中の生体の死亡については、当社は責任を負いません。</li>
            </Typography>
          </section>

          <section>
            <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
              第11条（規約の変更）
            </Typography>
            <Typography variant="body2" paragraph sx={{ lineHeight: 1.8 }}>
              当社は、必要と判断した場合には、本規約を変更することができます。変更後の規約は、本ウェブサイト上に掲載した時点から効力を生じるものとします。
            </Typography>
          </section>

          <section>
            <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
              第12条（準拠法・管轄裁判所）
            </Typography>
            <Typography component="ol" variant="body2" sx={{ pl: 2, lineHeight: 2 }}>
              <li>本規約の解釈にあたっては、日本法を準拠法とします。</li>
              <li>本サービスに関して紛争が生じた場合には、東京地方裁判所を第一審の専属的合意管轄とします。</li>
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

