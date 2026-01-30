<?php

namespace App\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;

class StoreItemRequest extends FormRequest
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
            'seller_profile_id' => ['required', 'exists:seller_profiles,id'],
            'species_name' => ['required', 'string', 'max:100'],
            'quantity' => ['required', 'integer', 'min:1', 'max:100'],
            'start_price' => ['required', 'numeric', 'min:100', 'max:10000000'],
            'estimated_price' => ['nullable', 'numeric', 'min:0', 'gte:start_price'],
            'reserve_price' => ['nullable', 'numeric', 'min:0'],
            'bid_increment' => ['nullable', 'numeric', 'min:100'],
            'inspection_info' => ['nullable', 'string', 'max:1000'],
            'individual_info' => ['nullable', 'string', 'max:2000'],
            'notes' => ['nullable', 'string', 'max:1000'],
            'is_premium' => ['nullable', 'boolean'],
            'premium_fee' => ['nullable', 'numeric', 'min:0', 'required_if:is_premium,true'],
            'unsold_action' => ['nullable', 'string', 'in:return,keep,dispose'],
            'storage_fee' => ['nullable', 'numeric', 'min:0'],
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
            'seller_profile_id.required' => '出品者を選択してください。',
            'seller_profile_id.exists' => '指定された出品者が見つかりません。',
            'species_name.required' => '品種名は必須です。',
            'species_name.max' => '品種名は100文字以内で入力してください。',
            'quantity.required' => '匹数は必須です。',
            'quantity.min' => '匹数は1匹以上で指定してください。',
            'quantity.max' => '匹数は100匹以下で指定してください。',
            'start_price.required' => '開始価格は必須です。',
            'start_price.min' => '開始価格は100円以上で指定してください。',
            'start_price.max' => '開始価格は10,000,000円以下で指定してください。',
            'estimated_price.gte' => '想定落札価格は開始価格以上で指定してください。',
            'bid_increment.min' => '入札増額単位は100円以上で指定してください。',
            'inspection_info.max' => '検品情報は1000文字以内で入力してください。',
            'individual_info.max' => '個体情報は2000文字以内で入力してください。',
            'notes.max' => '備考は1000文字以内で入力してください。',
            'premium_fee.required_if' => 'プレミアム出品の場合、プレミアム料金を指定してください。',
            'unsold_action.in' => '未落札時対応は「返却」「保管」「処分」から選択してください。',
        ];
    }
}
