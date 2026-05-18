<?php

namespace App\Http\Controllers\MediaEditor;

use App\Http\Controllers\Admin\ItemController as AdminItemController;

/**
 * media_editor ロール向けの商品コントローラ。
 *
 * Admin\ItemController を継承し、ルートからは以下の読み取り・メディア系メソッドのみを露出する：
 *   - index / show
 *   - uploadMedia / deleteMedia / reorderMedia / setThumbnail
 *
 * 開催前ガード（preparing/scheduled のみ許可）は routes/api.php 側の
 * `ensure.auction.editable` ミドルウェアで横断的に担保する。
 */
class ItemController extends AdminItemController
{
}
