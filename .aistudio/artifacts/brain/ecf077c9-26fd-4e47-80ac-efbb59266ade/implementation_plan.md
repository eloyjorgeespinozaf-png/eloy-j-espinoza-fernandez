# Plan de Implementación: Captura y Subida de Cédula de Identidad (COMPLETADO)

Este plan detalla la arquitectura, interfaz de usuario y sincronización con Google Drive y Google Sheets para permitir a los participantes adjuntar una fotografía o captura digital de su Cédula de Identidad al momento de inscribirse.

**Estado:** ✅ Implementado y Verificado con Éxito.

---

## 1. Decisiones y Requerimientos Confirmados

1. **Condición de Obligatoriedad**:
   - **Categorías de 10 KM (Civiles A-E y Militar/Policial F-I)**: **Obligatorio**. No se permitirá el envío sin adjuntar la captura del documento de identidad.
   - **Categorías Infantiles (U-4, U-6, U-8, U-13)**: **Opcional** (facilitando la inscripción de menores acompañados por sus tutores).
2. **Almacenamiento en Google Drive**:
   - Se creará/utilizará una carpeta exclusiva e independiente en Google Drive llamada **`Cedulas 10KM`** (separada de `Comprobantes 10KM`).
   - Los archivos se nombrarán automáticamente bajo el estándar militar: `{CI}_{NOMBRES}_cedula.jpg` con permisos de visualización mediante enlace.
3. **Registro Tabular en Google Sheets**:
   - Se incorporará una columna dedicada: **`URL Cédula Identidad (Drive)`** en la posición 9, antes del comprobante de pago.
   - Estructura final de 10 columnas institucionales:
     `[Marca Temporal, Dorsal Asignado, Nombres y Apellidos, Cédula de Identidad, Número de Celular, Unidad / Repartición, Categoría, Rama (Damas / Varones), URL Cédula Identidad (Drive), URL Comprobante (Drive)]`
   - Mecanismo de retrocompatibilidad automático para no romper ni desfasar hojas existentes.

---

## 2. Cambios en la Interfaz de Usuario (`index.html`)

### A. Campo de Carga de Cédula de Identidad
- Se ubicará estratégicamente en el formulario de inscripción, inmediatamente debajo o junto al campo de texto de **Cédula de Identidad**.
- Componente interactivo estilizado acorde a la estética táctica militar (`bg-army-950`, bordes dorados, iconos SVG limpios, tipografía nítida):
  - Botón táctico para seleccionar archivo desde galería o tomar fotografía directa con la cámara del dispositivo móvil (`accept="image/*"`).
  - Contenedor de previsualización inmediata con miniatura de la imagen cargada, nombre del archivo, tamaño y botón para remover o reemplazar.
  - Etiqueta dinámica: Muestra `<span class="text-rose-400">* Requerido</span>` cuando se selecciona una categoría de 10 KM, y conmuta automáticamente a `<span class="text-stone-400 font-normal">(Opcional para infantiles)</span>` cuando se elige una categoría infantil (J a M).
  - Mensaje de validación de error en caso de omisión: *"Debe adjuntar la captura o fotografía de su cédula de identidad para verificar su categoría."*

### B. Optimización y Compresión en el Cliente
- Al igual que el comprobante de pago, la imagen de la cédula se procesará mediante un canvas HTML5 en el navegador del usuario para:
  - Redimensionar imágenes pesadas a un tamaño óptimo (máx. 1200px).
  - Comprimir a JPEG con calidad 85%.
  - Convertir a Base64 ligero para transmisión sin bloqueos ni consumo excesivo de datos móviles.

### C. Transmisión del Formulario
- En la función `transmitirRegistroAScript`:
  - Se procesa tanto el `comprobante` como la `capturaCedula`.
  - Se añade al payload JSON:
    ```json
    {
      "nombres": "...",
      "ci": "...",
      "celular": "...",
      "unidad": "...",
      "categoria": "...",
      "genero": "...",
      "dorsal": "...",
      "capturaCedula": "data:image/jpeg;base64,...",
      "nombreArchivoCedula": "ci_foto.jpg",
      "comprobante": "data:image/jpeg;base64,...",
      "nombreArchivo": "comprobante.jpg"
    }
    ```

---

## 3. Cambios en el Backend de Google Apps Script (`Code.gs`)

### A. Carpeta Dedicada en Google Drive
- Se crea la rutina de Drive para verificar y crear la carpeta `"Cedulas 10KM"`:
  ```javascript
  var folderCedulasName = "Cedulas 10KM";
  var foldersCedula = DriveApp.getFoldersByName(folderCedulasName);
  var targetFolderCedulas = foldersCedula.hasNext() ? foldersCedula.next() : DriveApp.createFolder(folderCedulasName);
  ```
- Si viene `capturaCedulaBase64`, se decodifica y se almacena con el nombre `sanitizedName + "_cedula"`.

### B. Encabezados y Retrocompatibilidad en Google Sheets
- Se actualiza la función `asegurarColumnaCedula(sheet)`:
  - Si la hoja activa no tiene la columna de cédula, la inserta antes de la columna del comprobante de pago.
  - Aplica estilo institucional verde oliva con texto blanco en negrita.
- Al ejecutar `sheet.appendRow`:
  ```javascript
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
  ```

---

## 4. Actualización del Panel de Administrador y Documentación

- Se actualizará en el Panel de Administrador (`adminPanelScreen`) la cuadrícula visual de las 10 columnas registradas en Google Sheets.
- El botón de un clic para copiar el código de `Code.gs` se sincronizará automáticamente para que el administrador siempre copie la versión con soporte de Drive y Sheets para la Cédula de Identidad.

---

## 5. Plan de Verificación

1. **Prueba de Validación en Formulario**:
   - Seleccionar categoría 10 KM (ej. Mayores B) e intentar enviar sin foto de cédula ➔ Debe alertar y exigir el archivo.
   - Seleccionar categoría Infantil (ej. U-6 K) ➔ Debe permitir enviar con o sin foto de cédula.
2. **Prueba de Previsualización**:
   - Subir una imagen en formato JPG/PNG ➔ Verificar que se visualice la miniatura y el botón de remover funcione.
3. **Prueba de Compilación y Calidad**:
   - Ejecutar `lint_applet` y `compile_applet`.
   - Verificar que no existan errores de sintaxis en `index.html` ni en `server.ts`.
