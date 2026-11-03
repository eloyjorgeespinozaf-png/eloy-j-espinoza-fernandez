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
  const UPLOADS_DIR = path.resolve(__dirname, 'public/uploads');

  // Asegurar que la carpeta de almacenamiento permanente exista
  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  }

  // Servir imágenes subidas de forma estática y permanente con cabeceras de caché
  app.use('/uploads', express.static(UPLOADS_DIR, {
    maxAge: '1d',
    setHeaders: (res) => {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Cache-Control', 'public, max-age=86400');
    }
  }));

  /**
   * Decodifica y guarda una imagen Base64 de forma permanente en el disco del servidor.
   * Retorna la URL estática permanente (ej. /uploads/custom-background.jpg?t=123456789)
   */
  const persistBase64Image = (dataUri: string, filenamePrefix: 'custom-background' | 'custom-icon'): string => {
    if (!dataUri || !dataUri.startsWith('data:image/')) {
      return dataUri;
    }

    try {
      const matches = dataUri.match(/^data:image\/([a-zA-Z0-9+.-]+);base64,(.+)$/);
      if (!matches) {
        return dataUri;
      }

      let ext = matches[1].toLowerCase();
      if (ext === 'svg+xml') ext = 'svg';
      else if (ext === 'jpeg') ext = 'jpg';
      else if (!['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg'].includes(ext)) {
        ext = 'png';
      }

      const base64Data = matches[2];
      const buffer = Buffer.from(base64Data, 'base64');

      // Limpiar versiones previas con el mismo prefijo para evitar acumulación
      try {
        const existingFiles = fs.readdirSync(UPLOADS_DIR);
        for (const file of existingFiles) {
          if (file.startsWith(filenamePrefix)) {
            try {
              fs.unlinkSync(path.join(UPLOADS_DIR, file));
            } catch {}
          }
        }
      } catch {}

      const filename = `${filenamePrefix}.${ext}`;
      const filePath = path.join(UPLOADS_DIR, filename);
      fs.writeFileSync(filePath, buffer);
      console.log(`[Storage] Imagen guardada permanentemente en disco: ${filePath} (${buffer.length} bytes)`);

      return `/uploads/${filename}?t=${Date.now()}`;
    } catch (err) {
      console.error(`[Storage] Error al persistir imagen ${filenamePrefix}:`, err);
      return dataUri;
    }
  };

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
      bgSource: 'tactico',
      bgOpacity: 50,
      bgBlur: 1,
      overlayDarkness: 65,
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

  // 2. Endpoint POST: Subir imagen individual y guardarla en disco de inmediato
  app.post('/api/upload-image', (req, res) => {
    try {
      const { image, type } = req.body || {};
      if (!image || typeof image !== 'string' || !image.startsWith('data:image/')) {
        return res.status(400).json({ error: 'Formato de imagen inválido o ausente.' });
      }
      const prefix = type === 'icon' ? 'custom-icon' : 'custom-background';
      const staticUrl = persistBase64Image(image, prefix);
      res.json({ success: true, url: staticUrl });
    } catch (err) {
      console.error('Error al subir imagen:', err);
      res.status(500).json({ error: String(err) });
    }
  });

  // 3. Endpoint POST: Guardar configuración visual permanentemente en disco y sincronizar
  app.post('/api/visual-settings', (req, res) => {
    try {
      const incoming = req.body || {};
      let bgSource = incoming.bgSource || 'default';
      let iconSource = incoming.iconSource || 'default';

      // Persistir imagen de fondo en disco si es Base64
      if (typeof bgSource === 'string' && bgSource.startsWith('data:image/')) {
        bgSource = persistBase64Image(bgSource, 'custom-background');
      }

      // Persistir ícono en disco si es Base64
      if (typeof iconSource === 'string' && iconSource.startsWith('data:image/')) {
        iconSource = persistBase64Image(iconSource, 'custom-icon');
      }

      const settings = {
        bgSource,
        bgOpacity: typeof incoming.bgOpacity === 'number' ? incoming.bgOpacity : 45,
        bgBlur: typeof incoming.bgBlur === 'number' ? incoming.bgBlur : 0,
        overlayDarkness: typeof incoming.overlayDarkness === 'number' ? incoming.overlayDarkness : 70,
        iconSource,
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
        message: 'Configuración visual guardada permanentemente en disco y transmitida a todos los dispositivos.',
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
