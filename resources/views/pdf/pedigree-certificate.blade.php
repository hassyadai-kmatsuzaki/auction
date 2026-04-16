<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<style>
  body { font-family: 'ipag', sans-serif; font-size: 12px; color: #333; }
  .header { text-align: center; border-bottom: 3px double #2563EB; padding-bottom: 15px; margin-bottom: 20px; }
  .header h1 { font-size: 24px; color: #1E40AF; margin: 0; }
  .header .cert-no { font-size: 10px; color: #6B7280; margin-top: 5px; }
  .section { margin-bottom: 15px; }
  .section-title { font-size: 14px; font-weight: bold; color: #1E40AF; border-bottom: 1px solid #BFDBFE; padding-bottom: 3px; margin-bottom: 8px; }
  table { width: 100%; border-collapse: collapse; }
  table th { background: #EFF6FF; text-align: left; padding: 6px 10px; width: 30%; border: 1px solid #BFDBFE; font-size: 11px; }
  table td { padding: 6px 10px; border: 1px solid #BFDBFE; }
  .lineage-table th { width: 20%; background: #F0FDF4; border-color: #BBF7D0; }
  .lineage-table td { border-color: #BBF7D0; }
  .footer { margin-top: 30px; text-align: center; font-size: 10px; color: #9CA3AF; border-top: 1px solid #E5E7EB; padding-top: 10px; }
  .stamp { text-align: right; margin-top: 20px; }
  .stamp .date { font-size: 11px; }
</style>
</head>
<body>
  <div class="header">
    <h1>デジタル血統証明書</h1>
    <div class="cert-no">証明書番号: {{ $certificate->certificate_number }}</div>
  </div>

  <div class="section">
    <div class="section-title">基本情報</div>
    <table>
      <tr><th>品種名</th><td>{{ $certificate->breed_name }}</td></tr>
      @if($certificate->breed_type)<tr><th>品種タイプ</th><td>{{ $certificate->breed_type }}</td></tr>@endif
      @if($certificate->fixation_rate)<tr><th>固定率</th><td>{{ $certificate->fixation_rate }}%</td></tr>@endif
      @if($certificate->expression)<tr><th>表現型</th><td>{{ $certificate->expression }}</td></tr>@endif
      @if($item)<tr><th>商品番号</th><td>No.{{ $item->item_number }}</td></tr>@endif
      @if($item)<tr><th>匹数</th><td>{{ $item->quantity }}匹</td></tr>@endif
    </table>
  </div>

  @if($certificate->parent_male || $certificate->parent_female)
  <div class="section">
    <div class="section-title">親魚情報</div>
    <table>
      @if($certificate->parent_male)
      <tr><th>父魚（オス）</th><td>
        @foreach($certificate->parent_male as $key => $val){{ $key }}: {{ $val }}@if(!$loop->last) / @endif @endforeach
      </td></tr>
      @endif
      @if($certificate->parent_female)
      <tr><th>母魚（メス）</th><td>
        @foreach($certificate->parent_female as $key => $val){{ $key }}: {{ $val }}@if(!$loop->last) / @endif @endforeach
      </td></tr>
      @endif
    </table>
  </div>
  @endif

  @if($certificate->lineage)
  <div class="section">
    <div class="section-title">血統情報</div>
    <table class="lineage-table">
      @foreach($certificate->lineage as $generation => $info)
      <tr><th>{{ $generation }}</th><td>{{ is_array($info) ? implode(' / ', $info) : $info }}</td></tr>
      @endforeach
    </table>
  </div>
  @endif

  @if($certificate->breeding_notes)
  <div class="section">
    <div class="section-title">備考</div>
    <p>{{ $certificate->breeding_notes }}</p>
  </div>
  @endif

  <div class="stamp">
    <div class="date">発行日: {{ $certificate->issued_at ? $certificate->issued_at->format('Y年m月d日') : '未発行' }}</div>
    <div>発行者: {{ $issuer->name ?? '-' }}</div>
  </div>

  <div class="footer">
    本証明書はメダカオークションプラットフォームにより発行されたデジタル証明書です。<br>
    証明書番号で真正性を確認できます。
  </div>
</body>
</html>
