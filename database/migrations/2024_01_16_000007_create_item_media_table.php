<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('item_media', function (Blueprint $table) {
            $table->id();
            $table->foreignId('item_id')
                ->constrained('items')
                ->onDelete('cascade')
                ->comment('生体ID');
            $table->enum('media_type', ['video_top', 'video_side', 'photo_top', 'photo_side', 'photo_other'])
                ->comment('メディア種別');
            $table->string('file_path', 500)->comment('ファイルパス');
            $table->string('file_name')->comment('ファイル名');
            $table->bigInteger('file_size')->unsigned()->nullable()->comment('ファイルサイズ(バイト)');
            $table->string('mime_type', 100)->nullable()->comment('MIMEタイプ');
            $table->integer('duration')->unsigned()->nullable()->comment('再生時間(秒・動画のみ)');
            $table->integer('width')->unsigned()->nullable()->comment('幅(ピクセル)');
            $table->integer('height')->unsigned()->nullable()->comment('高さ(ピクセル)');
            $table->integer('display_order')->unsigned()->default(0)->comment('表示順序');
            $table->boolean('is_thumbnail')->default(false)->comment('サムネイルフラグ');
            $table->timestamp('uploaded_at')->useCurrent()->comment('アップロード日時');
            $table->timestamps();
            
            // インデックス
            $table->index('item_id');
            $table->index(['item_id', 'media_type']);
            $table->index(['item_id', 'display_order']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('item_media');
    }
};
