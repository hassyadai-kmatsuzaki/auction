@php
  $brand = '日本メダカオンライン市場';
  $lineUrl = 'https://lin.ee/XXXXXXX';
@endphp
<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="robots" content="noindex, nofollow">
  <title>落札者の方へ | {{ config('app.name', $brand) }}</title>
  <meta name="description" content="審査を通過したプロ出品者のメダカを、匿名・卸値で仕入れられる業者専用オンラインオークション。">
  <link rel="icon" type="image/png" href="/favicon.png">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;700;900&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="/css/lp.css?v=28">
  <script>
    (function(d) {
      var config = { kitId: 'png6ego', scriptTimeout: 3000, async: true },
      h=d.documentElement,t=setTimeout(function(){h.className=h.className.replace(/\bwf-loading\b/g,"")+" wf-inactive";},config.scriptTimeout),tk=d.createElement("script"),f=false,s=d.getElementsByTagName("script")[0],a;h.className+=" wf-loading";tk.src='https://use.typekit.net/'+config.kitId+'.js';tk.async=true;tk.onload=tk.onreadystatechange=function(){a=this.readyState;if(f||a&&a!="complete"&&a!="loaded")return;f=true;clearTimeout(t);try{Typekit.load(config)}catch(e){}};s.parentNode.insertBefore(tk,s)
    })(document);
  </script>
</head>
<body class="lp-bizpro lp-bizpro--buyer">

<!-- ===== HEADER (sticky, biz-nav) ===== -->
<header class="bizpro-header" id="header">
  <div class="bizpro-header__inner">
    <a href="/buyer" class="bizpro-header__logo">
      <img src="/img/logo.png?v=2" alt="{{ $brand }}" class="bizpro-header__logo-img">
    </a>
    <nav class="bizpro-header__nav" aria-label="ヘッダーナビ">
      <a href="/seller" class="bizpro-header__link">出品者の方へ</a>
      <a href="/buyer" class="bizpro-header__link is-current" aria-current="page">落札者の方へ</a>
      <a href="#pricing" class="bizpro-header__link">料金</a>
      <a href="#faq" class="bizpro-header__link">FAQ</a>
    </nav>
    <a href="{{ $lineUrl }}" target="_blank" rel="noopener noreferrer" class="bizpro-header__cta">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="white" aria-hidden="true"><path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63h2.386c.346 0 .627.285.627.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63.346 0 .628.285.628.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.281.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314"/></svg>
      <span>LINEで登録</span>
    </a>
  </div>
</header>

<!-- ===== ① FV / HERO ===== -->
<section class="bizpro-hero">
  <div class="bizpro-hero__bg" aria-hidden="true"></div>
  <div class="bizpro-hero__inner container">
    <div class="bizpro-hero__badge">
      <span class="bizpro-hero__badge-l">MEMBERS ONLY</span>
      <span class="bizpro-hero__badge-sep" aria-hidden="true">・</span>
      <span class="bizpro-hero__badge-r">業者向けオンラインオークション</span>
    </div>
    <p class="bizpro-hero__lead">業界初</p>
    <h1 class="bizpro-hero__title">業者専用<br class="sp-only">オンラインオークション</h1>
    <p class="bizpro-hero__desc">
      審査を通過したプロ出品者のメダカを、<br class="sp-only">匿名・卸値で仕入れられる場所。<br>
      業者だけのオンラインオークション、<br class="sp-only">それが {{ $brand }} です。
    </p>
    <div class="bizpro-hero__cta">
      <a href="{{ $lineUrl }}" target="_blank" rel="noopener noreferrer" class="bizpro-btn bizpro-btn--primary">
        <span>LINE追加でデモを試す</span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
      </a>
    </div>
    <p class="bizpro-hero__note">
      ※ LINE登録だけで、すぐにデモをお試しいただけます。<br>
      ※ 出品もご検討の方は <a href="/seller" class="bizpro-hero__note-link">出品者の方へ →</a>
    </p>
  </div>
</section>

<!-- ===== ② 協賛企業・協力ブリーダー ロゴ帯 ===== -->
<section class="bizpro-partners" id="partners">
  <div class="container">
    <div class="bizpro-partners__head anim" data-anim="fade-up">
      <p class="bizpro-eyebrow">PARTNERS</p>
      <h2 class="bizpro-partners__title">協賛企業・協力ブリーダー</h2>
      <p class="bizpro-partners__desc">
        日本のメダカ業界を代表するメーカー・専業ブリーダーが参画する、<br class="pc-only">
        業者間プラットフォームです。
      </p>
    </div>
    <div class="bizpro-partners__marquee anim" data-anim="fade-up" aria-hidden="true">
      <div class="bizpro-partners__track">
        @for ($i = 0; $i < 2; $i++)
          @for ($j = 0; $j < 10; $j++)
            <div class="bizpro-partners__item">
              <img src="/img/logo.png?v=2" alt="" loading="lazy">
            </div>
          @endfor
        @endfor
      </div>
    </div>
    <p class="bizpro-partners__note anim" data-anim="fade-up">※ 協賛企業・協力ブリーダーのロゴは順次掲載予定です。</p>
  </div>
</section>

<!-- ===== ③ メダカ業界を、もう一段。 ===== -->
<section class="bizpro-mission">
  <div class="container">
    <div class="bizpro-mission__inner anim" data-anim="fade-up">
      <p class="bizpro-eyebrow bizpro-eyebrow--center">MISSION</p>
      <h2 class="bizpro-mission__title">メダカ業界を、<br class="sp-only">もう一段。</h2>
      <p class="bizpro-mission__lead">
        日本のメダカ業界には、業者だけの場所が必要だと、<br class="pc-only">
        私たちは考えています。
      </p>

      <div class="bizpro-mission__body">
        <p>ヤフオクは便利。でも、個人愛好家との混雑で、<br class="pc-only">
          業者間の相場は読みにくく、丹精込めた個体が値崩れすることもある。</p>
        <p>オフライン競りは信頼できる。でも、地域に縛られ、<br class="pc-only">
          参加できる業者は限られる。</p>
        <p>業者間の卸取引は、業界の根幹であるはずなのに、<br class="pc-only">
          それに見合うインフラが、これまでありませんでした。</p>
      </div>

      <div class="bizpro-mission__pledge">
        <p>{{ $brand }} は、業者だけが集まれる<br class="sp-only">オンラインオークションです。</p>
        <p>信頼できるブリーダーから、信頼できる業者へ。<br>
          相場と収益を守りながら、業界全体を、もう一段引き上げる。</p>
      </div>

      <div class="bizpro-mission__close">
        <p class="bizpro-mission__close-line">このプラットフォームを、<br class="sp-only">皆さんと一緒につくっていきたい。</p>
        <p class="bizpro-mission__close-sign">── それが、{{ $brand }} の出発点です。</p>
      </div>
    </div>
  </div>
</section>

<!-- ===== ④ 落札者の課題 ===== -->
<section class="bizpro-problems">
  <div class="container">
    <div class="bizpro-section-head anim" data-anim="fade-up">
      <p class="bizpro-eyebrow">CHALLENGES</p>
      <h2 class="bizpro-section-title">こんなお悩み、<br class="sp-only">ありませんか？</h2>
      <p class="bizpro-section-desc">
        業者の仕入れには、これまでの市場では解決しきれなかった<br class="pc-only">
        3つの課題がありました。
      </p>
    </div>
    <ul class="bizpro-problems__list">
      <li class="bizpro-problems__item anim" data-anim="fade-up">
        <span class="bizpro-problems__check" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
        </span>
        <p>ヤフオクは個人愛好家が主体で、<br class="sp-only">業者向けの卸値で仕入れにくい</p>
      </li>
      <li class="bizpro-problems__item anim" data-anim="fade-up" data-delay="1">
        <span class="bizpro-problems__check" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
        </span>
        <p>同業者と競合関係を気にせず、<br class="sp-only">匿名で仕入れたい</p>
      </li>
      <li class="bizpro-problems__item anim" data-anim="fade-up" data-delay="2">
        <span class="bizpro-problems__check" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
        </span>
        <p>加工無しの現物動画を<br class="sp-only">じっくり確認してから判断したい</p>
      </li>
    </ul>
  </div>
</section>

<!-- ===== ⑤ 3つの仕組み ===== -->
<section class="bizpro-mechanism">
  <div class="container">
    <div class="bizpro-section-head anim" data-anim="fade-up">
      <p class="bizpro-eyebrow">MECHANISM</p>
      <h2 class="bizpro-section-title">業者の仕入れを、<br class="sp-only">3つの仕組みで変えます。</h2>
      <p class="bizpro-section-desc">お悩みのひとつひとつに、独自の仕組みで応えます。</p>
    </div>
    <div class="bizpro-mech-grid">
      <article class="bizpro-mech-card anim" data-anim="fade-up">
        <span class="bizpro-mech-card__num">01</span>
        <h3 class="bizpro-mech-card__title">個人愛好家を排除した、<br>業者専用の入札市場</h3>
        <p class="bizpro-mech-card__body">
          所定の審査を通過した業者のみが参加できます。<br>
          ヤフオクのような感情入札による価格高騰がなく、業者間の卸値で取引できます。
        </p>
      </article>
      <article class="bizpro-mech-card anim" data-anim="fade-up" data-delay="1">
        <span class="bizpro-mech-card__num">02</span>
        <h3 class="bizpro-mech-card__title">落札者・出品者ともに、<br>完全匿名</h3>
        <p class="bizpro-mech-card__body">
          {{ $brand }} が間に立つ収納代行モデル。<br>
          屋号・連絡先・住所は相互に開示されません。同業者間の取引でも、競合関係を気にせず仕入れられます。
        </p>
      </article>
      <article class="bizpro-mech-card anim" data-anim="fade-up" data-delay="2">
        <span class="bizpro-mech-card__num">03</span>
        <h3 class="bizpro-mech-card__title">加工無しの動画で、<br>現物をじっくり確認</h3>
        <p class="bizpro-mech-card__body">
          全ロットの横見・上見動画を、開催前日から公開。<br>
          加工しない実物の動画を、好きなだけ・止めて・戻して。仕入れ判断の精度を上げられます。
        </p>
      </article>
    </div>
  </div>
</section>

<!-- ===== ⑥ 比較表 ===== -->
<section class="bizpro-compare">
  <div class="container">
    <div class="bizpro-section-head anim" data-anim="fade-up">
      <p class="bizpro-eyebrow">COMPARISON</p>
      <h2 class="bizpro-section-title">業者の仕入れ、<br class="sp-only">選択肢は3つ。</h2>
      <p class="bizpro-section-desc">
        これまでメダカ業界で、業者間の仕入れは3つのチャネルに分かれていました。<br class="pc-only">
        それぞれに長所と限界があります。
      </p>
    </div>

    <div class="bizpro-compare__table-wrap anim" data-anim="fade-up">
      <table class="bizpro-compare__table">
        <thead>
          <tr>
            <th scope="col" class="bizpro-compare__th-empty"></th>
            <th scope="col" class="bizpro-compare__col">
              <span class="bizpro-compare__col-name">ヤフオク</span>
              <span class="bizpro-compare__col-sub">公開市場</span>
            </th>
            <th scope="col" class="bizpro-compare__col">
              <span class="bizpro-compare__col-name">オフライン<br>業者OK</span>
              <span class="bizpro-compare__col-sub">地域中心</span>
            </th>
            <th scope="col" class="bizpro-compare__col bizpro-compare__col--us">
              <span class="bizpro-compare__col-name">{{ $brand }}</span>
              <span class="bizpro-compare__col-sub">業者向けオンライン</span>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <th scope="row" class="bizpro-compare__row-name">参加層</th>
            <td><span class="bizpro-mark bizpro-mark--bad">×</span><span class="bizpro-compare__cell-note">制限なし</span></td>
            <td><span class="bizpro-mark bizpro-mark--good">◎</span><span class="bizpro-compare__cell-note">業者中心（地域）</span></td>
            <td class="bizpro-compare__cell-us"><span class="bizpro-mark bizpro-mark--good">◎</span><span class="bizpro-compare__cell-note">業者専用（審査制）</span></td>
          </tr>
          <tr>
            <th scope="row" class="bizpro-compare__row-name">審査</th>
            <td><span class="bizpro-mark bizpro-mark--bad">×</span><span class="bizpro-compare__cell-note">なし</span></td>
            <td><span class="bizpro-mark bizpro-mark--mid">△</span><span class="bizpro-compare__cell-note">紹介ベース<br>（知人を辿らないと参加できない）</span></td>
            <td class="bizpro-compare__cell-us"><span class="bizpro-mark bizpro-mark--good">◎</span><span class="bizpro-compare__cell-note">申込ベース<br>（誰でも申し込め、審査が明文化）</span></td>
          </tr>
          <tr>
            <th scope="row" class="bizpro-compare__row-name">仕入後の手取り</th>
            <td><span class="bizpro-mark bizpro-mark--bad">×</span><span class="bizpro-compare__cell-note">薄利</span></td>
            <td><span class="bizpro-mark bizpro-mark--mid">△</span><span class="bizpro-compare__cell-note">時間／地理<br>コスト大</span></td>
            <td class="bizpro-compare__cell-us"><span class="bizpro-mark bizpro-mark--good">◎</span><span class="bizpro-compare__cell-note">卸値＋コストなし</span></td>
          </tr>
          <tr>
            <th scope="row" class="bizpro-compare__row-name">地理制約</th>
            <td><span class="bizpro-mark bizpro-mark--good">◎</span><span class="bizpro-compare__cell-note">なし</span></td>
            <td><span class="bizpro-mark bizpro-mark--bad">×</span><span class="bizpro-compare__cell-note">あり</span></td>
            <td class="bizpro-compare__cell-us"><span class="bizpro-mark bizpro-mark--good">◎</span><span class="bizpro-compare__cell-note">なし</span></td>
          </tr>
          <tr>
            <th scope="row" class="bizpro-compare__row-name">品質確認</th>
            <td><span class="bizpro-mark bizpro-mark--bad">×</span><span class="bizpro-compare__cell-note">自己申告</span></td>
            <td><span class="bizpro-mark bizpro-mark--mid">△</span><span class="bizpro-compare__cell-note">現地で短時間</span></td>
            <td class="bizpro-compare__cell-us"><span class="bizpro-mark bizpro-mark--good">◎</span><span class="bizpro-compare__cell-note">加工なし動画</span></td>
          </tr>
          <tr>
            <th scope="row" class="bizpro-compare__row-name">匿名性</th>
            <td><span class="bizpro-mark bizpro-mark--bad">×</span><span class="bizpro-compare__cell-note">個人情報やりとり</span></td>
            <td><span class="bizpro-mark bizpro-mark--bad">×</span><span class="bizpro-compare__cell-note">地域で顔バレ</span></td>
            <td class="bizpro-compare__cell-us"><span class="bizpro-mark bizpro-mark--good">◎</span><span class="bizpro-compare__cell-note">完全匿名</span></td>
          </tr>
        </tbody>
      </table>
    </div>

    <p class="bizpro-compare__strong anim" data-anim="fade-up">
      オンラインの便利さと、業者間取引の信頼性を、両取りする。<br>
      それが、{{ $brand }} です。
    </p>
  </div>
</section>

<!-- ===== ⑥.5 仕入後の手取り ===== -->
<section class="bizpro-takehome">
  <div class="container">
    <div class="bizpro-section-head anim" data-anim="fade-up">
      <p class="bizpro-eyebrow">TAKE-HOME</p>
      <h2 class="bizpro-section-title">仕入後の手取りに、<br class="sp-only">3つの差が集まります。</h2>
      <p class="bizpro-section-desc">
        仕入価格・時間／地理コスト・品質ロス。<br class="pc-only">
        3つの違いが、最後の「手取り」を決めます。
      </p>
    </div>

    <div class="bizpro-bars anim" data-anim="fade-up">
      <div class="bizpro-bar">
        <div class="bizpro-bar__label">ヤフオク仕入</div>
        <div class="bizpro-bar__track"><div class="bizpro-bar__fill bizpro-bar__fill--low" style="width:14%"></div></div>
      </div>
      <div class="bizpro-bar">
        <div class="bizpro-bar__label">オフライン仕入</div>
        <div class="bizpro-bar__track"><div class="bizpro-bar__fill bizpro-bar__fill--mid" style="width:42%"></div></div>
      </div>
      <div class="bizpro-bar bizpro-bar--us">
        <div class="bizpro-bar__label">{{ $brand }} 仕入</div>
        <div class="bizpro-bar__track">
          <div class="bizpro-bar__fill bizpro-bar__fill--high" style="width:96%"></div>
          <span class="bizpro-bar__badge">最大</span>
        </div>
      </div>
    </div>

    <div class="bizpro-takehome__reasons">
      <article class="bizpro-takehome__reason anim" data-anim="fade-up">
        <span class="bizpro-takehome__num">01</span>
        <h3 class="bizpro-takehome__rtitle">仕入価格</h3>
        <p>ヤフオクは個人向けの小売値、オフラインは安いが地域内競合のみ。{{ $brand }} は業者専用の卸値で取引できます。</p>
      </article>
      <article class="bizpro-takehome__reason anim" data-anim="fade-up" data-delay="1">
        <span class="bizpro-takehome__num">02</span>
        <h3 class="bizpro-takehome__rtitle">時間・地理コスト</h3>
        <p>オフラインは現地までの交通費・宿泊・拘束時間が利益を圧迫。{{ $brand }} はオンライン完結、移動ゼロで参加できます。</p>
      </article>
      <article class="bizpro-takehome__reason anim" data-anim="fade-up" data-delay="2">
        <span class="bizpro-takehome__num">03</span>
        <h3 class="bizpro-takehome__rtitle">品質ロス</h3>
        <p>ヤフオクの自己申告、オフラインの現地短時間判断では見落としが発生。{{ $brand }} は加工なし動画を前日からゆっくり確認、判断ミスを最小化します。</p>
      </article>
    </div>

    <p class="bizpro-compare__strong anim" data-anim="fade-up">
      3つの差が集まって、仕入後の手取りは {{ $brand }} が最大化します。
    </p>
  </div>
</section>

<!-- ===== ⑦ 落札者向け 4カード詳細 ===== -->
<section class="bizpro-buyer-detail">
  <div class="container">
    <div class="bizpro-section-head anim" data-anim="fade-up">
      <p class="bizpro-eyebrow">FOR BUYERS</p>
      <h2 class="bizpro-section-title">落札者の方へ</h2>
      <p class="bizpro-section-desc">
        2つの仕入れニーズに、{{ $brand }} は応えます。<br>
        「ここでしか会えない個体」と、「ヤフオクで買えない価格」。
      </p>
    </div>

    <div class="bizpro-detail-grid">
      <article class="bizpro-detail-card bizpro-detail-card--top anim" data-anim="fade-up">
        <span class="bizpro-detail-card__num">01</span>
        <h3 class="bizpro-detail-card__title">普段会えないブリーダーの個体に、出会える</h3>
        <p class="bizpro-detail-card__body">
          厳選されたプロブリーダーの個体が並びます。<br>
          「ヤフオクには出さない」「個別販売しない」ロットが、{{ $brand }} でだけ流通します。
        </p>
        <p class="bizpro-detail-card__tag">─ 希少な個体を求める方へ</p>
      </article>
      <article class="bizpro-detail-card bizpro-detail-card--top anim" data-anim="fade-up" data-delay="1">
        <span class="bizpro-detail-card__num">02</span>
        <h3 class="bizpro-detail-card__title">標準個体も、ヤフオクで買えない卸値で</h3>
        <p class="bizpro-detail-card__body">
          特段稀少でない個体でも、ヤフオクの小売値より明確に安く。<br>
          業者間の卸値で取引できます。
        </p>
        <p class="bizpro-detail-card__tag">─ 安定的な仕入れ量を必要とする方へ</p>
      </article>
      <article class="bizpro-detail-card anim" data-anim="fade-up">
        <span class="bizpro-detail-card__num">03</span>
        <h3 class="bizpro-detail-card__title">取引のすべてを、{{ $brand }} が代行</h3>
        <p class="bizpro-detail-card__body">
          落札後の決済は収納代行、配送は直送、死着は補償規定で対応。<br>
          落札者は「決めて、待つ」だけで完結します。
        </p>
      </article>
      <article class="bizpro-detail-card anim" data-anim="fade-up" data-delay="1">
        <span class="bizpro-detail-card__num">04</span>
        <h3 class="bizpro-detail-card__title">月2回の定期開催で、計画的に仕入れられる</h3>
        <p class="bizpro-detail-card__body">
          固定スケジュール＋事前出品リストの公開で、仕入れ予算とロットを先に組めます。<br>
          「いつ良い個体が出るか分からない」が、終わります。
        </p>
      </article>
    </div>
  </div>
</section>

<!-- ===== ⑧ 動画品質確認 ===== -->
<section class="bizpro-video">
  <div class="container">
    <div class="bizpro-section-head bizpro-section-head--white anim" data-anim="fade-up">
      <p class="bizpro-eyebrow bizpro-eyebrow--white">VIDEO QUALITY</p>
      <h2 class="bizpro-section-title bizpro-section-title--white">加工なしの現物動画で、<br class="sp-only">現地より深く見極める。</h2>
      <p class="bizpro-section-desc bizpro-section-desc--white">
        全ロットの横見・上見動画を、開催前日から公開。<br>
        加工しない動画だから、写真では分からない実物の状態を、<br class="pc-only">
        オフラインの「現地で短時間」を超える深さで確認できます。
      </p>
    </div>

    <div class="bizpro-video-grid">
      <article class="bizpro-video-card anim" data-anim="fade-up">
        <span class="bizpro-video-card__num">01</span>
        <h3 class="bizpro-video-card__title">加工なし、だから実物が見える</h3>
        <p class="bizpro-video-card__body">
          メダカ業界では、写真の色補正・編集が常態化しています。<br>
          {{ $brand }} は加工しない動画で出品。「届いたら写真と違った」を、構造的に防ぎます。
        </p>
      </article>
      <article class="bizpro-video-card anim" data-anim="fade-up" data-delay="1">
        <span class="bizpro-video-card__num">02</span>
        <h3 class="bizpro-video-card__title">横見・上見の両方を、全ロット撮影</h3>
        <p class="bizpro-video-card__body">
          体形・体色・尾形・各鰭。評価で重要なすべての角度を、業界水準を超える精度で。<br>
          撮影も {{ $brand }} が代行するので、出品者ごとのバラつきがありません。
        </p>
      </article>
      <article class="bizpro-video-card anim" data-anim="fade-up" data-delay="2">
        <span class="bizpro-video-card__num">03</span>
        <h3 class="bizpro-video-card__title">開催前日から、好きなだけ</h3>
        <p class="bizpro-video-card__body">
          現地で数分しか見られないオフラインと違い、前日からじっくり、何度でも見られます。<br>
          仕入れの優先検討時間が、構造的に確保されます。
        </p>
      </article>
      <article class="bizpro-video-card anim" data-anim="fade-up" data-delay="3">
        <span class="bizpro-video-card__num">04</span>
        <h3 class="bizpro-video-card__title">止めて、戻して、共有して</h3>
        <p class="bizpro-video-card__body">
          気になる瞬間を止めて。別の個体と比べて。仕入れチームと共有して相談。<br>
          オフラインの「その場で判断」では不可能だった意思決定が可能になります。
        </p>
      </article>
    </div>

    <p class="bizpro-video__strong anim" data-anim="fade-up">
      現地で見るより、深く、長く、確かに。<br>
      それが、{{ $brand }} の品質確認です。
    </p>
  </div>
</section>

<!-- ===== ⑨ 落札の流れ ===== -->
<section class="bizpro-flow">
  <div class="container">
    <div class="bizpro-section-head anim" data-anim="fade-up">
      <p class="bizpro-eyebrow">FLOW</p>
      <h2 class="bizpro-section-title">落札までの4ステップ</h2>
      <p class="bizpro-section-desc">業者会員になっていただいた後の、実際の取引フローです。</p>
    </div>

    <ol class="bizpro-flow__list">
      <li class="bizpro-flow__item anim" data-anim="fade-up">
        <span class="bizpro-flow__step">STEP 01</span>
        <h3 class="bizpro-flow__title">出品リストを確認</h3>
        <p>LINE と Web で全ロットを公開します。加工なしの横見・上見動画を、ゆっくり何度でも確認できます。仕入れチームとの相談時間も、構造的に確保されます。</p>
      </li>
      <li class="bizpro-flow__item anim" data-anim="fade-up" data-delay="1">
        <span class="bizpro-flow__step">STEP 02</span>
        <h3 class="bizpro-flow__title">オークションに参加・入札</h3>
        <p>業者会員専用のオンライン会場で、リアルタイム形式のオークションに参加。事前入札も可能なので、当日リアルタイムで参加できない場合も入札を残しておけます。システム入札のため、忖度や手ゼリの不公平はありません。</p>
      </li>
      <li class="bizpro-flow__item anim" data-anim="fade-up" data-delay="2">
        <span class="bizpro-flow__step">STEP 03</span>
        <h3 class="bizpro-flow__title">落札・決済</h3>
        <p>落札確定後、決済は振込で完了します。取引のすべてが {{ $brand }} とのやり取りなので、出品者と直接やり取りすることはありません。</p>
      </li>
      <li class="bizpro-flow__item anim" data-anim="fade-up" data-delay="3">
        <span class="bizpro-flow__step">STEP 04</span>
        <h3 class="bizpro-flow__title">受け取り</h3>
        <p>{{ $brand }} から直送。配送伝票も {{ $brand }} 名義です。出品者と落札者の住所はやりとりされません。</p>
      </li>
    </ol>

    <p class="bizpro-flow__strong anim" data-anim="fade-up">
      リストを見て、入札して、待つだけ。<br>
      仕入れに使う時間を、最小化できます。
    </p>
  </div>
</section>

<!-- ===== ⑩ 料金プラン ===== -->
<section class="bizpro-pricing" id="pricing">
  <div class="container">
    <div class="bizpro-section-head anim" data-anim="fade-up">
      <p class="bizpro-eyebrow">PRICING</p>
      <h2 class="bizpro-section-title">シンプルな業者会員プラン2種。</h2>
      <p class="bizpro-section-desc">登録は年会費のみ。あとは成約時の手数料だけです。</p>
    </div>

    <div class="bizpro-plans">
      <article class="bizpro-plan anim" data-anim="fade-up">
        <p class="bizpro-plan__tag">業者会員（落札）</p>
        <p class="bizpro-plan__price"><em>5,500</em><small>円 / 年（税込）</small></p>
        <ul class="bizpro-plan__feat">
          <li>オークション閲覧</li>
          <li>入札・落札</li>
          <li>申込→審査制</li>
        </ul>
      </article>
      <article class="bizpro-plan bizpro-plan--featured anim" data-anim="fade-up" data-delay="1">
        <p class="bizpro-plan__tag">業者会員（出品兼）</p>
        <p class="bizpro-plan__price"><em>11,000</em><small>円 / 年（税込）</small></p>
        <ul class="bizpro-plan__feat">
          <li>出品（売り手）</li>
          <li>入札・落札</li>
          <li>より厳格な審査制</li>
        </ul>
      </article>
    </div>

    <div class="bizpro-pricing__fee anim" data-anim="fade-up">
      <span class="bizpro-pricing__fee-label">成約時手数料</span>
      <span class="bizpro-pricing__fee-value">落札額の <em>10</em><small>%</small></span>
    </div>

    <ul class="bizpro-pricing__notes anim" data-anim="fade-up">
      <li>※ 出品兼プランには、買い手として落札する権利も含まれます。</li>
      <li>※ 出品兼プランは、より厳格な審査を経てご加入いただけます。</li>
    </ul>
  </div>
</section>

<!-- ===== ⑪ LINE登録メリット + ステップ ===== -->
<section class="bizpro-line">
  <div class="container">
    <div class="bizpro-section-head anim" data-anim="fade-up">
      <p class="bizpro-eyebrow">LINE</p>
      <h2 class="bizpro-section-title">まずは、LINE から。</h2>
      <p class="bizpro-section-desc">
        即時の会員登録ではなく、LINE で先にサービスをご体験いただけます。<br class="pc-only">
        ご自身に合うかをご確認のうえ、ご判断ください。
      </p>
    </div>

    <div class="bizpro-line__merits">
      <article class="bizpro-line__merit anim" data-anim="fade-up">
        <span class="bizpro-line__num">01</span>
        <h3 class="bizpro-line__mtitle">デモで触ってから、判断できる</h3>
        <p>LINE登録するだけで、実際の入札画面と動画品質確認をお試しいただけます。会員登録するかは、触ってから決めていただけます。</p>
      </article>
      <article class="bizpro-line__merit anim" data-anim="fade-up" data-delay="1">
        <span class="bizpro-line__num">02</span>
        <h3 class="bizpro-line__mtitle">出品リストを先行で受け取れる</h3>
        <p>次回オークションの出品リストを、LINE に直接お届け。仕入れの優先検討時間が確保できます。</p>
      </article>
      <article class="bizpro-line__merit anim" data-anim="fade-up" data-delay="2">
        <span class="bizpro-line__num">03</span>
        <h3 class="bizpro-line__mtitle">申込・質問を LINE 上で完結</h3>
        <p>申請フォーム・資料・質問は LINE 上で完結。別サイトを行き来する必要はありません。</p>
      </article>
    </div>

    <ol class="bizpro-line__steps anim" data-anim="fade-up">
      <li>
        <span class="bizpro-line__step-num">01</span>
        <h4>LINE で友だち追加</h4>
        <p>下のボタンから1タップで完了します。</p>
      </li>
      <li>
        <span class="bizpro-line__step-num">02</span>
        <h4>デモを試す</h4>
        <p>LINE登録後、デモのURLをお送りします。実際の入札画面と動画品質確認をご体験ください。</p>
      </li>
      <li>
        <span class="bizpro-line__step-num">03</span>
        <h4>LINEで質問・申込</h4>
        <p>ご質問はLINEで。納得いただけたら、申込フォームへ。</p>
      </li>
    </ol>

    <div class="bizpro-line__cta anim" data-anim="fade-up">
      <a href="{{ $lineUrl }}" target="_blank" rel="noopener noreferrer" class="bizpro-btn bizpro-btn--line">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63h2.386c.346 0 .627.285.627.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63.346 0 .628.285.628.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.281.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314"/></svg>
        LINE追加でデモを試す
      </a>
      <p class="bizpro-line__note">※ 友だち追加だけ。登録は無料です。</p>
    </div>
  </div>
</section>

<!-- ===== ⑫ 協力ブリーダーの声 ===== -->
<section class="bizpro-voice">
  <div class="container">
    <div class="bizpro-section-head anim" data-anim="fade-up">
      <p class="bizpro-eyebrow">VOICE</p>
      <h2 class="bizpro-section-title">協力ブリーダーから</h2>
      <p class="bizpro-section-desc">
        ローンチに先立ち、出品予定のブリーダー様からコメントをいただきました。<br class="pc-only">
        業界の最前線で活動する皆さまの、率直な声をご覧ください。
      </p>
    </div>

    <div class="bizpro-voice__grid">
      <article class="bizpro-voice__card anim" data-anim="fade-up">
        <p class="bizpro-voice__shop">屋号 A</p>
        <p class="bizpro-voice__quote">「ヤフオクに出すには惜しい個体を、業者間でだけ動かしたい。{{ $brand }} はそのニーズに、最初に応えてくれる場所だと感じています。」</p>
        <p class="bizpro-voice__author">── 代表者名</p>
      </article>
      <article class="bizpro-voice__card anim" data-anim="fade-up" data-delay="1">
        <p class="bizpro-voice__shop">屋号 B</p>
        <p class="bizpro-voice__quote">「動画撮影を運営側がやってくれるのが大きい。出品作業の手間が劇的に減るので、繁殖と選別に時間を使えるようになります。」</p>
        <p class="bizpro-voice__author">── 代表者名</p>
      </article>
      <article class="bizpro-voice__card anim" data-anim="fade-up" data-delay="2">
        <p class="bizpro-voice__shop">屋号 C</p>
        <p class="bizpro-voice__quote">「匿名で取引できるのは、業者として本当に助かります。地域の同業者と顔を合わせる必要がない、フェアな入札環境はずっと欲しかったものでした。」</p>
        <p class="bizpro-voice__author">── 代表者名</p>
      </article>
    </div>
    <p class="bizpro-voice__note">※ 上記は実装テンプレートです。取材後の実コメントに差し替えます。</p>
  </div>
</section>

<!-- ===== ⑬ FAQ ===== -->
<section class="bizpro-faq" id="faq">
  <div class="container">
    <div class="bizpro-section-head anim" data-anim="fade-up">
      <p class="bizpro-eyebrow">FAQ</p>
      <h2 class="bizpro-section-title">よくあるご質問</h2>
    </div>

    <div class="bizpro-faq__list anim" data-anim="fade-up">
      <details class="bizpro-faq__item">
        <summary><span class="bizpro-faq__mark">Q</span><span class="bizpro-faq__q">ヤフオクとは競合しませんか？</span><span class="bizpro-faq__chev" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg></span></summary>
        <div class="bizpro-faq__a"><span class="bizpro-faq__mark bizpro-faq__mark--a">A</span><p>しません。ヤフオクは個人愛好家主体の小売チャネル、{{ $brand }} は業者専用の卸チャネルです。使い分けることで手取り全体が増える設計です。</p></div>
      </details>
      <details class="bizpro-faq__item">
        <summary><span class="bizpro-faq__mark">Q</span><span class="bizpro-faq__q">法人でなくても参加できますか？</span><span class="bizpro-faq__chev" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg></span></summary>
        <div class="bizpro-faq__a"><span class="bizpro-faq__mark bizpro-faq__mark--a">A</span><p>参加できます。屋号での活動実績があれば、個人事業主・専業ブリーダーの方も対象です。</p></div>
      </details>
      <details class="bizpro-faq__item">
        <summary><span class="bizpro-faq__mark">Q</span><span class="bizpro-faq__q">LINE で友だち追加すると、すぐに会員登録になりますか？</span><span class="bizpro-faq__chev" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg></span></summary>
        <div class="bizpro-faq__a"><span class="bizpro-faq__mark bizpro-faq__mark--a">A</span><p>なりません。LINE 登録後にデモの URL をお送りします。実際の入札画面と動画品質確認を体験した上で、ご自身のタイミングで申込フォームから会員登録いただけます。</p></div>
      </details>
      <details class="bizpro-faq__item">
        <summary><span class="bizpro-faq__mark">Q</span><span class="bizpro-faq__q">インボイス対応していますか？</span><span class="bizpro-faq__chev" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg></span></summary>
        <div class="bizpro-faq__a"><span class="bizpro-faq__mark bizpro-faq__mark--a">A</span><p>対応しています。{{ $brand }} はインボイス登録事業者です。</p></div>
      </details>
      <details class="bizpro-faq__item">
        <summary><span class="bizpro-faq__mark">Q</span><span class="bizpro-faq__q">既存のオフライン業者オークションとは何が違いますか？</span><span class="bizpro-faq__chev" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg></span></summary>
        <div class="bizpro-faq__a"><span class="bizpro-faq__mark bizpro-faq__mark--a">A</span><p>主な違いは「全国オンラインで参加可能」「動画で品質確認できる」「完全匿名で取引できる」の3点です。詳しくは比較表セクションをご覧ください。</p></div>
      </details>
      <details class="bizpro-faq__item">
        <summary><span class="bizpro-faq__mark">Q</span><span class="bizpro-faq__q">落札者として参加するには？</span><span class="bizpro-faq__chev" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg></span></summary>
        <div class="bizpro-faq__a"><span class="bizpro-faq__mark bizpro-faq__mark--a">A</span><p>LINE から申込フォームをご提出ください。所定の審査を経て、業者会員としてご参加いただけます。</p></div>
      </details>
      <details class="bizpro-faq__item">
        <summary><span class="bizpro-faq__mark">Q</span><span class="bizpro-faq__q">同業者と入札で競合になることはありますか？</span><span class="bizpro-faq__chev" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg></span></summary>
        <div class="bizpro-faq__a"><span class="bizpro-faq__mark bizpro-faq__mark--a">A</span><p>入札では業者間で競争が発生する場合がありますが、落札者は完全匿名のため、競合関係を気にすることなく取引できます。</p></div>
      </details>
      <details class="bizpro-faq__item">
        <summary><span class="bizpro-faq__mark">Q</span><span class="bizpro-faq__q">事前入札はどう使いますか？</span><span class="bizpro-faq__chev" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg></span></summary>
        <div class="bizpro-faq__a"><span class="bizpro-faq__mark bizpro-faq__mark--a">A</span><p>業者会員専用のオンライン会場で、リアルタイム入札と事前入札の両方が可能です。詳細は LINE 登録後のデモでご確認いただけます。</p></div>
      </details>
    </div>
  </div>
</section>

<!-- ===== ⑭ クロージング CTA ===== -->
<section class="bizpro-closing">
  <div class="container">
    <div class="bizpro-closing__inner anim" data-anim="fade-up">
      <h2 class="bizpro-closing__title">まずは、デモから。</h2>
      <p class="bizpro-closing__desc">
        LINE 登録するだけで、実際の入札画面と動画品質確認をお試しいただけます。<br class="pc-only">
        会員登録するかは、触ってから決めていただけます。
      </p>
      <a href="{{ $lineUrl }}" target="_blank" rel="noopener noreferrer" class="bizpro-btn bizpro-btn--line bizpro-btn--lg">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63h2.386c.346 0 .627.285.627.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63.346 0 .628.285.628.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.281.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314"/></svg>
        LINE追加でデモを試す
      </a>
      <p class="bizpro-closing__notes">
        ※ 友だち追加だけ。登録は無料です。<br>
        ※ 出品もご検討の方は <a href="/seller">出品者の方へ →</a>
      </p>
    </div>
  </div>
</section>

<!-- ===== FOOTER ===== -->
<footer class="bizpro-footer">
  <div class="container">
    <div class="bizpro-footer__top">
      <div class="bizpro-footer__brand">
        <img src="/img/logo.png?v=2" alt="{{ $brand }}" class="bizpro-footer__logo">
        <p class="bizpro-footer__name">{{ $brand }}（MEDAICHI）</p>
        <p class="bizpro-footer__operator">運営: 株式会社NEP / 母体: 株式会社サバンナ</p>
        <p class="bizpro-footer__invoice">インボイス登録番号: T-XXXXXXXXXXXXX</p>
      </div>
      <nav class="bizpro-footer__links" aria-label="フッターナビゲーション">
        <a href="#">会社概要</a>
        <a href="/legal/tokushoho">特定商取引法に基づく表記</a>
        <a href="/legal/privacy">プライバシーポリシー</a>
        <a href="/legal/terms">利用規約</a>
        <a href="#">お問い合わせ</a>
      </nav>
    </div>
    <p class="bizpro-footer__copy">© {{ date('Y') }} {{ $brand }}</p>
  </div>
</footer>

<script src="/js/lp.js?v=5"></script>
</body>
</html>
