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

  // Función para leer la configuración visual persistida y bloqueada
  const getVisualSettings = () => {
    try {
      if (fs.existsSync(DATA_FILE)) {
        const raw = fs.readFileSync(DATA_FILE, 'utf-8');
        const parsed = JSON.parse(raw);
        return {
          ...parsed,
          locked: true,
          status: 'PERMANENTEMENTE_BLOQUEADO'
        };
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
      locked: true,
      status: 'PERMANENTEMENTE_BLOQUEADO',
      updatedAt: 1793695593030
    };
  };

  // Clientes SSE (Server-Sent Events) conectados simultáneamente (Móviles y PCs)
  let sseClients: express.Response[] = [];

  // 1. Endpoint GET: Obtener la configuración visual activa en el servidor (Lectura Oficial)
  app.get('/api/visual-settings', (_req, res) => {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    const settings = getVisualSettings();
    res.json(settings);
  });

  // 2. Endpoint POST: Subir imagen (BLOQUEADO PERMANENTEMENTE POR ORDEN INSTITUCIONAL)
  app.post('/api/upload-image', (_req, res) => {
    console.warn('[Security] Intento de subida de imagen rechazado: Las imágenes están fijadas de forma permanente.');
    res.status(403).json({
      success: false,
      locked: true,
      error: 'Las imágenes institucionales de la ECEME han sido fijadas de forma permanente. No se permiten más modificaciones en las imágenes.'
    });
  });

  // 3. Endpoint POST: Modificar configuración visual (BLOQUEADO PERMANENTEMENTE)
  app.post('/api/visual-settings', (_req, res) => {
    console.warn('[Security] Intento de cambio visual rechazado: Las imágenes están fijadas de forma permanente.');
    res.status(403).json({
      success: false,
      locked: true,
      error: 'Las imágenes institucionales de la ECEME están bloqueadas permanentemente. No se permiten más cambios en las imágenes ni en los íconos.'
    });
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
