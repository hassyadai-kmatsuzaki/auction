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
  <title>落札者の方へ | {{ config('app.name', $brand) }}</title>
  <meta name="description" content="審査を通過したプロ出品者のメダカを、匿名・卸値で仕入れられる業者専用オンラインオークション。">
  <link rel="icon" type="image/png" href="/favicon.png">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;700;900&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="/css/lp.css?v=39">
  <script>
    (function(d) {
      var config = { kitId: 'png6ego', scriptTimeout: 3000, async: true },
      h=d.documentElement,t=setTimeout(function(){h.className=h.className.replace(/\bwf-loading\b/g,"")+" wf-inactive";},config.scriptTimeout),tk=d.createElement("script"),f=false,s=d.getElementsByTagName("script")[0],a;h.className+=" wf-loading";tk.src='https://use.typekit.net/'+config.kitId+'.js';tk.async=true;tk.onload=tk.onreadystatechange=function(){a=this.readyState;if(f||a&&a!="complete"&&a!="loaded")return;f=true;clearTimeout(t);try{Typekit.load(config)}catch(e){}};s.parentNode.insertBefore(tk,s)
    })(document);
  </script>
</head>
<body>

<!-- ===== HEADER ===== -->
<header class="header" id="header">
  <div class="header__inner">
    <a href="/buyer" class="header__logo">
      <img src="/img/logo.png?v=2" alt="{{ $brand }}" class="header__logo-img">
    </a>
    <div class="header__right">
      <a href="https://medaka-ichiba.com" class="header__btn header__btn--login">出品者の方へ</a>
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
    <p class="hero__eyebrow sp-only hero-anim" data-hero-delay="1">業界歴20年 × プロ選魚 × 審査制出品者</p>

    <div class="hero__visual hero-anim" data-hero-delay="2">
      <img src="/img/lp/fv-okada-yui.png?v" alt="" class="hero__visual-img" loading="eager">
      {{-- <span class="hero__visual-credit">岡田結実</span> --}}
    </div>

    <div class="hero__copy hero-anim" data-hero-delay="3">
      <p class="hero__eyebrow hero__eyebrow--inline pc-only">業界歴20年 × プロ選魚 × 審査制出品者</p>
      <h1 class="hero__title">
        <span class="hero__title-line">業界初、業者専用</span>
        <span class="hero__title-line hero__title-line--strong">オンラインオークション。</span>
      </h1>
      <p class="hero__desc">
        審査を通過したプロ出品者のメダカを、<br class="pc-only">
        匿名・卸値で仕入れられる場所。<br>
        業者だけのオンラインオークション、それが {{ $brand }}（日本メダカオンライン市場）です。
      </p>
    </div>

    <div class="hero__cta hero-anim" data-hero-delay="4">
      <a href="{{ $lineUrl }}" target="_blank" rel="noopener noreferrer" class="hero__cta-card hero__cta-card--primary" onclick="fbq('track', 'Lead'); return true;">
        <span class="hero__cta-card__icon" aria-hidden="true">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12c2-3 5-5 9-5s7 2 9 5c-2 3-5 5-9 5s-7-2-9-5z"/><circle cx="12" cy="12" r="2.2" fill="currentColor"/></svg>
        </span>
        <span class="hero__cta-card__body">
          <span class="hero__cta-card__title">LINE追加でデモを試す</span>
          <span class="hero__cta-card__sub">次回開催情報もお届け</span>
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
      日本のメダカ業界を代表するメーカー・専業ブリーダーが参画する、業者間プラットフォームです。
    </p>

    {{-- 協賛企業（横スクロール） --}}
    <p class="partners-row__label anim" data-anim="fade-up">協賛企業</p>
    @php $supporters = [1, 2, 3, 4, 5, 6, 7]; @endphp
    <div class="partners-marquee anim" data-anim="fade-up" aria-hidden="true">
      <div class="partners-marquee__track">
        {{-- 同じセットを3回連結し、CSS の translateX(-50%) で継ぎ目なくループ --}}
        @for ($i = 0; $i < 3; $i++)
          @foreach ($supporters as $n)
            <div class="partners-marquee__item">
              <img src="/img/lp/supporter/{{ $n }}.png" alt="" loading="lazy">
            </div>
          @endforeach
        @endfor
      </div>
    </div>

    {{-- 出品ブリーダー（横スクロール） --}}
    <p class="partners-row__label anim" data-anim="fade-up">出品ブリーダー</p>
    @php $breeders = [7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24]; @endphp
    <div class="partners-marquee anim" data-anim="fade-up" aria-hidden="true">
      <div class="partners-marquee__track">
        {{-- 同じセットを3回連結し、CSS の translateX(-50%) で継ぎ目なくループ --}}
        @for ($i = 0; $i < 3; $i++)
          @foreach ($breeders as $n)
            <div class="partners-marquee__item">
              <img src="/img/lp/seller/{{ $n }}.png" alt="" loading="lazy">
            </div>
          @endforeach
        @endfor
      </div>
    </div>

    <p class="partners-note anim" data-anim="fade-up">※ 協賛企業・出品ブリーダーのロゴは順次掲載予定です。</p>
  </div>
</section>

{{-- ===== 旧サポーターセクション（一旦コメントアウト）=====
<section class="section section--partners" id="partners">
  <div class="container">
    <div class="partners-header anim" data-anim="fade-up">
      <h2 class="partners-header__title">
        協賛企業・<span class="partners-header__num">出品企業</span>
      </h2>
    </div>

    <p class="partners-header__desc anim visible" data-anim="fade-up" style="text-align:center;max-width: 100%;margin:0 auto 1.75rem;color:#4a5568;font-weight:500;line-height:1.85;font-size:clamp(0.92rem, 1.6vw, 1rem);">
      日本のメダカ業界を代表するメーカー・専業ブリーダーが参画する、業者間プラットフォームです。
    </p>

    @php $partners = [1, 2, 3, 4, 6]; @endphp
    <div class="partners-marquee anim" data-anim="fade-up" aria-hidden="true">
      <div class="partners-marquee__track">
        @for ($i = 0; $i < 5; $i++)
          @foreach ($partners as $n)
            <div class="partners-marquee__item">
              <img src="/img/lp/client/{{ $n }}.png" alt="" loading="lazy">
            </div>
          @endforeach
        @endfor
      </div>
    </div>

    <p class="partners-note anim" data-anim="fade-up">※ 協賛企業・出品企業のロゴは順次掲載予定です。</p>
  </div>
</section>
--}}

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

<!-- ===== ④ 落札者の課題 ===== -->
<section class="section section--problems" id="problems">
  <div class="container">
    <div class="problems-header anim" data-anim="fade-up">
      <h2 class="problems-header__title">こんなお悩み、<span class="problems-header__mark">ありませんか？</span></h2>
      <p class="problems-header__desc">業者の仕入れには、これまでの市場では解決しきれなかった<br class="pc-only">3つの課題がありました。</p>
    </div>

    <div class="problems-rows">
      <div class="problem-row anim" data-anim="fade-up">
        <span class="problem-row__tag">
          仕入価格
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
        </span>
        <ul class="problem-row__list">
          <li>ヤフオクは個人愛好家が主体で、相場が読めない</li>
          <li>業者向けの卸値で仕入れにくい</li>
        </ul>
      </div>

      <div class="problem-row anim" data-anim="fade-up" data-delay="1">
        <span class="problem-row__tag">
          匿名性
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
        </span>
        <ul class="problem-row__list">
          <li>同業者と顔を合わせたくない</li>
          <li>競合関係を気にせず仕入れたい</li>
        </ul>
      </div>

      <div class="problem-row anim" data-anim="fade-up" data-delay="2">
        <span class="problem-row__tag">
          品質確認
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
        </span>
        <ul class="problem-row__list">
          <li>写真だけでは状態が分からない</li>
          <li>加工なしの動画でじっくり確認したい</li>
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
        業者の仕入れを、<br class="sp-only"><span class="mechanism-header__mark">3つの仕組みで変えます</span>
      </h2>
      <p class="mechanism-header__desc">
        個人愛好家を排除した業者専用市場、完全匿名で取引できる仕組み、<br class="pc-only">
        加工なしの動画品質確認。<br class="sp-only">
        独自の仕組みが、業者間取引を引き上げます。
      </p>
    </div>

    <div class="solutions-grid">
      <div class="solution-card solution-card--featured anim" data-anim="fade-up">
        <span class="solution-card__visual"><img src="/img/lp/mechanism/01.png" alt="" loading="lazy"></span>
        <span class="solution-card__body">
          <span class="solution-card__title">個人愛好家がいないので、<br>落札相場が業者向けに収まる</span>
        </span>
      </div>
      <div class="solution-card solution-card--featured anim" data-anim="fade-up" data-delay="1">
        <span class="solution-card__visual"><img src="/img/lp/mechanism/02.png" alt="" loading="lazy"></span>
        <span class="solution-card__body">
          <span class="solution-card__title">完全匿名で取引できる仕組みで、<br>同業者と競合しない</span>
        </span>
      </div>
      <div class="solution-card solution-card--featured anim" data-anim="fade-up" data-delay="2">
        <span class="solution-card__visual"><img src="/img/lp/mechanism/03.png" alt="" loading="lazy"></span>
        <span class="solution-card__body">
          <span class="solution-card__title">加工なしの動画で、<br>現物をじっくり確認</span>
        </span>
      </div>
    </div>
  </div>
</section>

<!-- ===== ⑥ 比較表 ===== -->
<section class="section section--compare">
  <div class="container">
    <div class="compare-header anim" data-anim="fade-up">
      <h2 class="compare-header__title">
        業者の仕入れ、<span class="compare-header__mark">選択肢は3つ</span>
      </h2>
      <p class="compare-header__desc">
        これまでメダカ業界で、業者間の仕入れは3つの場所に分かれていました。<br class="pc-only">
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
            <td class="compare-td--us"><span class="compare-mark compare-mark--good">◎</span><span class="compare-cell__note">業者専用（審査制）</span></td>
          </tr>
          <tr>
            <th scope="row">審査</th>
            <td><span class="compare-mark compare-mark--bad">×</span><span class="compare-cell__note">なし</span></td>
            <td><span class="compare-mark compare-mark--mid">△</span><span class="compare-cell__note">紹介制</span></td>
            <td class="compare-td--us"><span class="compare-mark compare-mark--good">◎</span><span class="compare-cell__note">申込制<br>（明文化された審査）</span></td>
          </tr>
          <tr>
            <th scope="row">仕入後の手取り</th>
            <td><span class="compare-mark compare-mark--bad">×</span><span class="compare-cell__note">薄利</span></td>
            <td><span class="compare-mark compare-mark--mid">△</span><span class="compare-cell__note">時間／移動コスト大</span></td>
            <td class="compare-td--us"><span class="compare-mark compare-mark--good">◎</span><span class="compare-cell__note">卸値＋コストなし</span></td>
          </tr>
          <tr>
            <th scope="row">地理制約</th>
            <td><span class="compare-mark compare-mark--good">◎</span><span class="compare-cell__note">なし</span></td>
            <td><span class="compare-mark compare-mark--bad">×</span><span class="compare-cell__note">あり</span></td>
            <td class="compare-td--us"><span class="compare-mark compare-mark--good">◎</span><span class="compare-cell__note">なし</span></td>
          </tr>
          <tr>
            <th scope="row">品質確認</th>
            <td><span class="compare-mark compare-mark--bad">×</span><span class="compare-cell__note">自己申告</span></td>
            <td><span class="compare-mark compare-mark--mid">△</span><span class="compare-cell__note">現地で短時間</span></td>
            <td class="compare-td--us"><span class="compare-mark compare-mark--good">◎</span><span class="compare-cell__note">加工なし動画</span></td>
          </tr>
          <tr>
            <th scope="row">匿名性</th>
            <td><span class="compare-mark compare-mark--bad">×</span><span class="compare-cell__note">個人情報やりとり</span></td>
            <td><span class="compare-mark compare-mark--bad">×</span><span class="compare-cell__note">地域で顔バレ</span></td>
            <td class="compare-td--us"><span class="compare-mark compare-mark--good">◎</span><span class="compare-cell__note">完全匿名</span></td>
          </tr>
        </tbody>
      </table>
    </div>

    {{-- スマホ用カードレイアウト（仕様書「望ましい」要件） --}}
    <div class="compare-cards anim" data-anim="fade-up">
      <article class="compare-card">
        <div class="compare-card__head">
          <p class="compare-card__name">ヤフオク</p>
          <p class="compare-card__sub">公開市場</p>
        </div>
        <ul class="compare-card__list">
          <li><span>参加層</span><span class="compare-mark compare-mark--bad">×</span></li>
          <li><span>審査</span><span class="compare-mark compare-mark--bad">×</span></li>
          <li><span>仕入後の手取り</span><span class="compare-mark compare-mark--bad">×</span></li>
          <li><span>地理制約</span><span class="compare-mark compare-mark--good">◎</span></li>
          <li><span>品質確認</span><span class="compare-mark compare-mark--bad">×</span></li>
          <li><span>匿名性</span><span class="compare-mark compare-mark--bad">×</span></li>
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
          <li><span>仕入後の手取り</span><span class="compare-mark compare-mark--mid">△</span></li>
          <li><span>地理制約</span><span class="compare-mark compare-mark--bad">×</span></li>
          <li><span>品質確認</span><span class="compare-mark compare-mark--mid">△</span></li>
          <li><span>匿名性</span><span class="compare-mark compare-mark--bad">×</span></li>
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
          <li><span>仕入後の手取り</span><span class="compare-mark compare-mark--good">◎</span></li>
          <li><span>地理制約</span><span class="compare-mark compare-mark--good">◎</span></li>
          <li><span>品質確認</span><span class="compare-mark compare-mark--good">◎</span></li>
          <li><span>匿名性</span><span class="compare-mark compare-mark--good">◎</span></li>
        </ul>
      </article>
    </div>

    <p class="compare-strong anim" data-anim="fade-up">
      オンラインの便利さと、業者間取引の信頼性を、<br class="sp-only">両取りする。<br>
      それが、{{ $brand }} です。
    </p>
  </div>
</section>

<!-- ===== ⑥.5 仕入後の手取り ===== -->
<section class="section section--takehome">
  <div class="container">
    <div class="takehome-header anim" data-anim="fade-up">
      <h2 class="takehome-header__title">
        仕入後の手取りに、<span class="takehome-header__mark">3つの差が集まります</span>
      </h2>
      <p class="takehome-header__desc">
        仕入価格・時間／移動コスト・品質ロス。<br class="pc-only">
        3つの違いが、最後の「手取り」を決めます。
      </p>
    </div>

    <div class="takehome-bars anim" data-anim="fade-up">
      <div class="takehome-bar">
        <div class="takehome-bar__label">ヤフオク仕入</div>
        <div class="takehome-bar__track"><div class="takehome-bar__fill takehome-bar__fill--low" style="width:14%"></div></div>
      </div>
      <div class="takehome-bar">
        <div class="takehome-bar__label">オフライン仕入</div>
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
        <h3 class="takehome-reason__title">仕入価格</h3>
        <p>ヤフオクは個人向けの小売値、オフラインは安いが地域内競合のみ。{{ $brand }} は業者専用の卸値で取引できます。</p>
      </article>
      <article class="takehome-reason anim" data-anim="fade-up" data-delay="1">
        <span class="takehome-reason__index">理由 02</span>
        <h3 class="takehome-reason__title">時間・移動コスト</h3>
        <p>オフラインは現地までの交通費・宿泊・拘束時間が利益を圧迫。{{ $brand }} はオンライン完結、移動ゼロで参加できます。</p>
      </article>
      <article class="takehome-reason anim" data-anim="fade-up" data-delay="2">
        <span class="takehome-reason__index">理由 03</span>
        <h3 class="takehome-reason__title">品質ロス</h3>
        <p>ヤフオクの自己申告、オフラインの現地短時間判断では見落としが発生。{{ $brand }} は加工なし動画を前日からゆっくり確認、判断ミスを最小化します。</p>
      </article>
    </div>
  </div>
</section>

<!-- ===== ⑦ 落札者向け 4カード詳細 ===== -->
<section class="section section--solutions" id="solutions">
  <div class="container">
    <div class="solutions-header anim" data-anim="fade-up">
      <h2 class="solutions-header__title">
        <span class="solutions-header__mark">落札者の方へ</span>
      </h2>
      <p class="solutions-header__desc">
        2つの仕入れニーズに、{{ $brand }} は応えます。<br>
        「ここでしか会えない個体」と「ヤフオクで買えない価格」。<br class="pc-only">
        さらに『取引は {{ $brand }} とだけ』と『定期開催で計画的に』。
      </p>
    </div>

    <div class="solutions-grid solutions-grid--2col">
      <div class="solution-card solution-card--featured anim" data-anim="fade-up">
        <span class="solution-card__visual"><img src="/img/lp/for-buyer/01.png" alt="" loading="lazy"></span>
        <span class="solution-card__body">
          <span class="solution-card__head">
            <span class="solution-card__title">個人愛好家がいないので、落札相場が業者向けに収まる</span>
          </span>
          <p class="solution-card__desc">ヤフオクは個人入札で価格が高騰しますが、{{ $brand }} は業者だけが入札する仕組み。業者として利益が取れる卸値で落札できます。</p>
          <span class="solution-card__sublabel">業者向けの仕入れ価格を求める方へ</span>
        </span>
      </div>
      <div class="solution-card solution-card--featured anim" data-anim="fade-up" data-delay="1">
        <span class="solution-card__visual"><img src="/img/lp/for-buyer/02.png" alt="" loading="lazy"></span>
        <span class="solution-card__body">
          <span class="solution-card__head">
            <span class="solution-card__title">標準個体も、ヤフオクで買えない卸値で</span>
          </span>
          <p class="solution-card__desc">特段稀少でない個体でも、ヤフオクの小売値より明確に安く。業者間の卸値で取引できます。</p>
          <span class="solution-card__sublabel">安定的な仕入れ量を必要とする方へ</span>
        </span>
      </div>
      <div class="solution-card solution-card--featured anim" data-anim="fade-up" data-delay="2">
        <span class="solution-card__visual"><img src="/img/lp/for-buyer/03.png" alt="" loading="lazy"></span>
        <span class="solution-card__body">
          <span class="solution-card__head">
            <span class="solution-card__title">取引はすべて、{{ $brand }} とのやり取りだけ</span>
          </span>
          <p class="solution-card__desc">落札後の決済は振込で完了。配送は {{ $brand }} から直送。出品者と直接やり取りすることはありません。落札者は「決めて、待つ」だけで完結します。</p>
          <span class="solution-card__sublabel">業務効率化を求める方へ</span>
        </span>
      </div>
      <div class="solution-card solution-card--featured anim" data-anim="fade-up" data-delay="3">
        <span class="solution-card__visual"><img src="/img/lp/for-buyer/04.png" alt="" loading="lazy"></span>
        <span class="solution-card__body">
          <span class="solution-card__head">
            <span class="solution-card__title">月2回の定期開催で、計画的に仕入れられる</span>
          </span>
          <p class="solution-card__desc">固定スケジュール＋事前出品リストの公開で、仕入れ予算とロットを先に組めます。「いつ良い個体が出るか分からない」が、終わります。</p>
          <span class="solution-card__sublabel">計画的な仕入れを求める方へ</span>
        </span>
      </div>
    </div>
  </div>
</section>

<!-- ===== ⑧ 動画品質確認 (差別化) ===== -->
<section class="section section--video">
  <div class="container">
    <div class="video-header anim" data-anim="fade-up">
      <h2 class="video-header__title">加工なしの現物動画で、<br class="sp-only">現地より深く見極める。</h2>
      <p class="video-header__desc">
        全ロットの横見・上見動画を、開催前日から公開。<br>
        加工しない動画だから、写真では分からない実物の状態を、<br class="pc-only">
        オフラインの「現地で短時間」を超える深さで確認できます。
      </p>
    </div>

    <div class="video-grid">
      <article class="video-card anim" data-anim="fade-up">
        <span class="video-card__index">POINT 01</span>
        <h3 class="video-card__title">加工なし、だから実物が見える</h3>
        <p>メダカ業界では、写真の色補正・編集が常態化しています。{{ $brand }} は加工しない動画で出品。「届いたら写真と違った」を、構造的に防ぎます。</p>
      </article>
      <article class="video-card anim" data-anim="fade-up" data-delay="1">
        <span class="video-card__index">POINT 02</span>
        <h3 class="video-card__title">横見・上見の両方を、全ロット撮影</h3>
        <p>体形・体色・尾形・各鰭。評価で重要なすべての角度を、業界水準を超える精度で。撮影も {{ $brand }} が代行するので、出品者ごとのバラつきがありません。</p>
      </article>
      <article class="video-card anim" data-anim="fade-up" data-delay="2">
        <span class="video-card__index">POINT 03</span>
        <h3 class="video-card__title">開催前日から、好きなだけ</h3>
        <p>現地で数分しか見られないオフラインと違い、前日からじっくり、何度でも見られます。仕入れの優先検討時間が、構造的に確保されます。</p>
      </article>
      <article class="video-card anim" data-anim="fade-up" data-delay="3">
        <span class="video-card__index">POINT 04</span>
        <h3 class="video-card__title">止めて、戻して、共有して</h3>
        <p>気になる瞬間を止めて。別の個体と比べて。仕入れチームと共有して相談。オフラインの「その場で判断」では不可能だった意思決定が可能になります。</p>
      </article>
    </div>

    <p class="video-strong anim" data-anim="fade-up">
      現地で見るより、深く、長く、確かに。<br>
      それが、{{ $brand }} の品質確認です。
    </p>
  </div>
</section>

<!-- ===== ⑨ 落札の流れ ===== -->
<section class="section section--steps" id="flow">
  <div class="container">
    <div class="steps-header anim" data-anim="fade-up">
      <h2 class="steps-header__title">
        <span class="steps-header__mark">落札までの4ステップ</span>
      </h2>
      <p class="steps-header__desc">
        業者会員になっていただいた後の、実際の取引フローです。
      </p>
    </div>

    <div class="steps-grid">
      <div class="step-tile anim" data-anim="fade-up">
        <span class="step-tile__index">STEP 01</span>
        <h3 class="step-tile__title">出品リストを確認</h3>
        <p class="step-tile__desc">LINE と Web で全ロットを公開。加工なしの横見・上見動画を、ゆっくり何度でも確認できます。</p>
      </div>
      <div class="step-tile anim" data-anim="fade-up" data-delay="1">
        <span class="step-tile__index">STEP 02</span>
        <h3 class="step-tile__title">オークションに参加・入札</h3>
        <p class="step-tile__desc">業者会員専用のオンライン会場で、リアルタイム形式に参加。事前入札も可能なので、当日リアルタイムで参加できない場合も入札を残しておけます。忖度や手ゼリの不公平はありません。</p>
      </div>
      <div class="step-tile anim" data-anim="fade-up" data-delay="2">
        <span class="step-tile__index">STEP 03</span>
        <h3 class="step-tile__title">落札・決済</h3>
        <p class="step-tile__desc">落札確定後、決済は振込で完了。取引のすべてが {{ $brand }} とのやり取りで、出品者と直接やり取りすることはありません。</p>
      </div>
      <div class="step-tile anim" data-anim="fade-up" data-delay="3">
        <span class="step-tile__index">STEP 04</span>
        <h3 class="step-tile__title">受け取り</h3>
        <p class="step-tile__desc">{{ $brand }} から直送。配送伝票も {{ $brand }} 名義で、相互の住所はやりとりされません。</p>
      </div>
    </div>

    <p class="steps-strong anim" data-anim="fade-up">
      リストを見て、入札して、待つだけ。<br class="sp-only">仕入れに使う時間を、最小化できます。
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
      ※ 落札プランの参加条件: ヤフオク評価・ヤフオクストア・EC実績・店舗・法人登記・イベント出展実績のいずれか1つ以上をクリア（詳細は FAQ 参照）。
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
        即時の会員登録ではなく、LINE で先にサービスをご体験いただけます。<br class="pc-only">
        ご自身に合うかをご確認のうえ、ご判断ください。
      </p>
    </div>

    <div class="line-merits">
      <article class="line-merit anim" data-anim="fade-up">
        <span class="line-merit__index">01</span>
        <h3 class="line-merit__title">デモで触ってから、判断できる</h3>
        <p>LINE登録するだけで、実際の入札画面と動画品質確認をお試しいただけます。会員登録するかは、触ってから決めていただけます。</p>
      </article>
      <article class="line-merit anim" data-anim="fade-up" data-delay="1">
        <span class="line-merit__index">02</span>
        <h3 class="line-merit__title">出品リストを先行で受け取れる</h3>
        <p>次回オークションの出品リストを、LINE に直接お届け。仕入れの優先検討時間が確保できます。</p>
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
        <p>LINE登録後、デモのURLをお送りします。実際の画面をご体験ください。</p>
      </li>
      <li>
        <span class="line-step__num">STEP 03</span>
        <h4>LINEで質問・申込</h4>
        <p>ご質問はLINEで。納得いただけたら、申込フォームへ。</p>
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
          <span class="faq-item__text">落札者として参加するには？</span>
          <span class="faq-item__chev" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg></span>
        </summary>
        <div class="faq-item__a">
          <span class="faq-item__mark faq-item__mark--a">A</span>
          <div class="faq-item__a-body">
            <p>
              LINE から申込フォームにてご提出ください。<br>
              以下のうち1つ以上を満たすことが、業者会員の参加条件です。
            </p>
            <ul class="faq-item__list">
              <li>ヤフオクの出品評価 50件以上 かつ 評価率 90% 以上</li>
              <li>ヤフオクストアの運営</li>
              <li>EC サイトでのメダカ販売 累計取引 50件以上</li>
              <li>実店舗または無人販売所での販売実績</li>
              <li>法人登記がある（登記簿にメダカ関連販売の記載がある）</li>
              <li>メダカ関連イベントへの年 3 回以上の出展実績</li>
            </ul>
            <p>所定の審査を経て、業者会員としてご参加いただけます。</p>
          </div>
        </div>
      </details>
      <details class="faq-item">
        <summary class="faq-item__q">
          <span class="faq-item__mark">Q</span>
          <span class="faq-item__text">同業者と入札で競合になることはありますか？</span>
          <span class="faq-item__chev" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg></span>
        </summary>
        <div class="faq-item__a">
          <span class="faq-item__mark faq-item__mark--a">A</span>
          <p>入札では業者間で競争が発生する場合がありますが、落札者は完全匿名のため、競合関係を気にすることなく取引できます。</p>
        </div>
      </details>
      <details class="faq-item">
        <summary class="faq-item__q">
          <span class="faq-item__mark">Q</span>
          <span class="faq-item__text">事前入札はどう使いますか？</span>
          <span class="faq-item__chev" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg></span>
        </summary>
        <div class="faq-item__a">
          <span class="faq-item__mark faq-item__mark--a">A</span>
          <p>業者会員専用のオンライン会場で、リアルタイム入札と事前入札の両方が可能です。詳細は LINE 登録後のデモでご確認いただけます。</p>
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
          会員登録するかは、触ってから決めていただけます。
        </p>
        <div class="cta-banner__actions">
          <a href="{{ $lineUrl }}" target="_blank" rel="noopener noreferrer" class="cta-banner__btn cta-banner__btn--white" onclick="fbq('track', 'Lead'); return true;">
            <span class="cta-banner__btn-main">
              LINE追加でデモを試す
              <span class="cta-banner__chev" aria-hidden="true">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
              </span>
            </span>
            <span class="cta-banner__btn-sub">落札したい方はこちら</span>
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
