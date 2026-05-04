<?php

namespace App\Http\Controllers;

use App\Mail\ContactReceivedMail;
use App\Mail\ContactThankYouMail;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;

class ContactController extends Controller
{
    private const ADMIN_RECIPIENTS = [
        'tshort.m.nakakita@gmail.com',
        'k.matsuzaki@beer-o-clock.jp',
    ];

    private const CATEGORY_LABELS = [
        'apply'    => '申込をしたい',
        'demo'     => 'デモを使いたい',
        'question' => '質問したい',
        'other'    => 'その他',
    ];

    public function store(Request $request)
    {
        // ハニーポット: 通常の利用者には見えないフィールド。値が入っていたらボット扱いで握りつぶす。
        if (filled($request->input('website'))) {
            return back()
                ->with('contact_status', 'success')
                ->withFragment('contact');
        }

        $validated = $request->validate([
            'name'     => 'required|string|max:100',
            'email'    => 'required|email:rfc|max:255',
            'phone'    => 'nullable|string|max:30',
            'company'  => 'nullable|string|max:200',
            'category' => 'required|string|in:' . implode(',', array_keys(self::CATEGORY_LABELS)),
            'message'  => 'required|string|max:5000',
        ]);

        // 表示用の日本語ラベルを併せて渡す
        $validated['category_label'] = self::CATEGORY_LABELS[$validated['category']];

        try {
            Mail::to(self::ADMIN_RECIPIENTS)->send(new ContactReceivedMail($validated));
            Mail::to($validated['email'])->send(new ContactThankYouMail($validated));
        } catch (\Throwable $e) {
            Log::error('Contact form mail send failed', [
                'error' => $e->getMessage(),
                'email' => $validated['email'],
            ]);
            return back()
                ->withInput()
                ->with('contact_status', 'error')
                ->withFragment('contact');
        }

        return back()
            ->with('contact_status', 'success')
            ->withFragment('contact');
    }
}
