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

  const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "ECEME2026";

  // Función para leer la configuración visual persistida
  const getVisualSettings = () => {
    try {
      if (fs.existsSync(DATA_FILE)) {
        const raw = fs.readFileSync(DATA_FILE, 'utf-8');
        const parsed = JSON.parse(raw);
        return {
          ...parsed,
          requiresAuth: true
        };
      }
    } catch (err) {
      console.error('Error al leer visual-settings.json:', err);
    }
    return {
      bgSource: '/fondo-oficial.jpeg',
      bgOpacity: 40,
      bgBlur: 0,
      overlayDarkness: 70,
      iconSource: '/assets/aistudio/ECEME_ESC_cad34ddd.png',
      requiresAuth: true,
      updatedAt: Date.now()
    };
  };

  // Clientes SSE (Server-Sent Events) conectados simultáneamente (Móviles y PCs)
  let sseClients: express.Response[] = [];

  const broadcastSettings = (settings: any) => {
    const payload = `data: ${JSON.stringify(settings)}\n\n`;
    sseClients.forEach((client) => {
      try {
        client.write(payload);
      } catch {}
    });
  };

  // 1. Endpoint GET: Obtener la configuración visual activa en el servidor
  app.get('/api/visual-settings', (_req, res) => {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    const settings = getVisualSettings();
    res.json(settings);
  });

  // 2. Endpoint POST: Verificar contraseña de administrador
  app.post('/api/admin/verify', (req, res) => {
    const { password } = req.body || {};
    if (password === ADMIN_PASSWORD) {
      return res.json({ success: true, message: 'Acceso de administrador autorizado' });
    }
    return res.status(401).json({ success: false, error: 'Contraseña incorrecta. Acceso restringido a administradores autorizados.' });
  });

  // 3. Endpoint POST: Guardar configuración visual protegida con contraseña
  app.post('/api/visual-settings', (req, res) => {
    const providedPassword = (req.headers['x-admin-password'] as string) || req.body?.adminPassword;
    if (providedPassword !== ADMIN_PASSWORD) {
      console.warn('[Security] Intento de modificación no autorizado rechazado');
      return res.status(401).json({
        success: false,
        error: 'Contraseña de administrador incorrecta o ausente. Acción denegada.'
      });
    }

    try {
      const {
        bgSource,
        bgOpacity,
        bgBlur,
        overlayDarkness,
        iconSource
      } = req.body || {};

      let finalBgSource = bgSource;
      let finalIconSource = iconSource;
      let bgUrl = '';
      let iconUrl = '';

      // Persistir fondo si es Base64
      if (bgSource && typeof bgSource === 'string' && bgSource.startsWith('data:image/')) {
        const persistedUrl = persistBase64Image(bgSource, 'custom-background');
        bgUrl = persistedUrl;
        finalBgSource = persistedUrl;
      }

      // Persistir ícono si es Base64
      if (iconSource && typeof iconSource === 'string' && iconSource.startsWith('data:image/')) {
        const persistedUrl = persistBase64Image(iconSource, 'custom-icon');
        iconUrl = persistedUrl;
        finalIconSource = persistedUrl;
      }

      const current = getVisualSettings();
      const newSettings = {
        bgSource: finalBgSource || current.bgSource,
        bgOpacity: typeof bgOpacity === 'number' ? bgOpacity : (current.bgOpacity ?? 50),
        bgBlur: typeof bgBlur === 'number' ? bgBlur : (current.bgBlur ?? 1),
        overlayDarkness: typeof overlayDarkness === 'number' ? overlayDarkness : (current.overlayDarkness ?? 65),
        iconSource: finalIconSource || current.iconSource,
        bgUrl: bgUrl || current.bgUrl || '',
        iconUrl: iconUrl || current.iconUrl || '',
        updatedAt: Date.now()
      };

      fs.writeFileSync(DATA_FILE, JSON.stringify(newSettings, null, 2), 'utf-8');
      console.log('[Admin] Configuración visual actualizada y transmitida a clientes conectados.');

      // Notificar a todos los dispositivos conectados mediante SSE
      broadcastSettings(newSettings);

      return res.json({
        success: true,
        message: 'Configuración visual guardada y transmitida a todos los dispositivos.',
        settings: newSettings
      });
    } catch (err: any) {
      console.error('Error al guardar configuración visual:', err);
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // 4. Endpoint SSE (Server-Sent Events): Transmisión en tiempo real a Móviles y PCs
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
