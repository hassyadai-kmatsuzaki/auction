<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        $exists = DB::table('roles')->where('name', 'media_editor')->exists();
        if ($exists) {
            return;
        }

        DB::table('roles')->insert([
            'name' => 'media_editor',
            'display_name' => '商品メディア編集者',
            'description' => '開催前オークションの商品メディア（画像・動画）のみ編集できる権限',
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    public function down(): void
    {
        DB::table('roles')->where('name', 'media_editor')->delete();
    }
};
