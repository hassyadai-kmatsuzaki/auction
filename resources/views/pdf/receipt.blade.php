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
            border-bottom: 3px double #27ae60;
            padding-bottom: 12px;
        }
        .header h1 {
            font-size: 22px;
            color: #27ae60;
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
        .total-box {
            background-color: #27ae60;
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
            background-color: #27ae60;
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
            font-weight: bold;
            border-top: 2px solid #333;
            border-bottom: none;
            padding-top: 10px;
        }
        .paid-stamp-box {
            text-align: center;
            margin: 20px 0;
            padding: 15px;
            border: 2px solid #27ae60;
        }
        .paid-stamp {
            display: inline-block;
            border: 3px solid #27ae60;
            color: #27ae60;
            font-size: 28px;
            font-weight: bold;
            padding: 4px 25px;
            letter-spacing: 5px;
        }
        .paid-detail {
            margin-top: 10px;
            font-size: 11px;
            color: #555;
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
    </style>
</head>
<body>
    <div class="doc-number">
        No. {{ $document_number }}<br>
        発行日: {{ $issue_date }}
    </div>

    <div class="header">
        <h1>領 収 書</h1>
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

    <p>下記の通り領収いたしました。</p>

    <div class="total-box">
        領収金額: ¥{{ number_format($grand_total) }}
    </div>

    <table class="detail">
        <thead>
            <tr>
                <th style="width: 30%">品目</th>
                <th style="width: 25%">品種</th>
                <th style="width: 10%; text-align: center">数量</th>
                <th style="width: 15%; text-align: right">単価</th>
                <th style="width: 20%; text-align: right">金額</th>
            </tr>
        </thead>
        <tbody>
            <tr>
                <td>
                    {{ $auction_title }}
                    @if($item_number)
                        <br><span class="small-text">No.{{ $item_number }}</span>
                    @endif
                </td>
                <td>{{ $species_name }}</td>
                <td style="text-align: center">{{ $quantity }}匹</td>
                <td class="right">¥{{ number_format($winning_price) }}</td>
                <td class="right">¥{{ number_format($total_amount) }}</td>
            </tr>
            @if($shipping_fee > 0)
            <tr>
                <td colspan="4">配送料金（送料・梱包資材費込）</td>
                <td class="right">¥{{ number_format($shipping_fee) }}</td>
            </tr>
            @endif
            <tr class="subtotal-row">
                <td colspan="4"><strong>合計（税込）</strong></td>
                <td class="right"><strong>¥{{ number_format($grand_total) }}</strong></td>
            </tr>
        </tbody>
    </table>

    <div class="paid-stamp-box">
        <div class="paid-stamp">領収済</div>
        <div class="paid-detail">
            お支払い方法: {{ $payment_method }}
            @if($paid_at)
                &nbsp;&nbsp;|&nbsp;&nbsp;入金日: {{ $paid_at }}
            @endif
        </div>
    </div>

    <div class="issuer">
        <div class="company-name">{{ $company_name }}</div>
        @if($company_address)<div>{{ $company_address }}</div>@endif
        @if($company_phone)<div>TEL: {{ $company_phone }}</div>@endif
        @if($company_email)<div>{{ $company_email }}</div>@endif
    </div>

    <div class="note">
        ※ この領収書は電子的に発行されたものです。
    </div>
</body>
</html>
