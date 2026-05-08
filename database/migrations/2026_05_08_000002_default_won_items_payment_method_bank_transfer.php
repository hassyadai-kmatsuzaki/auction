<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        DB::table('won_items')
            ->whereNull('payment_method')
            ->update(['payment_method' => 'bank_transfer']);

        $driver = Schema::getConnection()->getDriverName();
        if (in_array($driver, ['mysql', 'mariadb'], true)) {
            DB::statement(
                "ALTER TABLE won_items MODIFY payment_method "
                . "ENUM('bank_transfer','credit_card','cash','onsite') "
                . "NULL DEFAULT 'bank_transfer' COMMENT '支払い方法'"
            );
        }
    }

    public function down(): void
    {
        $driver = Schema::getConnection()->getDriverName();
        if (in_array($driver, ['mysql', 'mariadb'], true)) {
            DB::statement(
                "ALTER TABLE won_items MODIFY payment_method "
                . "ENUM('bank_transfer','credit_card','cash','onsite') "
                . "NULL DEFAULT NULL COMMENT '支払い方法'"
            );
        }
    }
};
