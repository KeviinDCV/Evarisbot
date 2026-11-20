// Skeletons de carga para la zona de Conversaciones.
// Efecto shimmer inspirado en un mockup de diseño; colores adaptados a la marca
// (grises fríos navy / verdes WhatsApp), nunca morados. La animación vive en app.css
// (.skeleton-shimmer) y respeta prefers-reduced-motion.

// Burbujas alternadas (entrante a la izquierda, propia a la derecha) con anchos/altos
// variados para imitar una conversación real mientras cargan los mensajes.
const CHAT_BUBBLES: { mine: boolean; width: string; height: string }[] = [
    { mine: false, width: '46%', height: '3.5rem' },
    { mine: true, width: '56%', height: '5rem' },
    { mine: false, width: '38%', height: '2.75rem' },
    { mine: true, width: '60%', height: '6.5rem' },
    { mine: false, width: '30%', height: '2.5rem' },
    { mine: true, width: '50%', height: '3.5rem' },
    { mine: false, width: '42%', height: '3rem' },
];

export function ChatMessagesSkeleton() {
    return (
        <div className="space-y-3 py-2" aria-hidden="true">
            {CHAT_BUBBLES.map((b, i) => (
                <div key={i} className={`flex ${b.mine ? 'justify-end' : 'justify-start'}`}>
                    <div
                        className={`skeleton-shimmer rounded-xl ${b.mine ? 'rounded-br-sm' : 'rounded-bl-sm'}`}
                        style={{ width: b.width, height: b.height, maxWidth: '56%' }}
                    />
                </div>
            ))}
        </div>
    );
}

export function ConversationListSkeleton({ rows = 8 }: { rows?: number }) {
    return (
        <div className="px-1 pt-1" aria-hidden="true">
            {Array.from({ length: rows }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 px-3 py-2.5 mb-1">
                    <div className="skeleton-shimmer w-12 h-12 rounded-full flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                        <div
                            className="skeleton-shimmer h-3.5 rounded-md mb-2"
                            style={{ width: `${45 + (i % 3) * 12}%` }}
                        />
                        <div
                            className="skeleton-shimmer h-3 rounded-md"
                            style={{ width: `${68 + (i % 4) * 6}%` }}
                        />
                    </div>
                </div>
            ))}
        </div>
    );
}
