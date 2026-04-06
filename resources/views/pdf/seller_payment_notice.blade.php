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
            border-bottom: 3px double #8B5CF6;
            padding-bottom: 12px;
        }
        .header h1 {
            font-size: 22px;
            color: #8B5CF6;
            margin: 0;
            letter-spacing: 8px;
        }
        .seller-info {
            border: 1px solid #ccc;
            padding: 12px 15px;
            background-color: #fafafa;
            margin-bottom: 15px;
        }
        .seller-name {
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
            background-color: #8B5CF6;
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
            background-color: #7C3AED;
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
        table.detail .total-row td {
            font-weight: bold;
            font-size: 12px;
            border-top: 2px solid #333;
            border-bottom: none;
            padding-top: 10px;
        }
        .bank-info {
            border: 1px solid #8B5CF6;
            padding: 12px 15px;
            margin: 15px 0;
        }
        .bank-info-title {
            color: #8B5CF6;
            font-size: 13px;
            font-weight: bold;
            margin-bottom: 8px;
        }
        .summary-table {
            width: 100%;
            border: none;
            margin: 12px 0;
        }
        .summary-table td {
            padding: 4px 10px;
            border: none;
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
    </style>
</head>
<body>
    <div class="doc-number">
        No. {{ $document_number }}<br>
        発行日: {{ $issue_date }}
    </div>

    <div class="header">
        <h1>支払通知書</h1>
    </div>

    <div class="seller-info">
        <div class="seller-name">{{ $seller_name }} 様</div>
    </div>

    <div class="auction-info">
        対象オークション: {{ $auction_title }}
        @if($auction_date)
            （{{ $auction_date }}）
        @endif
    </div>

    <p>下記の通りお支払いについてご通知申し上げます。</p>

    <div class="total-box">
        お支払い金額: ¥{{ number_format($net_amount) }}
    </div>

    <!-- 売上明細 -->
    <table class="detail">
        <thead>
            <tr>
                <th style="width: 8%">No.</th>
                <th style="width: 25%">品種</th>
                <th style="width: 10%">落札者</th>
                <th style="width: 8%; text-align: center">数量</th>
                <th style="width: 15%; text-align: right">落札金額</th>
                <th style="width: 15%; text-align: right">手数料</th>
                <th style="width: 19%; text-align: right">お支払い額</th>
            </tr>
        </thead>
        <tbody>
            @foreach($items as $item)
            <tr>
                <td>{{ $item['item_number'] }}</td>
                <td>{{ $item['species_name'] }}</td>
                <td>{{ $item['buyer_name'] }}</td>
                <td style="text-align: center">{{ $item['quantity'] }}匹</td>
                <td class="right">¥{{ number_format($item['total_amount']) }}</td>
                <td class="right">-¥{{ number_format($item['commission_amount']) }}</td>
                <td class="right">¥{{ number_format($item['seller_amount']) }}</td>
            </tr>
            @endforeach
            <tr class="total-row">
                <td colspan="4" style="text-align: right;"><strong>合計</strong></td>
                <td class="right"><strong>¥{{ number_format($total_sales) }}</strong></td>
                <td class="right"><strong>-¥{{ number_format($total_commission) }}</strong></td>
                <td class="right"><strong>¥{{ number_format($net_amount) }}</strong></td>
            </tr>
        </tbody>
    </table>

    <!-- 振込先情報 -->
    @if($bank_name)
    <div class="bank-info">
        <div class="bank-info-title">お振込先</div>
        <table style="width: 100%; border: none;">
            <tr>
                <td style="width: 100px; border: none; padding: 3px 0; font-weight: bold;">金融機関</td>
                <td style="border: none; padding: 3px 0;">{{ $bank_name }} {{ $bank_branch }}</td>
            </tr>
            <tr>
                <td style="border: none; padding: 3px 0; font-weight: bold;">口座種別</td>
                <td style="border: none; padding: 3px 0;">{{ $account_type }}</td>
            </tr>
            <tr>
                <td style="border: none; padding: 3px 0; font-weight: bold;">口座番号</td>
                <td style="border: none; padding: 3px 0;">{{ $account_number }}</td>
            </tr>
            <tr>
                <td style="border: none; padding: 3px 0; font-weight: bold;">口座名義</td>
                <td style="border: none; padding: 3px 0;">{{ $account_holder }}</td>
            </tr>
        </table>
    </div>
    @endif

    @if($payment_scheduled_date)
    <p style="text-align: center; font-weight: bold; color: #8B5CF6;">
        振込予定日: {{ $payment_scheduled_date }}
    </p>
    @endif

    <div class="issuer">
        <div class="company-name">{{ $company_name }}</div>
        @if($company_address)<div>{{ $company_address }}</div>@endif
        @if($company_phone)<div>TEL: {{ $company_phone }}</div>@endif
        @if($company_email)<div>{{ $company_email }}</div>@endif
    </div>

    <div class="note">
        ※ 本通知書は電子的に発行されたものです。
    </div>
</body>
</html>
