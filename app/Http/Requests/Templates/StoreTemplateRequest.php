<?php

namespace App\Http\Requests\Templates;

use Illuminate\Foundation\Http\FormRequest;

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
            'content' => ['required', 'string', 'max:4096'],
            'is_active' => ['boolean'],
            'is_global' => ['boolean'],
            'assigned_users' => ['array'],
            'assigned_users.*' => ['integer', 'exists:users,id'],
            // El archivo multimedia es opcional
            'media_file' => [
                'nullable',
                'file',
                'mimes:jpg,jpeg,png,gif,webp,mp4,mov,avi,3gp,pdf,doc,docx',
                'max:20480', // 20MB máximo
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
            'content.required' => 'El mensaje de la plantilla es obligatorio.',
            'content.max' => 'El mensaje no puede exceder 4096 caracteres.',
            'media_file.file' => 'El archivo adjunto debe ser un archivo válido.',
            'media_file.mimes' => 'El archivo debe ser: imagen (jpg, png, gif, webp), video (mp4, mov, avi, 3gp) o documento (pdf, doc, docx).',
            'media_file.max' => 'El archivo no puede exceder 20MB.',
        ];
    }
}
