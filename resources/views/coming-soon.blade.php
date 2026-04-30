<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="robots" content="noindex, nofollow">
  <title>Coming Soon | {{ config('app.name', '日本メダカオンライン市場') }}</title>
  <link rel="icon" type="image/png" href="/favicon.png">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;700;900&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    html, body { height: 100%; }
    body {
      font-family: 'Noto Sans JP', sans-serif;
      color: #1a1a1a;
      background: #FAF8F5;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
      min-height: 100vh;
    }
    .wrap {
      width: 100%;
      max-width: 520px;
      text-align: center;
    }
    .logo {
      width: 120px;
      height: auto;
      margin: 0 auto 32px;
      display: block;
    }
    .badge {
      display: inline-block;
      font-family: 'Inter', sans-serif;
      font-size: 12px;
      font-weight: 600;
      letter-spacing: 0.18em;
      color: #fff;
      background: linear-gradient(120deg, #5d40c6 0%, #05b2f8 50%, #e2229f 100%);
      padding: 6px 14px;
      border-radius: 999px;
      margin-bottom: 20px;
    }
    h1 {
      font-family: 'Inter', sans-serif;
      font-size: clamp(36px, 7vw, 56px);
      font-weight: 700;
      letter-spacing: 0.02em;
      background: linear-gradient(120deg, #5d40c6 0%, #05b2f8 50%, #e2229f 100%);
      -webkit-background-clip: text;
      background-clip: text;
      -webkit-text-fill-color: transparent;
      margin-bottom: 16px;
      line-height: 1.1;
    }
    p {
      font-size: 15px;
      line-height: 1.9;
      color: #555;
    }
    p + p { margin-top: 12px; }
    .note {
      margin-top: 28px;
      font-size: 13px;
      color: #888;
    }
  </style>
</head>
<body>
  <main class="wrap">
    <img src="/img/logo.png?v=2" alt="日本メダカオンライン市場" class="logo">
    <span class="badge">COMING SOON</span>
    <h1>Coming Soon</h1>
    <p>ただいま準備中です。</p>
    <p>サービス公開までいましばらくお待ちください。</p>
    <p class="note">© {{ date('Y') }} {{ config('app.name', '日本メダカオンライン市場') }}</p>
  </main>
</body>
</html>
