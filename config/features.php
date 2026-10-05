<?php

/*
| 画面に変化が出る機能の表示スイッチ（.env で true にするまで画面は従来どおり）。
| 変更後は php artisan config:cache が必要。フロントへは app.blade.php の meta で渡す。
*/
return [
    // デジタル血統証明書（生体編集のボタン・落札者マイページのボタン・公開照会ページ・PDFのQRコード）
    'pedigree_certificate' => (bool) env('FEATURE_PEDIGREE_CERTIFICATE', false),

    // お知らせの既読管理（ベルを開くと既読化し、バッジを未読数にする）
    'announcement_read' => (bool) env('FEATURE_ANNOUNCEMENT_READ', false),

    // F-021 Googleアカウントでログイン（ログイン画面のボタン。GOOGLE_CLIENT_ID 等の設定も必要）
    'google_login' => (bool) env('FEATURE_GOOGLE_LOGIN', false),

    // F-086 会員自身による年会費プランの確認・カード差し替え・再加入（設定画面のカード）
    'subscription_self_service' => (bool) env('FEATURE_SUBSCRIPTION_SELF_SERVICE', false),

    // F-037 帳票管理の支払通知書一覧から、出品者への精算を「支払済」にする
    'settlement_mark_paid' => (bool) env('FEATURE_SETTLEMENT_MARK_PAID', false),

    // F-107 設定＞配送・梱包の梱包資材費を画面から編集する
    'packing_material_edit' => (bool) env('FEATURE_PACKING_MATERIAL_EDIT', false),

    // F-044 初回ガイダンス（参加者・出品者のヘッダーに「ガイド」、初回ログイン時に自動表示）
    'tutorial' => (bool) env('FEATURE_TUTORIAL', false),

    // F-042/F-043 出品一覧の検索・絞り込み（品種名・価格帯・人気順）と検索条件の保存
    'item_search' => (bool) env('FEATURE_ITEM_SEARCH', false),

    // F-093 一斉メールの予約配信（作成画面に「日時を指定」、一覧に予約日時）
    'campaign_schedule' => (bool) env('FEATURE_CAMPAIGN_SCHEDULE', false),

    // F-022 参加者の入札履歴（ヘッダーに「入札履歴」、参加した生体と結果の一覧）
    'bid_history' => (bool) env('FEATURE_BID_HISTORY', false),

    // F-023 出品者の評価（平均と件数）を落札者マイページの出品者名の横に表示
    'seller_rating' => (bool) env('FEATURE_SELLER_RATING', false),

    // F-010 生体の詳細項目（性別・親魚・飼育環境）を管理画面の生体編集と出品申込で入力
    'item_detail_fields' => (bool) env('FEATURE_ITEM_DETAIL_FIELDS', false),

    // F-015 出品申込の CSV 一括入力（テンプレートのダウンロードと読み込み。読み込みはブラウザ内でフォームに反映）
    'seller_csv' => (bool) env('FEATURE_SELLER_CSV', false),

    // F-023 出品者から落札者への評価（出品者の生体詳細に「落札者を評価」）。落札者の評価はどこにも表示しない
    'seller_review_buyer' => (bool) env('FEATURE_SELLER_REVIEW_BUYER', false),

    // F-038 落札者が「会場で受け取る」を希望として登録（管理者の落札者一覧に「引取希望」）。送料・請求は変えない
    'pickup_request' => (bool) env('FEATURE_PICKUP_REQUEST', false),

    // F-013 出品一覧のカテゴリ（品種名マスタ）での絞り込み
    'item_category' => (bool) env('FEATURE_ITEM_CATEGORY', false),

    // F-032 エスクロー状況の管理画面（閲覧のみ。サイドバー「年会費・決済」に表示）
    'escrow_view' => (bool) env('FEATURE_ESCROW_VIEW', false),

    // F-057 オークション公開（予定に変更）時に参加者ごとの「おすすめ」を作成する（作成のみ・画面表示は無し）
    'recommendations' => (bool) env('FEATURE_RECOMMENDATIONS', false),
];
