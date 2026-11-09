import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = process.env.PORT || 3000;

  // Middleware de CORS para permitir peticiones desde cualquier dispositivo, móvil o iframe
  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-admin-password');
    if (req.method === 'OPTIONS') {
      return res.sendStatus(200);
    }
    next();
  });

  // Middleware con límite extendido para imágenes de fondo, comprobantes y capturas de cédula en Base64
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));

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
      bgSource: '/assets/aistudio/WhatsApp_Image_2026-11-09_at_08.23.27_b10092cb.jpeg',
      bgOpacity: 88,
      bgBlur: 0,
      overlayDarkness: 28,
      iconSource: '/assets/aistudio/WhatsApp_Image_2026-11-08_at_17.32.07_26f348b5.jpeg',
      qrSource: '/qr-oficial.png',
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

  const COUNTERS_FILE = path.resolve(__dirname, 'category-counters.json');

  const CATEGORY_CONFIG: Record<string, { start: number; end: number; prefix: string; name: string }> = {
    'A': { start: 1001, end: 1999, prefix: 'A-', name: 'Juvenil (14-17 años)' },
    'B': { start: 2001, end: 2999, prefix: 'B-', name: 'Mayores (18-29 años)' },
    'C': { start: 3001, end: 3999, prefix: 'C-', name: 'Master A (30-37 años)' },
    'D': { start: 4001, end: 4999, prefix: 'D-', name: 'Master B (38-45 años)' },
    'E': { start: 5001, end: 5999, prefix: 'E-', name: 'Master C (46+ años)' },
    'F': { start: 6001, end: 6999, prefix: 'F-', name: 'Militar Soldados / Premilitares' },
    'G': { start: 7001, end: 7999, prefix: 'G-', name: 'Militar y Policial "A" (Formación)' },
    'H': { start: 8001, end: 8999, prefix: 'H-', name: 'Militar y Policial "B" (Hasta 15 años)' },
    'I': { start: 9001, end: 9999, prefix: 'I-', name: 'Militar y Policial "C" (16+ años)' },
    'J': { start: 401, end: 499, prefix: 'J-', name: 'Niñas y Niños U-4 (80m)' },
    'K': { start: 601, end: 699, prefix: 'K-', name: 'Niñas y Niños U-6 (200m)' },
    'L': { start: 801, end: 899, prefix: 'L-', name: 'Niñas y Niños U-8 (400m)' },
    'M': { start: 1301, end: 1399, prefix: 'M-', name: 'Niñas y Niños U-13 (1000m)' }
  };

  const getCounters = (): Record<string, number> => {
    try {
      if (fs.existsSync(COUNTERS_FILE)) {
        return JSON.parse(fs.readFileSync(COUNTERS_FILE, 'utf-8'));
      }
    } catch {}
    const defaults: Record<string, number> = {};
    for (const [key, cfg] of Object.entries(CATEGORY_CONFIG)) {
      defaults[key] = cfg.start - 1;
    }
    return defaults;
  };

  const GOOGLE_SCRIPT_URL = process.env.GOOGLE_SCRIPT_URL || "https://script.google.com/macros/s/AKfycbzVTUS3K8HbkolL0l1kPlQYxyAkkKzb5snKNMCnvhKEBZEgsTaIbz4QH3IMaK0gzbhs_Q/exec";

  function extractCatCode(str?: string): string {
    if (!str) return 'A';
    const s = str.trim().toUpperCase();
    if (/^[A-M]$/.test(s)) return s;
    const m = s.match(/^\[?([A-M])[\.\-\)\s]/);
    if (m) return m[1];
    const m2 = s.match(/CATEGOR[IÍ]A\s+([A-M])\b/);
    if (m2) return m2[1];
    const first = s.charAt(0);
    if (first >= 'A' && first <= 'M') return first;
    return 'A';
  }

  // Endpoint para consultar contadores y rangos por categoría
  app.get('/api/dorsal/stats', (_req, res) => {
    const counters = getCounters();
    const stats: Record<string, any> = {};
    for (const [code, cfg] of Object.entries(CATEGORY_CONFIG)) {
      const cur = counters[code] ?? (cfg.start - 1);
      const nextNum = (cur < cfg.start - 1 || cur >= cfg.end) ? cfg.start : (cur + 1);
      stats[code] = {
        code,
        name: cfg.name,
        prefix: cfg.prefix,
        start: cfg.start,
        end: cfg.end,
        range: `${String(cfg.start).padStart(4, '0')} - ${String(cfg.end).padStart(4, '0')}`,
        currentNumber: cur,
        nextDorsal: `${cfg.prefix}${String(nextNum).padStart(4, '0')}`
      };
    }
    res.json({ success: true, counters, stats, config: CATEGORY_CONFIG });
  });

  // Endpoint para obtener el código backend actualizado de Google Apps Script (Code.gs)
  app.get('/api/script/code', (_req, res) => {
    try {
      const scriptPath = path.resolve(__dirname, 'Code.gs');
      if (fs.existsSync(scriptPath)) {
        const code = fs.readFileSync(scriptPath, 'utf-8');
        return res.json({ success: true, code });
      }
      return res.status(404).json({ success: false, error: 'Code.gs no encontrado' });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // Endpoint atómico para reservar el siguiente dorsal según la categoría
  // Función para sincronizar contadores con los registros reales de Google Sheets
  const syncCountersWithGoogleSheets = async () => {
    if (!GOOGLE_SCRIPT_URL || GOOGLE_SCRIPT_URL.includes('SU_URL_DE_APPS_SCRIPT_AQUI')) return;
    try {
      const res = await fetch(`${GOOGLE_SCRIPT_URL}?action=get_counters`, {
        signal: AbortSignal.timeout(12000)
      });
      if (res.ok) {
        const data: any = await res.json();
        if (data && data.status === 'success' && data.categories) {
          const counters = getCounters();
          let modified = false;
          for (const [code, info] of Object.entries(data.categories as Record<string, any>)) {
            const cfg = CATEGORY_CONFIG[code];
            if (!cfg) continue;
            const remoteNext = info.nextNumber || (info.nextDorsal ? parseInt(info.nextDorsal.replace(/\D/g, ''), 10) : cfg.start);
            const remoteLast = remoteNext - 1;
            if (remoteLast >= cfg.start - 1 && remoteLast <= cfg.end) {
              if (counters[code] !== remoteLast) {
                counters[code] = remoteLast;
                modified = true;
              }
            }
          }
          if (modified) {
            fs.writeFileSync(COUNTERS_FILE, JSON.stringify(counters, null, 2), 'utf-8');
            console.log('[CounterSync] Contadores sincronizados exactamente con Google Sheets:', counters);
          }
        }
      }
    } catch (err) {
      console.warn('[CounterSync] Aviso al sincronizar contadores con Google Sheets:', err);
    }
  };

  // Sincronización al iniciar y periódicamente cada 30 segundos
  setTimeout(syncCountersWithGoogleSheets, 1500);
  setInterval(syncCountersWithGoogleSheets, 30000);

  // Endpoint atómico para consultar o reservar el siguiente dorsal según la categoría
  app.post('/api/dorsal/next', async (req, res) => {
    try {
      const { categoryCode } = req.body || {};
      const code = extractCatCode(categoryCode);
      const cfg = CATEGORY_CONFIG[code] || CATEGORY_CONFIG['A'];

      // Consultar el próximo dorsal directamente de Google Sheets si está disponible
      if (GOOGLE_SCRIPT_URL && !GOOGLE_SCRIPT_URL.includes('SU_URL_DE_APPS_SCRIPT_AQUI')) {
        try {
          const gasRes = await fetch(`${GOOGLE_SCRIPT_URL}?action=get_next_dorsal&category=${code}`, {
            signal: AbortSignal.timeout(6000)
          });
          if (gasRes.ok) {
            const gasData: any = await gasRes.json();
            if (gasData && gasData.status === 'success' && gasData.dorsal) {
              const gasNum = gasData.number || gasData.dorsal.replace(cfg.prefix, '');
              const numVal = parseInt(gasNum, 10);
              if (!isNaN(numVal)) {
                const counters = getCounters();
                counters[code] = numVal;
                fs.writeFileSync(COUNTERS_FILE, JSON.stringify(counters, null, 2), 'utf-8');
              }
              return res.json({
                success: true,
                dorsal: gasData.dorsal,
                prefix: cfg.prefix,
                number: gasNum,
                categoryCode: code,
                range: `${String(cfg.start).padStart(4, '0')} - ${String(cfg.end).padStart(4, '0')}`,
                categoryName: cfg.name
              });
            }
          }
        } catch (e) {}
      }

      const counters = getCounters();
      let current = counters[code] ?? (cfg.start - 1);
      if (current < cfg.start - 1 || current >= cfg.end) {
        current = cfg.start - 1;
      }
      current += 1;
      counters[code] = current;
      fs.writeFileSync(COUNTERS_FILE, JSON.stringify(counters, null, 2), 'utf-8');

      const paddedNumber = String(current).padStart(4, '0');
      const dorsal = `${cfg.prefix}${paddedNumber}`;

      return res.json({
        success: true,
        dorsal,
        prefix: cfg.prefix,
        number: paddedNumber,
        categoryCode: code,
        range: `${String(cfg.start).padStart(4, '0')} - ${String(cfg.end).padStart(4, '0')}`,
        categoryName: cfg.name
      });
    } catch (err: any) {
      console.error('Error asignando dorsal:', err);
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // Endpoint principal de registro e inscripción sincronizado DIRECTAMENTE con Google Sheets
  app.post('/api/inscribir', async (req, res) => {
    try {
      const payload = req.body || {};
      const catCode = extractCatCode(payload.categoria || payload.categoryCode);
      const cfg = CATEGORY_CONFIG[catCode] || CATEGORY_CONFIG['A'];

      // Preparar payload hacia Google Apps Script
      // No imponemos un dorsal obsoleto; Google Apps Script, mediante LockService y lectura
      // de la hoja activa en tiempo real, asigna e inserta el correlativo oficial inalterable.
      const gasPayload = {
        nombres: payload.nombres || '',
        ci: payload.ci || '',
        celular: payload.celular || '',
        unidad: payload.unidad || '',
        categoria: payload.categoria || cfg.name,
        genero: payload.genero || 'NO APLICA',
        dorsal: payload.dorsal || '', // Si viene vacío, GAS calcula el siguiente correlativo oficial en la hoja
        capturaCedula: payload.capturaCedula || '',
        nombreArchivoCedula: payload.nombreArchivoCedula || '',
        comprobante: payload.comprobante || '',
        nombreArchivo: payload.nombreArchivo || ''
      };

      let assignedDorsal = '';
      let paddedNumber = '';
      let fileUrl = '';
      let fileCedulaUrl = '';

      // 1. TRANSMISIÓN PRIMARIA Y AUTORITATIVA A GOOGLE APPS SCRIPT (Fuente Oficial)
      if (GOOGLE_SCRIPT_URL && !GOOGLE_SCRIPT_URL.includes('SU_URL_DE_APPS_SCRIPT_AQUI')) {
        try {
          console.log(`[Google Sheets] Transmitiendo inscripción oficial (${payload.nombres} - Cat ${catCode})...`);
          const gasRes = await fetch(GOOGLE_SCRIPT_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify(gasPayload),
            signal: AbortSignal.timeout(42000)
          });

          if (gasRes.ok) {
            const gasData: any = await gasRes.json().catch(() => ({}));
            console.log(`[Google Sheets REGISTRADO] Confirmado en Google Sheets:`, gasData);
            if (gasData && gasData.status === 'success' && gasData.dorsal) {
              // USAR EL DORSAL OFICIAL QUE GOOGLE SHEETS ESCRIBIÓ EN LA CELDA DE LA HOJA
              assignedDorsal = String(gasData.dorsal).trim();
              const numMatch = assignedDorsal.match(/\d+/);
              paddedNumber = numMatch ? String(numMatch[0]).padStart(4, '0') : (gasData.number ? String(gasData.number).padStart(4, '0') : '');
              const numVal = parseInt(paddedNumber, 10);
              if (!isNaN(numVal)) {
                const counters = getCounters();
                counters[catCode] = Math.max(counters[catCode] || 0, numVal);
                fs.writeFileSync(COUNTERS_FILE, JSON.stringify(counters, null, 2), 'utf-8');
              }
              fileUrl = gasData.fileUrl || '';
              fileCedulaUrl = gasData.fileCedulaUrl || '';

              return res.json({
                success: true,
                dorsal: assignedDorsal,
                number: paddedNumber,
                prefix: cfg.prefix,
                categoryCode: catCode,
                categoryName: cfg.name,
                range: `${String(cfg.start).padStart(4, '0')} - ${String(cfg.end).padStart(4, '0')}`,
                fileUrl,
                fileCedulaUrl
              });
            }
          }
        } catch (gasErr) {
          console.error('[Google Sheets Error en transmisión]:', gasErr);
        }
      }

      // 2. CONTINGENCIA LOCAL (Solo en caso de desconexión total con Google Apps Script)
      console.warn('[Inscribir] Activando contingencia local por falta de respuesta remota');
      const counters = getCounters();
      let lastRecorded = counters[catCode] ?? (cfg.start - 1);
      if (lastRecorded < cfg.start - 1 || lastRecorded >= cfg.end) {
        lastRecorded = cfg.start - 1;
      }
      const assignedNum = lastRecorded + 1;
      counters[catCode] = assignedNum;
      fs.writeFileSync(COUNTERS_FILE, JSON.stringify(counters, null, 2), 'utf-8');

      paddedNumber = String(assignedNum).padStart(4, '0');
      assignedDorsal = `${cfg.prefix}${paddedNumber}`;

      // Enviar en background a Google Sheets para que la fila no se pierda
      if (GOOGLE_SCRIPT_URL && !GOOGLE_SCRIPT_URL.includes('SU_URL_DE_APPS_SCRIPT_AQUI')) {
        fetch(GOOGLE_SCRIPT_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({ ...gasPayload, dorsal: assignedDorsal })
        }).catch(() => {});
      }

      return res.json({
        success: true,
        dorsal: assignedDorsal,
        number: paddedNumber,
        prefix: cfg.prefix,
        categoryCode: catCode,
        categoryName: cfg.name,
        range: `${String(cfg.start).padStart(4, '0')} - ${String(cfg.end).padStart(4, '0')}`,
        fileUrl,
        fileCedulaUrl
      });
    } catch (err: any) {
      console.error('[Inscribir] Error en registro:', err);
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // Endpoint de administración para sincronizar o ajustar contadores manualmente
  app.post('/api/dorsal/update-counter', (req, res) => {
    const providedPassword = (req.headers['x-admin-password'] as string) || req.body?.adminPassword;
    if (providedPassword !== ADMIN_PASSWORD) {
      return res.status(401).json({ success: false, error: 'No autorizado' });
    }
    const { categoryCode, nextValue } = req.body || {};
    const code = extractCatCode(categoryCode);
    const cfg = CATEGORY_CONFIG[code];
    if (!cfg) return res.status(400).json({ success: false, error: 'Categoría inválida' });

    const val = parseInt(nextValue, 10);
    if (isNaN(val) || val < cfg.start || val > cfg.end) {
      return res.status(400).json({ success: false, error: `El número debe estar entre ${cfg.start} y ${cfg.end}` });
    }

    const counters = getCounters();
    counters[code] = val - 1; // Para que el próximo asignado sea exactamente val
    fs.writeFileSync(COUNTERS_FILE, JSON.stringify(counters, null, 2), 'utf-8');

    return res.json({
      success: true,
      message: `Categoría ${code} (${cfg.name}) ajustada. El próximo dorsal será ${cfg.prefix}${String(val).padStart(4, '0')}`,
      nextDorsal: `${cfg.prefix}${String(val).padStart(4, '0')}`,
      counters
    });
  });

  // Health check endpoints para pre-warming y balanceador de carga
  app.get(['/health', '/api/health'], (_req, res) => {
    res.status(200).json({ status: 'ok', uptime: process.uptime(), timestamp: Date.now() });
  });

  // 4. Endpoint SSE (Server-Sent Events): Transmisión en tiempo real a Móviles y PCs
  app.get('/api/visual-settings/stream', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.flushHeaders?.();

    // Enviar configuración inicial inmediata al dispositivo recién conectado
    try {
      const currentSettings = getVisualSettings();
      res.write(`data: ${JSON.stringify(currentSettings)}\n\n`);
    } catch (err) {
      console.warn('[SSE] Error enviando configuración inicial:', err);
    }

    sseClients.push(res);

    const cleanup = () => {
      sseClients = sseClients.filter((client) => client !== res);
    };

    req.on('close', cleanup);
    req.on('end', cleanup);
    req.on('error', cleanup);
    res.on('error', cleanup);
    res.on('close', cleanup);
  });

  // Heartbeat periódico para mantener vivas las conexiones SSE sin desconexiones abruptas
  const heartbeatInterval = setInterval(() => {
    sseClients = sseClients.filter((client) => {
      try {
        if (client.writableEnded || client.destroyed) return false;
        client.write(': ping\n\n');
        return true;
      } catch {
        return false;
      }
    });
  }, 25000);

  const isProduction = process.env.NODE_ENV === 'production';

  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false, // Desactivar HMR en contenedor para prevenir fallos de WebSocket
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

  const server = app.listen(Number(PORT), '0.0.0.0', () => {
    console.log(`[ECEME 10KM] Servidor en línea en http://0.0.0.0:${PORT}`);
  });

  server.on('error', (err: any) => {
    console.error('[Server Error]', err);
  });

  const gracefulShutdown = () => {
    clearInterval(heartbeatInterval);
    server.close(() => {
      process.exit(0);
    });
  };

  process.on('SIGTERM', gracefulShutdown);
  process.on('SIGINT', gracefulShutdown);
}

// Prevenir que excepciones no controladas cierren el proceso del servidor
process.on('uncaughtException', (err) => {
  console.error('[Process Uncaught Exception]:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('[Process Unhandled Rejection]:', reason, 'at', promise);
});

startServer();

