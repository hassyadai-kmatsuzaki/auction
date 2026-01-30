<?php

namespace App\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreAuctionRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        return true;
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, \Illuminate\Contracts\Validation\ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'title' => ['required', 'string', 'max:100'],
            'event_date' => ['required', 'date', 'after_or_equal:today'],
            'start_time' => ['nullable', 'date_format:H:i'],
            'description' => ['nullable', 'string', 'max:2000'],
            'lane_count' => ['nullable', 'integer', 'min:1', 'max:10'],
            'countdown_seconds' => ['nullable', 'integer', 'min:5', 'max:120'],
            'bid_increment' => ['nullable', 'numeric', 'min:100'],
            'entry_deadline' => ['nullable', 'date', 'before_or_equal:event_date'],
            'commission_rate' => ['nullable', 'numeric', 'min:0', 'max:50'],
            'payment_deadline_days' => ['nullable', 'integer', 'min:1', 'max:30'],
            'deposit_required' => ['nullable', 'boolean'],
            'deposit_amount' => ['nullable', 'numeric', 'min:0', 'required_if:deposit_required,true'],
            'packing_fee' => ['nullable', 'numeric', 'min:0'],
            'packing_fee_premium' => ['nullable', 'numeric', 'min:0'],
        ];
    }

    /**
     * Get custom messages for validator errors.
     *
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'title.required' => 'オークションタイトルは必須です。',
            'title.max' => 'タイトルは100文字以内で入力してください。',
            'event_date.required' => '開催日は必須です。',
            'event_date.date' => '有効な日付を入力してください。',
            'event_date.after_or_equal' => '開催日は本日以降の日付を指定してください。',
            'start_time.date_format' => '開始時刻はHH:mm形式で入力してください。',
            'description.max' => '説明は2000文字以内で入力してください。',
            'lane_count.min' => 'レーン数は1以上で指定してください。',
            'lane_count.max' => 'レーン数は10以下で指定してください。',
            'countdown_seconds.min' => 'カウントダウン秒数は5秒以上で指定してください。',
            'countdown_seconds.max' => 'カウントダウン秒数は120秒以下で指定してください。',
            'bid_increment.min' => '入札増額単位は100円以上で指定してください。',
            'entry_deadline.before_or_equal' => '出品締切は開催日以前の日付を指定してください。',
            'commission_rate.max' => '手数料率は50%以下で指定してください。',
            'payment_deadline_days.min' => '支払期限は1日以上で指定してください。',
            'payment_deadline_days.max' => '支払期限は30日以内で指定してください。',
            'deposit_amount.required_if' => 'デポジットが必要な場合、金額を指定してください。',
        ];
    }
}
