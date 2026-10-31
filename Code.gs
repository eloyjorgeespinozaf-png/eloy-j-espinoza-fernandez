/**
 * ============================================================================
 * SISTEMA DE INSCRIPCIÓN - CARRERA PEDESTRE 10 KM ECEME
 * ARCHIVO BACKEND: Code.gs (Google Apps Script)
 * ============================================================================
 * Servicios utilizados:
 * - Google Drive API: Almacenamiento organizado de comprobantes bancarios en Base64.
 * - Google Sheets API: Registro tabular de corredores inscritos y URLs de comprobantes.
 * - ContentService: Respuesta API JSON sin bloqueos de CORS.
 */

function doPost(e) {
  try {
    // 1. Recepción y validación del payload
    if (!e || !e.postData || !e.postData.contents) {
      return ContentService.createTextOutput(JSON.stringify({
        status: "error",
        message: "No se recibieron datos en el cuerpo de la petición."
      })).setMimeType(ContentService.MimeType.JSON);
    }

    var data = JSON.parse(e.postData.contents);

    // 2. Extracción de los campos del formulario
    var nombres = data.nombres || "Sin Nombre";
    var ci = data.ci || "Sin CI";
    var celular = data.celular || "Sin Celular";
    var unidad = data.unidad || "Sin Unidad";
    var categoria = data.categoria || "Sin Categoría";
    var dorsal = data.dorsal || "0000";
    var comprobanteBase64 = data.comprobante || "";
    var fileUrl = "Sin comprobante adjunto";

    // 3. Lógica de Drive: Buscar o crear carpeta "Comprobantes 10KM"
    if (comprobanteBase64 && comprobanteBase64.length > 50) {
      var folderName = "Comprobantes 10KM";
      var folders = DriveApp.getFoldersByName(folderName);
      var targetFolder;

      if (folders.hasNext()) {
        targetFolder = folders.next();
      } else {
        targetFolder = DriveApp.createFolder(folderName);
      }

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
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      fileUrl = file.getUrl();
    }

    // 4. Lógica de Sheets: Insertar fila en la hoja de cálculo activa
    var ss = SpreadsheetApp.getActiveSpreadsheet();
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
        "URL Comprobante (Drive)"
      ]);

      // Formato visual militar al encabezado
      var headerRange = sheet.getRange(1, 1, 1, 8);
      headerRange.setFontWeight("bold");
      headerRange.setBackground("#1e341b");
      headerRange.setFontColor("#ffffff");
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
      fileUrl
    ]);

    // 5. Retorno de respuesta JSON de éxito usando ContentService
    return ContentService.createTextOutput(JSON.stringify({
      status: "success",
      message: "Inscripción registrada correctamente en el sistema.",
      dorsal: dorsal,
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
 * Función auxiliar para verificar despliegue en navegador
 */
function doGet(e) {
  return ContentService.createTextOutput(JSON.stringify({
    status: "online",
    service: "Backend Carrera Pedestre 10KM ECEME",
    timestamp: new Date()
  })).setMimeType(ContentService.MimeType.JSON);
}
