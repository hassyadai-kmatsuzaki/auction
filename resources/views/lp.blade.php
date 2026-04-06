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
  <link rel="stylesheet" href="/css/lp.css">
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
      <img src="/img/logo.png" alt="日本メダカオンライン市場" class="header__logo-img">
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
  <div class="hero__noise"></div>
  <div class="hero__deco-text" aria-hidden="true">MEDAICHI</div>
  <div class="hero__inner">
    <div class="hero__left">
      <h1 class="hero__title hero-anim" data-hero-delay="1">
        <span class="hero__title-line">信頼できる</span>
        <span class="hero__title-line">出品者からあなたへ</span>
        <span class="hero__title-accent hero-anim" data-hero-delay="2">めだか専門<br>オークション。</span>
      </h1>
      <p class="hero__sub hero-anim" data-hero-delay="3">その地方のリーダーの最新世代・最新品種が、<br>ここに集まる。</p>
      <div class="hero__tags hero-anim" data-hero-delay="4">
        <span>審査制出品者のみ</span>
        <span>プロ品質の選魚</span>
        <span>めだか専門特化</span>
      </div>
      <div class="hero__action hero-anim" data-hero-delay="5">
        <a href="/register" class="btn-primary">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/></svg>
          無料で新規登録する
        </a>
      </div>
    </div>
    <div class="hero__right hero-anim" data-hero-delay="2">
      <div class="hero__visual">
        <div class="hero__img-full">
          <img src="/img/lp/AdobeStock_194803795.jpeg" alt="めだか" loading="eager">
        </div>
      </div>
    </div>
  </div>
  <!-- Marquee -->
  <div class="hero__marquee" aria-hidden="true">
    <div class="hero__marquee-track">
      <span>MEDAKA ONLINE AUCTION</span>
      <span>MEDAKA ONLINE AUCTION</span>
      <span>MEDAKA ONLINE AUCTION</span>
      <span>MEDAKA ONLINE AUCTION</span>
    </div>
  </div>
  <div class="hero__scroll">
    <span>SCROLL</span>
    <div class="hero__scroll-line"></div>
  </div>
</section>

<!-- ===== PROBLEMS ===== -->
<section class="section section--problems" id="problems">
  <div class="container">
    <div class="section__header anim" data-anim="fade-up">
      <span class="section__num">001</span>
      <span class="section__en">PROBLEM</span>
      <h2 class="section__title">こんな経験ありませんか？</h2>
      <p class="section__lead">めだかビジネスに関わる方が抱えがちな課題です。</p>
    </div>
    <div class="problem-list">
      <div class="problem-item anim" data-anim="fade-up">
        <div class="problem-item__img">
          <img src="/img/lp/AdobeStock_549627271.jpeg" alt="写真と違うメダカ" loading="lazy">
        </div>
        <div class="problem-item__body">
          <span class="problem-item__num">01</span>
          <h3>落札した個体が、<br>写真と全然違った</h3>
          <p>イメージばかりのフリマアプリでは出品者の質にバラつきがあり、詐欺まがいの取引も少なくありません。</p>
        </div>
      </div>
      <div class="problem-item problem-item--reverse anim" data-anim="fade-up">
        <div class="problem-item__img">
          <img src="/img/lp/AdobeStock_1903355340.jpeg" alt="梱包の問題" loading="lazy">
        </div>
        <div class="problem-item__body">
          <span class="problem-item__num">02</span>
          <h3>梱包が雑で、届いた時には<br>もう手遅れだった</h3>
          <p>生体の輸送は繊細。個人発送による死着・状態不良のリスクは、そのまま損失になります。</p>
        </div>
      </div>
      <div class="problem-item anim" data-anim="fade-up">
        <div class="problem-item__img">
          <img src="/img/lp/AdobeStock_1551862191.jpeg" alt="仕入れ先が見つからない" loading="lazy">
        </div>
        <div class="problem-item__body">
          <span class="problem-item__num">03</span>
          <h3>イベント前にまとまった<br>仕入れ先が見つからない</h3>
          <p>即売会や自社販売の前に、品質の良い個体を効率的に確保するルートがない。</p>
        </div>
      </div>
      <div class="problem-item problem-item--reverse anim" data-anim="fade-up">
        <div class="problem-item__img">
          <img src="/img/lp/AdobeStock_1888599652.jpeg" alt="販売計画が立てられない" loading="lazy">
        </div>
        <div class="problem-item__body">
          <span class="problem-item__num">04</span>
          <h3>仕入れが安定しないため、<br>販売計画が立てられない</h3>
          <p>毎回ゼロから探す仕入れでは、事業として回すのが難しい。</p>
        </div>
      </div>
    </div>
  </div>
</section>

<!-- ===== FEATURES ===== -->
<section class="section section--features" id="features">
  <div class="container">
    <div class="section__header anim" data-anim="fade-up">
      <span class="section__num">002</span>
      <span class="section__en">REASON</span>
      <h2 class="section__title">だから、日本メダカオンライン市場</h2>
      <p class="section__lead">3つの強みが、安心・安全なめだか取引を実現します。</p>
    </div>
    <div class="feature-grid">
      <div class="feature-card anim" data-anim="fade-up">
        <div class="feature-card__visual">
          <img src="/img/lp/AdobeStock_471441749.jpeg" alt="めだか専門" loading="lazy">
          <span class="feature-card__num">01</span>
        </div>
        <div class="feature-card__body">
          <h3>めだか専門だから、<br>共感が違う</h3>
          <p>めだかだけに特化した専門プラットフォーム。品種・グレードで欲しい個体にたどりつきやすく、画像と動画で状態を事前に確認できます。</p>
        </div>
      </div>
      <div class="feature-card anim" data-anim="fade-up" data-delay="1">
        <div class="feature-card__visual">
          <img src="/img/lp/AdobeStock_1888599652.jpeg" alt="審査制出品者" loading="lazy">
          <span class="feature-card__num">02</span>
        </div>
        <div class="feature-card__body">
          <h3>審査制の出品者だから、<br>信頼が違う</h3>
          <p>出品者は全員、身分証明書提出＋運営による審査を通過した方のみ。クローンや戻しはもちろん排除・推薦制を採用。安心の取引環境です。</p>
        </div>
      </div>
      <div class="feature-card anim" data-anim="fade-up" data-delay="2">
        <div class="feature-card__visual">
          <img src="/img/lp/AdobeStock_713019648.jpeg" alt="プロの選魚" loading="lazy">
          <span class="feature-card__num">03</span>
        </div>
        <div class="feature-card__body">
          <h3>業界歴20年のプロ選魚で、<br>届き方が違う</h3>
          <p>生体輸送を20年こなしてきたプロのノウハウで梱包・発送。大切な個体も、安心して受け取れます。</p>
        </div>
      </div>
    </div>
  </div>
</section>

<!-- ===== STEPS ===== -->
<section class="section section--steps" id="steps">
  <div class="container">
    <div class="section__header anim" data-anim="fade-up">
      <span class="section__num">003</span>
      <span class="section__en">FLOW</span>
      <h2 class="section__title">ご利用の流れ</h2>
      <p class="section__lead">新規登録するだけで、すぐにオークションに参加できます。</p>
    </div>
    <div class="steps-row anim" data-anim="fade-up">
      <div class="step">
        <div class="step__icon step__icon--green">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/></svg>
        </div>
        <span class="step__num">01</span>
        <h4>新規登録</h4>
        <p>無料で会員登録</p>
      </div>
      <div class="step__arrow"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg></div>
      <div class="step">
        <div class="step__icon step__icon--blue">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        </div>
        <span class="step__num">02</span>
        <h4>閲覧・入札</h4>
        <p>画像・動画で個体を確認</p>
      </div>
      <div class="step__arrow"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg></div>
      <div class="step">
        <div class="step__icon step__icon--navy">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
        </div>
        <span class="step__num">03</span>
        <h4>落札・決済</h4>
        <p>オンラインで決済</p>
      </div>
      <div class="step__arrow"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg></div>
      <div class="step">
        <div class="step__icon step__icon--gold">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>
        </div>
        <span class="step__num">04</span>
        <h4>受け取り</h4>
        <p>プロ梱包で安心お届け</p>
      </div>
    </div>
  </div>
</section>

<!-- ===== DEMO ===== -->
<section class="section section--demo" id="demo">
  <div class="container">
    <div class="demo-layout">
      <div class="demo-layout__text anim" data-anim="fade-up">
        <span class="section__num">004</span>
        <span class="section__en">DEMO</span>
        <h2 class="section__title">実際の画面を<br>体験してみる</h2>
        <p>実際のオークション画面を、登録後に体験できます。</p>
        <ul class="demo-features">
          <li>品種で絞り込み検索</li>
          <li>画像・動画で状態確認</li>
          <li>かんたん入札</li>
        </ul>
        <a href="/register" class="btn-primary">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/></svg>
          無料登録してオークションを見る
        </a>
      </div>
      <div class="demo-layout__phone anim" data-anim="fade-up" data-delay="2">
        <div class="phone-mockup">
          <img src="https://d2xsxph8kpxj0f.cloudfront.net/310519663221887977/PZGmsevztebBwahEFUeS9q/medaka-auction-demo-jbLiaxh7i2GnzhtSbopvVC.webp" alt="オークション画面デモ" loading="lazy">
        </div>
      </div>
    </div>
  </div>
</section>

<!-- ===== PRICING ===== -->
<section class="section section--pricing" id="pricing">
  <div class="container">
    <div class="section__header anim" data-anim="fade-up">
      <span class="section__num">005</span>
      <span class="section__en">PRICE</span>
      <h2 class="section__title">料金体系</h2>
    </div>

    <div class="pricing-hero anim" data-anim="fade-up">
      <span class="pricing-hero__badge">ローンチキャンペーン実施中</span>
      <p class="pricing-hero__label">入会金</p>
      <p class="pricing-hero__old">&yen;100,000</p>
      <div class="pricing-hero__arrow">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12l7 7 7-7"/></svg>
      </div>
      <p class="pricing-hero__new">&yen;0</p>
      <p class="pricing-hero__note">※ローンチキャンペーン期間中のみ</p>
    </div>

    <div class="pricing-table anim" data-anim="fade-up">
      <div class="pricing-row pricing-row--highlight">
        <div class="pricing-row__label">
          <span class="pricing-row__badge">注目</span>
          入会金
        </div>
        <div class="pricing-row__value">
          <span class="pricing-row__old">100,000円</span>
          <span class="pricing-row__new">0円</span>
          <span class="pricing-row__campaign">キャンペーン</span>
        </div>
      </div>
      <div class="pricing-row">
        <div class="pricing-row__label">年会費</div>
        <div class="pricing-row__value"><strong>5,000円（税込）</strong></div>
      </div>
      <div class="pricing-row">
        <div class="pricing-row__label">落札手数料</div>
        <div class="pricing-row__value"><strong>落札価格の10%</strong></div>
      </div>
      <div class="pricing-row">
        <div class="pricing-row__label">送料</div>
        <div class="pricing-row__value">実費負担（プロ品質の梱包込み）</div>
      </div>
    </div>
    <p class="pricing-note anim" data-anim="fade-up">手数料は落札価格の10%のみ。わかりやすい料金体系で安心してご利用いただけます。</p>
  </div>
</section>

<!-- ===== LINEUP ===== -->
<section class="section section--lineup" id="lineup">
  <div class="container">
    <div class="section__header anim" data-anim="fade-up">
      <span class="section__num">006</span>
      <span class="section__en">LINEUP</span>
      <h2 class="section__title">第1回オークション 出品ラインナップ</h2>
      <p class="section__lead">※写真はイメージです。実際の出品個体は本番サイトでご確認ください。</p>
    </div>
  </div>
  <div class="lineup-scroll anim" data-anim="fade-up">
    <div class="lineup-track" id="lineup-carousel">
      <div class="lineup-card">
        <div class="lineup-card__img">
          <img src="https://d2xsxph8kpxj0f.cloudfront.net/310519663221887977/PZGmsevztebBwahEFUeS9q/medaka-variety-1-ZQY4pEwNqGNjbN2PaxSLpQ.webp" alt="紅帝メダカ" loading="lazy">
          <span class="lineup-card__badge">出品予定</span>
        </div>
        <div class="lineup-card__body">
          <h4>紅帝メダカ</h4>
          <p>出品者: 準備中</p>
        </div>
      </div>
      <div class="lineup-card">
        <div class="lineup-card__img">
          <img src="https://d2xsxph8kpxj0f.cloudfront.net/310519663221887977/PZGmsevztebBwahEFUeS9q/medaka-variety-2-Ew8LvYs2z2YtGh9r9jBhyQ.webp" alt="黒龍メダカ" loading="lazy">
          <span class="lineup-card__badge">出品予定</span>
        </div>
        <div class="lineup-card__body">
          <h4>黒龍メダカ</h4>
          <p>出品者: 準備中</p>
        </div>
      </div>
      <div class="lineup-card">
        <div class="lineup-card__img">
          <img src="https://d2xsxph8kpxj0f.cloudfront.net/310519663221887977/PZGmsevztebBwahEFUeS9q/medaka-variety-3-nKiUrUUTHdEe9EttL23QXa.webp" alt="白幹之メダカ" loading="lazy">
          <span class="lineup-card__badge">出品予定</span>
        </div>
        <div class="lineup-card__body">
          <h4>白幹之メダカ</h4>
          <p>出品者: 準備中</p>
        </div>
      </div>
      <div class="lineup-card lineup-card--placeholder">
        <div class="lineup-card__img">
          <div class="lineup-card__coming">
            <span>Coming Soon</span>
          </div>
        </div>
        <div class="lineup-card__body">
          <h4>掲載準備中</h4>
          <p>続々と出品予定</p>
        </div>
      </div>
      <div class="lineup-card lineup-card--placeholder">
        <div class="lineup-card__img">
          <div class="lineup-card__coming">
            <span>Coming Soon</span>
          </div>
        </div>
        <div class="lineup-card__body">
          <h4>掲載準備中</h4>
          <p>続々と出品予定</p>
        </div>
      </div>
    </div>
  </div>
  <div class="container" style="text-align:center;margin-top:3rem">
    <p class="section__lead">出品ラインナップは随時追加中。最新情報はLINEでお届けします。</p>
    <a href="https://lin.ee/XXXXXXX" target="_blank" rel="noopener noreferrer" class="btn-primary" style="margin-top:1.5rem">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="white"><path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63h2.386c.346 0 .627.285.627.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63.346 0 .628.285.628.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.281.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314"/></svg>
      LINE登録で最新情報を受け取る
    </a>
  </div>
</section>

<!-- ===== CTA ===== -->
<section class="section section--cta" id="cta">
  <div class="container">
    <div class="cta-inner anim" data-anim="fade-up">
      <p class="cta-inner__badge">先行登録で第1回オークションに参加できます</p>
      <h2>ここからはじめよう。<br><span>めだかの新しい出会いを、ここから。</span></h2>
      <p class="cta-inner__sub">新規登録で、第1回オークションにご参加いただけます。</p>
      <a href="/register" class="btn-primary btn-primary--lg">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/></svg>
        無料で新規登録する
      </a>
      <div class="cta-inner__trust">
        <span>審査制出品者のみ</span>
        <span>プロ品質の選魚</span>
        <span>めだか専門特化</span>
      </div>
    </div>
  </div>
</section>

<!-- ===== SELLER ===== -->
<section class="section section--seller" id="seller">
  <div class="container">
    <div class="seller-card anim" data-anim="fade-up">
      <div class="seller-card__inner">
        <h2>出品をご希望の方へ</h2>
        <p>日本メダカオンライン市場では、品質を保つため出品者は、紹介・推薦制にて受け付けております。ご興味のある方は、下記からお問い合わせください。</p>
        <a href="https://lin.ee/XXXXXXX" target="_blank" rel="noopener noreferrer" class="btn-secondary">
          お問い合わせはこちら
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
        </a>
      </div>
    </div>
  </div>
</section>

<!-- ===== FOOTER ===== -->
<footer class="footer">
  <div class="container">
    <div class="footer__logo">
      <img src="/img/logo.png" alt="日本メダカオンライン市場">
    </div>
    <p class="footer__operator">運営: サバント</p>
    <div class="footer__links">
      <a href="/legal/tokushoho">特定商取引法に基づく表記</a>
      <a href="/legal/privacy">プライバシーポリシー</a>
      <a href="/legal/terms">利用規約</a>
    </div>
    <p class="footer__copy">&copy; 2025 サバント All Rights Reserved.</p>
  </div>
</footer>

<!-- ===== FLOATING CTA (mobile) ===== -->
<div class="floating-cta" id="floating-cta">
  <a href="/register" class="btn-primary">
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/></svg>
    無料で新規登録する
  </a>
</div>

<script src="/js/lp.js"></script>
</body>
</html>
