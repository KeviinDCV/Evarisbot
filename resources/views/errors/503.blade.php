<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>En mantenimiento - Evarisbot HUV</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #1e3a5f 0%, #0f1f3a 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            color: #fff;
            padding: 1rem;
        }
        .container {
            text-align: center;
            max-width: 520px;
        }
        .icon {
            font-size: 4rem;
            margin-bottom: 1.5rem;
            animation: pulse 2s ease-in-out infinite;
        }
        @keyframes pulse {
            0%, 100% { transform: scale(1); }
            50% { transform: scale(1.1); }
        }
        h1 {
            font-size: 1.75rem;
            font-weight: 700;
            margin-bottom: 0.75rem;
            color: #fff;
        }
        p {
            font-size: 1.05rem;
            line-height: 1.6;
            color: #b0c4de;
            margin-bottom: 1rem;
        }
        .badge {
            display: inline-block;
            background: rgba(255,255,255,0.1);
            border: 1px solid rgba(255,255,255,0.2);
            border-radius: 2rem;
            padding: 0.5rem 1.25rem;
            font-size: 0.85rem;
            color: #7eb8e0;
            margin-top: 1rem;
        }
        .badge::before {
            content: '🔄 ';
        }
        .logo {
            margin-top: 2.5rem;
            font-size: 0.8rem;
            color: #5a7a9a;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="icon">🛠️</div>
        <h1>Estamos en mantenimiento</h1>
        <p>Estamos realizando mejoras y ajustes en el sistema para brindarte un mejor servicio. Volveremos en unos minutos.</p>
        <p>Agradecemos tu paciencia.</p>
        <div class="badge">Actualización en curso</div>
        <div class="logo">Evarisbot — Hospital Universitario del Valle 💙</div>
    </div>
</body>
</html>
