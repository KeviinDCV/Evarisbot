<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Error del servidor - Evarisbot HUV</title>
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
        .container { text-align: center; max-width: 520px; }
        .icon { margin-bottom: 2rem; }
        .icon img { width: 200px; height: 200px; object-fit: contain; filter: drop-shadow(0 4px 12px rgba(0,0,0,0.3)); }
        .code { font-size: 5rem; font-weight: 800; color: rgba(255,255,255,0.15); line-height: 1; margin-bottom: 0.5rem; }
        h1 { font-size: 1.75rem; font-weight: 700; margin-bottom: 0.75rem; color: #fff; }
        p { font-size: 1.05rem; line-height: 1.6; color: #b0c4de; margin-bottom: 1rem; }
        .btn {
            display: inline-block;
            background: rgba(255,255,255,0.12);
            border: 1px solid rgba(255,255,255,0.25);
            border-radius: 2rem;
            padding: 0.65rem 1.75rem;
            font-size: 0.95rem;
            color: #fff;
            text-decoration: none;
            margin-top: 1rem;
            transition: background 0.2s;
        }
        .btn:hover { background: rgba(255,255,255,0.2); }
        .logo { margin-top: 2.5rem; font-size: 0.8rem; color: #5a7a9a; }
    </style>
</head>
<body>
    <div class="container">
        <div class="icon"><img src="/images/favicon.png" alt="Hospital Universitario del Valle"></div>
        <div class="code">500</div>
        <h1>Error del servidor</h1>
        <p>Ocurrió un error inesperado. Nuestro equipo técnico ha sido notificado. Por favor intenta de nuevo en unos minutos.</p>
        <a href="/admin/dashboard" class="btn">← Volver al inicio</a>
        <div class="logo">Evarisbot — Hospital Universitario del Valle</div>
    </div>
</body>
</html>
