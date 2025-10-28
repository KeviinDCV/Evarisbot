<?php

namespace App\Http\Controllers;

use App\Services\TwilioService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

class TwilioWebhookController extends Controller
{
    protected $twilioService;

    public function __construct(TwilioService $twilioService)
    {
        $this->twilioService = $twilioService;
    }

    /**
     * Maneja webhooks de mensajes entrantes de Twilio
     */
    public function handleIncoming(Request $request)
    {
        try {
            $data = $request->all();
            
            // Procesar el mensaje entrante
            $this->twilioService->processIncomingMessage($data);

            return response()->json(['status' => 'success']);
        } catch (\Exception $e) {
            Log::error('Error handling Twilio webhook', [
                'error' => $e->getMessage(),
                'data' => $request->all()
            ]);

            return response()->json(['status' => 'error'], 500);
        }
    }

    /**
     * Maneja webhooks de estado de mensajes de Twilio
     */
    public function handleStatus(Request $request)
    {
        try {
            $data = $request->all();
            
            // Procesar actualización de estado
            $this->twilioService->processStatusUpdate($data);

            return response()->json(['status' => 'success']);
        } catch (\Exception $e) {
            Log::error('Error handling Twilio status webhook', [
                'error' => $e->getMessage(),
                'data' => $request->all()
            ]);

            return response()->json(['status' => 'error'], 500);
        }
    }
}
