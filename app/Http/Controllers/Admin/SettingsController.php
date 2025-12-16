<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Setting;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;

class SettingsController extends Controller
{
    /**
     * Mostrar la página de configuración
     */
    public function index()
    {
        $settings = [
            'whatsapp' => [
                'token' => Setting::getPreview('whatsapp_token'),
                'phone_id' => Setting::get('whatsapp_phone_id'),
                'business_account_id' => Setting::get('whatsapp_business_account_id'),
                'verify_token' => Setting::getPreview('whatsapp_verify_token'),
                'webhook_url' => Setting::get('whatsapp_webhook_url'),
                'is_configured' => Setting::has('whatsapp_token') && Setting::has('whatsapp_phone_id'),
            ],
        ];

        // Obtener asesores para la sección de turnos
        $advisors = User::where('role', 'advisor')
            ->select('id', 'name', 'email', 'is_on_duty')
            ->orderBy('name')
            ->get();

        return Inertia::render('admin/settings/index', [
            'settings' => $settings,
            'advisors' => $advisors,
        ]);
    }

    /**
     * Actualizar configuración de WhatsApp
     */
    public function updateWhatsApp(Request $request)
    {
        $validated = $request->validate([
            'whatsapp_token' => 'nullable|string|min:20',
            'whatsapp_phone_id' => 'nullable|numeric|digits_between:10,20',
            'whatsapp_business_account_id' => 'nullable|numeric|digits_between:10,20',
            'whatsapp_verify_token' => 'nullable|string|min:8',
        ]);

        // Si se proporciona un token, verificar que sea válido
        if (!empty($validated['whatsapp_token'])) {
            $isValid = $this->verifyWhatsAppToken($validated['whatsapp_token']);
            
            if (!$isValid) {
                throw ValidationException::withMessages([
                    'whatsapp_token' => 'El token de WhatsApp no es válido o ha expirado.',
                ]);
            }
        }

        // Guardar configuraciones
        if (isset($validated['whatsapp_token'])) {
            Setting::set('whatsapp_token', $validated['whatsapp_token'], 'Token de acceso de WhatsApp Business API');
        }

        if (isset($validated['whatsapp_phone_id'])) {
            Setting::set('whatsapp_phone_id', $validated['whatsapp_phone_id'], 'ID del número de teléfono de WhatsApp');
        }

        if (isset($validated['whatsapp_business_account_id'])) {
            Setting::set('whatsapp_business_account_id', $validated['whatsapp_business_account_id'], 'ID de la cuenta de WhatsApp Business');
        }

        if (isset($validated['whatsapp_verify_token'])) {
            Setting::set('whatsapp_verify_token', $validated['whatsapp_verify_token'], 'Token de verificación del webhook');
        }

        return redirect()->back()->with('success', 'Configuración de WhatsApp actualizada exitosamente.');
    }

    /**
     * Verificar si el token de WhatsApp es válido
     */
    private function verifyWhatsAppToken(string $token): bool
    {
        try {
            $response = Http::withToken($token)
                ->timeout(10)
                ->get('https://graph.facebook.com/v18.0/me');

            return $response->successful();
        } catch (\Exception $e) {
            return false;
        }
    }

    /**
     * Obtener información del perfil de WhatsApp Business
     */
    public function getBusinessProfile()
    {
        $token = Setting::get('whatsapp_token');
        $phoneId = Setting::get('whatsapp_phone_id');

        if (empty($token) || empty($phoneId)) {
            return response()->json([
                'success' => false,
                'message' => 'WhatsApp API not configured.',
            ], 400);
        }

        try {
            $response = Http::withToken($token)
                ->timeout(10)
                ->get("https://graph.facebook.com/v18.0/{$phoneId}", [
                    'fields' => 'id,verified_name,code_verification_status,display_phone_number,quality_rating,messaging_limit_tier'
                ]);

            if ($response->successful()) {
                $data = $response->json();
                return response()->json([
                    'success' => true,
                    'profile' => [
                        'business_name' => $data['verified_name'] ?? 'N/A',
                        'phone_number' => $data['display_phone_number'] ?? 'N/A',
                        'phone_number_id' => $data['id'] ?? 'N/A',
                        'verified' => ($data['code_verification_status'] ?? 'NOT_VERIFIED') === 'VERIFIED',
                        'quality_rating' => $data['quality_rating'] ?? 'UNKNOWN',
                        'messaging_limit' => $data['messaging_limit_tier'] ?? 'TIER_NOT_SET',
                    ],
                ]);
            }

            return response()->json([
                'success' => false,
                'message' => 'Unable to fetch business profile.',
            ], 400);

        } catch (\Exception $e) {
            Log::error('Get business profile error', ['error' => $e->getMessage()]);
            return response()->json([
                'success' => false,
                'message' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Probar la conexión con WhatsApp
     */
    public function testWhatsAppConnection()
    {
        $token = Setting::get('whatsapp_token');
        $phoneId = Setting::get('whatsapp_phone_id');

        if (empty($token) || empty($phoneId)) {
            return response()->json([
                'success' => false,
                'message' => 'No se han configurado las credenciales de WhatsApp.',
            ], 400);
        }

        try {
            // Verificar el token
            $response = Http::withToken($token)
                ->timeout(10)
                ->get('https://graph.facebook.com/v18.0/me');

            if ($response->successful()) {
                return response()->json([
                    'success' => true,
                    'message' => 'Conexión exitosa con WhatsApp Business API.',
                    'data' => $response->json(),
                ]);
            }

            return response()->json([
                'success' => false,
                'message' => 'No se pudo conectar con WhatsApp. Verifica tus credenciales.',
            ], 400);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error al conectar: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Actualizar asesores de turno
     */
    public function updateOnDutyAdvisors(Request $request)
    {
        $validated = $request->validate([
            'advisor_ids' => 'present|array',
            'advisor_ids.*' => 'integer|exists:users,id',
        ]);

        // Desactivar todos los asesores primero
        User::where('role', 'advisor')->update(['is_on_duty' => false]);

        // Activar solo los seleccionados
        if (!empty($validated['advisor_ids'])) {
            User::whereIn('id', $validated['advisor_ids'])
                ->where('role', 'advisor')
                ->update(['is_on_duty' => true]);
        }

        return redirect()->back()->with('success', 'Asesores de turno actualizados exitosamente.');
    }
}
