import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Divider,
  Box,
  IconButton,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';

type LegalType = 'tokushoho' | 'privacy' | 'terms' | 'refund' | null;

interface EcLegalModalProps {
  open: LegalType;
  onClose: () => void;
}

const MODAL_TITLE: Record<string, string> = {
  tokushoho: '特定商取引法に基づく表記',
  privacy: 'プライバシーポリシー',
  terms: '利用規約',
  refund: '返金ポリシー',
};

function TokushohoContent() {
  const rows = [
    ['販売業者', 'MEDAKA AUCTION 運営事務局'],
    ['運営責任者', '代表者名'],
    ['所在地', '〒000-0000 ○○県○○市○○町0-0-0'],
    ['電話番号', '000-0000-0000（受付時間：平日10:00〜17:00）'],
    ['メールアドレス', 'info@medaka-auction.com'],
    ['販売URL', 'https://medaka-auction.com/ec'],
    ['販売価格', '各商品ページに記載の価格（税込）'],
    ['商品代金以外の必要料金', '送料（地域により異なります）、振込手数料（銀行振込の場合）'],
    ['支払方法', 'クレジットカード決済、銀行振込'],
    ['支払時期', 'クレジットカード：ご注文時 / 銀行振込：ご注文後7日以内'],
    ['商品の引渡時期', 'ご注文確認後、3〜7営業日以内に発送'],
    ['返品・交換について', '生体のため、お客様都合による返品・交換は原則お受けできません。到着時の死着については返金ポリシーをご確認ください。'],
  ];

  return (
    <Box>
      {rows.map(([label, value], i) => (
        <Box key={i} sx={{ py: 1.5, borderBottom: '1px solid', borderColor: 'divider' }}>
          <Typography variant="subtitle2" sx={{ color: 'text.secondary', mb: 0.5, fontSize: '0.75rem' }}>
            {label}
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.primary' }}>
            {value}
          </Typography>
        </Box>
      ))}
    </Box>
  );
}

function PrivacyContent() {
  return (
    <Box sx={{ '& > *:not(:last-child)': { mb: 3 } }}>
      <section>
        <Typography variant="h6" gutterBottom>1. 個人情報の収集</Typography>
        <Typography variant="body2">
          当サイトでは、お問い合わせやご注文の際に、お名前、ご住所、電話番号、メールアドレス等の個人情報をお伺いすることがあります。
          これらの情報は、サービスの提供およびお客様対応のために必要な範囲でのみ収集いたします。
        </Typography>
      </section>
      <section>
        <Typography variant="h6" gutterBottom>2. 個人情報の利用目的</Typography>
        <Typography variant="body2">
          収集した個人情報は、以下の目的で利用いたします。
        </Typography>
        <Box component="ul" sx={{ pl: 2, mt: 1 }}>
          <li><Typography variant="body2">商品の発送およびご連絡</Typography></li>
          <li><Typography variant="body2">ご注文内容の確認</Typography></li>
          <li><Typography variant="body2">お問い合わせへの回答</Typography></li>
          <li><Typography variant="body2">サービスの改善・新サービスの開発</Typography></li>
        </Box>
      </section>
      <section>
        <Typography variant="h6" gutterBottom>3. 個人情報の第三者提供</Typography>
        <Typography variant="body2">
          当サイトでは、以下の場合を除き、お客様の個人情報を第三者に提供することはありません。
        </Typography>
        <Box component="ul" sx={{ pl: 2, mt: 1 }}>
          <li><Typography variant="body2">お客様の同意がある場合</Typography></li>
          <li><Typography variant="body2">法令に基づく場合</Typography></li>
          <li><Typography variant="body2">商品の配送業務のために配送業者に提供する場合</Typography></li>
        </Box>
      </section>
      <section>
        <Typography variant="h6" gutterBottom>4. 個人情報の管理</Typography>
        <Typography variant="body2">
          お客様の個人情報は、適切な安全対策を講じ、不正アクセス、紛失、破壊、改ざん、漏洩等の防止に努めます。
        </Typography>
      </section>
      <section>
        <Typography variant="h6" gutterBottom>5. Cookieの使用</Typography>
        <Typography variant="body2">
          当サイトでは、サービスの利便性向上のためにCookieを使用する場合があります。
          Cookieの使用を望まない場合は、ブラウザの設定により無効にすることが可能です。
        </Typography>
      </section>
      <section>
        <Typography variant="h6" gutterBottom>6. お問い合わせ</Typography>
        <Typography variant="body2">
          個人情報の取り扱いに関するお問い合わせは、下記までご連絡ください。<br />
          メール：info@medaka-auction.com
        </Typography>
      </section>
    </Box>
  );
}

function TermsContent() {
  return (
    <Box sx={{ '& > *:not(:last-child)': { mb: 3 } }}>
      <section>
        <Typography variant="h6" gutterBottom>第1条（適用）</Typography>
        <Typography variant="body2">
          本利用規約は、MEDAKA AUCTION（以下「当サイト」）が提供するすべてのサービスに適用されます。
          ユーザーは本規約に同意の上、サービスをご利用ください。
        </Typography>
      </section>
      <section>
        <Typography variant="h6" gutterBottom>第2条（商品について）</Typography>
        <Typography variant="body2">
          当サイトで販売する商品はメダカ等の生体です。生体の性質上、色味・体型等に個体差がございます。
          商品画像はあくまで参考であり、実際にお届けする個体とは異なる場合があります。
        </Typography>
      </section>
      <section>
        <Typography variant="h6" gutterBottom>第3条（注文・決済）</Typography>
        <Typography variant="body2">
          ご注文は当サイト上での手続き完了をもって成立するものとします。
          決済は外部決済サービスを通じて行われ、当サイトではクレジットカード情報等を直接保持いたしません。
        </Typography>
      </section>
      <section>
        <Typography variant="h6" gutterBottom>第4条（配送）</Typography>
        <Typography variant="body2">
          生体の配送は、季節・天候等を考慮し、安全な方法で行います。
          配送中の事故等については、到着時の状態に応じて対応いたします。
        </Typography>
      </section>
      <section>
        <Typography variant="h6" gutterBottom>第5条（禁止事項）</Typography>
        <Typography variant="body2">
          ユーザーは以下の行為を行ってはなりません。
        </Typography>
        <Box component="ul" sx={{ pl: 2, mt: 1 }}>
          <li><Typography variant="body2">虚偽の情報を登録する行為</Typography></li>
          <li><Typography variant="body2">当サイトの運営を妨害する行為</Typography></li>
          <li><Typography variant="body2">他のユーザーに迷惑をかける行為</Typography></li>
          <li><Typography variant="body2">法令に違反する行為</Typography></li>
        </Box>
      </section>
      <section>
        <Typography variant="h6" gutterBottom>第6条（免責事項）</Typography>
        <Typography variant="body2">
          当サイトは、サービスの中断・停止等により生じた損害について、一切の責任を負いません。
          生体の飼育結果については、お客様の飼育環境に依存するため保証いたしかねます。
        </Typography>
      </section>
      <section>
        <Typography variant="h6" gutterBottom>第7条（規約の変更）</Typography>
        <Typography variant="body2">
          当サイトは、必要に応じて本規約を変更できるものとします。
          変更後の規約は、当サイト上に掲載した時点で効力を生じるものとします。
        </Typography>
      </section>
    </Box>
  );
}

function RefundContent() {
  return (
    <Box sx={{ '& > *:not(:last-child)': { mb: 3 } }}>
      <section>
        <Typography variant="h6" gutterBottom>1. 基本方針</Typography>
        <Typography variant="body2">
          メダカは生体のため、お客様のご都合による返品・返金は原則としてお受けしておりません。
          ご注文前に商品説明をよくお読みいただき、ご不明な点はお問い合わせください。
        </Typography>
      </section>
      <section>
        <Typography variant="h6" gutterBottom>2. 死着保証</Typography>
        <Typography variant="body2">
          配送中の死着（到着時に死亡していた場合）については、以下の条件で返金または代替品の発送にて対応いたします。
        </Typography>
        <Box component="ul" sx={{ pl: 2, mt: 1 }}>
          <li><Typography variant="body2">到着日当日中にご連絡いただくこと</Typography></li>
          <li><Typography variant="body2">開封前の状態で写真をお送りいただくこと</Typography></li>
          <li><Typography variant="body2">袋の水を捨てずに保管いただくこと</Typography></li>
        </Box>
      </section>
      <section>
        <Typography variant="h6" gutterBottom>3. 返金対象外</Typography>
        <Typography variant="body2">
          以下の場合は返金対象外となります。
        </Typography>
        <Box component="ul" sx={{ pl: 2, mt: 1 }}>
          <li><Typography variant="body2">到着後の飼育環境に起因する死亡</Typography></li>
          <li><Typography variant="body2">お客様の不在等により配送が遅延した場合</Typography></li>
          <li><Typography variant="body2">色味・体型等の個体差に関するもの</Typography></li>
          <li><Typography variant="body2">ご連絡が到着翌日以降になった場合</Typography></li>
        </Box>
      </section>
      <section>
        <Typography variant="h6" gutterBottom>4. 返金方法</Typography>
        <Typography variant="body2">
          返金が認められた場合、お支払い方法に応じて以下の方法で返金いたします。
        </Typography>
        <Box component="ul" sx={{ pl: 2, mt: 1 }}>
          <li><Typography variant="body2">クレジットカード：カード会社を通じて返金</Typography></li>
          <li><Typography variant="body2">銀行振込：ご指定の口座へ振込（振込手数料は当方負担）</Typography></li>
        </Box>
      </section>
      <section>
        <Typography variant="h6" gutterBottom>5. お問い合わせ先</Typography>
        <Typography variant="body2">
          返金に関するお問い合わせは、下記までご連絡ください。<br />
          メール：info@medaka-auction.com<br />
          受付時間：平日 10:00〜17:00
        </Typography>
      </section>
    </Box>
  );
}

const CONTENT_MAP: Record<string, () => JSX.Element> = {
  tokushoho: TokushohoContent,
  privacy: PrivacyContent,
  terms: TermsContent,
  refund: RefundContent,
};

export default function EcLegalModals({ open, onClose }: EcLegalModalProps) {
  if (!open) return null;
  const ContentComponent = CONTENT_MAP[open];
  if (!ContentComponent) return null;

  return (
    <Dialog
      open={!!open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      scroll="paper"
      PaperProps={{
        sx: {
          borderRadius: 3,
          maxHeight: '80vh',
        },
      }}
    >
      <DialogTitle
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontWeight: 700,
          fontSize: '1.25rem',
          pb: 1,
        }}
      >
        {MODAL_TITLE[open]}
        <IconButton onClick={onClose} size="small">
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <Divider />
      <DialogContent sx={{ py: 3 }}>
        <ContentComponent />
      </DialogContent>
      <Divider />
      <DialogActions sx={{ p: 2 }}>
        <Button onClick={onClose} variant="contained" sx={{ borderRadius: 2 }}>
          閉じる
        </Button>
      </DialogActions>
    </Dialog>
  );
}
