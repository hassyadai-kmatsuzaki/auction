<x-mail::message>
{!! \Illuminate\Support\Str::markdown($bodyMarkdown, ['renderer' => ['soft_break' => "<br>\n"]]) !!}
</x-mail::message>
