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
        $userId = Auth::id();
        if (!$userId) {
            return response()->json(['success' => false, 'message' => 'ログインが必要です'], 401);
        }

        // 連携後に戻るページ（ホワイトリストで検証）
        $returnTo = $request->input('return_to', '/participant/settings');
        $allowedReturns = ['/participant/settings', '/seller/profile'];
        if (!in_array($returnTo, $allowedReturns, true)) {
            $returnTo = '/participant/settings';
        }

        // state にユーザーIDを埋め込み（コールバック時にセッションが切れていても復元可能）
        $token = Str::random(40);
        $state = base64_encode(json_encode(['token' => $token, 'user_id' => $userId]));

        // キャッシュに保存（セッションはAPIとブラウザで共有されない場合があるため）
        \Illuminate\Support\Facades\Cache::put("line_oauth:{$token}", [
            'user_id' => $userId,
            'return_to' => $returnTo,
        ], now()->addMinutes(10));

        return response()->json([
            'success' => true,
            'data'    => ['url' => $this->lineService->getLoginUrl($state)],
        ]);
    }

    /** LINE Login コールバック（LINEからブラウザにリダイレクトされる） */
    public function callback(Request $request)
    {
        $code     = $request->input('code');
        $stateRaw = $request->input('state');
        $baseUrl  = config('app.frontend_url', config('app.url', ''));

        Log::info('LINE callback received', ['has_code' => !!$code, 'has_state' => !!$stateRaw]);

        // state からユーザーID・戻り先を復元（セッション非依存）
        $userId = null;
        $returnTo = '/participant/settings';
        if ($stateRaw) {
            $decoded = json_decode(base64_decode($stateRaw), true);
            if ($decoded && !empty($decoded['token'])) {
                $cached = \Illuminate\Support\Facades\Cache::pull("line_oauth:{$decoded['token']}");
                if (is_array($cached)) {
                    $userId = $cached['user_id'] ?? null;
                    $returnTo = $cached['return_to'] ?? $returnTo;
                } elseif (is_numeric($cached)) {
                    $userId = (int) $cached;
                }
            }
        }

        if (!$code) {
            return redirect("{$baseUrl}{$returnTo}?line=error&reason=code");
        }

        // キャッシュから取れなかった場合はセッション認証にフォールバック
        if (!$userId) {
            $userId = Auth::guard('web')->id() ?? Auth::id();
        }

        if (!$userId) {
            Log::warning('LINE callback: could not identify user');
            return redirect("{$baseUrl}/login?line=error&reason=auth");
        }

        Log::info('LINE callback: user identified', ['user_id' => $userId]);

        $lineAccount = $this->linkAction->execute($userId, $code);

        if (!$lineAccount) {
            Log::error('LINE callback: linkAction failed', ['user_id' => $userId]);
            return redirect("{$baseUrl}{$returnTo}?line=error&reason=link");
        }

        Log::info('LINE account linked successfully', [
            'user_id'      => $userId,
            'display_name' => $lineAccount->display_name,
        ]);

        return redirect("{$baseUrl}{$returnTo}?line=success");
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
