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
          cedulaPolicy: parsed.cedulaPolicy || 'optional',
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
      cedulaPolicy: 'optional',
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
        iconSource,
        cedulaPolicy
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

      const validCedulaPolicies = ['optional', 'required_10k', 'required_all'];
      const current = getVisualSettings();
      const finalCedulaPolicy = validCedulaPolicies.includes(cedulaPolicy)
        ? cedulaPolicy
        : (current.cedulaPolicy || 'optional');

      const newSettings = {
        bgSource: finalBgSource || current.bgSource,
        bgOpacity: typeof bgOpacity === 'number' ? bgOpacity : (current.bgOpacity ?? 50),
        bgBlur: typeof bgBlur === 'number' ? bgBlur : (current.bgBlur ?? 1),
        overlayDarkness: typeof overlayDarkness === 'number' ? overlayDarkness : (current.overlayDarkness ?? 65),
        iconSource: finalIconSource || current.iconSource,
        bgUrl: bgUrl || current.bgUrl || '',
        iconUrl: iconUrl || current.iconUrl || '',
        cedulaPolicy: finalCedulaPolicy,
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
  const DORSAL_REGISTRY_FILE = path.resolve(__dirname, 'dorsal-registry.json');

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
    'M': { start: 1301, end: 1599, prefix: 'M-', name: 'Niñas y Niños U-13 (1000m)' }
  };

  interface DorsalRegistry {
    issuedNumbers: Record<string, number[]>;
    submissions: Record<string, { response: any; createdAt: number }>;
  }

  // Mutex asíncrono por categoría para serializar lecturas/asignaciones sin condiciones de carrera
  const categoryLocks = new Map<string, Promise<void>>();
  async function withDorsalLock<T>(catCode: string, task: () => Promise<T>): Promise<T> {
    const prev = categoryLocks.get(catCode) || Promise.resolve();
    let release!: () => void;
    const next = new Promise<void>((resolve) => {
      release = resolve;
    });
    categoryLocks.set(catCode, prev.then(() => next));
    await prev;
    try {
      return await task();
    } finally {
      release();
    }
  }

  const getCounters = (): Record<string, number> => {
    const defaults: Record<string, number> = {};
    for (const [key, cfg] of Object.entries(CATEGORY_CONFIG)) {
      defaults[key] = cfg.start - 1;
    }
    try {
      if (fs.existsSync(COUNTERS_FILE)) {
        const parsed = JSON.parse(fs.readFileSync(COUNTERS_FILE, 'utf-8'));
        for (const [key, cfg] of Object.entries(CATEGORY_CONFIG)) {
          const val = Number(parsed?.[key]);
          defaults[key] = !isNaN(val) && val >= cfg.start - 1 ? val : (cfg.start - 1);
        }
      }
    } catch {}
    return defaults;
  };

  const getRegistry = (): DorsalRegistry => {
    const empty: DorsalRegistry = { issuedNumbers: {}, submissions: {} };
    try {
      if (fs.existsSync(DORSAL_REGISTRY_FILE)) {
        const parsed = JSON.parse(fs.readFileSync(DORSAL_REGISTRY_FILE, 'utf-8'));
        return {
          issuedNumbers: parsed?.issuedNumbers && typeof parsed.issuedNumbers === 'object' ? parsed.issuedNumbers : {},
          submissions: parsed?.submissions && typeof parsed.submissions === 'object' ? parsed.submissions : {}
        };
      }
    } catch {}
    return empty;
  };

  const saveCountersAndRegistry = (counters: Record<string, number>, registry: DorsalRegistry) => {
    fs.writeFileSync(COUNTERS_FILE, JSON.stringify(counters, null, 2), 'utf-8');
    // Mantener máximo 1000 envíos recientes en caché de idempotencia
    const subKeys = Object.keys(registry.submissions);
    if (subKeys.length > 1000) {
      subKeys
        .sort((a, b) => (registry.submissions[a]?.createdAt || 0) - (registry.submissions[b]?.createdAt || 0))
        .slice(0, subKeys.length - 1000)
        .forEach((k) => delete registry.submissions[k]);
    }
    fs.writeFileSync(DORSAL_REGISTRY_FILE, JSON.stringify(registry, null, 2), 'utf-8');
  };

  const getNextAvailableNumber = (code: string, counters: Record<string, number>, registry: DorsalRegistry, minFloor?: number): number => {
    const cfg = CATEGORY_CONFIG[code] || CATEGORY_CONFIG['A'];
    const issued = new Set<number>(registry.issuedNumbers[code] || []);
    let maxIssued = cfg.start - 1;
    for (const n of issued) {
      if (n > maxIssued) maxIssued = n;
    }
    const cur = Math.max(counters[code] ?? (cfg.start - 1), maxIssued, minFloor ?? (cfg.start - 1), cfg.start - 1);
    let candidate = cur + 1;
    while (issued.has(candidate)) {
      candidate += 1;
    }
    return candidate;
  };

  const markNumberIssued = (code: string, numVal: number, counters: Record<string, number>, registry: DorsalRegistry) => {
    const cfg = CATEGORY_CONFIG[code] || CATEGORY_CONFIG['A'];
    if (!Array.isArray(registry.issuedNumbers[code])) {
      registry.issuedNumbers[code] = [];
    }
    if (!registry.issuedNumbers[code].includes(numVal)) {
      registry.issuedNumbers[code].push(numVal);
    }
    counters[code] = Math.max(counters[code] ?? (cfg.start - 1), numVal);
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
    if (s.includes('U-13')) return 'M';
    if (s.includes('U-8')) return 'L';
    if (s.includes('U-6')) return 'K';
    if (s.includes('U-4')) return 'J';
    const first = s.charAt(0);
    if (first >= 'A' && first <= 'M') return first;
    return 'A';
  }

  // Endpoint para consultar contadores y rangos por categoría
  app.get('/api/dorsal/stats', (_req, res) => {
    const counters = getCounters();
    const registry = getRegistry();
    const stats: Record<string, any> = {};
    for (const [code, cfg] of Object.entries(CATEGORY_CONFIG)) {
      const nextNum = getNextAvailableNumber(code, counters, registry);
      const cur = nextNum - 1;
      stats[code] = {
        code,
        name: cfg.name,
        prefix: cfg.prefix,
        start: cfg.start,
        end: cfg.end,
        range: `${String(cfg.start).padStart(4, '0')} - ${String(cfg.end).padStart(4, '0')}`,
        currentNumber: cur,
        nextNumber: nextNum,
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

  // Función para sincronizar contadores con los registros reales de Google Sheets (monotónico, nunca retrocede)
  const syncCountersWithGoogleSheets = async () => {
    if (!GOOGLE_SCRIPT_URL || GOOGLE_SCRIPT_URL.includes('SU_URL_DE_APPS_SCRIPT_AQUI')) return;
    try {
      const res = await fetch(`${GOOGLE_SCRIPT_URL}?action=get_counters`, {
        signal: AbortSignal.timeout(35000)
      });
      if (res.ok) {
        const data: any = await res.json();
        if (data && data.status === 'success' && data.categories) {
          const counters = getCounters();
          let modified = false;
          for (const [code, info] of Object.entries(data.categories as Record<string, any>)) {
            const cfg = CATEGORY_CONFIG[code];
            if (!cfg) continue;
            const remoteNext = info.nextNumber || (info.nextDorsal ? parseInt(String(info.nextDorsal).replace(/\D/g, ''), 10) : cfg.start);
            const remoteLast = remoteNext - 1;
            if (!isNaN(remoteLast) && remoteLast >= cfg.start - 1) {
              if ((counters[code] ?? (cfg.start - 1)) < remoteLast) {
                counters[code] = remoteLast;
                modified = true;
              }
            }
          }
          if (modified) {
            fs.writeFileSync(COUNTERS_FILE, JSON.stringify(counters, null, 2), 'utf-8');
            console.log('[CounterSync] Contadores sincronizados (monotónico) con Google Sheets:', counters);
          }
        }
      }
    } catch (err: any) {
      // Manejo silencioso de timeout o desconexión transitoria de Google Apps Script; se reintentará en el próximo ciclo
      if (err?.name !== 'TimeoutError' && !err?.message?.includes('timeout') && err?.name !== 'AbortError') {
        console.warn('[CounterSync] Aviso de conexión con Google Sheets:', err?.message || err);
      }
    }
  };

  // Sincronización al iniciar y periódicamente cada 30 segundos
  setTimeout(syncCountersWithGoogleSheets, 1500);
  setInterval(syncCountersWithGoogleSheets, 30000);

  // Endpoint atómico para reservar el siguiente dorsal único según la categoría (nunca repite números)
  app.post('/api/dorsal/next', async (req, res) => {
    try {
      const { categoryCode } = req.body || {};
      const code = extractCatCode(categoryCode);
      const cfg = CATEGORY_CONFIG[code] || CATEGORY_CONFIG['A'];

      const result = await withDorsalLock(code, async () => {
        const counters = getCounters();
        const registry = getRegistry();
        let remoteFloor = counters[code] ?? (cfg.start - 1);

        // Consultar el próximo dorsal directamente de Google Sheets si está disponible
        if (GOOGLE_SCRIPT_URL && !GOOGLE_SCRIPT_URL.includes('SU_URL_DE_APPS_SCRIPT_AQUI')) {
          try {
            const gasRes = await fetch(`${GOOGLE_SCRIPT_URL}?action=get_next_dorsal&category=${code}`, {
              signal: AbortSignal.timeout(20000)
            });
            if (gasRes.ok) {
              const gasData: any = await gasRes.json();
              if (gasData && gasData.status === 'success' && gasData.dorsal) {
                const gasNumStr = String(gasData.number || gasData.dorsal.replace(/\D/g, ''));
                const remoteNext = parseInt(gasNumStr, 10);
                if (!isNaN(remoteNext) && remoteNext >= cfg.start) {
                  remoteFloor = Math.max(remoteFloor, remoteNext - 1);
                }
              }
            }
          } catch {}
        }

        const allocatedNum = getNextAvailableNumber(code, counters, registry, remoteFloor);
        markNumberIssued(code, allocatedNum, counters, registry);
        saveCountersAndRegistry(counters, registry);

        const paddedNumber = String(allocatedNum).padStart(4, '0');
        const dorsal = `${cfg.prefix}${paddedNumber}`;

        return {
          success: true,
          dorsal,
          prefix: cfg.prefix,
          number: paddedNumber,
          categoryCode: code,
          range: `${String(cfg.start).padStart(4, '0')} - ${String(cfg.end).padStart(4, '0')}`,
          categoryName: cfg.name
        };
      });

      return res.json(result);
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
      const submissionId = payload.submissionId ? String(payload.submissionId).trim() : '';

      const responseBody = await withDorsalLock(catCode, async () => {
        const counters = getCounters();
        const registry = getRegistry();

        // 0. Idempotencia: si esta inscripción ya fue procesada (ej. doble clic / reintento), devolver el mismo dorsal
        if (submissionId && registry.submissions[submissionId]) {
          return registry.submissions[submissionId].response;
        }

        // Calcular candidato local único e irrepetible como piso mínimo garantizado
        const localNextNum = getNextAvailableNumber(catCode, counters, registry);
        const reservedDorsal = `${cfg.prefix}${String(localNextNum).padStart(4, '0')}`;

        // Preparar payload hacia Google Apps Script
        // Si localNextNum está dentro del rango inicial, lo enviamos como propuesta mínima para evitar retrocesos;
        // Google Apps Script bajo LockService verificará la hoja y garantizará un dorsal único >= maxSheet + 1.
        const gasPayload = {
          submissionId,
          nombres: payload.nombres || '',
          ci: payload.ci || '',
          celular: payload.celular || '',
          unidad: payload.inscritoPor || payload.unidad || '',
          inscritoPor: payload.inscritoPor || payload.unidad || '',
          categoria: payload.categoria || cfg.name,
          genero: payload.genero || 'NO APLICA',
          dorsal: localNextNum <= cfg.end ? reservedDorsal : '',
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
              signal: AbortSignal.timeout(50000)
            });

            if (gasRes.ok) {
              const gasData: any = await gasRes.json().catch(() => ({}));
              console.log(`[Google Sheets REGISTRADO] Confirmado en Google Sheets:`, gasData);
              if (gasData && gasData.status === 'success' && gasData.dorsal) {
                const rawGasDorsal = String(gasData.dorsal).trim();
                const numMatch = rawGasDorsal.match(/\d+/);
                const parsedNum = numMatch ? parseInt(numMatch[0], 10) : parseInt(String(gasData.number || ''), 10);
                const issuedSet = new Set<number>(registry.issuedNumbers[catCode] || []);

                let finalNum = !isNaN(parsedNum) ? parsedNum : localNextNum;
                if (issuedSet.has(finalNum)) {
                  // Salvaguarda absoluta: si por algún desfase remoto llegara un número ya emitido en este servidor,
                  // avanzar al siguiente libre para garantizar no repetición en la respuesta del cliente
                  finalNum = getNextAvailableNumber(catCode, counters, registry, finalNum);
                }

                paddedNumber = String(finalNum).padStart(4, '0');
                assignedDorsal = `${cfg.prefix}${paddedNumber}`;
                markNumberIssued(catCode, finalNum, counters, registry);

                fileUrl = gasData.fileUrl || '';
                fileCedulaUrl = gasData.fileCedulaUrl || '';

                const resObj = {
                  success: true,
                  dorsal: assignedDorsal,
                  number: paddedNumber,
                  prefix: cfg.prefix,
                  categoryCode: catCode,
                  categoryName: cfg.name,
                  range: `${String(cfg.start).padStart(4, '0')} - ${String(cfg.end).padStart(4, '0')}`,
                  fileUrl,
                  fileCedulaUrl
                };

                if (submissionId) {
                  registry.submissions[submissionId] = { response: resObj, createdAt: Date.now() };
                }
                saveCountersAndRegistry(counters, registry);
                return resObj;
              }
            }
          } catch (gasErr) {
            console.error('[Google Sheets Error en transmisión]:', gasErr);
          }
        }

        // 2. CONTINGENCIA LOCAL (Solo en caso de desconexión total con Google Apps Script)
        console.warn('[Inscribir] Activando contingencia local por falta de respuesta remota');
        const assignedNum = getNextAvailableNumber(catCode, counters, registry);
        markNumberIssued(catCode, assignedNum, counters, registry);

        paddedNumber = String(assignedNum).padStart(4, '0');
        assignedDorsal = `${cfg.prefix}${paddedNumber}`;

        const fallbackObj = {
          success: true,
          dorsal: assignedDorsal,
          number: paddedNumber,
          prefix: cfg.prefix,
          categoryCode: catCode,
          categoryName: cfg.name,
          range: `${String(cfg.start).padStart(4, '0')} - ${String(cfg.end).padStart(4, '0')}`,
          fileUrl,
          fileCedulaUrl
        };

        if (submissionId) {
          registry.submissions[submissionId] = { response: fallbackObj, createdAt: Date.now() };
        }
        saveCountersAndRegistry(counters, registry);

        // Enviar en background a Google Sheets usando el mismo submissionId para que sea idempotente
        if (GOOGLE_SCRIPT_URL && !GOOGLE_SCRIPT_URL.includes('SU_URL_DE_APPS_SCRIPT_AQUI')) {
          fetch(GOOGLE_SCRIPT_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({ ...gasPayload, dorsal: assignedDorsal })
          }).catch(() => {});
        }

        return fallbackObj;
      });

      return res.json(responseBody);
    } catch (err: any) {
      console.error('[Inscribir] Error en registro:', err);
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // Endpoint de administración para sincronizar o ajustar contadores manualmente
  app.post('/api/dorsal/update-counter', async (req, res) => {
    const providedPassword = (req.headers['x-admin-password'] as string) || req.body?.adminPassword;
    if (providedPassword !== ADMIN_PASSWORD) {
      return res.status(401).json({ success: false, error: 'No autorizado' });
    }
    const { categoryCode, nextValue } = req.body || {};
    const code = extractCatCode(categoryCode);
    const cfg = CATEGORY_CONFIG[code];
    if (!cfg) return res.status(400).json({ success: false, error: 'Categoría inválida' });

    const val = parseInt(nextValue, 10);
    if (isNaN(val) || val < cfg.start) {
      return res.status(400).json({ success: false, error: `El número debe ser mayor o igual a ${cfg.start}` });
    }

    const updatedCounters = await withDorsalLock(code, async () => {
      const counters = getCounters();
      const registry = getRegistry();
      counters[code] = val - 1; // Para que el próximo asignado sea al menos val
      if (Array.isArray(registry.issuedNumbers[code])) {
        registry.issuedNumbers[code] = registry.issuedNumbers[code].filter((n) => n < val);
      }
      saveCountersAndRegistry(counters, registry);
      return counters;
    });

    return res.json({
      success: true,
      message: `Categoría ${code} (${cfg.name}) ajustada. El próximo dorsal será ${cfg.prefix}${String(val).padStart(4, '0')}`,
      nextDorsal: `${cfg.prefix}${String(val).padStart(4, '0')}`,
      counters: updatedCounters
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

