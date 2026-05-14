@php
  $brand = 'MEDAICHI';
  $lineUrl = 'https://liff.line.me/2009178950-3kyQfbZq?route=add&source=FWUbEVcD';
@endphp
<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">

  <!-- Meta Pixel Code -->
  <script>
  !function(f,b,e,v,n,t,s)
  {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
  n.callMethod.apply(n,arguments):n.queue.push(arguments)};
  if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
  n.queue=[];t=b.createElement(e);t.async=!0;
  t.src=v;s=b.getElementsByTagName(e)[0];
  s.parentNode.insertBefore(t,s)}(window, document,'script',
  'https://connect.facebook.net/en_US/fbevents.js');
  fbq('init', '1745877730110348');
  fbq('track', 'PageView');
  </script>
  <noscript><img height="1" width="1" style="display:none"
  src="https://www.facebook.com/tr?id=1745877730110348&ev=PageView&noscript=1"
  /></noscript>
  <!-- End Meta Pixel Code -->

  <meta name="robots" content="noindex, nofollow">
  <title>出品者の方へ | {{ config('app.name', $brand) }}</title>
  <meta name="description" content="メダカを送るだけ。撮影・梱包・発送・問い合わせ対応は MEDAICHI が代行し、ヤフオクの相場を守りながら卸せる業者専用オンラインオークション。">
  <link rel="icon" type="image/png" href="/favicon.png">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;700;900&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="/css/lp.css?v=42">
  <script>
    (function(d) {
      var config = { kitId: 'png6ego', scriptTimeout: 3000, async: true },
      h=d.documentElement,t=setTimeout(function(){h.className=h.className.replace(/\bwf-loading\b/g,"")+" wf-inactive";},config.scriptTimeout),tk=d.createElement("script"),f=false,s=d.getElementsByTagName("script")[0],a;h.className+=" wf-loading";tk.src='https://use.typekit.net/'+config.kitId+'.js';tk.async=true;tk.onload=tk.onreadystatechange=function(){a=this.readyState;if(f||a&&a!="complete"&&a!="loaded")return;f=true;clearTimeout(t);try{Typekit.load(config)}catch(e){}};s.parentNode.insertBefore(tk,s)
    })(document);
  </script>
</head>
<body class="lp-seller">

<!-- ===== HEADER ===== -->
<header class="header" id="header">
  <div class="header__inner">
    <a href="/seller" class="header__logo">
      <img src="/img/logo.png?v=2" alt="{{ $brand }}" class="header__logo-img">
    </a>
    <div class="header__right">
      <a href="/buyer" class="header__btn header__btn--login">落札者の方へ</a>
      <a href="{{ $lineUrl }}" target="_blank" rel="noopener noreferrer" class="header__cta" onclick="fbq('track', 'Lead'); return true;">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="white"><path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63h2.386c.346 0 .627.285.627.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63.346 0 .628.285.628.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.281.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314"/></svg>
        <span>LINE登録</span>
      </a>
    </div>
  </div>
</header>

<!-- ===== HERO ===== -->
<section class="hero">
  <div class="hero__inner">
    <p class="hero__eyebrow sp-only hero-anim" data-hero-delay="1">撮影代行 × 匿名出品可 × 相場防衛</p>

    <div class="hero__visual hero-anim" data-hero-delay="2">
      <img src="/img/lp/fv-okada-yui.png?v" alt="" class="hero__visual-img" loading="eager">
      {{-- <span class="hero__visual-credit">岡田結実</span> --}}
    </div>

    <div class="hero__copy hero-anim" data-hero-delay="3">
      <p class="hero__eyebrow hero__eyebrow--inline pc-only">撮影代行 × 匿名出品可 × 相場防衛</p>
      <h1 class="hero__title">
        <span class="hero__title-line">業界初、業者専用</span>
        <span class="hero__title-line hero__title-line--strong">オンラインオークション。</span>
      </h1>
      <p class="hero__desc">
        メダカを送るだけ。<br class="pc-only">
        撮影・顧客対応・梱包・発送は {{ $brand }} が代行し、<br>
        ヤフオクの相場を守りながら卸せる場所。<br>
        業者だけのオンラインオークション、それが {{ $brand }}（日本メダカオンライン市場）です。
      </p>
      <p class="hero__notice">
        ※ 現在、出品枠は応募多数につき新規受付を一時制限中です。<br class="pc-only">
        まずは落札者会員にご登録いただき、申込フォームの「出品にも興味あり」にチェックいただくと、解放時に優先ご案内します。
      </p>
    </div>

    <div class="hero__cta hero-anim" data-hero-delay="4">
      <a href="{{ $lineUrl }}" target="_blank" rel="noopener noreferrer" class="hero__cta-card hero__cta-card--primary" onclick="fbq('track', 'Lead'); return true;">
        <span class="hero__cta-card__icon" aria-hidden="true">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12c2-3 5-5 9-5s7 2 9 5c-2 3-5 5-9 5s-7-2-9-5z"/><circle cx="12" cy="12" r="2.2" fill="currentColor"/></svg>
        </span>
        <span class="hero__cta-card__body">
          <span class="hero__cta-card__title">LINE追加でデモを試す</span>
          <span class="hero__cta-card__sub">出品の最新情報をお届け</span>
        </span>
        <span class="hero__cta-card__arrow" aria-hidden="true">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
        </span>
      </a>
      <a href="#contact" class="hero__cta-card hero__cta-card--secondary">
        <span class="hero__cta-card__icon" aria-hidden="true">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><polyline points="3 7 12 13 21 7"/></svg>
        </span>
        <span class="hero__cta-card__body">
          <span class="hero__cta-card__title">メールで問い合わせる</span>
          <span class="hero__cta-card__sub">メール・お電話どちらでも対応</span>
        </span>
        <span class="hero__cta-card__arrow" aria-hidden="true">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
        </span>
      </a>
    </div>
  </div>
</section>

<!-- ===== ② 協賛企業・出品ブリーダー ロゴ帯 ===== -->
<section class="section section--partners" id="partners">
  <div class="container">
    <div class="partners-header anim" data-anim="fade-up">
      <h2 class="partners-header__title">
        協賛企業・<span class="partners-header__num">出品ブリーダー</span>
      </h2>
    </div>

    <p class="partners-header__desc anim visible" data-anim="fade-up" style="text-align:center;max-width: 100%;margin:0 auto 1.5rem;color:#4a5568;font-weight:500;line-height:1.85;font-size:clamp(0.92rem, 1.6vw, 1rem);">
      日本のメダカ業界を代表する<br class="sp-only">メーカー・専業ブリーダーが参画する、<br class="sp-only">業者間プラットフォームです。
    </p>

    {{-- 出品ブリーダー（横スクロール） --}}
    <p class="partners-row__label anim" data-anim="fade-up">出品ブリーダー</p>
    @php $breeders = [7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26]; @endphp
    <div class="partners-marquee anim" data-anim="fade-up" aria-hidden="true">
      <div class="partners-marquee__track">
        @for ($i = 0; $i < 3; $i++)
          @foreach ($breeders as $n)
            <div class="partners-marquee__item">
              <img src="/img/lp/seller/{{ $n }}.png" alt="" loading="lazy">
            </div>
          @endforeach
        @endfor
      </div>
    </div>

    {{-- 協賛企業（7社・静止グリッド） --}}
    <p class="partners-row__label anim" data-anim="fade-up">協賛企業</p>
    @php $supporters = [1, 2, 3, 4, 5, 6, 7]; @endphp
    <div class="partners-grid anim" data-anim="fade-up">
      @foreach ($supporters as $n)
        <div class="partners-grid__item">
          <img src="/img/lp/supporter/{{ $n }}.png" alt="" loading="lazy">
        </div>
      @endforeach
    </div>
  </div>
</section>

<!-- ===== ③ メダカ業界を、もう一段。 ===== -->
<section class="section section--mission">
  <div class="container">
    <div class="mission-inner anim" data-anim="fade-up">
      <h2 class="mission-title">メダカ業界を、<br class="sp-only">もう一段。</h2>
      <div class="mission-quote">
        <p class="mission-lead">
          日本のメダカ業界には、業者だけの場所が必要だと、<br class="sp-only">
          私たちは考えています。
        </p>

        <div class="mission-body">
          <p>ヤフオクは便利。でも、個人愛好家との混雑で、
            業者間の相場は読みにくく、丹精込めた個体が値崩れすることもある。<br>
            オフライン競りは信頼できる。でも、地域に縛られ、
            参加できる業者は限られる。<br>
            業者間の卸取引は、業界の根幹であるはずなのに、
            それに見合うインフラが、これまでありませんでした。</p>
        </div>

        <div class="mission-pledge">
          <p>{{ $brand }} は、業者だけが集まれる<br class="sp-only">オンラインオークションです。</p>
          <p>信頼できるブリーダーから、信頼できる業者へ。<br>
            相場と収益を守りながら、業界全体を、もう一段引き上げる。</p>
        </div>

        <div class="mission-close">
          <p class="mission-close__line">このプラットフォームを、<br class="sp-only">皆さんと一緒につくっていきたい。</p>
          <p class="mission-close__sign">── それが、{{ $brand }} の出発点です。</p>
        </div>
      </div>
    </div>
  </div>
</section>

<!-- ===== ④ 出品者の課題（4課題） ===== -->
<section class="section section--problems" id="problems">
  <div class="container">
    <div class="problems-header anim" data-anim="fade-up">
      <h2 class="problems-header__title">こんなお悩み、<span class="problems-header__mark">ありませんか？</span></h2>
      <p class="problems-header__desc">プロブリーダー・業者が在庫を卸すとき、<br class="pc-only">これまでの市場では解決しきれなかった4つの課題がありました。</p>
    </div>

    <div class="problems-rows">
      <div class="problem-row anim" data-anim="fade-up">
        <span class="problem-row__tag">
          時間
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
        </span>
        <ul class="problem-row__list">
          <li>ヤフオクで売っても、撮影・梱包・発送・問い合わせ対応で本業の時間が削られる</li>
          <li>手取りで思ったほど残らない</li>
        </ul>
      </div>

      <div class="problem-row anim" data-anim="fade-up" data-delay="1">
        <span class="problem-row__tag">
          相場防衛
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
        </span>
        <ul class="problem-row__list">
          <li>ロットで放出したいが、ヤフオクに大量出品すると小売相場を壊してしまう</li>
        </ul>
      </div>

      <div class="problem-row anim" data-anim="fade-up" data-delay="2">
        <span class="problem-row__tag">
          代金回収
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
        </span>
        <ul class="problem-row__list">
          <li>個別販売は代金未払い・連絡不通のリスクがつきまとう</li>
          <li>落札後入金まで2-3週間、トラブル対応も自己責任</li>
        </ul>
      </div>

      <div class="problem-row anim" data-anim="fade-up" data-delay="3">
        <span class="problem-row__tag">
          匿名性
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
        </span>
        <ul class="problem-row__list">
          <li>同業者に屋号を知られたくない</li>
          <li>ヤフオクは出品者名が公開される</li>
        </ul>
      </div>
    </div>
  </div>
</section>

<!-- ===== ⑤ 3つの仕組み ===== -->
<section class="section section--mechanism" id="mechanism">
  <div class="container">
    <div class="mechanism-header anim" data-anim="fade-up">
      <h2 class="mechanism-header__title">
        業者の出品を、<br class="sp-only"><span class="mechanism-header__mark">3つの仕組みで変えます</span>
      </h2>
      <p class="mechanism-header__desc">
        お悩みのひとつひとつに、独自の仕組みで応えます。
      </p>
    </div>

    <div class="solutions-grid">
      <div class="solution-card solution-card--featured anim" data-anim="fade-up">
        <span class="solution-card__visual"><img src="/img/lp/mechanism/01.png" alt="" loading="lazy"></span>
        <span class="solution-card__body">
          <span class="solution-card__title">撮影・出品・梱包・発送・問い合わせ対応、<br>すべて {{ $brand }} が代行</span>
        </span>
      </div>
      <div class="solution-card solution-card--featured anim" data-anim="fade-up" data-delay="1">
        <span class="solution-card__visual"><img src="/img/lp/mechanism/02.png" alt="" loading="lazy"></span>
        <span class="solution-card__body">
          <span class="solution-card__title">業者専用市場で、<br>ヤフオク相場を壊さずに卸せる</span>
        </span>
      </div>
      <div class="solution-card solution-card--featured anim" data-anim="fade-up" data-delay="2">
        <span class="solution-card__visual"><img src="/img/lp/mechanism/03.png" alt="" loading="lazy"></span>
        <span class="solution-card__body">
          <span class="solution-card__title">出品者の屋号は<br>公開／非公開を選択可能</span>
        </span>
      </div>
    </div>

    <p class="mechanism-note anim" data-anim="fade-up" style="text-align:center;margin-top:1.5rem;font-size:0.9rem;color:#4a5568;line-height:1.8;">
      ※ 撮影・梱包・発送・問い合わせ対応は標準サービスです。<br class="pc-only">
      選別についても今後導入を検討しています。
    </p>
  </div>
</section>

<!-- ===== ⑥ 比較表 ===== -->
<section class="section section--compare">
  <div class="container">
    <div class="compare-header anim" data-anim="fade-up">
      <h2 class="compare-header__title">
        業者の出品、<span class="compare-header__mark">選択肢は3つ</span>
      </h2>
      <p class="compare-header__desc">
        これまでメダカ業界で、業者がロットを卸す手段は3つに分かれていました。<br class="pc-only">
        それぞれに長所と限界があります。
      </p>
    </div>

    <div class="compare-table-wrap anim" data-anim="fade-up">
      <table class="compare-table">
        <thead>
          <tr>
            <th></th>
            <th><span class="compare-th__name">ヤフオク</span><span class="compare-th__sub">公開市場</span></th>
            <th><span class="compare-th__name">オフライン業者OK</span><span class="compare-th__sub">地域中心</span></th>
            <th class="compare-th--us"><span class="compare-th__name">{{ $brand }}</span><span class="compare-th__sub">業者向けオンライン</span></th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <th scope="row">参加層</th>
            <td><span class="compare-mark compare-mark--bad">×</span><span class="compare-cell__note">制限なし</span></td>
            <td><span class="compare-mark compare-mark--good">◎</span><span class="compare-cell__note">業者中心（地域）</span></td>
            <td class="compare-td--us"><span class="compare-mark compare-mark--good">◎</span><span class="compare-cell__note">業者専用<br>（招待・審査制）</span></td>
          </tr>
          <tr>
            <th scope="row">審査</th>
            <td><span class="compare-mark compare-mark--bad">×</span><span class="compare-cell__note">なし</span></td>
            <td><span class="compare-mark compare-mark--mid">△</span><span class="compare-cell__note">知人ベース<br>（非公式）</span></td>
            <td class="compare-td--us"><span class="compare-mark compare-mark--good">◎</span><span class="compare-cell__note">招待制<br>（明文化された審査）</span></td>
          </tr>
          <tr>
            <th scope="row">出品後の手取り</th>
            <td><span class="compare-mark compare-mark--bad">×</span><span class="compare-cell__note">薄利</span></td>
            <td><span class="compare-mark compare-mark--mid">△</span><span class="compare-cell__note">時間／地理コスト大</span></td>
            <td class="compare-td--us"><span class="compare-mark compare-mark--good">◎</span><span class="compare-cell__note">卸値＋諸コストなし</span></td>
          </tr>
          <tr>
            <th scope="row">出品の手間</th>
            <td><span class="compare-mark compare-mark--bad">×</span><span class="compare-cell__note">撮影・梱包・発送・対応</span></td>
            <td><span class="compare-mark compare-mark--mid">△</span><span class="compare-cell__note">搬入・現地滞在</span></td>
            <td class="compare-td--us"><span class="compare-mark compare-mark--good">◎</span><span class="compare-cell__note">送るだけ</span></td>
          </tr>
          <tr>
            <th scope="row">相場への影響</th>
            <td><span class="compare-mark compare-mark--bad">×</span><span class="compare-cell__note">公開市場で値崩れリスク</span></td>
            <td><span class="compare-mark compare-mark--mid">△</span><span class="compare-cell__note">地域限定で影響限定的</span></td>
            <td class="compare-td--us"><span class="compare-mark compare-mark--good">◎</span><span class="compare-cell__note">クローズドで完全分離</span></td>
          </tr>
          <tr>
            <th scope="row">代金回収</th>
            <td><span class="compare-mark compare-mark--bad">×</span><span class="compare-cell__note">2-3週間後＋<br>未払いリスク</span></td>
            <td><span class="compare-mark compare-mark--mid">△</span><span class="compare-cell__note">現場現金<br>（現金管理・税務リスク）</span></td>
            <td class="compare-td--us"><span class="compare-mark compare-mark--good">◎</span><span class="compare-cell__note">発送後10営業日<br>未払いリスクゼロ</span></td>
          </tr>
        </tbody>
      </table>
    </div>

    {{-- スマホ用カードレイアウト --}}
    <div class="compare-cards anim" data-anim="fade-up">
      <article class="compare-card">
        <div class="compare-card__head">
          <p class="compare-card__name">ヤフオク</p>
          <p class="compare-card__sub">公開市場</p>
        </div>
        <ul class="compare-card__list">
          <li><span>参加層</span><span class="compare-mark compare-mark--bad">×</span></li>
          <li><span>審査</span><span class="compare-mark compare-mark--bad">×</span></li>
          <li><span>出品後の手取り</span><span class="compare-mark compare-mark--bad">×</span></li>
          <li><span>出品の手間</span><span class="compare-mark compare-mark--bad">×</span></li>
          <li><span>相場への影響</span><span class="compare-mark compare-mark--bad">×</span></li>
          <li><span>代金回収</span><span class="compare-mark compare-mark--bad">×</span></li>
        </ul>
      </article>
      <article class="compare-card">
        <div class="compare-card__head">
          <p class="compare-card__name">オフライン業者OK</p>
          <p class="compare-card__sub">地域中心</p>
        </div>
        <ul class="compare-card__list">
          <li><span>参加層</span><span class="compare-mark compare-mark--good">◎</span></li>
          <li><span>審査</span><span class="compare-mark compare-mark--mid">△</span></li>
          <li><span>出品後の手取り</span><span class="compare-mark compare-mark--mid">△</span></li>
          <li><span>出品の手間</span><span class="compare-mark compare-mark--mid">△</span></li>
          <li><span>相場への影響</span><span class="compare-mark compare-mark--mid">△</span></li>
          <li><span>代金回収</span><span class="compare-mark compare-mark--mid">△</span></li>
        </ul>
      </article>
      <article class="compare-card compare-card--us">
        <div class="compare-card__head">
          <p class="compare-card__name">{{ $brand }}</p>
          <p class="compare-card__sub">業者向けオンライン</p>
        </div>
        <ul class="compare-card__list">
          <li><span>参加層</span><span class="compare-mark compare-mark--good">◎</span></li>
          <li><span>審査</span><span class="compare-mark compare-mark--good">◎</span></li>
          <li><span>出品後の手取り</span><span class="compare-mark compare-mark--good">◎</span></li>
          <li><span>出品の手間</span><span class="compare-mark compare-mark--good">◎</span></li>
          <li><span>相場への影響</span><span class="compare-mark compare-mark--good">◎</span></li>
          <li><span>代金回収</span><span class="compare-mark compare-mark--good">◎</span></li>
        </ul>
      </article>
    </div>

    <p class="compare-strong anim" data-anim="fade-up">
      オンラインの便利さと、業者間取引の信頼性を、<br class="sp-only">両取りする。<br>
      それが、{{ $brand }} です。
    </p>
  </div>
</section>

<!-- ===== ⑥.5 出品後の手取りに、3つの差 ===== -->
<section class="section section--takehome">
  <div class="container">
    <div class="takehome-header anim" data-anim="fade-up">
      <h2 class="takehome-header__title">
        出品後の手取りに、<span class="takehome-header__mark">3つの差が集まります</span>
      </h2>
      <p class="takehome-header__desc">
        落札額・コスト・工数。<br class="pc-only">
        3つの違いが集まって、最後の「手取り」を決めます。
      </p>
    </div>

    <div class="takehome-bars anim" data-anim="fade-up">
      <div class="takehome-bar">
        <div class="takehome-bar__label">ヤフオク出品</div>
        <div class="takehome-bar__track"><div class="takehome-bar__fill takehome-bar__fill--low" style="width:14%"></div></div>
      </div>
      <div class="takehome-bar">
        <div class="takehome-bar__label">オフライン出品</div>
        <div class="takehome-bar__track"><div class="takehome-bar__fill takehome-bar__fill--mid" style="width:42%"></div></div>
      </div>
      <div class="takehome-bar takehome-bar--us">
        <div class="takehome-bar__label">{{ $brand }}</div>
        <div class="takehome-bar__track">
          <div class="takehome-bar__fill takehome-bar__fill--high" style="width:96%"></div>
          <span class="takehome-bar__badge">最大</span>
        </div>
      </div>
    </div>

    <div class="takehome-reasons">
      <article class="takehome-reason anim" data-anim="fade-up">
        <span class="takehome-reason__index">理由 01</span>
        <h3 class="takehome-reason__title">落札額の差</h3>
        <p>ヤフオクは個人愛好家がいるので高値、{{ $brand }} は業者間の卸値。落札額そのものは、ヤフオクの方が高くなります。ただし、ここからのコスト・工数の差で、最後の手取りの差は大きく縮まります。</p>
      </article>
      <article class="takehome-reason anim" data-anim="fade-up" data-delay="1">
        <span class="takehome-reason__index">理由 02</span>
        <h3 class="takehome-reason__title">コストの差</h3>
        <p>ヤフオクは梱包資材・発送送料・対応人件費が、出品回数分積み重なる。{{ $brand }} なら1回送るだけで完結する、シンプルな構造。</p>
      </article>
      <article class="takehome-reason anim" data-anim="fade-up" data-delay="2">
        <span class="takehome-reason__index">理由 03</span>
        <h3 class="takehome-reason__title">工数とロット効率の差</h3>
        <p>ヤフオクで一定量を捌くには、撮影・出品・問い合わせ対応・梱包・発送が出品数分必要。{{ $brand }} は大ロットでも一括で受入、出品者は預けて待つだけ。</p>
      </article>
    </div>

    <p class="takehome-strong anim" data-anim="fade-up" style="text-align:center;margin-top:2.5rem;font-size:clamp(1rem, 2.2vw, 1.2rem);font-weight:700;color:#1a202c;line-height:1.85;">
      3つの差が集まって、出品後の手取りの差は大きく縮まる。<br>
      出品ロットによっては、{{ $brand }} が上回ります。
    </p>
  </div>
</section>

<!-- ===== ⑦ 出品者向け 4カード詳細 ===== -->
<section class="section section--solutions" id="solutions">
  <div class="container">
    <div class="solutions-header anim" data-anim="fade-up">
      <h2 class="solutions-header__title">
        <span class="solutions-header__mark">出品者の方へ</span>
      </h2>
      <p class="solutions-header__desc">
        出品者の本音は「もっと売りたい」ではなく、<br>
        「同じ手取りで、もっとラクに、もっと安全に売りたい」。<br class="pc-only">
        {{ $brand }} は、その4つの願いに応えます。
      </p>
    </div>

    <div class="solutions-grid solutions-grid--2col">
      <div class="solution-card solution-card--featured anim" data-anim="fade-up">
        <span class="solution-card__visual"><img src="/img/lp/for-buyer/01.png" alt="" loading="lazy"></span>
        <span class="solution-card__body">
          <span class="solution-card__head">
            <span class="solution-card__title">預けるだけで、撮影・出品・落札後の発送までゼロ工数</span>
          </span>
          <p class="solution-card__desc">本業の繁殖・選別に時間を投下できます。撮影・梱包・発送・問い合わせ対応まで、すべて {{ $brand }} が代行。</p>
          <span class="solution-card__sublabel">本業に時間を集中したい方へ</span>
        </span>
      </div>
      <div class="solution-card solution-card--featured anim" data-anim="fade-up" data-delay="1">
        <span class="solution-card__visual"><img src="/img/lp/for-buyer/02.png" alt="" loading="lazy"></span>
        <span class="solution-card__body">
          <span class="solution-card__head">
            <span class="solution-card__title">月2回の定期開催で、繁殖在庫を計画的に整理</span>
          </span>
          <p class="solution-card__desc">固定スケジュールで月2回開催。繁殖サイクルに合わせて、増えた在庫を計画的に放出できます。</p>
          <span class="solution-card__sublabel">在庫回転を安定させたい方へ</span>
        </span>
      </div>
      <div class="solution-card solution-card--featured anim" data-anim="fade-up" data-delay="2">
        <span class="solution-card__visual"><img src="/img/lp/for-buyer/03.png" alt="" loading="lazy"></span>
        <span class="solution-card__body">
          <span class="solution-card__head">
            <span class="solution-card__title">発送翌日から10営業日以内に、買取代金が確実に入金</span>
          </span>
          <p class="solution-card__desc">買取再販モデルで、未払い・連絡不通リスクゼロ。落札者の入金状況にかかわらず、確実にお支払いします。買取代金は「落札額の90%＋消費税」（インボイス登録時）。</p>
          <span class="solution-card__sublabel">代金回収の不安をなくしたい方へ</span>
        </span>
      </div>
      <div class="solution-card solution-card--featured anim" data-anim="fade-up" data-delay="3">
        <span class="solution-card__visual"><img src="/img/lp/for-buyer/04.png" alt="" loading="lazy"></span>
        <span class="solution-card__body">
          <span class="solution-card__head">
            <span class="solution-card__title">売れ残っても、返却 or 無料譲渡を選べる</span>
          </span>
          <p class="solution-card__desc">オークションで売れ残った場合は、返却または無料譲渡（運営／他会員へ）を出品者ご自身でお選びいただけます。無料譲渡なら、以後の管理から解放されます。</p>
          <span class="solution-card__sublabel">在庫リスクを柔軟に整理したい方へ</span>
        </span>
      </div>
    </div>
  </div>
</section>

<!-- ===== ⑧ 最強差別化（手取り比較表） ===== -->
{{-- <section class="section section--video">
  <div class="container">
    <div class="video-header anim" data-anim="fade-up">
      <h2 class="video-header__title">ヤフオクで60,000円、{{ $brand }}で40,000円。<br class="pc-only">通帳に残るのは、いくら？</h2>
      <p class="video-header__desc">
        楊貴妃ラメ・中クラス20匹を売る場合の試算です。<br class="pc-only">
        1出品あたり約50分の作業（撮影・編集・出品作業・問い合わせ対応・梱包・発送）を時給1,500円で換算しています。
      </p>
    </div>

    <div class="profit-compare-wrap anim" data-anim="fade-up" style="margin: 2.5rem auto; max-width: 920px; overflow-x: auto;">
      <table class="profit-compare-table" style="width:100%; border-collapse: collapse; background:#fff; color:#1a202c; font-size: clamp(0.85rem, 1.6vw, 1rem); border:1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
        <thead>
          <tr style="background: #f7fafc;">
            <th style="padding: 0.9rem 0.8rem; text-align: left; border-bottom: 2px solid #e2e8f0; color:#4a5568; font-weight: 700;"></th>
            <th style="padding: 0.9rem 0.8rem; text-align: center; border-bottom: 2px solid #e2e8f0; color:#4a5568; font-weight: 700;">
              ヤフオク<br><small style="font-weight: 400; color:#718096;">(1匹×20回)</small>
            </th>
            <th style="padding: 0.9rem 0.8rem; text-align: center; border-bottom: 2px solid #e2e8f0; color:#2bb1b7; font-weight: 700;">
              {{ $brand }}<br><small style="font-weight: 400; color:#718096;">(20匹×1ロット)</small>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <th scope="row" style="padding: 0.8rem; text-align: left; border-bottom: 1px solid #edf2f7; color:#2d3748; font-weight: 600;">落札額（表示）</th>
            <td style="padding: 0.8rem; text-align: center; border-bottom: 1px solid #edf2f7;">60,000円</td>
            <td style="padding: 0.8rem; text-align: center; border-bottom: 1px solid #edf2f7;">40,000円<br><small style="color:#718096;">（税抜）</small></td>
          </tr>
          <tr>
            <th scope="row" style="padding: 0.8rem; text-align: left; border-bottom: 1px solid #edf2f7; color:#2d3748; font-weight: 600;">買取代金<br><small style="font-weight: 400; color:#718096;">（受取総額）</small></th>
            <td style="padding: 0.8rem; text-align: center; border-bottom: 1px solid #edf2f7;">60,000円</td>
            <td style="padding: 0.8rem; text-align: center; border-bottom: 1px solid #edf2f7;">39,600円<br><small style="color:#718096;">（税込）落札額の90%＋消費税</small></td>
          </tr>
          <tr>
            <th scope="row" style="padding: 0.8rem; text-align: left; border-bottom: 1px solid #edf2f7; color:#2d3748; font-weight: 600;">販売手数料</th>
            <td style="padding: 0.8rem; text-align: center; border-bottom: 1px solid #edf2f7; color:#c53030;">△6,000円<br><small style="color:#718096;">(10%)</small></td>
            <td style="padding: 0.8rem; text-align: center; border-bottom: 1px solid #edf2f7; color:#718096;">─<br><small>受取額に反映済</small></td>
          </tr>
          <tr>
            <th scope="row" style="padding: 0.8rem; text-align: left; border-bottom: 1px solid #edf2f7; color:#2d3748; font-weight: 600;">梱包資材費</th>
            <td style="padding: 0.8rem; text-align: center; border-bottom: 1px solid #edf2f7; color:#c53030;">△4,000円<br><small style="color:#718096;">(200円×20回)</small></td>
            <td style="padding: 0.8rem; text-align: center; border-bottom: 1px solid #edf2f7;">0円<br><small style="color:#718096;">{{ $brand }} 代行</small></td>
          </tr>
          <tr>
            <th scope="row" style="padding: 0.8rem; text-align: left; border-bottom: 1px solid #edf2f7; color:#2d3748; font-weight: 600;">発送送料</th>
            <td style="padding: 0.8rem; text-align: center; border-bottom: 1px solid #edf2f7; color:#c53030;">△20,000円<br><small style="color:#718096;">(1,000円×20回)</small></td>
            <td style="padding: 0.8rem; text-align: center; border-bottom: 1px solid #edf2f7; color:#c53030;">△1,500円<br><small style="color:#718096;">{{ $brand }} へ1回送るだけ</small></td>
          </tr>
          <tr>
            <th scope="row" style="padding: 0.8rem; text-align: left; border-bottom: 1px solid #edf2f7; color:#2d3748; font-weight: 600;">人件費</th>
            <td style="padding: 0.8rem; text-align: center; border-bottom: 1px solid #edf2f7; color:#c53030;">△25,000円<br><small style="color:#718096;">(時給1,500円×50分×20回)</small></td>
            <td style="padding: 0.8rem; text-align: center; border-bottom: 1px solid #edf2f7; color:#c53030;">△750円<br><small style="color:#718096;">(時給1,500円×30分×1回)</small></td>
          </tr>
          <tr>
            <th scope="row" style="padding: 0.8rem; text-align: left; border-bottom: 1px solid #edf2f7; color:#2d3748; font-weight: 600;">入金タイミング</th>
            <td style="padding: 0.8rem; text-align: center; border-bottom: 1px solid #edf2f7;">落札後 2-3 週間<br><small style="color:#718096;">＋未払いリスク</small></td>
            <td style="padding: 0.8rem; text-align: center; border-bottom: 1px solid #edf2f7;">発送翌日から10営業日<br><small style="color:#718096;">確実入金</small></td>
          </tr>
          <tr style="background: #fffaf0;">
            <th scope="row" style="padding: 1rem 0.8rem; text-align: left; color:#1a202c; font-weight: 800; font-size: 1.05em;">手取り（口座残）</th>
            <td style="padding: 1rem 0.8rem; text-align: center; color:#c53030; font-weight: 800; font-size: 1.15em;">約5,000円</td>
            <td style="padding: 1rem 0.8rem; text-align: center; color:#2bb1b7; font-weight: 800; font-size: 1.15em;">約37,350円</td>
          </tr>
        </tbody>
      </table>
    </div>

    <p class="video-strong anim" data-anim="fade-up">
      落札額1.5倍のヤフオクの手取りは、人件費を引けば 約5,000円。<br>
      {{ $brand }} なら、預けるだけで <strong>約37,350円</strong> が確実に残ります。<br>
      差は実に、<strong>約7.5倍</strong>。
    </p>

    <div class="video-quote anim" data-anim="fade-up" style="max-width: 720px; margin: 2rem auto 1.5rem; padding: 1.5rem 1.75rem; background: #f7fafc; border-left: 4px solid #2bb1b7; border-radius: 8px; color:#2d3748; line-height: 1.85;">
      <p style="margin: 0; font-size: 0.98em;">「ヤフオクの方が高く売れます。<br>
      でも、20回出品して、20回梱包して、20回発送して、<br>
      手数料を払って…手取りで、いくら残りましたか？」</p>
    </div>

    <p class="video-conclusion anim" data-anim="fade-up" style="text-align: center; margin: 1.5rem 0 0.5rem; font-size: clamp(0.95rem, 2vw, 1.1rem); line-height: 1.85; color:#ffffff;">
      ヤフオクは小売チャネル、{{ $brand }} は卸チャネル。<br>
      <strong>使い分けることで、手取り全体が増えます。</strong>
    </p>

    <p class="video-note anim" data-anim="fade-up" style="text-align: left; max-width: 720px; margin: 2rem auto 0; padding: 1rem 1.25rem; background: #fafafa; border-radius: 6px; font-size: 0.85em; color:#718096; line-height: 1.85;">
      ※ 上記は標準的な作業時間（撮影10分・編集5分・出品作業5分・問い合わせ対応5分・梱包15分・発送10分＝計50分）を時給1,500円で計算した試算です。<br>
      ※ 落札額・人件費は出品者の運営状況により変動します。<br>
      ※ {{ $brand }} の買取代金は、インボイス登録ありの場合の試算です（未登録の場合の調整金は FAQ 参照）。
    </p>
  </div>
</section> --}}

<!-- ===== ⑨ 出品までの4ステップ ===== -->
<section class="section section--steps" id="flow">
  <div class="container">
    <div class="steps-header anim" data-anim="fade-up">
      <h2 class="steps-header__title">
        <span class="steps-header__mark">出品までの4ステップ</span>
      </h2>
      <p class="steps-header__desc">
        業者会員になっていただいた後の、実際の出品フローです。
      </p>
    </div>

    <div class="steps-grid">
      <div class="step-tile anim" data-anim="fade-up">
        <span class="step-tile__index">STEP 01</span>
        <h3 class="step-tile__title">出品フォームから申込</h3>
        <p class="step-tile__desc">オークションシステムの出品フォームで、品種・匹数などを入力します。</p>
      </div>
      <div class="step-tile anim" data-anim="fade-up" data-delay="1">
        <span class="step-tile__index">STEP 02</span>
        <h3 class="step-tile__title">オークション前日に届くよう、個体を {{ $brand }} へ送付</h3>
        <p class="step-tile__desc">公開されているオークションスケジュール（月2回開催）に合わせて、開催前日に {{ $brand }} へ到着するように個体を発送します。出品者の作業は、ここまでで完了します。</p>
      </div>
      <div class="step-tile anim" data-anim="fade-up" data-delay="2">
        <span class="step-tile__index">STEP 03</span>
        <h3 class="step-tile__title">{{ $brand }} が撮影・出品・落札・発送まで代行</h3>
        <p class="step-tile__desc">受入後、横見・上見の動画を撮影し、出品リストに掲載。開催前日から落札候補者へ公開され、当日リアルタイム入札で落札確定。落札後は {{ $brand }} が落札者へ直送します（伝票は {{ $brand }} 名義）。</p>
      </div>
      <div class="step-tile anim" data-anim="fade-up" data-delay="3">
        <span class="step-tile__index">STEP 04</span>
        <h3 class="step-tile__title">発送翌日から10営業日以内に、買取代金が入金</h3>
        <p class="step-tile__desc">{{ $brand }} から出品者へ、買取代金（落札額の90%＋消費税）を振込。落札者の入金状況にかかわらず、確実にお支払いします。未払い・連絡不通リスクはゼロです。</p>
      </div>
    </div>

    <p class="steps-strong anim" data-anim="fade-up">
      申し込んで、送って、待つだけ。<br class="sp-only">本業の時間が、最大化されます。
    </p>
  </div>
</section>

<!-- ===== ⑩ 料金プラン ===== -->
<section class="section section--pricing" id="pricing">
  <div class="container">
    <div class="pricing-header anim" data-anim="fade-up">
      <h2 class="pricing-header__title">
        <span class="pricing-header__mark">シンプルな業者会員プラン2種</span>
      </h2>
      <p class="pricing-header__desc">
        登録は年会費のみ。あとは成約時の手数料だけです。
      </p>
    </div>

    <div class="pricing-cards anim" data-anim="fade-up">
      <div class="pricing-card">
        <span class="pricing-card__tag">業者会員（落札）</span>
        <span class="pricing-card__price"><em>5,500</em><small>円</small></span>
        <span class="pricing-card__note">年 / 税込</span>
      </div>
      <span class="pricing-plus" aria-hidden="true">/</span>
      <div class="pricing-card">
        <span class="pricing-card__tag">業者会員（出品兼落札）</span>
        <span class="pricing-card__price"><em>11,000</em><small>円</small></span>
        <span class="pricing-card__note">年 / 税込</span>
      </div>
    </div>

    <div class="pricing-detail anim" data-anim="fade-up">
      <p class="pricing-detail__title">プランの内訳</p>
      <div class="pricing-compare">
        <div class="pricing-compare__row pricing-compare__row--head">
          <span class="pricing-compare__feature"></span>
          <span class="pricing-compare__plan">業者会員<br class="sp-only">（落札）</span>
          <span class="pricing-compare__plan">業者会員<br class="sp-only">（出品兼落札）</span>
        </div>
        <div class="pricing-compare__row">
          <span class="pricing-compare__feature">オークション閲覧</span>
          <span class="pricing-compare__cell pricing-compare__cell--check" aria-label="対応">✓</span>
          <span class="pricing-compare__cell pricing-compare__cell--check" aria-label="対応">✓</span>
        </div>
        <div class="pricing-compare__row">
          <span class="pricing-compare__feature">入札・落札</span>
          <span class="pricing-compare__cell pricing-compare__cell--check" aria-label="対応">✓</span>
          <span class="pricing-compare__cell pricing-compare__cell--check" aria-label="対応">✓</span>
        </div>
        <div class="pricing-compare__row">
          <span class="pricing-compare__feature">出品</span>
          <span class="pricing-compare__cell pricing-compare__cell--muted" aria-label="非対応">─</span>
          <span class="pricing-compare__cell pricing-compare__cell--check" aria-label="対応">✓</span>
        </div>
        <div class="pricing-compare__row">
          <span class="pricing-compare__feature">審査</span>
          <span class="pricing-compare__cell">審査</span>
          <span class="pricing-compare__cell">厳格な審査</span>
        </div>
        <div class="pricing-compare__row">
          <span class="pricing-compare__feature">成約時手数料</span>
          <span class="pricing-compare__cell">落札額の 10%</span>
          <span class="pricing-compare__cell">落札額の 10%</span>
        </div>
      </div>
    </div>

    <p class="pricing-note anim" data-anim="fade-up">
      ※ 出品兼落札プランは、落札プランの全機能を含みます（買い手として落札する権利も含まれます）。<br>
      ※ 出品兼落札プランは、より厳格な審査を経てご加入いただけます。<br>
      ※ 落札プランの参加条件: ヤフオク評価・ヤフオクストア・EC実績・店舗・法人登記・イベント出展実績のいずれか1つ以上をクリア（詳細は FAQ 参照）。<br>
      ※ 出品者への買取代金は、落札額の90%＋消費税です。インボイス未登録の場合は、運営が仕入税額控除を適用できない分が「インボイス調整金」として別途差し引かれます（詳細は FAQ 参照）。
    </p>
  </div>
</section>

<!-- ===== ⑪ LINE 登録メリット + ステップ ===== -->
<section class="section section--line">
  <div class="container">
    <div class="line-header anim" data-anim="fade-up">
      <h2 class="line-header__title">
        まずは、<span class="line-header__mark">LINE から</span>。
      </h2>
      <p class="line-header__desc">
        即時の会員登録ではなく、LINE で先にサービスを体験いただけます。<br class="pc-only">
        落札者会員としてご参加いただきながら、出品枠が解放され次第、優先的にご案内します。<br class="pc-only">
        ご自身に合うかをご確認のうえ、ご判断ください。
      </p>
    </div>

    <div class="line-merits">
      <article class="line-merit anim" data-anim="fade-up">
        <span class="line-merit__index">01</span>
        <h3 class="line-merit__title">デモで触ってから、判断できる</h3>
        <p>LINE登録するだけで、実際の入札画面と動画品質確認をお試しいただけます。出品者目線でも「自分の個体がどう見せられるか」を確認できます。</p>
      </article>
      <article class="line-merit anim" data-anim="fade-up" data-delay="1">
        <span class="line-merit__index">02</span>
        <h3 class="line-merit__title">次回開催・出品枠解放のご案内が届く</h3>
        <p>次回オークションのスケジュール、出品枠解放のお知らせを LINE で先行配信。お見逃しがありません。</p>
      </article>
      <article class="line-merit anim" data-anim="fade-up" data-delay="2">
        <span class="line-merit__index">03</span>
        <h3 class="line-merit__title">申込・質問を LINE 上で完結</h3>
        <p>申請フォーム・資料・質問は LINE 上で完結。別サイトを行き来する必要はありません。</p>
      </article>
    </div>

    <ol class="line-steps anim" data-anim="fade-up">
      <li>
        <span class="line-step__num">STEP 01</span>
        <h4>LINE で友だち追加</h4>
        <p>下のボタンから1タップで完了します。</p>
      </li>
      <li>
        <span class="line-step__num">STEP 02</span>
        <h4>デモを試す</h4>
        <p>LINE登録後、デモのURLをお送りします。実際の入札画面と動画品質確認をご体験ください。</p>
      </li>
      <li>
        <span class="line-step__num">STEP 03</span>
        <h4>落札者会員に申込・「出品にも興味あり」にチェック</h4>
        <p>申込フォームの「出品にも興味あり」にチェックを入れていただくと、出品枠解放時に優先的にご案内します。</p>
      </li>
    </ol>

    <div class="line-cta anim" data-anim="fade-up">
      <a href="{{ $lineUrl }}" target="_blank" rel="noopener noreferrer" class="btn-primary btn-primary--lg" onclick="fbq('track', 'Lead'); return true;">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="white"><path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63h2.386c.346 0 .627.285.627.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63.346 0 .628.285.628.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.281.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314"/></svg>
        LINE追加でデモを試す
      </a>
      <p class="line-cta__note">※ 友だち追加だけ。登録は無料です。</p>
    </div>
  </div>
</section>

<!-- ===== ⑫ お客様の声 ===== -->
<section class="section section--voice" id="voice">
  <div class="container">
    <div class="voice-header anim" data-anim="fade-up">
      <h2 class="voice-header__title">
        <span class="voice-header__mark">お客様</span>の声
      </h2>
      <p class="voice-header__desc">
        スタートに先立ち、出品予定の事業者様からコメントをいただきました。<br class="pc-only">
        業界の最前線で活動する皆さまの、率直な声をご覧ください。
      </p>
    </div>

    <div class="voice-grid">
      <article class="voice-tile anim" data-anim="fade-up">
        <p class="voice-tile__quote">ヤフオクは愛好家相場の上に成り立っているので、業者向けに値段を下げると、相場が一気に崩れてしまう。これまでは個別に相対でやりとりするしかなく、まとまった数量で効率的に卸す場所が業界にありませんでした。{{ $brand }} の業者専門の環境なら、相場を壊さずに、業者さんへ効率的に卸せる。業界に必要だった仕組みです。</p>
      </article>
      <article class="voice-tile anim" data-anim="fade-up" data-delay="1">
        <p class="voice-tile__quote">個別販売は、撮影・梱包・発送だけでなく、お客様への問い合わせ対応まで、本業の時間を奪い続けてきました。{{ $brand }} なら、業者間の流通が一気に効率化される。作り手はめだかと向き合う時間に集中でき、業者は仕入れに困らない。業界全体の生産性と収益性が、同時に上がる仕組みです。</p>
      </article>
      <article class="voice-tile anim" data-anim="fade-up" data-delay="2">
        <p class="voice-tile__quote">業者向けの卸ネットワークが整備されることで、新しい作り手も評価される機会が生まれる。全国の小売店・専門店も、もっと多様な個体を扱える。結果としてお客様に届くメダカの幅が広がる。業界全体の市場が大きくなる、業界の未来が楽しみです。</p>
      </article>
    </div>
  </div>
</section>

<!-- ===== ⑬ FAQ ===== -->
<section class="section section--faq" id="faq">
  <div class="container">
    <div class="faq-header anim" data-anim="fade-up">
      <h2 class="faq-header__title">
        <span class="faq-header__mark">よくある</span>ご質問
      </h2>
      <p class="faq-header__desc">
        ご利用前によく寄せられるご質問をまとめました。お問い合わせの前にご確認ください。
      </p>
    </div>

    <div class="faq-list anim" data-anim="fade-up">
      <details class="faq-item">
        <summary class="faq-item__q">
          <span class="faq-item__mark">Q</span>
          <span class="faq-item__text">ヤフオクとは競合しませんか？</span>
          <span class="faq-item__chev" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg></span>
        </summary>
        <div class="faq-item__a">
          <span class="faq-item__mark faq-item__mark--a">A</span>
          <p>しません。ヤフオクは個人愛好家主体の小売場所、{{ $brand }} は業者専用の卸場所です。使い分けることで手取り全体が増える設計です。</p>
        </div>
      </details>
      <details class="faq-item">
        <summary class="faq-item__q">
          <span class="faq-item__mark">Q</span>
          <span class="faq-item__text">法人でなくても参加できますか？</span>
          <span class="faq-item__chev" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg></span>
        </summary>
        <div class="faq-item__a">
          <span class="faq-item__mark faq-item__mark--a">A</span>
          <p>参加できます。屋号での活動実績があれば、個人事業主・専業ブリーダーの方も対象です。</p>
        </div>
      </details>
      <details class="faq-item">
        <summary class="faq-item__q">
          <span class="faq-item__mark">Q</span>
          <span class="faq-item__text">LINE で友だち追加すると、すぐに会員登録になりますか？</span>
          <span class="faq-item__chev" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg></span>
        </summary>
        <div class="faq-item__a">
          <span class="faq-item__mark faq-item__mark--a">A</span>
          <p>なりません。LINE 登録後にデモの URL をお送りします。実際の入札画面と動画品質確認を体験した上で、ご自身のタイミングで申込フォームから会員登録いただけます。</p>
        </div>
      </details>
      <details class="faq-item">
        <summary class="faq-item__q">
          <span class="faq-item__mark">Q</span>
          <span class="faq-item__text">インボイス対応していますか？</span>
          <span class="faq-item__chev" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg></span>
        </summary>
        <div class="faq-item__a">
          <span class="faq-item__mark faq-item__mark--a">A</span>
          <p>対応しています。{{ $brand }} はインボイス登録事業者です。</p>
        </div>
      </details>
      <details class="faq-item">
        <summary class="faq-item__q">
          <span class="faq-item__mark">Q</span>
          <span class="faq-item__text">既存のオフライン業者オークションとは何が違いますか？</span>
          <span class="faq-item__chev" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg></span>
        </summary>
        <div class="faq-item__a">
          <span class="faq-item__mark faq-item__mark--a">A</span>
          <p>主な違いは「全国オンラインで参加可能」「動画で品質確認できる」「完全匿名で取引できる」の3点です。詳しくは比較表セクションをご覧ください。</p>
        </div>
      </details>
      <details class="faq-item">
        <summary class="faq-item__q">
          <span class="faq-item__mark">Q</span>
          <span class="faq-item__text">出品者として参加するには？</span>
          <span class="faq-item__chev" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg></span>
        </summary>
        <div class="faq-item__a">
          <span class="faq-item__mark faq-item__mark--a">A</span>
          <p>現在、出品枠は応募多数につき新規受付を一時制限中です。まずは落札者会員にご登録いただき、申込フォームの「出品にも興味あり」にチェックを入れてください。出品枠が解放され次第、ご登録順に優先案内をお送りします。出品者会員（出品兼落札プラン）は、落札者会員より厳格な審査を経てご加入いただきます。</p>
        </div>
      </details>
      <details class="faq-item">
        <summary class="faq-item__q">
          <span class="faq-item__mark">Q</span>
          <span class="faq-item__text">ヤフオクと相場が競合しませんか？値崩れが心配です。</span>
          <span class="faq-item__chev" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg></span>
        </summary>
        <div class="faq-item__a">
          <span class="faq-item__mark faq-item__mark--a">A</span>
          <p>しません。{{ $brand }} は出品リスト・落札価格・入札履歴を会員間で完全守秘とする閉じたプラットフォームです。出品者の屋号は公開／非公開を出品者ご自身が選択でき、落札者の屋号は出品者には開示されません。ヤフオクで築いた小売相場は影響を受けません。</p>
        </div>
      </details>
      <details class="faq-item">
        <summary class="faq-item__q">
          <span class="faq-item__mark">Q</span>
          <span class="faq-item__text">インボイス未登録の場合、買取代金はどうなりますか？</span>
          <span class="faq-item__chev" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg></span>
        </summary>
        <div class="faq-item__a">
          <span class="faq-item__mark faq-item__mark--a">A</span>
          <div class="faq-item__a-body">
            <p>
              出品者への買取代金は、原則として「落札額の90%＋消費税」です。<br>
              インボイス未登録の出品者の場合、運営が仕入税額控除をフルに適用できない分が「インボイス調整金」として別途差し引かれます。<br>
              調整金率は、国が定めた仕入税額控除の経過措置に連動した段階制です。
            </p>
            <ul class="faq-item__list">
              <li>インボイス登録あり: 調整金 0%</li>
              <li>インボイス未登録（〜2026年9月）: 調整金 2%</li>
              <li>インボイス未登録（2026年10月〜2029年9月）: 調整金 5%</li>
              <li>インボイス未登録（2029年10月〜）: 調整金 10%</li>
            </ul>
            <p>例）落札額 10,000円 の場合の受取額</p>
            <ul class="faq-item__list">
              <li>インボイス登録あり: 9,000円 + 消費税 900円 = 9,900円</li>
              <li>インボイス未登録（〜2026年9月）: 9,680円</li>
              <li>インボイス未登録（2026年10月〜2029年9月）: 9,350円</li>
              <li>インボイス未登録（2029年10月〜）: 8,800円</li>
            </ul>
          </div>
        </div>
      </details>
    </div>
  </div>
</section>

<!-- ===== ⑭ クロージング CTA ===== -->
<section class="section section--cta" id="cta">
  <div class="cta-banner">
    <div class="cta-banner__inner">
      <div class="cta-banner__copy anim" data-anim="fade-up">
        <h2 class="cta-banner__title">まずは、デモから。</h2>
        <p class="cta-banner__desc">
          LINE 登録するだけで、実際の入札画面と動画品質確認をお試しいただけます。<br class="pc-only">
          出品をご希望の方も、まずはLINE登録・落札者会員から。<br class="pc-only">
          ご自身に合うかをご確認のうえ、ご判断ください。
        </p>
        <div class="cta-banner__actions">
          <a href="{{ $lineUrl }}" target="_blank" rel="noopener noreferrer" class="cta-banner__btn cta-banner__btn--white" onclick="fbq('track', 'Lead'); return true;">
            <span class="cta-banner__btn-main">
              LINE追加でデモを試す
              <span class="cta-banner__chev" aria-hidden="true">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
              </span>
            </span>
            <span class="cta-banner__btn-sub">出品の最新情報をお届け</span>
          </a>
          <a href="#contact" class="cta-banner__btn cta-banner__btn--accent">
            <span class="cta-banner__btn-main">
              メールで問い合わせる
              <span class="cta-banner__chev" aria-hidden="true">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
              </span>
            </span>
            <span class="cta-banner__btn-sub">メール・お電話どちらでも対応</span>
          </a>
        </div>
        <p class="cta-banner__note" style="margin-top:1.25rem;font-size:0.85em;color:rgba(255,255,255,0.85);line-height:1.7;">
          ※ 出品兼落札プランは現在新規受付制限中。落札者会員でのご参加が、出品枠解放時の優先案内対象となります。
        </p>
      </div>
      <div class="cta-banner__visual anim" data-anim="fade-up" data-delay="1" aria-hidden="true">
        <img src="/img/lp/cta.png?v=2" alt="" loading="lazy">
      </div>
    </div>
  </div>
</section>

<!-- ===== ⑮ お問い合わせ ===== -->
<section class="section section--contact" id="contact">
  <div class="container">
    <div class="contact-header anim" data-anim="fade-up">
      <h2 class="contact-header__title">お問い合わせ</h2>
      <p class="contact-header__desc">
        ご質問・ご相談・取材依頼など、<br class="sp-only">下記フォームまたはお電話よりお気軽にお問い合わせください。
      </p>
    </div>

    <div class="contact-grid">
      <aside class="contact-info anim" data-anim="fade-up">
        <div class="contact-info__block">
          <span class="contact-info__label">お電話でのお問い合わせ</span>
          <a class="contact-info__phone" href="tel:08046499385">080-4649-9385</a>
          <span class="contact-info__sub">受付時間: 平日 10:00〜18:00</span>
        </div>
        <div class="contact-info__block">
          <span class="contact-info__label">運営</span>
          <span class="contact-info__text">{{ $brand }} 運営事務局</span>
        </div>
      </aside>

      <div class="contact-form-wrap anim" data-anim="fade-up" data-delay="1">
        @if (session('contact_status') === 'success')
          <div class="contact-alert contact-alert--success" role="status">
            お問い合わせありがとうございます。確認メールを送信しましたので、ご確認ください。
          </div>
        @elseif (session('contact_status') === 'error')
          <div class="contact-alert contact-alert--error" role="alert">
            送信中にエラーが発生しました。お手数ですが、しばらく時間をおいて再度お試しください。
          </div>
        @endif

        <form class="contact-form" method="POST" action="{{ route('contact.store') }}#contact" novalidate>
          @csrf
          {{-- ハニーポット: 通常の利用者には見えないフィールド --}}
          <div class="contact-form__hp" aria-hidden="true">
            <label>Webサイト<input type="text" name="website" tabindex="-1" autocomplete="off"></label>
          </div>

          <div class="contact-form__row">
            <label class="contact-form__field">
              <span class="contact-form__label">お名前 <span class="contact-form__required">必須</span></span>
              <input type="text" name="name" required maxlength="100" value="{{ old('name') }}" autocomplete="name">
              @error('name')<span class="contact-form__error">{{ $message }}</span>@enderror
            </label>
            <label class="contact-form__field">
              <span class="contact-form__label">会社名 / 屋号</span>
              <input type="text" name="company" maxlength="200" value="{{ old('company') }}" autocomplete="organization">
              @error('company')<span class="contact-form__error">{{ $message }}</span>@enderror
            </label>
          </div>

          <div class="contact-form__row">
            <label class="contact-form__field">
              <span class="contact-form__label">メールアドレス <span class="contact-form__required">必須</span></span>
              <input type="email" name="email" required maxlength="255" value="{{ old('email') }}" autocomplete="email">
              @error('email')<span class="contact-form__error">{{ $message }}</span>@enderror
            </label>
            <label class="contact-form__field">
              <span class="contact-form__label">お電話番号</span>
              <input type="tel" name="phone" maxlength="30" value="{{ old('phone') }}" autocomplete="tel">
              @error('phone')<span class="contact-form__error">{{ $message }}</span>@enderror
            </label>
          </div>

          <label class="contact-form__field">
            <span class="contact-form__label">お問い合わせ種別 <span class="contact-form__required">必須</span></span>
            <select name="category" required>
              <option value="" disabled @selected(old('category', '') === '')>選択してください</option>
              <option value="apply" @selected(old('category') === 'apply')>申込をしたい</option>
              <option value="demo" @selected(old('category') === 'demo')>デモを使いたい</option>
              <option value="question" @selected(old('category') === 'question')>質問したい</option>
              <option value="seller_apply" @selected(old('category') === 'seller_apply')>出品について</option>
              <option value="seller_member_apply" @selected(old('category') === 'seller_member_apply')>業者会員（出品兼落札）の申込について</option>
              <option value="invoice" @selected(old('category') === 'invoice')>インボイス・買取代金について</option>
              <option value="other" @selected(old('category') === 'other')>その他</option>
            </select>
            @error('category')<span class="contact-form__error">{{ $message }}</span>@enderror
          </label>

          <label class="contact-form__field">
            <span class="contact-form__label">お問い合わせ内容</span>
            <textarea name="message" rows="6" maxlength="5000">{{ old('message') }}</textarea>
            @error('message')<span class="contact-form__error">{{ $message }}</span>@enderror
          </label>

          <div class="contact-form__actions">
            <button type="submit" class="contact-form__submit">
              送信する
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</section>

<!-- ===== FOOTER ===== -->
<footer class="footer">
  <div class="container">
    <div class="footer__top">
      <div class="footer__brand">
        <img src="/img/logo.png?v=2" alt="{{ $brand }}" class="footer__logo">
        <p class="footer__operator">運営：MEDAICHI</p>
      </div>
      <nav class="footer__links" aria-label="フッターナビゲーション">
        <a href="/legal/tokushoho">特定商取引法に基づく表記</a>
        <a href="/legal/privacy">プライバシーポリシー</a>
        <a href="/legal/terms">利用規約</a>
      </nav>
    </div>
    <p class="footer__copy">&copy; {{ date('Y') }} {{ $brand }} All Rights Reserved.</p>
  </div>
</footer>

<!-- ===== FLOATING CTA (mobile) ===== -->
<div class="floating-cta" id="floating-cta">
  <a href="{{ $lineUrl }}" target="_blank" rel="noopener noreferrer" class="btn-primary" onclick="fbq('track', 'Lead'); return true;">
    <svg width="20" height="20" viewBox="0 0 24 24" fill="white"><path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63h2.386c.346 0 .627.285.627.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63.346 0 .628.285.628.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.281.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314"/></svg>
    LINE追加でデモを試す
  </a>
</div>

<script src="/js/lp.js?v=5"></script>
</body>
</html>
