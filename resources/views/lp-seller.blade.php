@php
  // ⚠ 出品者向け LP の仮文言版です。確定文言が出たら差し替えてください。
  $brand = '日本メダカオンライン市場';
  $lineUrl = 'https://lin.ee/XXXXXXX';
@endphp
<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="robots" content="noindex, nofollow">
  <title>出品者の方へ | {{ config('app.name', $brand) }}</title>
  <meta name="description" content="撮影・梱包・発送はすべて運営が代行。匿名・卸値で安定的にメダカを出品できる業者専用オンラインオークション。">
  <link rel="icon" type="image/png" href="/favicon.png">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;700;900&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="/css/lp.css?v=30">
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
    <a href="/seller" class="header__logo">
      <img src="/img/logo.png?v=2" alt="{{ $brand }}" class="header__logo-img">
    </a>
    <div class="header__right">
      <a href="/buyer" class="header__btn header__btn--login">落札者の方へ</a>
      <a href="{{ $lineUrl }}" target="_blank" rel="noopener noreferrer" class="header__cta">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="white"><path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63h2.386c.346 0 .627.285.627.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63.346 0 .628.285.628.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.281.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314"/></svg>
        <span>LINE登録</span>
      </a>
    </div>
  </div>
</header>

<!-- ===== HERO ===== -->
<section class="hero">
  <div class="hero__inner">
    <p class="hero__eyebrow sp-only hero-anim" data-hero-delay="1">FOR BREEDERS × 業者向けオンラインオークション</p>

    <div class="hero__visual hero-anim" data-hero-delay="2">
      <img src="/img/lp/fv-okada-yui.png" alt="" class="hero__visual-img" loading="eager">
    </div>

    <div class="hero__copy hero-anim" data-hero-delay="3">
      <p class="hero__eyebrow hero__eyebrow--inline pc-only">FOR BREEDERS × 業者向けオンラインオークション</p>
      <h1 class="hero__title">
        <span class="hero__title-line">出品の手間も値崩れも、</span>
        <span class="hero__title-line hero__title-line--strong">これで終わり。</span>
      </h1>
      <p class="hero__desc">
        撮影・梱包・発送はすべて運営が代行。<br class="pc-only">
        匿名・卸値で、安定した相場のなか出品できる業者専用オンラインオークション、<br>
        それが {{ $brand }} です。
      </p>
    </div>

    <div class="hero__cta hero-anim" data-hero-delay="4">
      <a href="{{ $lineUrl }}" target="_blank" rel="noopener noreferrer" class="hero__cta-card hero__cta-card--primary">
        <span class="hero__cta-card__icon" aria-hidden="true">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12c2-3 5-5 9-5s7 2 9 5c-2 3-5 5-9 5s-7-2-9-5z"/><circle cx="12" cy="12" r="2.2" fill="currentColor"/></svg>
        </span>
        <span class="hero__cta-card__body">
          <span class="hero__cta-card__title">LINEで出品相談</span>
          <span class="hero__cta-card__sub">出品したい方はこちら</span>
        </span>
        <span class="hero__cta-card__arrow" aria-hidden="true">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
        </span>
      </a>
      <a href="/buyer" class="hero__cta-card hero__cta-card--secondary">
        <span class="hero__cta-card__icon" aria-hidden="true">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2v6h6"/><path d="M19 9V21H5V3h9z"/><path d="M9 13h6"/><path d="M9 17h4"/></svg>
        </span>
        <span class="hero__cta-card__body">
          <span class="hero__cta-card__title">落札者の方へ</span>
          <span class="hero__cta-card__sub">落札のみご検討の方はこちら</span>
        </span>
        <span class="hero__cta-card__arrow" aria-hidden="true">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
        </span>
      </a>
    </div>
  </div>
</section>

<!-- ===== ② 協賛企業・協力ブリーダー ロゴ帯 ===== -->
<section class="section section--partners" id="partners">
  <div class="container">
    <div class="partners-header anim" data-anim="fade-up">
      <h2 class="partners-header__title">
        協賛企業・<span class="partners-header__num">協力ブリーダー</span>
      </h2>
    </div>
    <p class="partners-header__desc anim" data-anim="fade-up" style="text-align:center; max-width:680px; margin:0 auto 1.75rem; color:#4a5568; font-weight:500; line-height:1.85; font-size:clamp(0.92rem, 1.6vw, 1rem);">
      日本のメダカ業界を代表するメーカー・専業ブリーダーが参画する、<br class="pc-only">
      業者間プラットフォームです。
    </p>
    @php $partners = [1, 2, 3, 4, 5, 6]; @endphp
    <div class="partners-marquee anim" data-anim="fade-up" aria-hidden="true">
      <div class="partners-marquee__track">
        {{-- 同じセットを2回連結し、CSS の translateX(-50%) で継ぎ目なくループ --}}
        @for ($i = 0; $i < 2; $i++)
          @foreach ($partners as $n)
            <div class="partners-marquee__item">
              <img src="/img/lp/client/{{ $n }}.png" alt="" loading="lazy">
            </div>
          @endforeach
        @endfor
      </div>
    </div>
    <p class="partners-note anim" data-anim="fade-up">※ 協賛企業・協力ブリーダーのロゴは順次掲載予定です。</p>
  </div>
</section>

<!-- ===== ③ メダカ業界を、もう一段。 (共通) ===== -->
<section class="section section--mission">
  <div class="container">
    <div class="mission-inner anim" data-anim="fade-up">
      <h2 class="mission-title">メダカ業界を、<br class="sp-only">もう一段。</h2>
      <p class="mission-lead">
        日本のメダカ業界には、業者だけの場所が必要だと、<br class="pc-only">
        私たちは考えています。
      </p>
      <div class="mission-body">
        <p>ヤフオクは便利。でも、個人愛好家との混雑で、<br class="pc-only">
          業者間の相場は読みにくく、丹精込めた個体が値崩れすることもある。</p>
        <p>オフライン競りは信頼できる。でも、地域に縛られ、<br class="pc-only">
          参加できる業者は限られる。</p>
        <p>業者間の卸取引は、業界の根幹であるはずなのに、<br class="pc-only">
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
</section>

<!-- ===== ④ 出品者の課題 ===== -->
<section class="section section--problems" id="problems">
  <div class="container">
    <div class="problems-header anim" data-anim="fade-up">
      <h2 class="problems-header__title">こんなお悩み、<span class="problems-header__mark">ありませんか？</span></h2>
      <p class="problems-header__desc">出品側の業務には、これまでの市場では解決しきれなかった<br class="pc-only">3つの課題がありました。</p>
    </div>

    <div class="problems-rows">
      <div class="problem-row anim" data-anim="fade-up">
        <span class="problem-row__tag">
          価格・相場
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
        </span>
        <ul class="problem-row__list">
          <li>個人愛好家との混雑で値崩れする</li>
          <li>業者間の安定した相場で売りたい</li>
        </ul>
      </div>

      <div class="problem-row anim" data-anim="fade-up" data-delay="1">
        <span class="problem-row__tag">
          出品の手間
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
        </span>
        <ul class="problem-row__list">
          <li>撮影・梱包・発送の作業負荷</li>
          <li>問い合わせ対応に時間が取られる</li>
        </ul>
      </div>

      <div class="problem-row anim" data-anim="fade-up" data-delay="2">
        <span class="problem-row__tag">
          匿名性
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
        </span>
        <ul class="problem-row__list">
          <li>同業者と顔を合わせたくない</li>
          <li>匿名で安心して出品したい</li>
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
        出品者の業務を、<br class="sp-only"><span class="mechanism-header__mark">3つの仕組みで変えます</span>
      </h2>
      <p class="mechanism-header__desc">
        業者専用市場で安定した相場、完全匿名の収納代行、<br class="pc-only">
        撮影・梱包・発送は運営が代行。<br class="sp-only">
        独自の仕組みが、出品作業をゼロに近づけます。
      </p>
    </div>

    <div class="solutions-grid">
      <div class="solution-card solution-card--featured anim" data-anim="fade-up">
        <span class="solution-card__visual" style="background:#e6f4f5; display:flex; align-items:center; justify-content:center;">
          <span style="font-family:'Inter',sans-serif; font-size:2.2rem; font-weight:900; color:#2bb1b7;">01</span>
        </span>
        <span class="solution-card__body">
          <span class="solution-card__title">業者専用市場で、<br>相場が安定する</span>
        </span>
      </div>
      <div class="solution-card solution-card--featured anim" data-anim="fade-up" data-delay="1">
        <span class="solution-card__visual" style="background:#e6f4f5; display:flex; align-items:center; justify-content:center;">
          <span style="font-family:'Inter',sans-serif; font-size:2.2rem; font-weight:900; color:#2bb1b7;">02</span>
        </span>
        <span class="solution-card__body">
          <span class="solution-card__title">完全匿名で、<br>同業者とも取引できる</span>
        </span>
      </div>
      <div class="solution-card solution-card--featured anim" data-anim="fade-up" data-delay="2">
        <span class="solution-card__visual" style="background:#e6f4f5; display:flex; align-items:center; justify-content:center;">
          <span style="font-family:'Inter',sans-serif; font-size:2.2rem; font-weight:900; color:#2bb1b7;">03</span>
        </span>
        <span class="solution-card__body">
          <span class="solution-card__title">撮影・梱包・発送は<br>すべて運営が代行</span>
        </span>
      </div>
    </div>
  </div>
</section>

<!-- ===== ⑥ 比較表（出品者観点） ===== -->
<section class="section section--compare">
  <div class="container">
    <div class="compare-header anim" data-anim="fade-up">
      <h2 class="compare-header__title">
        業者の販路、<span class="compare-header__mark">選択肢は3つ</span>
      </h2>
      <p class="compare-header__desc">
        これまでメダカ業界で、業者の出品先は3つのチャネルに分かれていました。<br class="pc-only">
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
            <th scope="row">買い手の質</th>
            <td><span class="compare-mark compare-mark--bad">×</span><span class="compare-cell__note">個人愛好家中心</span></td>
            <td><span class="compare-mark compare-mark--good">◎</span><span class="compare-cell__note">業者中心（地域）</span></td>
            <td class="compare-td--us"><span class="compare-mark compare-mark--good">◎</span><span class="compare-cell__note">業者専用（審査制）</span></td>
          </tr>
          <tr>
            <th scope="row">相場の安定</th>
            <td><span class="compare-mark compare-mark--bad">×</span><span class="compare-cell__note">価格が読めない</span></td>
            <td><span class="compare-mark compare-mark--mid">△</span><span class="compare-cell__note">参加者数に依存</span></td>
            <td class="compare-td--us"><span class="compare-mark compare-mark--good">◎</span><span class="compare-cell__note">業者間の卸相場</span></td>
          </tr>
          <tr>
            <th scope="row">出品の手間</th>
            <td><span class="compare-mark compare-mark--bad">×</span><span class="compare-cell__note">撮影・梱包・発送すべて自分</span></td>
            <td><span class="compare-mark compare-mark--mid">△</span><span class="compare-cell__note">現地搬入・拘束時間大</span></td>
            <td class="compare-td--us"><span class="compare-mark compare-mark--good">◎</span><span class="compare-cell__note">運営が完全代行</span></td>
          </tr>
          <tr>
            <th scope="row">地理制約</th>
            <td><span class="compare-mark compare-mark--good">◎</span><span class="compare-cell__note">なし</span></td>
            <td><span class="compare-mark compare-mark--bad">×</span><span class="compare-cell__note">あり</span></td>
            <td class="compare-td--us"><span class="compare-mark compare-mark--good">◎</span><span class="compare-cell__note">なし</span></td>
          </tr>
          <tr>
            <th scope="row">品質訴求</th>
            <td><span class="compare-mark compare-mark--bad">×</span><span class="compare-cell__note">写真のみで限界</span></td>
            <td><span class="compare-mark compare-mark--mid">△</span><span class="compare-cell__note">現地で短時間</span></td>
            <td class="compare-td--us"><span class="compare-mark compare-mark--good">◎</span><span class="compare-cell__note">加工なし動画で訴求</span></td>
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

    <div class="compare-cards anim" data-anim="fade-up">
      <article class="compare-card">
        <div class="compare-card__head">
          <p class="compare-card__name">ヤフオク</p>
          <p class="compare-card__sub">公開市場</p>
        </div>
        <ul class="compare-card__list">
          <li><span>買い手の質</span><span class="compare-mark compare-mark--bad">×</span></li>
          <li><span>相場の安定</span><span class="compare-mark compare-mark--bad">×</span></li>
          <li><span>出品の手間</span><span class="compare-mark compare-mark--bad">×</span></li>
          <li><span>地理制約</span><span class="compare-mark compare-mark--good">◎</span></li>
          <li><span>品質訴求</span><span class="compare-mark compare-mark--bad">×</span></li>
          <li><span>匿名性</span><span class="compare-mark compare-mark--bad">×</span></li>
        </ul>
      </article>
      <article class="compare-card">
        <div class="compare-card__head">
          <p class="compare-card__name">オフライン業者OK</p>
          <p class="compare-card__sub">地域中心</p>
        </div>
        <ul class="compare-card__list">
          <li><span>買い手の質</span><span class="compare-mark compare-mark--good">◎</span></li>
          <li><span>相場の安定</span><span class="compare-mark compare-mark--mid">△</span></li>
          <li><span>出品の手間</span><span class="compare-mark compare-mark--mid">△</span></li>
          <li><span>地理制約</span><span class="compare-mark compare-mark--bad">×</span></li>
          <li><span>品質訴求</span><span class="compare-mark compare-mark--mid">△</span></li>
          <li><span>匿名性</span><span class="compare-mark compare-mark--bad">×</span></li>
        </ul>
      </article>
      <article class="compare-card compare-card--us">
        <div class="compare-card__head">
          <p class="compare-card__name">{{ $brand }}</p>
          <p class="compare-card__sub">業者向けオンライン</p>
        </div>
        <ul class="compare-card__list">
          <li><span>買い手の質</span><span class="compare-mark compare-mark--good">◎</span></li>
          <li><span>相場の安定</span><span class="compare-mark compare-mark--good">◎</span></li>
          <li><span>出品の手間</span><span class="compare-mark compare-mark--good">◎</span></li>
          <li><span>地理制約</span><span class="compare-mark compare-mark--good">◎</span></li>
          <li><span>品質訴求</span><span class="compare-mark compare-mark--good">◎</span></li>
          <li><span>匿名性</span><span class="compare-mark compare-mark--good">◎</span></li>
        </ul>
      </article>
    </div>

    <p class="compare-strong anim" data-anim="fade-up">
      手間ゼロと、業者間の相場安定を、<br class="sp-only">両取りする。<br>
      それが、{{ $brand }} です。
    </p>
  </div>
</section>

<!-- ===== ⑥.5 出品ロットの実利益 ===== -->
<section class="section section--takehome">
  <div class="container">
    <div class="takehome-header anim" data-anim="fade-up">
      <h2 class="takehome-header__title">
        出品ロットの実利益に、<span class="takehome-header__mark">3つの差が集まります</span>
      </h2>
      <p class="takehome-header__desc">
        落札価格・出品コスト・拘束時間。<br class="pc-only">
        3つの違いが、最後の「実利益」を決めます。
      </p>
    </div>

    <div class="takehome-bars anim" data-anim="fade-up">
      <div class="takehome-bar">
        <div class="takehome-bar__label">ヤフオク出品</div>
        <div class="takehome-bar__track"><div class="takehome-bar__fill takehome-bar__fill--low" style="width:18%"></div></div>
      </div>
      <div class="takehome-bar">
        <div class="takehome-bar__label">オフライン出品</div>
        <div class="takehome-bar__track"><div class="takehome-bar__fill takehome-bar__fill--mid" style="width:46%"></div></div>
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
        <h3 class="takehome-reason__title">落札価格</h3>
        <p>業者専用の卸相場で、ヤフオク特有の値崩れがありません。動画品質確認の精度の高さが、価格訴求にも直結します。</p>
      </article>
      <article class="takehome-reason anim" data-anim="fade-up" data-delay="1">
        <span class="takehome-reason__index">理由 02</span>
        <h3 class="takehome-reason__title">出品コスト</h3>
        <p>撮影・梱包・発送はすべて {{ $brand }} が代行。出品ロットあたりの作業コストが、構造的に最小化されます。</p>
      </article>
      <article class="takehome-reason anim" data-anim="fade-up" data-delay="2">
        <span class="takehome-reason__index">理由 03</span>
        <h3 class="takehome-reason__title">拘束時間</h3>
        <p>オフラインの現地拘束も、ヤフオクの問い合わせ対応も不要。空いた時間を、繁殖と選別に使えます。</p>
      </article>
    </div>
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
        2つの出品ニーズに、{{ $brand }} は応えます。<br>
        「相場の安定した卸先」と「手間ゼロでの出品」。<br class="pc-only">
        さらに「運営代行」と「定期開催」も。
      </p>
    </div>

    <div class="solutions-grid">
      <a href="#mechanism" class="solution-card solution-card--featured anim" data-anim="fade-up">
        <span class="solution-card__visual" style="background:#e6f4f5; display:flex; align-items:center; justify-content:center;">
          <span style="font-family:'Inter',sans-serif; font-size:2.2rem; font-weight:900; color:#2bb1b7;">01</span>
        </span>
        <span class="solution-card__body">
          <span class="solution-card__title">業者間の相場で、安定した売上</span>
          <span class="solution-card__arrow" aria-hidden="true">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
          </span>
        </span>
      </a>
      <a href="#mechanism" class="solution-card solution-card--featured anim" data-anim="fade-up" data-delay="1">
        <span class="solution-card__visual" style="background:#e6f4f5; display:flex; align-items:center; justify-content:center;">
          <span style="font-family:'Inter',sans-serif; font-size:2.2rem; font-weight:900; color:#2bb1b7;">02</span>
        </span>
        <span class="solution-card__body">
          <span class="solution-card__title">「ヤフオクには出さない」個体を、ここで</span>
          <span class="solution-card__arrow" aria-hidden="true">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
          </span>
        </span>
      </a>
      <a href="#flow" class="solution-card anim" data-anim="fade-up">
        <span class="solution-card__visual" style="background:#e6f4f5; display:flex; align-items:center; justify-content:center;">
          <span style="font-family:'Inter',sans-serif; font-size:1.8rem; font-weight:900; color:#2bb1b7;">03</span>
        </span>
        <span class="solution-card__body">
          <span class="solution-card__title">撮影・梱包・発送を、運営が代行</span>
          <span class="solution-card__arrow" aria-hidden="true">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
          </span>
        </span>
      </a>
      <a href="#flow" class="solution-card anim" data-anim="fade-up" data-delay="1">
        <span class="solution-card__visual" style="background:#e6f4f5; display:flex; align-items:center; justify-content:center;">
          <span style="font-family:'Inter',sans-serif; font-size:1.8rem; font-weight:900; color:#2bb1b7;">04</span>
        </span>
        <span class="solution-card__body">
          <span class="solution-card__title">月2回の定期開催で、計画的に出品</span>
          <span class="solution-card__arrow" aria-hidden="true">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
          </span>
        </span>
      </a>
    </div>
  </div>
</section>

<!-- ===== ⑧ 運営代行差別化 ===== -->
<section class="section section--video">
  <div class="container">
    <div class="video-header anim" data-anim="fade-up">
      <h2 class="video-header__title">出品作業のすべてを、<br class="sp-only">運営が引き受ける。</h2>
      <p class="video-header__desc">
        撮影・梱包・発送・問い合わせ対応まで、出品に伴うすべての業務を運営が代行します。<br class="pc-only">
        出品者は、本来の繁殖と選別に集中できます。
      </p>
    </div>

    <div class="video-grid">
      <article class="video-card anim" data-anim="fade-up">
        <span class="video-card__index">POINT 01</span>
        <h3 class="video-card__title">撮影は、運営が全ロット撮影</h3>
        <p>横見・上見の動画を業界水準を超える精度で撮影。出品者ごとのバラつきがなく、買い手にとっても比較しやすい品質訴求が可能です。</p>
      </article>
      <article class="video-card anim" data-anim="fade-up" data-delay="1">
        <span class="video-card__index">POINT 02</span>
        <h3 class="video-card__title">梱包・発送は、生体専用オペレーション</h3>
        <p>温度管理・酸素供給を含む生体輸送を運営が一括代行。死着リスクも、運営側の補償規定でカバーします。</p>
      </article>
      <article class="video-card anim" data-anim="fade-up" data-delay="2">
        <span class="video-card__index">POINT 03</span>
        <h3 class="video-card__title">入金・問い合わせ対応も運営側</h3>
        <p>落札後の決済は買取再販モデル。買い手とのやり取りも運営が窓口になるため、出品者は連絡対応に時間を取られません。</p>
      </article>
      <article class="video-card anim" data-anim="fade-up" data-delay="3">
        <span class="video-card__index">POINT 04</span>
        <h3 class="video-card__title">繁殖・選別の時間が、構造的に増える</h3>
        <p>出品にかけていた時間を、本来の繁殖と選別に振り直せます。良い個体を出すことに、純粋に集中できる体制が整います。</p>
      </article>
    </div>

    <p class="video-strong anim" data-anim="fade-up">
      出品の手間を、構造的にゼロにする。<br>
      それが、{{ $brand }} の運営代行モデルです。
    </p>
  </div>
</section>

<!-- ===== ⑨ 出品の流れ ===== -->
<section class="section section--steps" id="flow">
  <div class="container">
    <div class="steps-header anim" data-anim="fade-up">
      <h2 class="steps-header__title">
        <span class="steps-header__mark">出品までの4ステップ</span>
      </h2>
      <p class="steps-header__desc">
        業者会員（出品兼）になっていただいた後の、実際の出品フローです。
      </p>
    </div>

    <div class="steps-grid">
      <div class="step-tile anim" data-anim="fade-up">
        <span class="step-tile__index">STEP 01</span>
        <h3 class="step-tile__title">出品ロットを登録</h3>
        <p class="step-tile__desc">LINE もしくは管理画面から、次回オークションに出す個体を登録。品種・希望最低価格をご指定ください。</p>
      </div>
      <div class="step-tile anim" data-anim="fade-up" data-delay="1">
        <span class="step-tile__index">STEP 02</span>
        <h3 class="step-tile__title">個体の集荷・撮影</h3>
        <p class="step-tile__desc">運営が集荷を手配。撮影・上場ページの作成まで、すべて {{ $brand }} 側で行います。</p>
      </div>
      <div class="step-tile anim" data-anim="fade-up" data-delay="2">
        <span class="step-tile__index">STEP 03</span>
        <h3 class="step-tile__title">オークション開催・落札</h3>
        <p class="step-tile__desc">業者会員専用のオンライン会場で開催。決済・配送・買い手対応はすべて運営が窓口に。</p>
      </div>
      <div class="step-tile anim" data-anim="fade-up" data-delay="3">
        <span class="step-tile__index">STEP 04</span>
        <h3 class="step-tile__title">入金・実績反映</h3>
        <p class="step-tile__desc">落札額から成約手数料を差し引いた金額をご指定の口座へ。出品実績は管理画面で確認できます。</p>
      </div>
    </div>
  </div>
</section>

<!-- ===== ⑩ 料金プラン (共通) ===== -->
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
        <span class="pricing-card__tag">業者会員（出品兼）</span>
        <span class="pricing-card__price"><em>11,000</em><small>円</small></span>
        <span class="pricing-card__note">年 / 税込</span>
      </div>
    </div>

    <div class="pricing-detail anim" data-anim="fade-up">
      <p class="pricing-detail__title">プランの内訳</p>
      <div class="pricing-detail__table">
        <div class="pricing-detail__row">
          <span class="pricing-detail__label">業者会員（落札）</span>
          <span class="pricing-detail__value">オークション閲覧 / 入札・落札 / 申込→審査</span>
        </div>
        <div class="pricing-detail__row">
          <span class="pricing-detail__label">業者会員（出品兼）</span>
          <span class="pricing-detail__value">出品 + 入札・落札 / より厳格な審査</span>
        </div>
        <div class="pricing-detail__row">
          <span class="pricing-detail__label">成約時手数料</span>
          <span class="pricing-detail__value">落札額の 10%</span>
        </div>
      </div>
    </div>

    <p class="pricing-note anim" data-anim="fade-up">
      ※ 出品兼プランには、買い手として落札する権利も含まれます。<br>
      ※ 出品兼プランは、より厳格な審査を経てご加入いただけます。
    </p>
  </div>
</section>

<!-- ===== ⑪ LINE 登録メリット (共通) ===== -->
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
        <h3 class="line-merit__title">出品プロセスを、先に把握できる</h3>
        <p>LINE登録するだけで、出品フローと運営代行範囲の詳細をご案内します。納得いただいてから審査申込いただけます。</p>
      </article>
      <article class="line-merit anim" data-anim="fade-up" data-delay="1">
        <span class="line-merit__index">02</span>
        <h3 class="line-merit__title">次回開催・出品枠を先行で受け取れる</h3>
        <p>次回オークションのスケジュールと、出品枠の空き状況を LINE に直接お届けします。</p>
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
        <h4>出品プロセスを確認</h4>
        <p>LINE登録後、出品プロセスの詳細資料をお送りします。</p>
      </li>
      <li>
        <span class="line-step__num">STEP 03</span>
        <h4>LINEで質問・申込</h4>
        <p>ご質問はLINEで。納得いただけたら、申込フォームへ。</p>
      </li>
    </ol>

    <div class="line-cta anim" data-anim="fade-up">
      <a href="{{ $lineUrl }}" target="_blank" rel="noopener noreferrer" class="btn-primary btn-primary--lg">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="white"><path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63h2.386c.346 0 .627.285.627.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63.346 0 .628.285.628.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.281.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314"/></svg>
        LINEで出品相談する
      </a>
      <p class="line-cta__note">※ 友だち追加だけ。登録は無料です。</p>
    </div>
  </div>
</section>

<!-- ===== ⑫ 協力ブリーダーの声 (共通) ===== -->
<section class="section section--voice" id="voice">
  <div class="container">
    <div class="voice-header anim" data-anim="fade-up">
      <h2 class="voice-header__title">
        <span class="voice-header__mark">協力ブリーダー</span>から
      </h2>
      <p class="voice-header__desc">
        ローンチに先立ち、出品予定のブリーダー様からコメントをいただきました。<br class="pc-only">
        業界の最前線で活動する皆さまの、率直な声をご覧ください。
      </p>
    </div>

    <div class="voice-grid">
      <article class="voice-tile anim" data-anim="fade-up">
        <p class="voice-tile__quote">ヤフオクは愛好家相場の上に成り立っているので、業者向けに値段を下げると、相場が一気に崩れてしまう。これまでは個別に相対でやりとりするしかなく、まとまった数量で効率的に卸す場所が業界にありませんでした。{{ $brand }} の業者専門の環境なら、相場を壊さずに、業者さんへ効率的に卸せる。業界に必要だった仕組みです。</p>
        <div class="voice-tile__author">
          <span class="voice-tile__avatar"><img src="/img/lp/voice/01.png" alt="" loading="lazy"></span>
          <span class="voice-tile__info">
            <strong>A社</strong>
          </span>
        </div>
      </article>
      <article class="voice-tile anim" data-anim="fade-up" data-delay="1">
        <p class="voice-tile__quote">個別販売は、撮影・梱包・発送だけでなく、お客様への問い合わせ対応まで、本業の時間を奪い続けてきました。{{ $brand }} なら、業者間の流通が一気に効率化される。作り手はめだかと向き合う時間に集中でき、業者は仕入れに困らない。業界全体の生産性と収益性が、同時に上がる仕組みです。</p>
        <div class="voice-tile__author">
          <span class="voice-tile__avatar"><img src="/img/lp/voice/02.png" alt="" loading="lazy"></span>
          <span class="voice-tile__info">
            <strong>B社</strong>
          </span>
        </div>
      </article>
      <article class="voice-tile anim" data-anim="fade-up" data-delay="2">
        <p class="voice-tile__quote">業者向けの卸ネットワークが整備されることで、新しい作り手も評価される機会が生まれる。全国の小売店・専門店も、もっと多様な個体を扱える。結果としてお客様に届くメダカの幅が広がる。業界全体の市場が大きくなる、業界の未来が楽しみです。</p>
        <div class="voice-tile__author">
          <span class="voice-tile__avatar"><img src="/img/lp/voice/03.png" alt="" loading="lazy"></span>
          <span class="voice-tile__info">
            <strong>C社</strong>
          </span>
        </div>
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
          <p>しません。ヤフオクは個人愛好家主体の小売チャネル、{{ $brand }} は業者専用の卸チャネルです。使い分けることで手取り全体が増える設計です。</p>
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
          <p>なりません。LINE 登録後にデモの URL と出品プロセスの資料をお送りします。ご自身のタイミングで申込フォームから会員登録いただけます。</p>
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
          <p>LINE から申込フォームをご提出ください。業者会員（出品兼）はより厳格な審査を経てご加入いただきます。</p>
        </div>
      </details>
      <details class="faq-item">
        <summary class="faq-item__q">
          <span class="faq-item__mark">Q</span>
          <span class="faq-item__text">撮影や梱包は本当にすべて運営側でやってくれますか？</span>
          <span class="faq-item__chev" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg></span>
        </summary>
        <div class="faq-item__a">
          <span class="faq-item__mark faq-item__mark--a">A</span>
          <p>はい、撮影・梱包・発送・買い手対応はすべて {{ $brand }} 側で代行します。出品者は対象個体をお預けいただくだけで完結します。</p>
        </div>
      </details>
      <details class="faq-item">
        <summary class="faq-item__q">
          <span class="faq-item__mark">Q</span>
          <span class="faq-item__text">最低出品ロット数や品種の指定はありますか？</span>
          <span class="faq-item__chev" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg></span>
        </summary>
        <div class="faq-item__a">
          <span class="faq-item__mark faq-item__mark--a">A</span>
          <p>運用基準は審査時にご案内します。詳細は LINE 登録後にお送りする資料をご確認ください。</p>
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
        <h2 class="cta-banner__title">まずは、LINE から。</h2>
        <p class="cta-banner__desc">
          LINE 登録するだけで、出品プロセスと運営代行の詳細をご案内します。<br class="pc-only">
          審査申込するかは、内容を見てから決めていただけます。
        </p>
        <div class="cta-banner__actions">
          <a href="{{ $lineUrl }}" target="_blank" rel="noopener noreferrer" class="cta-banner__btn cta-banner__btn--white">
            <span class="cta-banner__btn-main">
              LINEで出品相談する
              <span class="cta-banner__chev" aria-hidden="true">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
              </span>
            </span>
            <span class="cta-banner__btn-sub">出品したい方はこちら</span>
          </a>
          <a href="/buyer" class="cta-banner__btn cta-banner__btn--accent">
            <span class="cta-banner__btn-main">
              落札者の方へ
              <span class="cta-banner__chev" aria-hidden="true">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
              </span>
            </span>
            <span class="cta-banner__btn-sub">落札のみご検討の方はこちら</span>
          </a>
        </div>
      </div>
      <div class="cta-banner__visual anim" data-anim="fade-up" data-delay="1" aria-hidden="true">
        <img src="/img/lp/cta.png" alt="" loading="lazy">
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
        <p class="footer__operator">運営：日本メダカオンライン市場</p>
        <p class="footer__operator">インボイス登録番号: T-XXXXXXXXXXXXX</p>
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
  <a href="{{ $lineUrl }}" target="_blank" rel="noopener noreferrer" class="btn-primary">
    <svg width="20" height="20" viewBox="0 0 24 24" fill="white"><path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63h2.386c.346 0 .627.285.627.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63.346 0 .628.285.628.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.281.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314"/></svg>
    LINEで出品相談
  </a>
</div>

<script src="/js/lp.js?v=5"></script>
</body>
</html>
