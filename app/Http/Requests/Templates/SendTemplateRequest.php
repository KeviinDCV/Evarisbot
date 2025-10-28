<?php

namespace App\Http\Requests\Templates;

use Illuminate\Foundation\Http\FormRequest;

class SendTemplateRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        return $this->user()->isAdmin();
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, \Illuminate\Contracts\Validation\ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'send_to_all' => ['required', 'boolean'],
            'recipient_ids' => [
                'required_if:send_to_all,false',
                'array',
                'min:1'
            ],
            'recipient_ids.*' => ['integer', 'exists:conversations,id'],
        ];
    }

    /**
     * Get custom messages for validator errors.
     */
    public function messages(): array
    {
        return [
            'send_to_all.required' => 'Debe especificar si enviar a todos o solo a destinatarios seleccionados.',
            'recipient_ids.required_if' => 'Debe seleccionar al menos un destinatario.',
            'recipient_ids.min' => 'Debe seleccionar al menos un destinatario.',
            'recipient_ids.*.exists' => 'Uno o más destinatarios seleccionados no son válidos.',
        ];
    }
}
