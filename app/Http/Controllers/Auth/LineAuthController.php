<?php

namespace App\Http\Controllers\Auth;

use App\Actions\Line\LinkLineAccountAction;
use App\Http\Controllers\Controller;
use App\Models\LineAccount;
use App\Services\LineService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Log;
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
        $userId = Auth::id();
        $code   = $request->input('code');
        $state  = $request->input('state');

        Log::info('LINE callback received', [
            'user_id'       => $userId,
            'has_code'      => !!$code,
            'has_state'     => !!$state,
            'session_state' => session('line_oauth_state') ? 'exists' : 'missing',
        ]);

        if (!$code) {
            Log::warning('LINE callback: no code');
            return redirect(config('app.frontend_url', '/') . '/participant/settings?line=error&reason=code');
        }

        if (!$userId) {
            Log::warning('LINE callback: not authenticated');
            return redirect(config('app.frontend_url', '/') . '/login?line=error&reason=auth');
        }

        // state検証（セッションが切れている場合はスキップしてログに記録）
        $sessionState = session('line_oauth_state');
        if ($sessionState && $sessionState !== $state) {
            Log::warning('LINE callback: state mismatch', ['session' => $sessionState, 'request' => $state]);
            return redirect(config('app.frontend_url', '/') . '/participant/settings?line=error&reason=state');
        }
        if (!$sessionState) {
            Log::warning('LINE callback: session state missing (proceeding anyway)');
        }

        $lineAccount = $this->linkAction->execute($userId, $code);

        if (!$lineAccount) {
            Log::error('LINE callback: linkAction failed', ['user_id' => $userId]);
            return redirect(config('app.frontend_url', '/') . '/participant/settings?line=error&reason=link');
        }

        Log::info('LINE account linked successfully', [
            'user_id'      => $userId,
            'line_user_id' => substr($lineAccount->line_user_id, 0, 10) . '...',
            'display_name' => $lineAccount->display_name,
        ]);

        session()->forget('line_oauth_state');
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
