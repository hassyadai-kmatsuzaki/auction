<?php

namespace App\Http\Controllers\Auth;

use App\Actions\Line\LinkLineAccountAction;
use App\Http\Controllers\Controller;
use App\Models\LineAccount;
use App\Services\LineService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Str;

class LineAuthController extends Controller
{
    public function __construct(
        private readonly LineService            $lineService,
        private readonly LinkLineAccountAction  $linkAction,
    ) {}

    /** LINE Login 画面へリダイレクト */
    public function redirect(Request $request)
    {
        $state = Str::random(40);
        session(['line_oauth_state' => $state]);

        return response()->json([
            'success' => true,
            'data'    => ['url' => $this->lineService->getLoginUrl($state)],
        ]);
    }

    /** LINE Login コールバック（認証後にブラウザから呼ばれる） */
    public function callback(Request $request)
    {
        $state = session('line_oauth_state');
        if (!$state || $state !== $request->input('state')) {
            return redirect(config('app.frontend_url', '/') . '/participant/settings?line=error&reason=state');
        }

        $code = $request->input('code');
        if (!$code) {
            return redirect(config('app.frontend_url', '/') . '/participant/settings?line=error&reason=code');
        }

        $userId = Auth::id();
        if (!$userId) {
            return redirect(config('app.frontend_url', '/') . '/login?line=error&reason=auth');
        }

        $lineAccount = $this->linkAction->execute($userId, $code);

        if (!$lineAccount) {
            return redirect(config('app.frontend_url', '/') . '/participant/settings?line=error&reason=link');
        }

        // フロントの設定画面に成功パラメータ付きでリダイレクト
        $role = $this->detectRole($request);
        return redirect(config('app.frontend_url', '/') . "/{$role}/settings?line=success");
    }

    /** LINE連携状態を取得 */
    public function status()
    {
        $account = LineAccount::where('user_id', Auth::id())->first();
        return response()->json([
            'success' => true,
            'data'    => [
                'linked'       => !!$account,
                'is_active'    => $account?->is_active ?? false,
                'display_name' => $account?->display_name,
                'picture_url'  => $account?->picture_url,
                'linked_at'    => $account?->linked_at?->toIso8601String(),
            ],
        ]);
    }

    /** LINE連携を解除 */
    public function unlink()
    {
        $account = LineAccount::where('user_id', Auth::id())->first();
        if ($account) {
            $account->update(['is_active' => false]);
        }
        return response()->json(['success' => true, 'message' => 'LINE連携を解除しました']);
    }

    private function detectRole(Request $request): string
    {
        $referer = session('line_return_role', 'participant');
        session()->forget('line_return_role');
        return in_array($referer, ['participant', 'seller']) ? $referer : 'participant';
    }
}
