import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = process.env.PORT || 3000;

  // Middleware con límite extendido para imágenes de fondo y escudos en Base64
  app.use(express.json({ limit: '25mb' }));
  app.use(express.urlencoded({ extended: true, limit: '25mb' }));

  const DATA_FILE = path.resolve(__dirname, 'visual-settings.json');

  // Función para leer la configuración visual persistida
  const getVisualSettings = () => {
    try {
      if (fs.existsSync(DATA_FILE)) {
        const raw = fs.readFileSync(DATA_FILE, 'utf-8');
        return JSON.parse(raw);
      }
    } catch (err) {
      console.error('Error al leer visual-settings.json:', err);
    }
    return {
      bgSource: 'default',
      bgOpacity: 45,
      bgBlur: 0,
      overlayDarkness: 70,
      iconSource: 'default',
      updatedAt: Date.now()
    };
  };

  // Clientes SSE (Server-Sent Events) conectados simultáneamente (Móviles y PCs)
  let sseClients: express.Response[] = [];

  // 1. Endpoint GET: Obtener la configuración visual activa en el servidor
  app.get('/api/visual-settings', (_req, res) => {
    res.setHeader('Cache-Control', 'no-cache');
    const settings = getVisualSettings();
    res.json(settings);
  });

  // 2. Endpoint POST: Guardar y sincronizar en tiempo real para todos los dispositivos
  app.post('/api/visual-settings', (req, res) => {
    try {
      const incoming = req.body || {};
      const settings = {
        bgSource: incoming.bgSource || 'default',
        bgOpacity: typeof incoming.bgOpacity === 'number' ? incoming.bgOpacity : 45,
        bgBlur: typeof incoming.bgBlur === 'number' ? incoming.bgBlur : 0,
        overlayDarkness: typeof incoming.overlayDarkness === 'number' ? incoming.overlayDarkness : 70,
        iconSource: incoming.iconSource || 'default',
        bgUrl: incoming.bgUrl || '',
        iconUrl: incoming.iconUrl || '',
        updatedAt: Date.now()
      };

      fs.writeFileSync(DATA_FILE, JSON.stringify(settings, null, 2), 'utf-8');

      // Notificar a todos los dispositivos móviles y PCs en tiempo real
      const message = `data: ${JSON.stringify(settings)}\n\n`;
      sseClients.forEach((client) => {
        try {
          client.write(message);
        } catch {
          // Conexión cerrada
        }
      });

      res.json({
        success: true,
        message: 'Configuración visual actualizada y transmitida a todos los dispositivos.',
        settings
      });
    } catch (err) {
      console.error('Error al guardar configuración visual:', err);
      res.status(500).json({ error: String(err) });
    }
  });

  // 3. Endpoint SSE (Server-Sent Events): Transmisión en tiempo real
  app.get('/api/visual-settings/stream', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.flushHeaders?.();

    // Enviar configuración inicial inmediata al dispositivo recién conectado
    const currentSettings = getVisualSettings();
    res.write(`data: ${JSON.stringify(currentSettings)}\n\n`);

    sseClients.push(res);

    req.on('close', () => {
      sseClients = sseClients.filter((client) => client !== res);
    });
  });

  const isProduction = process.env.NODE_ENV === 'production';

  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR !== 'true',
        watch: process.env.DISABLE_HMR === 'true' ? null : {},
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(Number(PORT), '0.0.0.0', () => {
    console.log(`[ECEME 10KM] Servidor en línea en http://0.0.0.0:${PORT}`);
  });
}

startServer();
