<?php

namespace App\Http\Requests\Settings;

use App\Models\User;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class ProfileUpdateRequest extends FormRequest
{
    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            // El nombre se permite en cualquier caso (mayúsculas/minúsculas).
            'name' => ['required', 'string', 'max:255'],

            // El email se acepta en cualquier caso: lo normalizamos a minúsculas
            // en prepareForValidation(), así "Kevin@gmail.com" no es rechazado.
            'email' => [
                'required',
                'string',
                'email',
                'max:255',
                Rule::unique(User::class)->ignore($this->user()->id),
            ],
        ];
    }

    /**
     * Normaliza el email a minúsculas antes de validar (estándar para correos),
     * para que el usuario pueda escribirlo en cualquier caso sin error de validación.
     */
    protected function prepareForValidation(): void
    {
        if ($this->has('email')) {
            $this->merge([
                'email' => mb_strtolower(trim((string) $this->input('email'))),
            ]);
        }
    }
}
