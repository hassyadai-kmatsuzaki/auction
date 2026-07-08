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
            border-bottom: 3px double #059669;
            padding-bottom: 12px;
        }
        .header h1 {
            font-size: 22px;
            color: #059669;
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
            background-color: #059669;
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
            background-color: #047857;
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
        .shipping-info {
            border: 1px solid #059669;
            padding: 12px 15px;
            margin: 15px 0;
        }
        .shipping-info-title {
            color: #059669;
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
        .issuer .registration-number {
            font-size: 11px;
            font-weight: bold;
            margin-top: 2px;
        }
        .note {
            font-size: 9px;
            color: #aaa;
            margin-top: 15px;
            text-align: center;
        }
        .shipping-breakdown {
            margin: 12px 0 18px 0;
            border: 1px solid #a7d8c4;
            background-color: #ecf7f1;
            padding: 10px 12px;
        }
        .shipping-breakdown-title {
            font-size: 11px;
            font-weight: bold;
            color: #047857;
            border-bottom: 1px solid #6db89a;
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
            background-color: #c8e6d6;
            color: #1f4d39;
            padding: 5px 8px;
            font-weight: bold;
            border: 1px solid #6db89a;
        }
        table.breakdown td {
            padding: 5px 8px;
            border: 1px solid #c8e6d6;
        }
        table.breakdown .right { text-align: right; }
        table.breakdown .center { text-align: center; }
        table.breakdown .total-row td {
            background-color: #d8ecdf;
            font-weight: bold;
        }
        .species-subtotals {
            margin-top: 8px;
            font-size: 10px;
            color: #1f4d39;
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
        <h1>納 品 書</h1>
    </div>

    <div class="buyer-info">
        <div class="buyer-name">{{ $buyer_name }} 様</div>
        @if($buyer_postal_code)
            <div>〒{{ $buyer_postal_code }}</div>
        @endif
        @if($buyer_address && trim($buyer_address) !== '')
            <div>{{ $buyer_address }}</div>
        @endif
        @if($buyer_phone)
            <div>TEL: {{ $buyer_phone }}</div>
        @endif
    </div>

    <div class="auction-info">
        対象オークション: {{ $auction_title }}
        @if($auction_date)
            （{{ $auction_date }}）
        @endif
    </div>

    <p>下記の通り納品いたしましたのでご確認ください。</p>

    <div class="total-box">
        納品金額: ¥{{ number_format($grand_total) }}
    </div>

    <table class="detail">
        <thead>
            <tr>
                <th style="width: 8%">商品ID</th>
                <th style="width: 12%">出品ID</th>
                <th style="width: 30%">品種</th>
                <th style="width: 15%">数量</th>
                <th style="width: 20%">単価</th>
                <th style="width: 15%">小計</th>
            </tr>
        </thead>
        <tbody>
            @foreach($items as $item)
            <tr>
                <td>{{ $item['item_id'] }}</td>
                <td>{{ $item['exhibit_code'] }}</td>
                <td>{{ $item['species_name'] }}</td>
                <td>{{ $item['quantity'] }}{{ $item['quantity_unit'] }}</td>
                <td>¥{{ number_format($item['winning_price']) }}</td>
                <td>¥{{ number_format($item['line_subtotal']) }}</td>
            </tr>
            @endforeach
            <tr class="subtotal-row">
                <td colspan="5"><strong>商品小計</strong></td>
                <td><strong>¥{{ number_format($subtotal) }}</strong></td>
            </tr>
            @if($commission_total > 0)
            <tr class="shipping-row">
                <td colspan="5">落札手数料</td>
                <td>¥{{ number_format($commission_total) }}</td>
            </tr>
            @endif
            <tr class="shipping-row">
                <td colspan="5">配送料</td>
                <td>¥{{ number_format($total_shipping_fee) }}</td>
            </tr>
            <tr class="shipping-row">
                <td colspan="5">消費税（{{ rtrim(rtrim(number_format($tax_rate, 1), '0'), '.') }}%）</td>
                <td>¥{{ number_format($tax_amount) }}</td>
            </tr>
            <tr class="total-row">
                <td colspan="5"><strong>合計金額</strong></td>
                <td><strong>¥{{ number_format($grand_total) }}</strong></td>
            </tr>
        </tbody>
    </table>

    @include('pdf.partials.shipping_breakdown', ['shipping_breakdown' => $shipping_breakdown ?? null])

    @if($shipping_company || $tracking_number)
    <div class="shipping-info">
        <div class="shipping-info-title">配送情報</div>
        <table style="width: 100%; border: none;">
            @if($shipping_company)
            <tr>
                <td style="width: 120px; border: none; padding: 3px 0; font-weight: bold;">配送業者</td>
                <td style="border: none; padding: 3px 0;">{{ $shipping_company }}</td>
            </tr>
            @endif
            @if($tracking_number)
            <tr>
                <td style="border: none; padding: 3px 0; font-weight: bold;">追跡番号</td>
                <td style="border: none; padding: 3px 0; font-family: monospace;">{{ $tracking_number }}</td>
            </tr>
            @endif
            <tr>
                <td style="border: none; padding: 3px 0; font-weight: bold;">配送状態</td>
                <td style="border: none; padding: 3px 0;">{{ $delivery_status }}</td>
            </tr>
        </table>
    </div>
    @endif

    <div class="issuer">
        <div class="company-name">{{ $company_name }}</div>
        @if(!empty($company_registration_number))<div class="registration-number">登録番号: {{ $company_registration_number }}</div>@endif
        @if($company_address)<div>{{ $company_address }}</div>@endif
        @if($company_phone)<div>TEL: {{ $company_phone }}</div>@endif
        @if($company_email)<div>{{ $company_email }}</div>@endif
    </div>

    <div class="note">
        ※ 本納品書は電子的に発行されたものです。
    </div>
</body>
</html>
