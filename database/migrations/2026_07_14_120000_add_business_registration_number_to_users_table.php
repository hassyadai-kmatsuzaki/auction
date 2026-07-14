<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * インボイス登録番号（T+13桁）を users にも持つ。
 *
 * seller_profiles.business_registration_number（免税判定の参照元）は出品者にしか
 * 存在しないため、E-NE Webhook で買受者として作成された会員の番号を保持できなかった。
 * 買受→出品へ昇格する前提のため users で全員分を保持し、SellerProfile 作成時に
 * 各作成箇所でコピーする。
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('business_registration_number', 255)->nullable()->after('company_name');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn('business_registration_number');
        });
    }
};
