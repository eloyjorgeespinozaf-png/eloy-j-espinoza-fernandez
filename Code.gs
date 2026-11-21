/**
 * ============================================================================
 * SISTEMA DE INSCRIPCIÓN - CARRERA PEDESTRE 10 KM ECEME
 * ARCHIVO BACKEND: Code.gs (Google Apps Script)
 * ============================================================================
 * CATEGORÍAS OFICIALES REGISTRADAS:
 * A.- Juvenil Damas y Varones (ROSADO): 14 a 17 años — Mcal. Juana Azurduy de Padilla
 * B.- Mayores Damas y Varones (AZUL): 18 a 29 años — Mcal. Antonio José de Sucre 1
 * C.- Master A Damas y Varones (CAFÉ): 30 a 37 años — Mcal. Andrés de Santa Cruz 1
 * D.- Master B Damas y Varones (GRIS): 38 a 45 años — Mcal. Otto Felipe Braun
 * E.- Master C Damas y Varones (AMARILLO): 46 años en adelante — Mcal. Esteban Arze
 * F.- Militar Soldados y Premilitares (NEGRO): Tropa SMO/Premilitar — Mal. Bernardino Bilbao Rioja
 * G.- Militar y Policial “A” (ROJO): Formación profesional (Cadetes/Alumnos) — Mcal. José Ballivián Segurola
 * H.- Militar y Policial “B” (AMARILLO): Hasta 15 años de servicio — Mcal. Antonio José de Sucre 2
 * I.- Militar y Policial “C” (VERDE): A partir de 16 años de servicio — Mcal. Andrés de Santa Cruz 2
 * J.- Niñas y niños U-4 (CELESTE): hasta los 4 años de edad (80 metros)
 * K.- Niñas y niños U-6 (NARANJA): hasta los 6 años de edad (200 metros)
 * L.- Niñas y niños U-8 (MORADO): hasta los 8 años de edad (400 metros)
 * M.- Niñas y niños U-13 (TURQUESA): hasta los 13 años de edad (1000 metros)
 * ============================================================================
 * Servicios utilizados:
 * - Google Drive API: Almacenamiento organizado de comprobantes bancarios en Base64.
 * - Google Sheets API: Registro tabular de corredores inscritos y URLs de comprobantes.
 * - ContentService: Respuesta API JSON sin bloqueos de CORS.
 */

/**
 * ⚡ PASO OBLIGATORIO DE AUTORIZACIÓN:
 * Selecciona 'testSetup' en el menú de funciones arriba del editor de Apps Script
 * y haz clic en 'Ejecutar'. Acepta los permisos de Google ("Avanzado" -> "Ir a... (no seguro)" -> "Permitir").
 */
function testSetup() {
  Logger.log("Iniciando prueba de conexión...");
  
  // 1. Verificar Google Drive: Carpetas para Comprobantes y Cédulas
  var folderName = "Comprobantes 10KM";
  var folders = DriveApp.getFoldersByName(folderName);
  var folder = folders.hasNext() ? folders.next() : DriveApp.createFolder(folderName);
  Logger.log("✅ Google Drive conectado. Carpeta Comprobantes lista: " + folder.getName() + " (ID: " + folder.getId() + ")");

  var folderCedulasName = "Cedulas 10KM";
  var foldersCedula = DriveApp.getFoldersByName(folderCedulasName);
  var folderCedula = foldersCedula.hasNext() ? foldersCedula.next() : DriveApp.createFolder(folderCedulasName);
  Logger.log("✅ Google Drive conectado. Carpeta Cédulas lista: " + folderCedula.getName() + " (ID: " + folderCedula.getId() + ")");
  
  // 2. Verificar Google Sheets
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (ss) {
    var sheet = ss.getActiveSheet();
    Logger.log("✅ Google Sheets conectado. Hoja activa: " + sheet.getName());
    
    // Crear encabezados si está vacía (10 columnas institucionales)
    if (sheet.getLastRow() === 0) {
      sheet.appendRow([
        "Marca Temporal",
        "Dorsal Asignado",
        "Nombres y Apellidos",
        "Cédula de Identidad",
        "Número de Celular",
        "Inscrito Por",
        "Categoría",
        "Rama (Damas / Varones)",
        "URL Cédula Identidad (Drive)",
        "URL Comprobante (Drive)"
      ]);
      var headerRange = sheet.getRange(1, 1, 1, 10);
      headerRange.setFontWeight("bold");
      headerRange.setBackground("#1e341b");
      headerRange.setFontColor("#ffffff");
      headerRange.setHorizontalAlignment("center");
      Logger.log("✅ Encabezados creados en la hoja (10 columnas incluyendo Cédula de Identidad).");
    } else {
      asegurarColumnaRama(sheet);
      asegurarColumnaCedula(sheet);
      asegurarColumnaInscritoPor(sheet);
    }
  } else {
    Logger.log("⚠️ Advertencia: Este script no está vinculado directamente a un Google Sheet.");
    Logger.log("Asegúrate de crearlo desde: Google Sheets > Extensiones > Apps Script.");
  }
  
  Logger.log("🎉 Autorización completa. Ahora implementa como 'Nueva versión' con acceso para 'Cualquier persona'.");
}

/**
 * Verifica si la hoja existente cuenta con la columna "Rama (Damas / Varones)".
 * Si la hoja viene con el formato anterior, inserta de forma segura la columna
 * en la posición adecuada evitando desfases.
 */
function asegurarColumnaRama(sheet) {
  var lastCol = sheet.getLastColumn();
  if (lastCol === 0) return;

  var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  var tieneRama = false;
  var colComprobanteIndex = -1;

  for (var i = 0; i < headers.length; i++) {
    var val = headers[i] ? headers[i].toString().toUpperCase() : "";
    if (val.indexOf("RAMA") !== -1 || val.indexOf("GÉNERO") !== -1 || val.indexOf("GENERO") !== -1) {
      tieneRama = true;
      break;
    }
    if (val.indexOf("COMPROBANTE") !== -1 || val.indexOf("DRIVE") !== -1) {
      if (colComprobanteIndex === -1) colComprobanteIndex = i + 1; // 1-based index
    }
  }

  if (!tieneRama) {
    var insertPos = colComprobanteIndex > 0 ? colComprobanteIndex : 8;
    sheet.insertColumnBefore(insertPos);
    var cell = sheet.getRange(1, insertPos);
    cell.setValue("Rama (Damas / Varones)");
    cell.setFontWeight("bold");
    cell.setBackground("#1e341b");
    cell.setFontColor("#ffffff");
    cell.setHorizontalAlignment("center");
    Logger.log("✅ Columna 'Rama (Damas / Varones)' insertada automáticamente en columna " + insertPos);
  }
}

/**
 * Verifica si la hoja existente cuenta con la columna "URL Cédula Identidad (Drive)".
 * Si falta, la inserta de forma segura antes de la columna del Comprobante
 * para evitar desfase de datos o rotura de registros anteriores.
 */
function asegurarColumnaCedula(sheet) {
  var lastCol = sheet.getLastColumn();
  if (lastCol === 0) return;

  var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  var tieneCedula = false;
  var colComprobanteIndex = -1;

  for (var i = 0; i < headers.length; i++) {
    var val = headers[i] ? headers[i].toString().toUpperCase() : "";
    if ((val.indexOf("CÉDULA") !== -1 || val.indexOf("CEDULA") !== -1) && (val.indexOf("DRIVE") !== -1 || val.indexOf("URL") !== -1 || val.indexOf("FOTO") !== -1)) {
      tieneCedula = true;
      break;
    }
    if (val.indexOf("COMPROBANTE") !== -1) {
      colComprobanteIndex = i + 1; // 1-based index
    }
  }

  if (!tieneCedula) {
    var insertPos = colComprobanteIndex > 0 ? colComprobanteIndex : (lastCol + 1);
    sheet.insertColumnBefore(insertPos);
    var cell = sheet.getRange(1, insertPos);
    cell.setValue("URL Cédula Identidad (Drive)");
    cell.setFontWeight("bold");
    cell.setBackground("#1e341b");
    cell.setFontColor("#ffffff");
    cell.setHorizontalAlignment("center");
    Logger.log("✅ Columna 'URL Cédula Identidad (Drive)' insertada automáticamente en columna " + insertPos);
  }
}

/**
 * Verifica si la columna existente contiene "Unidad" o "Unidad / Repartición".
 * Si es así, renombra automáticamente la celda del encabezado en fila 1 a "Inscrito Por"
 * manteniendo todo el formato visual militar intacto.
 */
function asegurarColumnaInscritoPor(sheet) {
  var lastCol = sheet.getLastColumn();
  if (lastCol === 0) return;

  var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  for (var i = 0; i < headers.length; i++) {
    var val = headers[i] ? headers[i].toString().toUpperCase() : "";
    if (val.indexOf("UNIDAD") !== -1 || val.indexOf("REPARTICIÓN") !== -1 || val.indexOf("REPARTICION") !== -1) {
      var cell = sheet.getRange(1, i + 1);
      cell.setValue("Inscrito Por");
      cell.setFontWeight("bold");
      cell.setBackground("#1e341b");
      cell.setFontColor("#ffffff");
      cell.setHorizontalAlignment("center");
      Logger.log("✅ Encabezado de celda actualizado automáticamente a 'Inscrito Por' en columna " + (i + 1));
      break;
    }
  }
}

/**
 * Tabla Oficial de Rangos y Prefijos Correlativos por Categoría (A - M)
 */
var CATEGORIAS_CONTROL = {
  "A": { start: 1001, end: 1999, prefix: "A-", name: "Juvenil (14-17 años)" },
  "B": { start: 2001, end: 2999, prefix: "B-", name: "Mayores (18-29 años)" },
  "C": { start: 3001, end: 3999, prefix: "C-", name: "Master A (30-37 años)" },
  "D": { start: 4001, end: 4999, prefix: "D-", name: "Master B (38-45 años)" },
  "E": { start: 5001, end: 5999, prefix: "E-", name: "Master C (46+ años)" },
  "F": { start: 6001, end: 6999, prefix: "F-", name: "Militar Soldados / Premilitares" },
  "G": { start: 7001, end: 7999, prefix: "G-", name: "Militar y Policial 'A' (Formación)" },
  "H": { start: 8001, end: 8999, prefix: "H-", name: "Militar y Policial 'B' (Hasta 15 años)" },
  "I": { start: 9001, end: 9999, prefix: "I-", name: "Militar y Policial 'C' (16+ años)" },
  "J": { start: 401, end: 499, prefix: "J-", name: "Niñas y Niños U-4 (80m)" },
  "K": { start: 601, end: 699, prefix: "K-", name: "Niñas y Niños U-6 (200m)" },
  "L": { start: 801, end: 899, prefix: "L-", name: "Niñas y Niños U-8 (400m)" },
  "M": { start: 1301, end: 1599, prefix: "M-", name: "Niñas y Niños U-13 (1000m)" }
};

/**
 * Extrae el código de categoría (A a M) a partir de cualquier texto o formato
 */
function extraerCodigoCategoria(str) {
  if (!str) return "A";
  var s = str.toString().trim().toUpperCase();
  if (/^[A-M]$/.test(s)) return s;
  var match = s.match(/^\[?([A-M])[\.\-\)\s]/);
  if (match) return match[1];
  var match2 = s.match(/CATEGOR[IÍ]A\s+([A-M])\b/);
  if (match2) return match2[1];
  if (s.indexOf("U-13") !== -1) return "M";
  if (s.indexOf("U-8") !== -1) return "L";
  if (s.indexOf("U-6") !== -1) return "K";
  if (s.indexOf("U-4") !== -1) return "J";
  var first = s.charAt(0);
  if (first >= "A" && first <= "M") return first;
  return "A";
}

/**
 * Obtiene el índice (1-based) de la columna que contiene los dorsales asignados
 */
function obtenerColumnaDorsal(sheet) {
  var lastCol = sheet.getLastColumn();
  if (lastCol > 0) {
    var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
    for (var c = 0; c < headers.length; c++) {
      var h = headers[c] ? headers[c].toString().toUpperCase() : "";
      if (h.indexOf("DORSAL") !== -1 || h.indexOf("NUMERO") !== -1 || h.indexOf("NÚMERO") !== -1) {
        return c + 1;
      }
    }
  }
  return 2; // Por defecto columna 2: "Dorsal Asignado"
}

/**
 * Obtiene el índice (1-based) de la columna que contiene la Categoría
 */
function obtenerColumnaCategoria(sheet) {
  var lastCol = sheet.getLastColumn();
  if (lastCol > 0) {
    var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
    for (var c = 0; c < headers.length; c++) {
      var h = headers[c] ? headers[c].toString().toUpperCase() : "";
      if (h.indexOf("CATEGORIA") !== -1 || h.indexOf("CATEGORÍA") !== -1) {
        return c + 1;
      }
    }
  }
  return 7; // Por defecto columna 7: "Categoría"
}

/**
 * Extrae el número entero de un dorsal SOLO si pertenece estrictamente a la categoría indicada.
 * Evita que categorías con rangos numéricos superpuestos (ej. A: 1001-1999 y M: 1301-1599) se contaminen entre sí.
 */
function extraerNumeroDorsalDeCategoria(dorsalCellVal, categoriaCellVal, code) {
  if (!dorsalCellVal) return null;
  var d = dorsalCellVal.toString().trim().toUpperCase().replace(/^#+\s*/, "");
  if (!d) return null;

  // Detectar si el dorsal tiene prefijo alfabético explícito (ej. "A-1384", "M-1305", "J0410")
  var prefixMatch = d.match(/^([A-M])[\s\-_]*(\d+)$/);
  if (prefixMatch) {
    if (prefixMatch[1] !== code) {
      return null; // Pertenece a OTRA categoría
    }
    var nPref = parseInt(prefixMatch[2], 10);
    return isNaN(nPref) ? null : nPref;
  }

  // Si empieza con cualquier otra letra de categoría (aunque tenga texto extra), descartar si no es `code`
  var anyLetterMatch = d.match(/^([A-Z])/);
  if (anyLetterMatch) {
    if (anyLetterMatch[1] !== code) {
      return null;
    }
    var digitsOnly = d.match(/\d+/);
    if (digitsOnly) {
      var nCode = parseInt(digitsOnly[0], 10);
      return isNaN(nCode) ? null : nCode;
    }
    return null;
  }

  // Si el dorsal es puramente numérico (sin prefijo), verificar la columna Categoría de esa fila
  var purelyNum = d.match(/^\d+$/);
  if (purelyNum) {
    if (categoriaCellVal && extraerCodigoCategoria(categoriaCellVal) === code) {
      var nPure = parseInt(purelyNum[0], 10);
      return isNaN(nPure) ? null : nPure;
    }
  }

  return null;
}

/**
 * Calcula y asigna de manera estrictamente correlativa, única e irrepetible el dorsal para una categoría.
 * Inspecciona TODOS los dorsales registrados en la hoja para esa categoría y la marca monotónica persistente,
 * garantizando que ningún número ya generado vuelva a repetirse jamás.
 */
function asignarDorsalCorrelativoOficial(sheet, categoriaTexto, dorsalPropuesto, persistirMarca) {
  var code = extraerCodigoCategoria(categoriaTexto);
  var cfg = CATEGORIAS_CONTROL[code] || CATEGORIAS_CONTROL["A"];
  var maxNum = cfg.start - 1;

  // Marca de agua monotónica persistida en ScriptProperties (evita repetir números incluso si se borran filas)
  var props = PropertiesService.getScriptProperties();
  var propKey = "LAST_DORSAL_NUM_" + code;
  var savedPropVal = parseInt(props.getProperty(propKey) || "0", 10);
  if (!isNaN(savedPropVal) && savedPropVal > maxNum) {
    maxNum = savedPropVal;
  }

  var lastRow = sheet.getLastRow();
  var usedNumbers = {};

  if (lastRow > 1) {
    var colDorsal = obtenerColumnaDorsal(sheet);
    var colCat = obtenerColumnaCategoria(sheet);
    var dorsalValues = sheet.getRange(2, colDorsal, lastRow - 1, 1).getValues();
    var catValues = colCat <= sheet.getLastColumn()
      ? sheet.getRange(2, colCat, lastRow - 1, 1).getValues()
      : [];

    for (var i = 0; i < dorsalValues.length; i++) {
      var cellVal = dorsalValues[i][0];
      var catVal = (catValues[i] && catValues[i][0]) ? catValues[i][0] : "";
      var parsedNum = extraerNumeroDorsalDeCategoria(cellVal, catVal, code);
      if (parsedNum !== null && parsedNum >= cfg.start) {
        usedNumbers[parsedNum] = true;
        if (parsedNum > maxNum) {
          maxNum = parsedNum;
        }
      }
    }
  }

  // Calcular el siguiente número estrictamente mayor al máximo usado y nunca presente en usedNumbers
  var nextNum = maxNum + 1;

  // Si se propuso un dorsal específico de contingencia (ej. tras reconexión), aceptarlo SOLO si es estrictamente
  // mayor o igual a nextNum y no ha sido usado ni registrado antes
  if (dorsalPropuesto && dorsalPropuesto !== "0000" && dorsalPropuesto !== "undefined" && dorsalPropuesto !== "") {
    var pNum = extraerNumeroDorsalDeCategoria(dorsalPropuesto, categoriaTexto, code);
    if (pNum !== null && pNum >= nextNum && !usedNumbers[pNum]) {
      nextNum = pNum;
    }
  }

  while (usedNumbers[nextNum]) {
    nextNum++;
  }

  // Nunca reiniciar al inicio del rango (cfg.start) al superar cfg.end, para no repetir números ya emitidos
  if (persistirMarca) {
    try {
      props.setProperty(propKey, String(nextNum));
    } catch (eProp) {}
  }

  return cfg.prefix + ("0000" + nextNum).slice(-4);
}

/**
 * Alias de compatibilidad hacia atrás
 */
function calcularSiguienteDorsal(sheet, categoria) {
  return asignarDorsalCorrelativoOficial(sheet, categoria, "", false);
}

function doPost(e) {
  try {
    // 1. Recepción y validación del payload (JSON o Form)
    var data = {};
    if (e && e.postData && e.postData.contents) {
      try {
        data = JSON.parse(e.postData.contents);
      } catch (err) {
        data = e.parameter || {};
      }
    } else if (e && e.parameter) {
      data = e.parameter;
    }

    // 2. Comprobar si es una petición para guardar configuración visual / cierre global en la nube
    if (data.action === "save_visuals" && data.visualSettings) {
      try {
        var strSettings = typeof data.visualSettings === "string" ? data.visualSettings : JSON.stringify(data.visualSettings);
        PropertiesService.getScriptProperties().setProperty("eceme_visual_settings", strSettings);
        return ContentService.createTextOutput(JSON.stringify({
          status: "success",
          message: "Configuración global sincronizada en Google Apps Script",
          timestamp: new Date()
        })).setMimeType(ContentService.MimeType.JSON);
      } catch (errProp) {
        return ContentService.createTextOutput(JSON.stringify({
          status: "error",
          message: "Error al guardar propiedades: " + errProp.toString()
        })).setMimeType(ContentService.MimeType.JSON);
      }
    }

    // 2.5 Verificar cierre general de inscripciones antes de registrar al participante
    try {
      var savedSettingsRaw = PropertiesService.getScriptProperties().getProperty("eceme_visual_settings");
      if (savedSettingsRaw) {
        var savedCfg = JSON.parse(savedSettingsRaw);
        if (savedCfg && savedCfg.registrationsClosed === true) {
          return ContentService.createTextOutput(JSON.stringify({
            status: "closed",
            registrationsClosed: true,
            message: savedCfg.closedMessage || "Las inscripciones para la Carrera Pedestre 10 KM ECEME han finalizado. Muchas gracias por su participación."
          })).setMimeType(ContentService.MimeType.JSON);
        }
      }
    } catch (errClosedCheck) {}

    // 3. Extracción de los campos del formulario de inscripción
    var nombres = data.nombres || "Sin Nombre";
    var ci = data.ci || "Sin CI";
    var celular = data.celular || "Sin Celular";
    var unidad = data.inscritoPor || data.unidad || "";
    var categoria = data.categoria || "Sin Categoría";
    var dorsal = data.dorsal || "0000";
    var comprobanteBase64 = data.comprobante || "";
    var fileUrl = "Sin comprobante adjunto";
    var cedulaBase64 = data.capturaCedula || "";
    var fileCedulaUrl = "Sin captura de cédula adjunta";

    // Extracción y normalización de la Rama / Género (DAMAS / VARONES / NO APLICA)
    var genero = data.genero || "";
    if (!genero && categoria) {
      if (categoria.indexOf("RAMA: DAMAS") !== -1 || categoria.indexOf("DAMAS") !== -1) {
        genero = "DAMAS";
      } else if (categoria.indexOf("RAMA: VARONES") !== -1 || categoria.indexOf("VARONES") !== -1) {
        genero = "VARONES";
      } else if (categoria.indexOf("Niñas y niños") !== -1 || categoria.indexOf("U-") !== -1) {
        genero = "NO APLICA (INFANTIL)";
      }
    }
    if (!genero) {
      genero = "NO APLICA";
    }

    // Limpiar el texto de categoría para que la columna sea nítida sin redundancia
    if (categoria && categoria.indexOf(" · RAMA:") !== -1) {
      categoria = categoria.split(" · RAMA:")[0].trim();
    }

    // 3.1 Lógica de Drive: Buscar o crear carpeta "Cedulas 10KM" y guardar foto de cédula
    if (cedulaBase64 && cedulaBase64.length > 50) {
      try {
        var folderCedulasName = "Cedulas 10KM";
        var foldersCedula = DriveApp.getFoldersByName(folderCedulasName);
        var targetFolderCedulas = foldersCedula.hasNext() ? foldersCedula.next() : DriveApp.createFolder(folderCedulasName);

        var contentTypeCedula = "image/jpeg";
        var cleanBase64Cedula = cedulaBase64;

        if (cedulaBase64.indexOf("data:") !== -1 && cedulaBase64.indexOf(";base64,") !== -1) {
          var partsCedula = cedulaBase64.split(";base64,");
          contentTypeCedula = partsCedula[0].replace("data:", "");
          cleanBase64Cedula = partsCedula[1];
        }

        var decodedBytesCedula = Utilities.base64Decode(cleanBase64Cedula);
        var sanitizedNameCedula = (ci + "_" + nombres).replace(/[^a-zA-Z0-9_\-]/g, "_");
        var fileNameCedula = sanitizedNameCedula + "_cedula";

        var blobCedula = Utilities.newBlob(decodedBytesCedula, contentTypeCedula, fileNameCedula);
        var fileCedula = targetFolderCedulas.createFile(blobCedula);

        try {
          fileCedula.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
        } catch (shareErrCedula) {}
        fileCedulaUrl = fileCedula.getUrl();
      } catch (errCedulaDrive) {
        Logger.log("Aviso al guardar cédula en Drive: " + errCedulaDrive.toString());
        fileCedulaUrl = "Cédula recibida (No alojada en Drive)";
      }
    }

    // 3.2 Lógica de Drive: Buscar o crear carpeta "Comprobantes 10KM" y guardar comprobante
    if (comprobanteBase64 && comprobanteBase64.length > 50) {
      try {
        var folderName = "Comprobantes 10KM";
        var folders = DriveApp.getFoldersByName(folderName);
        var targetFolder = folders.hasNext() ? folders.next() : DriveApp.createFolder(folderName);

        // Procesar formato Base64 (remover prefijos data:image/...;base64,)
        var contentType = "image/jpeg";
        var cleanBase64 = comprobanteBase64;

        if (comprobanteBase64.indexOf("data:") !== -1 && comprobanteBase64.indexOf(";base64,") !== -1) {
          var parts = comprobanteBase64.split(";base64,");
          contentType = parts[0].replace("data:", "");
          cleanBase64 = parts[1];
        }

        var decodedBytes = Utilities.base64Decode(cleanBase64);

        // Nombrar el archivo con el CI y Nombre del corredor
        var sanitizedName = (ci + "_" + nombres).replace(/[^a-zA-Z0-9_\-]/g, "_");
        var fileName = sanitizedName + "_comprobante";

        var blob = Utilities.newBlob(decodedBytes, contentType, fileName);
        var file = targetFolder.createFile(blob);

        // Configurar permisos de visualización al enlace
        try {
          file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
        } catch (shareErr) {}
        fileUrl = file.getUrl();
      } catch (errCompDrive) {
        Logger.log("Aviso al guardar comprobante en Drive: " + errCompDrive.toString());
        fileUrl = "Comprobante recibido (No alojado en Drive)";
      }
    }

    // 4. Lógica de Sheets: Bloqueo estricto + Idempotencia + Inserción correlativa sin duplicados
    var submissionId = data.submissionId ? data.submissionId.toString().trim() : "";
    var cache = CacheService.getScriptCache();

    // Si ya se procesó este mismo submissionId antes de adquirir lock, devolver respuesta exacta
    if (submissionId) {
      try {
        var cachedEarly = cache.get("SUB_" + submissionId);
        if (cachedEarly) {
          return ContentService.createTextOutput(cachedEarly).setMimeType(ContentService.MimeType.JSON);
        }
      } catch (cacheEarlyErr) {}
    }

    var lock = LockService.getScriptLock();
    var lockAcquired = false;
    try {
      lockAcquired = lock.tryLock(25000);
      if (!lockAcquired) {
        Utilities.sleep(500);
        lockAcquired = lock.tryLock(15000);
      }
    } catch (lockErr) {}

    if (!lockAcquired) {
      return ContentService.createTextOutput(JSON.stringify({
        status: "error",
        message: "Sistema ocupado procesando inscripciones simultáneas. Por favor reintente."
      })).setMimeType(ContentService.MimeType.JSON);
    }

    try {
      // Re-verificar idempotencia dentro del bloqueo para evitar duplicados por reintentos simultáneos
      if (submissionId) {
        try {
          var cachedInside = cache.get("SUB_" + submissionId);
          if (cachedInside) {
            return ContentService.createTextOutput(cachedInside).setMimeType(ContentService.MimeType.JSON);
          }
        } catch (cacheErr) {}
      }

      var ss = SpreadsheetApp.getActiveSpreadsheet();
      if (ss) {
        var sheet = ss.getActiveSheet();

        // Si la hoja es nueva o no tiene filas, generar encabezados institucionales (10 columnas)
        if (sheet.getLastRow() === 0) {
          sheet.appendRow([
            "Marca Temporal",
            "Dorsal Asignado",
            "Nombres y Apellidos",
            "Cédula de Identidad",
            "Número de Celular",
            "Inscrito Por",
            "Categoría",
            "Rama (Damas / Varones)",
            "URL Cédula Identidad (Drive)",
            "URL Comprobante (Drive)"
          ]);

          // Formato visual militar al encabezado
          var headerRange = sheet.getRange(1, 1, 1, 10);
          headerRange.setFontWeight("bold");
          headerRange.setBackground("#1e341b");
          headerRange.setFontColor("#ffffff");
          headerRange.setHorizontalAlignment("center");
        } else {
          // Asegurar que las columnas de Rama, Cédula e Inscrito Por existan y estén actualizadas
          asegurarColumnaRama(sheet);
          asegurarColumnaCedula(sheet);
          asegurarColumnaInscritoPor(sheet);
        }

        // Garantizar número de dorsal oficial correlativo e irrepetible según la hoja y marca persistente
        dorsal = asignarDorsalCorrelativoOficial(sheet, categoria, dorsal, true);

        var timestamp = new Date();
        sheet.appendRow([
          timestamp,
          dorsal,
          nombres,
          ci,
          celular,
          unidad,
          categoria,
          genero,
          fileCedulaUrl,
          fileUrl
        ]);
        SpreadsheetApp.flush();
      }

      // 5. Retorno de respuesta JSON de éxito usando ContentService
      var cfgCode = extraerCodigoCategoria(categoria);
      var cfgFound = CATEGORIAS_CONTROL[cfgCode] || CATEGORIAS_CONTROL["A"];
      var cleanNumber = dorsal ? dorsal.replace(cfgFound.prefix, "").replace(/^[A-M]-?/, "") : "";

      var resultJson = JSON.stringify({
        status: "success",
        message: "Inscripción registrada correctamente en el sistema.",
        dorsal: dorsal,
        number: cleanNumber,
        prefix: cfgFound.prefix,
        categoria: categoria,
        genero: genero,
        fileCedulaUrl: fileCedulaUrl,
        fileUrl: fileUrl
      });

      if (submissionId) {
        try {
          cache.put("SUB_" + submissionId, resultJson, 21600);
        } catch (cachePutErr) {}
      }

      return ContentService.createTextOutput(resultJson).setMimeType(ContentService.MimeType.JSON);
    } finally {
      if (lockAcquired) {
        try { lock.releaseLock(); } catch (eRel) {}
      }
    }

  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      status: "error",
      message: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Función auxiliar para verificar despliegue, consultar próximo dorsal correlativo o configuración visual
 */
function doGet(e) {
  var action = (e && e.parameter && e.parameter.action) ? e.parameter.action : "";

  // 1. Consultar el próximo dorsal correlativo oficial para una categoría
  if (action === "get_next_dorsal") {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    if (ss) {
      var sheet = ss.getActiveSheet();
      var catParam = (e && e.parameter && (e.parameter.category || e.parameter.categoria)) ? (e.parameter.category || e.parameter.categoria) : "A";
      var code = extraerCodigoCategoria(catParam);
      var cfg = CATEGORIAS_CONTROL[code] || CATEGORIAS_CONTROL["A"];
      var nextD = asignarDorsalCorrelativoOficial(sheet, code, "", false);
      return ContentService.createTextOutput(JSON.stringify({
        status: "success",
        dorsal: nextD,
        prefix: cfg.prefix,
        number: nextD.replace(cfg.prefix, ""),
        categoryCode: code,
        range: ("0000" + cfg.start).slice(-4) + " - " + ("0000" + cfg.end).slice(-4)
      })).setMimeType(ContentService.MimeType.JSON);
    }
  }

  // 1.1 Consultar todos los contadores actuales de las categorías A a M
  if (action === "get_counters") {
    var ssAll = SpreadsheetApp.getActiveSpreadsheet();
    if (ssAll) {
      var sheetAll = ssAll.getActiveSheet();
      var countersObj = {};
      var codes = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M"];
      for (var cIdx = 0; cIdx < codes.length; cIdx++) {
        var cCode = codes[cIdx];
        var cCfg = CATEGORIAS_CONTROL[cCode];
        var cNext = asignarDorsalCorrelativoOficial(sheetAll, cCode, "", false);
        countersObj[cCode] = {
          code: cCode,
          name: cCfg.name,
          prefix: cCfg.prefix,
          start: cCfg.start,
          end: cCfg.end,
          nextDorsal: cNext,
          nextNumber: parseInt(cNext.replace(cCfg.prefix, ""), 10)
        };
      }
      return ContentService.createTextOutput(JSON.stringify({
        status: "success",
        categories: countersObj,
        totalRows: sheetAll.getLastRow()
      })).setMimeType(ContentService.MimeType.JSON);
    }
  }

  // 2. Consultar configuración visual
  if (action === "get_visuals") {
    var saved = PropertiesService.getScriptProperties().getProperty("eceme_visual_settings");
    if (saved) {
      return ContentService.createTextOutput(saved).setMimeType(ContentService.MimeType.JSON);
    } else {
      return ContentService.createTextOutput(JSON.stringify({ status: "not_found" })).setMimeType(ContentService.MimeType.JSON);
    }
  }

  return ContentService.createTextOutput(JSON.stringify({
    status: "online",
    service: "Backend Carrera Pedestre 10KM ECEME",
    timestamp: new Date()
  })).setMimeType(ContentService.MimeType.JSON);
}
