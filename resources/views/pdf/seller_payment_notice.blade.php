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
        .tax-chip {
            display: inline-block;
            background-color: #FEF3C7;
            color: #B45309;
            padding: 3px 10px;
            font-size: 10px;
            font-weight: bold;
            border-radius: 12px;
            margin-bottom: 10px;
        }
        .tax-note {
            font-size: 9px;
            color: #666;
            margin-top: 8px;
            line-height: 1.5;
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

    @php
        $fmtRate = function ($r) {
            return rtrim(rtrim(number_format((float) $r, 2), '0'), '.');
        };
    @endphp

    @if(!empty($is_tax_exempt))
        @if((float) $winning_tax_rate > 0)
            <div class="tax-chip">
                免税事業者・落札分は消費税相当額 {{ $fmtRate($winning_tax_rate) }}%（経過措置 {{ $fmtRate((float) $transition_rate * 100) }}%）適用
            </div>
        @else
            <div class="tax-chip">
                免税事業者・経過措置終了（落札分の消費税相当額なし）
            </div>
        @endif
    @endif

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

    <!-- 売上明細（金額はすべて税抜） -->
    <table class="detail">
        <thead>
            <tr>
                <th style="width: 8%">商品ID</th>
                <th style="width: 12%">出品ID</th>
                <th style="width: 30%">品種</th>
                <th style="width: 10%">数量</th>
                <th style="width: 20%">落札金額（税抜）</th>
                <th style="width: 20%">手数料（税抜）</th>
            </tr>
        </thead>
        <tbody>
            @foreach($items as $item)
            <tr>
                <td>{{ $item['item_id'] }}</td>
                <td>{{ $item['exhibit_code'] }}</td>
                <td>{{ $item['species_name'] }}</td>
                <td>{{ $item['quantity'] }}匹</td>
                <td>¥{{ number_format($item['winning_amount']) }}</td>
                <td>¥{{ number_format($item['commission_amount']) }}</td>
            </tr>
            @endforeach
            <tr class="total-row">
                <td colspan="4"><strong>小計（税抜）</strong></td>
                <td><strong>¥{{ number_format($subtotal_winning) }}</strong></td>
                <td><strong>¥{{ number_format($subtotal_commission) }}</strong></td>
            </tr>
            @if(!empty($is_tax_exempt))
            <tr>
                <td colspan="4">
                    @if((float) $winning_tax_rate > 0)
                        消費税相当額（{{ $fmtRate($winning_tax_rate) }}%）／消費税（{{ $fmtRate($commission_tax_rate) }}%）
                    @else
                        消費税相当額（なし）／消費税（{{ $fmtRate($commission_tax_rate) }}%）
                    @endif
                </td>
                <td>¥{{ number_format($tax_winning) }}</td>
                <td>¥{{ number_format($tax_commission) }}</td>
            </tr>
            @else
            <tr>
                <td colspan="4">消費税（{{ $fmtRate($tax_rate) }}%）</td>
                <td>¥{{ number_format($tax_winning) }}</td>
                <td>¥{{ number_format($tax_commission) }}</td>
            </tr>
            @endif
            <tr class="total-row">
                <td colspan="4"><strong>合計（税込）</strong></td>
                <td><strong>¥{{ number_format($total_winning_with_tax) }}</strong></td>
                <td><strong>¥{{ number_format($total_commission_with_tax) }}</strong></td>
            </tr>
        </tbody>
    </table>

    <table class="summary-table" style="margin-top: 10px;">
        <tr>
            <td style="text-align: right; width: 70%;"><strong>差引お支払い額</strong></td>
            <td style="text-align: right; font-size: 14px; font-weight: bold; color: #8B5CF6;">
                ¥{{ number_format($net_amount) }}
            </td>
        </tr>
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

    @if(!empty($is_tax_exempt))
    <div class="tax-note">
        ※ 消費税の扱いについて<br>
        @if((float) $winning_tax_rate > 0)
            ・落札金額：消費税相当額 {{ $fmtRate($winning_tax_rate) }}%（インボイス制度の経過措置 {{ $fmtRate((float) $transition_rate * 100) }}% 適用）<br>
            ・手数料：通常消費税 {{ $fmtRate($commission_tax_rate) }}%
        @else
            ・落札分は消費税相当額の上乗せはありません（経過措置終了）<br>
            ・手数料：通常消費税 {{ $fmtRate($commission_tax_rate) }}%
        @endif
    </div>
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
