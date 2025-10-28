<?php

namespace App\Http\Requests\Templates;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreTemplateRequest extends FormRequest
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
            'name' => ['required', 'string', 'max:255'],
            'subject' => ['nullable', 'string', 'max:255'],
            'content' => ['required', 'string', 'max:4096'],
            'is_active' => ['boolean'],
            'message_type' => ['required', Rule::in(['text', 'image', 'document'])],
            'media_url' => [
                'nullable',
                'string',
                'max:500',
                Rule::requiredIf(fn() => in_array($this->message_type, ['image', 'document']))
            ],
            'media_filename' => [
                'nullable',
                'string',
                'max:255',
                Rule::requiredIf(fn() => in_array($this->message_type, ['image', 'document']))
            ],
        ];
    }

    /**
     * Get custom messages for validator errors.
     */
    public function messages(): array
    {
        return [
            'name.required' => 'El nombre de la plantilla es obligatorio.',
            'name.max' => 'El nombre no puede exceder 255 caracteres.',
            'content.required' => 'El contenido de la plantilla es obligatorio.',
            'content.max' => 'El contenido no puede exceder 4096 caracteres.',
            'message_type.required' => 'El tipo de mensaje es obligatorio.',
            'message_type.in' => 'El tipo de mensaje debe ser: texto, imagen o documento.',
            'media_url.required_if' => 'La URL del archivo es obligatoria para mensajes con imagen o documento.',
            'media_filename.required_if' => 'El nombre del archivo es obligatorio para mensajes con imagen o documento.',
        ];
    }
}
