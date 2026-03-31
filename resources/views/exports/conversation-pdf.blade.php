<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <title>Conversación - {{ $conversation->contact_name ?? $conversation->phone_number }}</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: DejaVu Sans, sans-serif; font-size: 11px; color: #1a1c1c; line-height: 1.5; }
        .header { background: #2e3f84; color: white; padding: 20px 30px; margin-bottom: 20px; }
        .header h1 { font-size: 18px; margin-bottom: 4px; }
        .header p { font-size: 11px; opacity: 0.85; }
        .meta { padding: 0 30px; margin-bottom: 20px; }
        .meta table { width: 100%; border-collapse: collapse; }
        .meta td { padding: 4px 8px; font-size: 11px; }
        .meta .label { font-weight: bold; color: #2e3f84; width: 140px; }
        .messages { padding: 0 30px; }
        .message { margin-bottom: 12px; page-break-inside: avoid; }
        .message .bubble { padding: 8px 12px; border-radius: 8px; max-width: 80%; }
        .message.incoming .bubble { background: #f0f0f0; border: 1px solid #e0e0e0; }
        .message.outgoing .bubble { background: #dee1ff; border: 1px solid #c5caff; margin-left: auto; }
        .message .sender { font-size: 9px; font-weight: bold; color: #2e3f84; margin-bottom: 2px; }
        .message .time { font-size: 9px; color: #888; margin-top: 2px; text-align: right; }
        .message .content { font-size: 11px; word-wrap: break-word; }
        .message .media-tag { font-size: 10px; color: #555; font-style: italic; }
        .notes-section { margin-top: 30px; padding: 0 30px; page-break-inside: avoid; }
        .notes-section h3 { font-size: 13px; color: #2e3f84; margin-bottom: 8px; border-bottom: 1px solid #2e3f84; padding-bottom: 4px; }
        .notes-section .notes-content { font-size: 11px; white-space: pre-wrap; background: #fff8e1; padding: 10px; border-radius: 6px; border: 1px solid #ffe082; }
        .footer { margin-top: 30px; padding: 15px 30px; border-top: 1px solid #ddd; font-size: 9px; color: #888; text-align: center; }
        .activity-section { margin-top: 20px; padding: 0 30px; page-break-inside: avoid; }
        .activity-section h3 { font-size: 13px; color: #2e3f84; margin-bottom: 8px; border-bottom: 1px solid #2e3f84; padding-bottom: 4px; }
        .activity-item { font-size: 10px; padding: 3px 0; border-bottom: 1px solid #f0f0f0; }
        .activity-item .activity-time { color: #888; }
    </style>
</head>
<body>
    <div class="header">
        <h1>{{ $conversation->contact_name ?? 'Sin nombre' }} — {{ $conversation->phone_number }}</h1>
        <p>Resumen de conversación · Hospital Universitario del Valle · Evarisbot</p>
    </div>

    <div class="meta">
        <table>
            <tr>
                <td class="label">Estado:</td>
                <td>{{ ucfirst($conversation->status) }}</td>
                <td class="label">Fecha de exportación:</td>
                <td>{{ now()->format('d/m/Y H:i') }}</td>
            </tr>
            <tr>
                <td class="label">Asignado a:</td>
                <td>{{ $conversation->assignedUser?->name ?? 'Sin asignar' }}</td>
                <td class="label">Total mensajes:</td>
                <td>{{ $messages->count() }}</td>
            </tr>
            @if($conversation->resolved_at)
            <tr>
                <td class="label">Resuelto por:</td>
                <td>{{ $conversation->resolvedByUser?->name ?? '—' }}</td>
                <td class="label">Fecha resolución:</td>
                <td>{{ $conversation->resolved_at->format('d/m/Y H:i') }}</td>
            </tr>
            @endif
        </table>
    </div>

    <div class="messages">
        @foreach($messages as $message)
        <div class="message {{ $message->is_from_user ? 'incoming' : 'outgoing' }}">
            <div class="bubble">
                @if(!$message->is_from_user && $message->sender)
                    <div class="sender">{{ $message->sender->name }}</div>
                @endif
                @if(in_array($message->message_type, ['image', 'video', 'audio', 'document']))
                    <div class="media-tag">[{{ ucfirst($message->message_type) }}{{ $message->media_filename ? ': ' . $message->media_filename : '' }}]</div>
                @endif
                @if($message->content)
                    <div class="content">{!! nl2br(e($message->content)) !!}</div>
                @endif
                <div class="time">{{ $message->created_at->format('d/m/Y H:i') }}</div>
            </div>
        </div>
        @endforeach
    </div>

    @if($conversation->notes)
    <div class="notes-section">
        <h3>Notas internas</h3>
        <div class="notes-content">{{ $conversation->notes }}</div>
    </div>
    @endif

    @if($activities->count() > 0)
    <div class="activity-section">
        <h3>Historial de actividad</h3>
        @foreach($activities as $activity)
        <div class="activity-item">
            <span class="activity-time">{{ $activity->created_at->format('d/m H:i') }}</span> —
            {{ $activity->user?->name ?? 'Sistema' }}:
            @switch($activity->type)
                @case('assigned') asignó el chat a {{ $activity->metadata['assigned_to_name'] ?? 'alguien' }} @break
                @case('unassigned') removió la asignación @break
                @case('auto_assigned') tomó el chat automáticamente @break
                @case('resolved') marcó como resuelto @break
                @case('reopened') reabrió la conversación @break
                @case('status_changed') cambió estado a {{ $activity->metadata['new_status'] ?? '' }} @break
                @default {{ $activity->type }}
            @endswitch
        </div>
        @endforeach
    </div>
    @endif

    <div class="footer">
        Generado por Evarisbot · {{ now()->format('d/m/Y H:i:s') }} · Este documento es confidencial
    </div>
</body>
</html>
