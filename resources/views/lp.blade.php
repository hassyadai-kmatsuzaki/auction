<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{{ config('app.name', '日本メダカオンライン市場') }} | 信頼できるめだか専門オークション</title>
  <meta name="description" content="審査制出品者のみ。プロ品質の選魚、めだか専門のオンラインオークションプラットフォーム。">
  <link rel="icon" type="image/png" href="/favicon.png">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;700;900&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="/css/lp.css?v=27">
  <script>
    (function(d) {
      var config = {
        kitId: 'png6ego',
        scriptTimeout: 3000,
        async: true
      },
      h=d.documentElement,t=setTimeout(function(){h.className=h.className.replace(/\bwf-loading\b/g,"")+" wf-inactive";},config.scriptTimeout),tk=d.createElement("script"),f=false,s=d.getElementsByTagName("script")[0],a;h.className+=" wf-loading";tk.src='https://use.typekit.net/'+config.kitId+'.js';tk.async=true;tk.onload=tk.onreadystatechange=function(){a=this.readyState;if(f||a&&a!="complete"&&a!="loaded")return;f=true;clearTimeout(t);try{Typekit.load(config)}catch(e){}};s.parentNode.insertBefore(tk,s)
    })(document);
  </script>
</head>
<body>

<!-- ===== HEADER ===== -->
<header class="header" id="header">
  <div class="header__inner">
    <a href="/" class="header__logo">
      <img src="/img/logo.png?v=2" alt="日本メダカオンライン市場" class="header__logo-img">
    </a>
    <div class="header__right">
      <a href="/login" class="header__btn header__btn--login">ログイン</a>
      <a href="/register" class="header__btn header__btn--register">新規登録</a>
      <a href="https://lin.ee/XXXXXXX" target="_blank" rel="noopener noreferrer" class="header__cta">
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
      <img src="/img/lp/fv-okada-yui.png" alt="" class="hero__visual-img" loading="eager">
    </div>

    <div class="hero__copy hero-anim" data-hero-delay="3">
      <p class="hero__eyebrow hero__eyebrow--inline pc-only">業界歴20年 × プロ選魚 × 審査制出品者</p>
      <h1 class="hero__title">
        <span class="hero__title-line">プロ品質のめだかに、</span>
        <span class="hero__title-line hero__title-line--strong">最短翌日で出会う。</span>
      </h1>
      <p class="hero__desc">
        審査を通過したプロ出品者と、業界歴20年の選魚チームが、<br class="pc-only">
        ご希望にあわせた最適な一匹を最短翌日でお届けします。
      </p>
    </div>

    <div class="hero__cta hero-anim" data-hero-delay="4">
      <a href="/register" class="hero__cta-card hero__cta-card--primary">
        <span class="hero__cta-card__icon" aria-hidden="true">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2v6h6"/><path d="M19 9V21H5V3h9z"/><path d="M9 13h6"/><path d="M9 17h4"/></svg>
        </span>
        <span class="hero__cta-card__body">
          <span class="hero__cta-card__title">無料で新規登録</span>
          <span class="hero__cta-card__sub">落札したい方はこちら</span>
        </span>
        <span class="hero__cta-card__arrow" aria-hidden="true">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
        </span>
      </a>
      <a href="https://lin.ee/XXXXXXX" target="_blank" rel="noopener noreferrer" class="hero__cta-card hero__cta-card--secondary">
        <span class="hero__cta-card__icon" aria-hidden="true">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12c2-3 5-5 9-5s7 2 9 5c-2 3-5 5-9 5s-7-2-9-5z"/><circle cx="15.5" cy="12" r="1.2" fill="currentColor"/></svg>
        </span>
        <span class="hero__cta-card__body">
          <span class="hero__cta-card__title">LINEで相談する</span>
          <span class="hero__cta-card__sub">出品したい方はこちら</span>
        </span>
        <span class="hero__cta-card__arrow" aria-hidden="true">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
        </span>
      </a>
    </div>
  </div>
</section>

<!-- ===== PROBLEMS ===== -->
<section class="section section--problems" id="problems">
  <div class="container">
    <div class="problems-header anim" data-anim="fade-up">
      <h2 class="problems-header__title">こんな<span class="problems-header__mark">ご経験・お悩み<br class="sp-only"></span>ありませんか？</h2>
      <p class="problems-header__desc">めだかの落札・出品で、こうした課題を<br class="sp-only">感じたことはありませんか。</p>
    </div>

    <div class="problems-rows">
      <div class="problem-row anim" data-anim="fade-up">
        <span class="problem-row__tag">
          個体の品質
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
        </span>
        <ul class="problem-row__list">
          <li>写真と全然違った</li>
          <li>個体の状態が悪かった</li>
          <li>グレードが下回っていた</li>
        </ul>
      </div>

      <div class="problem-row anim" data-anim="fade-up" data-delay="1">
        <span class="problem-row__tag">
          配送・梱包
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
        </span>
        <ul class="problem-row__list">
          <li>死着のリスクがこわい</li>
          <li>個人発送だと届くまで不安</li>
          <li>クレーム対応が個人間で煩雑</li>
        </ul>
      </div>

      <div class="problem-row anim" data-anim="fade-up" data-delay="2">
        <span class="problem-row__tag">
          仕入れ・経営
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
        </span>
        <ul class="problem-row__list">
          <li>信頼できる出品者が見つからない</li>
          <li>まとまった仕入れができない</li>
          <li>販売計画が立てられない</li>
        </ul>
      </div>
    </div>
  </div>
</section>

<!-- ===== MECHANISM (Value) ===== -->
<section class="section section--mechanism" id="mechanism">
  <div class="container">
    <div class="mechanism-header anim" data-anim="fade-up">
      <h2 class="mechanism-header__title">
        プロ品質のめだか取引を支える、<br class="sp-only"><span class="mechanism-header__mark">3つの仕組み</span>
      </h2>
      <p class="mechanism-header__desc">
        審査を通過したプロ出品者、<br class="sp-only">業界歴20年の選魚チーム、<br class="sp-only">プロが行う梱包・発送。<br>
        3つの仕組みが一体となり、<br class="sp-only">安心できるめだか取引を実現します。
      </p>
    </div>

    <div class="mechanism-visual anim" data-anim="fade-up">
      <img src="/img/lp/value.png" alt="プロ品質のめだか取引を支える3つの仕組み" loading="lazy">
    </div>

    <div class="mechanism-actions anim" data-anim="fade-up">
      <a href="#features" class="pill-link">
        サービスの特長を見る
        <span class="pill-link__icon" aria-hidden="true">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
        </span>
      </a>
      <a href="#pricing" class="pill-link">
        料金プランを見る
        <span class="pill-link__icon" aria-hidden="true">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
        </span>
      </a>
    </div>
  </div>
</section>

<!-- ===== PARTNERS ===== -->
<section class="section section--partners" id="partners">
  <div class="container">
    <div class="partners-header anim" data-anim="fade-up">
      <h2 class="partners-header__title">
        登録者数<span class="partners-header__num">200名以上</span><sup>※1</sup>の<br class="sp-only">さまざまなプロ・愛好家に<br class="sp-only">ご利用いただいています
      </h2>
    </div>

    <div class="partners-choice anim" data-anim="fade-up">
      <img src="/img/lp/choice.png" alt="" class="partners-choice__img" loading="lazy">
    </div>

    <div class="partners-marquee anim" data-anim="fade-up" aria-hidden="true">
      <div class="partners-marquee__track">
        @for ($i = 0; $i < 2; $i++)
          @for ($j = 0; $j < 12; $j++)
            <div class="partners-marquee__item">
              <img src="/img/logo.png?v=2" alt="" loading="lazy">
            </div>
          @endfor
        @endfor
      </div>
    </div>

    <div class="partners-medals anim" data-anim="fade-up">
      <img src="/img/lp/no1-01.svg" alt="めだか専門オークション 信頼度 No.1" class="partners-medals__img" loading="lazy">
      <img src="/img/lp/no1-02.svg" alt="めだか専門オークション 使いやすさ No.1" class="partners-medals__img" loading="lazy">
    </div>

    <p class="partners-note anim" data-anim="fade-up">
      ※1 2026年4月時点の累計登録ユーザー数（落札・出品者含む）。<br>
      掲載ロゴは順次更新予定です。
    </p>
  </div>
</section>

<!-- ===== SOLUTIONS ===== -->
<section class="section section--solutions" id="solutions">
  <div class="container">
    <div class="solutions-header anim" data-anim="fade-up">
      <h2 class="solutions-header__title">
        <span class="solutions-header__mark">課題を解決するなら、<br class="sp-only"></span>日本メダカオンライン市場
      </h2>
      <p class="solutions-header__desc">
        個体の品質から梱包・配送まで、<br class="sp-only">めだか取引のあらゆる課題を解決に導きます
      </p>
    </div>

    <div class="solutions-grid">
      <a href="#features" class="solution-card solution-card--featured anim" data-anim="fade-up">
        <span class="solution-card__visual"><img src="/img/lp/solution/01.png" alt="" loading="lazy"></span>
        <span class="solution-card__body">
          <span class="solution-card__title">プロ選魚で品質保証された一匹に出会う</span>
          <span class="solution-card__arrow" aria-hidden="true">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
          </span>
        </span>
      </a>
      <a href="#features" class="solution-card solution-card--featured anim" data-anim="fade-up" data-delay="1">
        <span class="solution-card__visual"><img src="/img/lp/solution/02.png" alt="" loading="lazy"></span>
        <span class="solution-card__body">
          <span class="solution-card__title">写真＋動画で個体の状態を事前確認</span>
          <span class="solution-card__arrow" aria-hidden="true">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
          </span>
        </span>
      </a>
      <a href="#features" class="solution-card solution-card--featured anim" data-anim="fade-up" data-delay="2">
        <span class="solution-card__visual"><img src="/img/lp/solution/03.png" alt="" loading="lazy"></span>
        <span class="solution-card__body">
          <span class="solution-card__title">審査制の信頼できる出品者だけ</span>
          <span class="solution-card__arrow" aria-hidden="true">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
          </span>
        </span>
      </a>

      <a href="#features" class="solution-card anim" data-anim="fade-up">
        <span class="solution-card__visual"><img src="/img/lp/solution/04.png" alt="" loading="lazy"></span>
        <span class="solution-card__body">
          <span class="solution-card__title">プロ品質の梱包・発送で安心</span>
          <span class="solution-card__arrow" aria-hidden="true">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
          </span>
        </span>
      </a>
      <a href="#features" class="solution-card anim" data-anim="fade-up" data-delay="1">
        <span class="solution-card__visual"><img src="/img/lp/solution/05.png" alt="" loading="lazy"></span>
        <span class="solution-card__body">
          <span class="solution-card__title">死着・状態保証で取引リスクゼロ</span>
          <span class="solution-card__arrow" aria-hidden="true">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
          </span>
        </span>
      </a>
      <a href="#features" class="solution-card anim" data-anim="fade-up">
        <span class="solution-card__visual"><img src="/img/lp/solution/06.png" alt="" loading="lazy"></span>
        <span class="solution-card__body">
          <span class="solution-card__title">品種・グレードで絞り込み検索</span>
          <span class="solution-card__arrow" aria-hidden="true">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
          </span>
        </span>
      </a>
      <a href="#features" class="solution-card anim" data-anim="fade-up" data-delay="1">
        <span class="solution-card__visual"><img src="/img/lp/solution/07.png" alt="" loading="lazy"></span>
        <span class="solution-card__body">
          <span class="solution-card__title">まとまった仕入れ・継続調達に対応</span>
          <span class="solution-card__arrow" aria-hidden="true">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
          </span>
        </span>
      </a>
    </div>
  </div>
</section>

<!-- ===== PRICING ===== -->
<section class="section section--pricing" id="pricing">
  <div class="container">
    <div class="pricing-header anim" data-anim="fade-up">
      <h2 class="pricing-header__title">
        <span class="pricing-header__mark">シンプルで分かりやすい</span>料金体系
      </h2>
      <p class="pricing-header__desc">
        入会金は0円。年会費は落札のみ5,000円、出品・落札の両方を行う場合は10,000円。<br>
        落札時に10%の手数料のみで、安心してご利用いただけます。
      </p>
    </div>

    <div class="pricing-cards anim" data-anim="fade-up">
      <div class="pricing-card">
        <span class="pricing-card__tag">入会金</span>
        <span class="pricing-card__price"><em>0</em><small>円</small></span>
        <span class="pricing-card__note">登録時の費用は不要</span>
      </div>
      <span class="pricing-plus" aria-hidden="true">+</span>
      <div class="pricing-card pricing-card--plans">
        <span class="pricing-card__tag">年会費</span>
        <span class="pricing-card__plans">
          <span class="pricing-plan">
            <span class="pricing-plan__label">落札のみ</span>
            <span class="pricing-plan__value"><em>5,000</em><small>円</small></span>
          </span>
          <span class="pricing-plan">
            <span class="pricing-plan__label">出品・落札</span>
            <span class="pricing-plan__value"><em>10,000</em><small>円</small></span>
          </span>
        </span>
        <span class="pricing-card__note">税抜 / 年</span>
      </div>
      <span class="pricing-plus" aria-hidden="true">+</span>
      <div class="pricing-card">
        <span class="pricing-card__tag">落札手数料</span>
        <span class="pricing-card__price"><em>10</em><small>%</small></span>
        <span class="pricing-card__note">落札価格に対して</span>
      </div>
    </div>

    <p class="pricing-note anim" data-anim="fade-up">
      ※価格はすべて税抜表示です。送料は実費（プロ品質の梱包込み）にてご負担いただきます。
    </p>

    <div class="pricing-actions anim" data-anim="fade-up">
      <a href="/register" class="pricing-cta">
        無料で新規登録する
        <span class="pricing-cta__icon" aria-hidden="true">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
        </span>
      </a>
    </div>
  </div>
</section>

<!-- ===== STEPS ===== -->
<section class="section section--steps" id="steps">
  <div class="container">
    <div class="steps-header anim" data-anim="fade-up">
      <h2 class="steps-header__title">
        <span class="steps-header__mark">かんたん4ステップ</span>で、<br class="sp-only">すぐに参加できる
      </h2>
      <p class="steps-header__desc">
        無料の会員登録だけで、プロ品質のめだかオークションをすぐにご利用いただけます。
      </p>
    </div>

    <div class="steps-grid">
      <div class="step-tile anim" data-anim="fade-up">
        <span class="step-tile__index">STEP 01</span>
        <span class="step-tile__visual">
          <img src="/img/lp/flow/01.png" alt="" loading="lazy">
        </span>
        <h3 class="step-tile__title">会員登録</h3>
        <p class="step-tile__desc">メールアドレスとパスワードだけで、無料でかんたんに登録できます。</p>
      </div>
      <div class="step-tile anim" data-anim="fade-up" data-delay="1">
        <span class="step-tile__index">STEP 02</span>
        <span class="step-tile__visual">
          <img src="/img/lp/flow/02.png" alt="" loading="lazy">
        </span>
        <h3 class="step-tile__title">個体を閲覧・入札</h3>
        <p class="step-tile__desc">写真と動画で状態を確認し、品種・グレードで絞り込んで入札できます。</p>
      </div>
      <div class="step-tile anim" data-anim="fade-up" data-delay="2">
        <span class="step-tile__index">STEP 03</span>
        <span class="step-tile__visual">
          <img src="/img/lp/flow/03.png" alt="" loading="lazy">
        </span>
        <h3 class="step-tile__title">落札・オンライン決済</h3>
        <p class="step-tile__desc">落札後はマイページからクレジットカードで安全にお支払いできます。</p>
      </div>
      <div class="step-tile anim" data-anim="fade-up" data-delay="3">
        <span class="step-tile__index">STEP 04</span>
        <span class="step-tile__visual">
          <img src="/img/lp/flow/04.png" alt="" loading="lazy">
        </span>
        <h3 class="step-tile__title">プロ梱包でお届け</h3>
        <p class="step-tile__desc">業界歴20年のプロが温度管理・酸素供給を徹底して安全にお届けします。</p>
      </div>
    </div>
  </div>
</section>

<!-- ===== VOICE ===== -->
<section class="section section--voice" id="voice">
  <div class="container">
    <div class="voice-header anim" data-anim="fade-up">
      <h2 class="voice-header__title">
        <span class="voice-header__mark">ご利用者さま</span>からの声
      </h2>
      <p class="voice-header__desc">
        実際にご利用いただいた皆さまから、多くの嬉しいお声をいただいています。
      </p>
    </div>

    <div class="voice-grid">
      <article class="voice-tile anim" data-anim="fade-up">
        <p class="voice-tile__quote">フリマアプリで何度も失敗した経験がありましたが、こちらでは審査制の出品者のみなので安心して入札できました。届いた個体も写真通りで、梱包も丁寧でした。</p>
        <div class="voice-tile__author">
          <span class="voice-tile__avatar"><img src="/img/lp/voice/01.png" alt="" loading="lazy"></span>
          <span class="voice-tile__info">
            <strong>T.K. 様</strong>
            <small>めだか愛好家・個人コレクター</small>
          </span>
        </div>
      </article>
      <article class="voice-tile anim" data-anim="fade-up" data-delay="1">
        <p class="voice-tile__quote">即売会前の仕入れに毎回苦労していましたが、まとまった品質の個体を安定して確保できるようになり、事業計画が立てやすくなりました。</p>
        <div class="voice-tile__author">
          <span class="voice-tile__avatar"><img src="/img/lp/voice/02.png" alt="" loading="lazy"></span>
          <span class="voice-tile__info">
            <strong>S.M. 様</strong>
            <small>めだか販売店経営</small>
          </span>
        </div>
      </article>
      <article class="voice-tile anim" data-anim="fade-up" data-delay="2">
        <p class="voice-tile__quote">プロによる梱包・発送が本当にありがたいです。以前は個人発送で死着のリスクが常にありましたが、ここでは一度もトラブルがありません。</p>
        <div class="voice-tile__author">
          <span class="voice-tile__avatar"><img src="/img/lp/voice/03.png" alt="" loading="lazy"></span>
          <span class="voice-tile__info">
            <strong>Y.H. 様</strong>
            <small>ブリーダー・即売会出展者</small>
          </span>
        </div>
      </article>
    </div>

    <div class="voice-banner anim" data-anim="fade-up" aria-hidden="true">
      <img src="/img/lp/voice.png" alt="" loading="lazy">
    </div>
  </div>
</section>

<!-- ===== FAQ ===== -->
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
          <span class="faq-item__text">出品者はどのように審査されていますか？</span>
          <span class="faq-item__chev" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
          </span>
        </summary>
        <div class="faq-item__a">
          <span class="faq-item__mark faq-item__mark--a">A</span>
          <p>出品者は全員、身分証明書の提出と運営による審査を通過した方のみです。既存の信頼できる出品者からの推薦制も採用しており、品質と信頼性を担保しています。</p>
        </div>
      </details>
      <details class="faq-item">
        <summary class="faq-item__q">
          <span class="faq-item__mark">Q</span>
          <span class="faq-item__text">発送はどのように行われますか？</span>
          <span class="faq-item__chev" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
          </span>
        </summary>
        <div class="faq-item__a">
          <span class="faq-item__mark faq-item__mark--a">A</span>
          <p>業界歴20年のプロが梱包・発送を行います。生体輸送の専門知識を持つスタッフが、温度管理や酸素供給など適切な処理を施し、安全にお届けします。</p>
        </div>
      </details>
      <details class="faq-item">
        <summary class="faq-item__q">
          <span class="faq-item__mark">Q</span>
          <span class="faq-item__text">死着保証はありますか？</span>
          <span class="faq-item__chev" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
          </span>
        </summary>
        <div class="faq-item__a">
          <span class="faq-item__mark faq-item__mark--a">A</span>
          <p>はい、万が一の死着時には保証制度がございます。到着後すぐに写真をお送りいただくことで、返金または代替個体での対応をいたします。詳細は利用規約をご確認ください。</p>
        </div>
      </details>
      <details class="faq-item">
        <summary class="faq-item__q">
          <span class="faq-item__mark">Q</span>
          <span class="faq-item__text">支払い方法は何がありますか？</span>
          <span class="faq-item__chev" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
          </span>
        </summary>
        <div class="faq-item__a">
          <span class="faq-item__mark faq-item__mark--a">A</span>
          <p>クレジットカード（VISA・Mastercard・JCB・AMEX）でのオンライン決済に対応しています。落札後、マイページから安全に決済いただけます。</p>
        </div>
      </details>
      <details class="faq-item">
        <summary class="faq-item__q">
          <span class="faq-item__mark">Q</span>
          <span class="faq-item__text">出品者として参加することはできますか？</span>
          <span class="faq-item__chev" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
          </span>
        </summary>
        <div class="faq-item__a">
          <span class="faq-item__mark faq-item__mark--a">A</span>
          <p>はい、品質維持のため紹介・推薦制で受け付けております。ご興味のある方はLINEからお問い合わせください。</p>
        </div>
      </details>
    </div>
  </div>
</section>

<!-- ===== CTA ===== -->
<section class="section section--cta" id="cta">
  <div class="cta-banner">
    <div class="cta-banner__inner">
      <div class="cta-banner__copy anim" data-anim="fade-up">
        <h2 class="cta-banner__title">プロ品質のめだか取引を、<br class="sp-only">最速ではじめる</h2>
        <p class="cta-banner__desc">
          会員登録は無料。落札も出品も、最短翌日からご利用いただけます。
        </p>
        <div class="cta-banner__actions">
          <a href="/register" class="cta-banner__btn cta-banner__btn--white">
            <span class="cta-banner__btn-main">
              無料で新規登録する
              <span class="cta-banner__chev" aria-hidden="true">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
              </span>
            </span>
            <span class="cta-banner__btn-sub">落札したい方はこちらから</span>
          </a>
          <a href="https://lin.ee/XXXXXXX" target="_blank" rel="noopener noreferrer" class="cta-banner__btn cta-banner__btn--accent">
            <span class="cta-banner__btn-main">
              LINEで相談する
              <span class="cta-banner__chev" aria-hidden="true">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
              </span>
            </span>
            <span class="cta-banner__btn-sub">出品したい方はこちらから</span>
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
        <img src="/img/logo.png?v=2" alt="日本メダカオンライン市場" class="footer__logo">
        <p class="footer__operator">運営: 日本メダカオンライン市場運営事務局</p>
      </div>
      <nav class="footer__links" aria-label="フッターナビゲーション">
        <a href="/legal/tokushoho">特定商取引法に基づく表記</a>
        <a href="/legal/privacy">プライバシーポリシー</a>
        <a href="/legal/terms">利用規約</a>
      </nav>
    </div>
    <p class="footer__copy">&copy; 2026 株式会社サバント All Rights Reserved.</p>
  </div>
</footer>

<!-- ===== FLOATING CTA (mobile) ===== -->
<div class="floating-cta" id="floating-cta">
  <a href="/register" class="btn-primary">
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/></svg>
    無料で新規登録する
  </a>
</div>

<script src="/js/lp.js?v=5"></script>
</body>
</html>
