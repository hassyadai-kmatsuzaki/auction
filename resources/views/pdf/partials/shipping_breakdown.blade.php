@php($_b = $shipping_breakdown ?? null)
@if($_b)
<div class="shipping-breakdown">
    <div class="shipping-breakdown-title">配送料の内訳</div>

    @if(!empty($_b['region']))
        <div class="shipping-breakdown-meta">
            配送地域：<strong>{{ $_b['region'] }}</strong>
        </div>
    @endif

    @if(($_b['mode'] ?? null) === 'manual')
        <div class="breakdown-note">
            {{ $_b['manual_reason'] ?? '管理者により個別に設定された送料です。' }}
        </div>
        @if(!empty($_b['species_subtotals']))
            <div class="species-subtotals">
                <div class="label">品種別内訳</div>
                <ul>
                    @foreach($_b['species_subtotals'] as $sp)
                        <li>
                            {{ $sp['species_name'] }} {{ $sp['quantity'] }}匹：
                            @if($sp['subtotal_fee'] === null)
                                個別設定
                            @else
                                ¥{{ number_format($sp['subtotal_fee']) }}
                            @endif
                        </li>
                    @endforeach
                </ul>
            </div>
        @endif
        @if(!empty($_b['manual_total']))
            <table class="breakdown" style="margin-top: 6px;">
                <tbody>
                    <tr class="total-row">
                        <td class="right" style="width: 75%;">配送料 計</td>
                        <td class="right">¥{{ number_format($_b['manual_total']) }}</td>
                    </tr>
                </tbody>
            </table>
        @endif
    @else
        @if(!empty($_b['boxes']))
            <table class="breakdown">
                <thead>
                    <tr>
                        <th class="center" style="width: 18%;">箱サイズ</th>
                        <th class="center" style="width: 12%;">個数</th>
                        <th class="right" style="width: 23%;">配送料</th>
                        <th class="right" style="width: 23%;">梱包資材費</th>
                        <th class="right" style="width: 24%;">小計</th>
                    </tr>
                </thead>
                <tbody>
                    @foreach($_b['boxes'] as $box)
                        <tr>
                            <td class="center">{{ $box['box_size'] }}サイズ</td>
                            <td class="center">{{ $box['count'] }}箱</td>
                            <td class="right">¥{{ number_format($box['shipping_cost']) }}</td>
                            <td class="right">¥{{ number_format($box['packing_cost']) }}</td>
                            <td class="right">¥{{ number_format($box['subtotal']) }}</td>
                        </tr>
                    @endforeach
                    <tr class="total-row">
                        <td class="right" colspan="2">合計</td>
                        <td class="right">¥{{ number_format($_b['shipping_cost_total']) }}</td>
                        <td class="right">¥{{ number_format($_b['packing_cost_total']) }}</td>
                        <td class="right">¥{{ number_format($_b['total_shipping_fee']) }}</td>
                    </tr>
                </tbody>
            </table>
        @endif

        @if(count($_b['species_subtotals'] ?? []) > 1)
            <div class="species-subtotals">
                <div class="label">品種別内訳</div>
                <ul>
                    @foreach($_b['species_subtotals'] as $sp)
                        <li>
                            {{ $sp['species_name'] }} {{ $sp['quantity'] }}匹：
                            @if($sp['subtotal_fee'] === null)
                                個別設定
                            @else
                                ¥{{ number_format($sp['subtotal_fee']) }}
                            @endif
                        </li>
                    @endforeach
                </ul>
            </div>
        @endif

        <div class="breakdown-note">
            ※ 配送料は箱サイズ・配送地域に基づき算出され、梱包資材費（発泡スチロール等）を含みます。
        </div>
    @endif
</div>
@endif
