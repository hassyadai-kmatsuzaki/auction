<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('prefecture_regions', function (Blueprint $table) {
            $table->id();
            $table->string('prefecture', 10)->unique()->comment('都道府県名');
            $table->string('region', 10)->comment('配送地域区分');
            $table->index('region');
        });

        $mapping = [
            '北海道' => ['北海道'],
            '東北'   => ['青森', '岩手', '宮城', '秋田', '山形', '福島'],
            '関東'   => ['茨城', '栃木', '群馬', '埼玉', '千葉', '東京', '神奈川', '山梨'],
            '信越'   => ['新潟', '長野'],
            '北陸'   => ['富山', '石川', '福井'],
            '中部'   => ['静岡', '愛知', '三重', '岐阜'],
            '関西'   => ['大阪', '京都', '滋賀', '奈良', '和歌山', '兵庫'],
            '中国'   => ['岡山', '広島', '山口', '鳥取', '島根'],
            '四国'   => ['香川', '徳島', '愛媛', '高知'],
            '九州'   => ['福岡', '佐賀', '長崎', '熊本', '大分', '宮崎', '鹿児島'],
            '沖縄'   => ['沖縄'],
        ];

        $rows = [];
        foreach ($mapping as $region => $prefs) {
            foreach ($prefs as $pref) {
                $rows[] = ['prefecture' => $pref, 'region' => $region];
            }
        }
        DB::table('prefecture_regions')->insert($rows);
    }

    public function down(): void
    {
        Schema::dropIfExists('prefecture_regions');
    }
};
