<?php
/**
 * Fix bulk send messages that were stored without template preview text.
 * Run: php fix_bulk_messages.php
 */

require __DIR__ . '/vendor/autoload.php';
$app = require_once __DIR__ . '/bootstrap/app.php';
$kernel = $app->make(\Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use App\Models\BulkSend;
use App\Models\BulkSendRecipient;
use App\Models\Message;
use App\Models\WhatsappTemplate;

// Get all templates indexed by meta_template_name
$templates = WhatsappTemplate::pluck('preview_text', 'meta_template_name');

echo "Templates found:\n";
foreach ($templates as $name => $preview) {
    echo "  - {$name}: " . ($preview ? substr($preview, 0, 60) . '...' : 'NO PREVIEW') . "\n";
}

// Find all bulk send messages that only have the label (no newline = no body text)
$messages = Message::where('content', 'LIKE', '[Envío masivo:%')
    ->where('content', 'NOT LIKE', "%\n%")
    ->get();

echo "\nMessages missing preview text: " . $messages->count() . "\n";

$fixed = 0;
foreach ($messages as $message) {
    // Extract the bulk send name from [Envío masivo: NAME]
    if (preg_match('/\[Envío masivo: (.+?)\]/', $message->content, $matches)) {
        $bulkSendName = $matches[1];

        // Find the BulkSend
        $bulkSend = BulkSend::where('name', $bulkSendName)->first();
        if (!$bulkSend) {
            echo "  SKIP: BulkSend '{$bulkSendName}' not found for message #{$message->id}\n";
            continue;
        }

        // Get template preview
        $previewText = $templates[$bulkSend->template_name] ?? '';
        if (!$previewText) {
            echo "  SKIP: No preview text for template '{$bulkSend->template_name}'\n";
            continue;
        }

        // Try to find the recipient by matching phone number via conversation
        $conversation = \App\Models\Conversation::find($message->conversation_id);
        if ($conversation) {
            $phone = preg_replace('/[^0-9]/', '', $conversation->phone_number);
            $recipient = BulkSendRecipient::where('bulk_send_id', $bulkSend->id)
                ->where(function ($q) use ($phone) {
                    $q->where('phone_number', 'LIKE', '%' . substr($phone, -10) . '%');
                })
                ->first();

            // Build param values from recipient
            $paramValues = [];
            if ($recipient && !empty($recipient->params) && is_array($recipient->params)) {
                $paramValues[] = $recipient->contact_name ?? '';
                foreach ($recipient->params as $value) {
                    $paramValues[] = $value;
                }
            } elseif (!empty($bulkSend->template_params)) {
                $paramValues = $bulkSend->template_params;
            }

            // Replace placeholders
            if (!empty($paramValues)) {
                foreach ($paramValues as $index => $paramValue) {
                    $placeholder = '{{' . ($index + 1) . '}}';
                    $previewText = str_replace($placeholder, (string) $paramValue, $previewText);
                }
            }
        }

        $newContent = $message->content . "\n" . $previewText;
        $message->update(['content' => $newContent]);
        $fixed++;
    }
}

echo "\nFixed: {$fixed} messages\n";
echo "Done!\n";
