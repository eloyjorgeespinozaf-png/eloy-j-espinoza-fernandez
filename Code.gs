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
  
  // 1. Verificar Google Drive
  var folderName = "Comprobantes 10KM";
  var folders = DriveApp.getFoldersByName(folderName);
  var folder = folders.hasNext() ? folders.next() : DriveApp.createFolder(folderName);
  Logger.log("✅ Google Drive conectado. Carpeta lista: " + folder.getName() + " (ID: " + folder.getId() + ")");
  
  // 2. Verificar Google Sheets
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (ss) {
    var sheet = ss.getActiveSheet();
    Logger.log("✅ Google Sheets conectado. Hoja activa: " + sheet.getName());
    
    // Crear encabezados si está vacía
    if (sheet.getLastRow() === 0) {
      sheet.appendRow([
        "Marca Temporal",
        "Dorsal Asignado",
        "Nombres y Apellidos",
        "Cédula de Identidad",
        "Número de Celular",
        "Unidad / Repartición",
        "Categoría",
        "Rama (Damas / Varones)",
        "URL Comprobante (Drive)"
      ]);
      var headerRange = sheet.getRange(1, 1, 1, 9);
      headerRange.setFontWeight("bold");
      headerRange.setBackground("#1e341b");
      headerRange.setFontColor("#ffffff");
      headerRange.setHorizontalAlignment("center");
      Logger.log("✅ Encabezados creados en la hoja (9 columnas incluyendo Rama).");
    } else {
      asegurarColumnaRama(sheet);
    }
  } else {
    Logger.log("⚠️ Advertencia: Este script no está vinculado directamente a un Google Sheet.");
    Logger.log("Asegúrate de crearlo desde: Google Sheets > Extensiones > Apps Script.");
  }
  
  Logger.log("🎉 Autorización completa. Ahora implementa como 'Nueva versión' con acceso para 'Cualquier persona'.");
}

/**
 * Verifica si la hoja existente cuenta con la columna "Rama (Damas / Varones)".
 * Si la hoja viene con el formato anterior de 8 columnas (donde la col 8 era URL Comprobante),
 * inserta de forma segura la columna "Rama (Damas / Varones)" en la posición 8,
 * evitando desfase de datos o rotura de registros anteriores.
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
      colComprobanteIndex = i + 1; // 1-based index
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

    // 2. Comprobar si es una petición para guardar configuración visual en la nube
    if (data.action === "save_visuals" && data.visualSettings) {
      try {
        var strSettings = typeof data.visualSettings === "string" ? data.visualSettings : JSON.stringify(data.visualSettings);
        PropertiesService.getScriptProperties().setProperty("eceme_visual_settings", strSettings);
        return ContentService.createTextOutput(JSON.stringify({
          status: "success",
          message: "Configuración visual sincronizada en Google Apps Script",
          timestamp: new Date()
        })).setMimeType(ContentService.MimeType.JSON);
      } catch (errProp) {
        return ContentService.createTextOutput(JSON.stringify({
          status: "error",
          message: "Error al guardar propiedades: " + errProp.toString()
        })).setMimeType(ContentService.MimeType.JSON);
      }
    }

    // 3. Extracción de los campos del formulario de inscripción
    var nombres = data.nombres || "Sin Nombre";
    var ci = data.ci || "Sin CI";
    var celular = data.celular || "Sin Celular";
    var unidad = data.unidad || "Sin Unidad";
    var categoria = data.categoria || "Sin Categoría";
    var dorsal = data.dorsal || "0000";
    var comprobanteBase64 = data.comprobante || "";
    var fileUrl = "Sin comprobante adjunto";

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

    // 3. Lógica de Drive: Buscar o crear carpeta "Comprobantes 10KM"
    if (comprobanteBase64 && comprobanteBase64.length > 50) {
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
    }

    // 4. Lógica de Sheets: Insertar fila en la hoja de cálculo activa
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    if (ss) {
      var sheet = ss.getActiveSheet();

      // Si la hoja es nueva o no tiene filas, generar encabezados institucionales
      if (sheet.getLastRow() === 0) {
        sheet.appendRow([
          "Marca Temporal",
          "Dorsal Asignado",
          "Nombres y Apellidos",
          "Cédula de Identidad",
          "Número de Celular",
          "Unidad / Repartición",
          "Categoría",
          "Rama (Damas / Varones)",
          "URL Comprobante (Drive)"
        ]);

        // Formato visual militar al encabezado
        var headerRange = sheet.getRange(1, 1, 1, 9);
        headerRange.setFontWeight("bold");
        headerRange.setBackground("#1e341b");
        headerRange.setFontColor("#ffffff");
        headerRange.setHorizontalAlignment("center");
      } else {
        // Asegurar que la columna Rama exista para evitar desfases
        asegurarColumnaRama(sheet);
      }

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
        fileUrl
      ]);
    }

    // 5. Retorno de respuesta JSON de éxito usando ContentService
    return ContentService.createTextOutput(JSON.stringify({
      status: "success",
      message: "Inscripción registrada correctamente en el sistema.",
      dorsal: dorsal,
      genero: genero,
      fileUrl: fileUrl
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      status: "error",
      message: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Función auxiliar para verificar despliegue o consultar configuración visual
 */
function doGet(e) {
  var action = (e && e.parameter && e.parameter.action) ? e.parameter.action : "";
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
