<!DOCTYPE html>
<html lang="ja">
<head>
    <meta http-equiv="Content-Type" content="text/html; charset=utf-8"/>
    <style>
        body {
            font-family: 'ipagothic', 'DejaVu Sans', sans-serif;
            font-size: 11px;
            color: #333;
            line-height: 1.7;
            margin: 0;
            padding: 25px 30px;
        }
        .doc-number {
            text-align: right;
            font-size: 10px;
            color: #888;
            margin-bottom: 5px;
        }
        .header {
            text-align: center;
            margin-bottom: 25px;
            border-bottom: 3px double #2c3e50;
            padding-bottom: 12px;
        }
        .header h1 {
            font-size: 22px;
            color: #2c3e50;
            margin: 0;
            letter-spacing: 8px;
        }
        .buyer-info {
            border: 1px solid #ccc;
            padding: 12px 15px;
            background-color: #fafafa;
            margin-bottom: 15px;
        }
        .buyer-name {
            font-size: 15px;
            font-weight: bold;
            border-bottom: 1px solid #555;
            padding-bottom: 4px;
            margin-bottom: 6px;
        }
        .auction-info {
            font-size: 10px;
            color: #666;
            margin-bottom: 10px;
        }
        .total-box {
            background-color: #2c3e50;
            color: #fff;
            padding: 12px 20px;
            text-align: center;
            margin: 15px 0;
            font-size: 18px;
            font-weight: bold;
        }
        table.detail {
            width: 100%;
            border-collapse: collapse;
            margin: 12px 0;
        }
        table.detail th {
            background-color: #34495e;
            color: #fff;
            padding: 7px 10px;
            text-align: left;
            font-size: 10px;
            font-weight: bold;
        }
        table.detail td {
            padding: 7px 10px;
            border-bottom: 1px solid #ddd;
            font-size: 11px;
        }
        table.detail .right {
            text-align: right;
        }
        table.detail .subtotal-row td {
            border-top: 2px solid #333;
            border-bottom: none;
            padding-top: 10px;
        }
        table.detail .shipping-row td {
            border-bottom: 1px solid #ddd;
        }
        table.detail .total-row td {
            font-weight: bold;
            font-size: 12px;
            border-top: 2px solid #333;
            border-bottom: none;
            padding-top: 10px;
        }
        .payment-info {
            border: 1px solid #e74c3c;
            padding: 12px 15px;
            margin: 15px 0;
        }
        .payment-info-title {
            color: #e74c3c;
            font-size: 13px;
            font-weight: bold;
            margin-bottom: 8px;
        }
        .issuer {
            margin-top: 25px;
            text-align: right;
            border-top: 1px solid #ddd;
            padding-top: 12px;
        }
        .issuer .company-name {
            font-size: 13px;
            font-weight: bold;
        }
        .note {
            font-size: 9px;
            color: #aaa;
            margin-top: 15px;
            text-align: center;
        }
        .small-text {
            font-size: 9px;
            color: #888;
        }
        .shipping-breakdown {
            margin: 12px 0 18px 0;
            border: 1px solid #cfd8dc;
            background-color: #f5f9fb;
            padding: 10px 12px;
        }
        .shipping-breakdown-title {
            font-size: 11px;
            font-weight: bold;
            color: #2c3e50;
            border-bottom: 1px solid #b0bec5;
            padding-bottom: 4px;
            margin-bottom: 6px;
        }
        .shipping-breakdown-meta {
            font-size: 10px;
            color: #555;
            margin-bottom: 6px;
        }
        table.breakdown {
            width: 100%;
            border-collapse: collapse;
            font-size: 10px;
        }
        table.breakdown th {
            background-color: #cfd8dc;
            color: #2c3e50;
            padding: 5px 8px;
            font-weight: bold;
            border: 1px solid #b0bec5;
        }
        table.breakdown td {
            padding: 5px 8px;
            border: 1px solid #cfd8dc;
        }
        table.breakdown .right { text-align: right; }
        table.breakdown .center { text-align: center; }
        table.breakdown .total-row td {
            background-color: #eceff1;
            font-weight: bold;
        }
        .species-subtotals {
            margin-top: 8px;
            font-size: 10px;
            color: #455a64;
        }
        .species-subtotals .label {
            font-weight: bold;
            margin-bottom: 3px;
        }
        .species-subtotals ul {
            margin: 0;
            padding-left: 18px;
        }
        .breakdown-note {
            font-size: 9px;
            color: #777;
            margin-top: 6px;
        }
    </style>
</head>
<body>
    <div class="doc-number">
        No. {{ $document_number }}<br>
        発行日: {{ $issue_date }}
    </div>

    <div class="header">
        <h1>請 求 書</h1>
    </div>

    <div class="buyer-info">
        <div class="buyer-name">{{ $buyer_name }} 様</div>
        @if($buyer_postal_code)
            <div>〒{{ $buyer_postal_code }}</div>
        @endif
        @if($buyer_address && trim($buyer_address) !== '')
            <div>{{ $buyer_address }}</div>
        @endif
    </div>

    <div class="auction-info">
        対象オークション: {{ $auction_title }}
        @if($auction_date)
            （{{ $auction_date }}）
        @endif
    </div>

    <p>下記の通りご請求申し上げます。</p>

    <div class="total-box">
        ご請求金額: ¥{{ number_format($grand_total) }}
    </div>

    <table class="detail">
        <thead>
            <tr>
                <th style="width: 10%">No.</th>
                <th style="width: 40%">品種</th>
                <th style="width: 15%; text-align: center">数量</th>
                <th style="width: 20%; text-align: right">単価</th>
                <th style="width: 15%; text-align: right">小計</th>
            </tr>
        </thead>
        <tbody>
            @foreach($items as $item)
            <tr>
                <td>{{ $item['item_number'] }}</td>
                <td>{{ $item['species_name'] }}</td>
                <td style="text-align: center">{{ $item['quantity'] }}{{ $item['quantity_unit'] }}</td>
                <td class="right">¥{{ number_format($item['winning_price']) }}</td>
                <td class="right">¥{{ number_format($item['line_subtotal']) }}</td>
            </tr>
            @endforeach
            <tr class="subtotal-row">
                <td colspan="4" style="text-align: right;"><strong>商品小計</strong></td>
                <td class="right"><strong>¥{{ number_format($subtotal) }}</strong></td>
            </tr>
            @if($commission_total > 0)
            <tr class="shipping-row">
                <td colspan="4" style="text-align: right;">落札手数料</td>
                <td class="right">¥{{ number_format($commission_total) }}</td>
            </tr>
            @endif
            <tr class="shipping-row">
                <td colspan="4" style="text-align: right;">配送料</td>
                <td class="right">¥{{ number_format($total_shipping_fee) }}</td>
            </tr>
            <tr class="shipping-row">
                <td colspan="4" style="text-align: right;">消費税（{{ rtrim(rtrim(number_format($tax_rate, 1), '0'), '.') }}%）</td>
                <td class="right">¥{{ number_format($tax_amount) }}</td>
            </tr>
            <tr class="total-row">
                <td colspan="4" style="text-align: right;"><strong>合計金額</strong></td>
                <td class="right"><strong>¥{{ number_format($grand_total) }}</strong></td>
            </tr>
        </tbody>
    </table>

    @include('pdf.partials.shipping_breakdown', ['shipping_breakdown' => $shipping_breakdown ?? null])

    @if($payment_deadline || $payment_method !== '未定')
    <div class="payment-info">
        <div class="payment-info-title">お支払い情報</div>
        <table style="width: 100%; border: none;">
            <tr>
                <td style="width: 120px; border: none; padding: 3px 0; font-weight: bold;">お支払い方法</td>
                <td style="border: none; padding: 3px 0;">{{ $payment_method }}</td>
            </tr>
            @if($payment_deadline)
            <tr>
                <td style="border: none; padding: 3px 0; font-weight: bold;">お支払い期限</td>
                <td style="border: none; padding: 3px 0; color: #e74c3c; font-weight: bold;">{{ $payment_deadline }}</td>
            </tr>
            @endif
            @if($bank_info)
            <tr>
                <td style="border: none; padding: 3px 0; vertical-align: top; font-weight: bold;">振込先</td>
                <td style="border: none; padding: 3px 0;">{!! nl2br(e($bank_info)) !!}</td>
            </tr>
            @endif
        </table>
    </div>
    @endif

    <div class="issuer">
        <div class="company-name">{{ $company_name }}</div>
        @if($company_address)<div>{{ $company_address }}</div>@endif
        @if($company_phone)<div>TEL: {{ $company_phone }}</div>@endif
        @if($company_email)<div>{{ $company_email }}</div>@endif
    </div>

    <div class="note">
        ※ 配送料金は配送先地域・梱包サイズにより異なります。<br>
        ※ 本請求書は電子的に発行されたものです。
    </div>
</body>
</html>
