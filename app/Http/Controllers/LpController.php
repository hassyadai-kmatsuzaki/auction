<?php

namespace App\Http\Controllers;

use App\Models\LpCvrSetting;
use Illuminate\Http\Request;

class LpController extends Controller
{
    public function buyer(Request $request)
    {
        return $this->renderLp($request, 'lp-buyer', 'buyer');
    }

    public function seller(Request $request)
    {
        return $this->renderLp($request, 'lp-seller', 'seller');
    }

    private function renderLp(Request $request, string $view, string $lpType)
    {
        $rid = $request->query('rid');
        if (!is_string($rid)) {
            $rid = null;
        }

        $lineUrl = LpCvrSetting::resolveCtaUrl($lpType, $rid);

        return response()
            ->view($view, ['lineUrl' => $lineUrl])
            ->header('X-Robots-Tag', 'noindex, nofollow');
    }
}
