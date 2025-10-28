<?php

namespace App\Jobs;

use App\Models\Conversation;
use App\Models\Template;
use App\Models\TemplateSend;
use App\Services\TemplateSendService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;

class SendTemplateMessageJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public $timeout = 600; // 10 minutos
    public $tries = 1;

    /**
     * Create a new job instance.
     */
    public function __construct(
        public TemplateSend $templateSend,
        public array $conversationIds
    ) {}

    /**
     * Execute the job.
     */
    public function handle(TemplateSendService $service): void
    {
        Log::info('Starting template send job', [
            'template_send_id' => $this->templateSend->id,
            'total_recipients' => count($this->conversationIds),
        ]);

        // Marcar como en progreso
        $this->templateSend->markAsInProgress();

        $template = $this->templateSend->template;

        // Procesar envíos en lotes de 10 para evitar sobrecarga
        $batches = array_chunk($this->conversationIds, 10);

        foreach ($batches as $batch) {
            foreach ($batch as $conversationId) {
                $conversation = Conversation::find($conversationId);

                if (!$conversation) {
                    $this->templateSend->incrementFailed();
                    continue;
                }

                // Enviar mensaje
                $result = $service->sendToRecipient($template, $conversation);

                // Actualizar contadores
                if ($result['success']) {
                    $this->templateSend->incrementSuccessful();
                } else {
                    $this->templateSend->incrementFailed();
                }

                // Delay de 1 segundo entre mensajes para respetar rate limits
                sleep(1);
            }

            // Delay de 2 segundos entre lotes
            sleep(2);
        }

        // Marcar como completado
        $this->templateSend->markAsCompleted();

        Log::info('Template send job completed', [
            'template_send_id' => $this->templateSend->id,
            'successful' => $this->templateSend->successful_sends,
            'failed' => $this->templateSend->failed_sends,
        ]);
    }

    /**
     * Handle a job failure.
     */
    public function failed(\Throwable $exception): void
    {
        Log::error('Template send job failed', [
            'template_send_id' => $this->templateSend->id,
            'error' => $exception->getMessage(),
        ]);

        $this->templateSend->markAsFailed();
    }
}
