# Plan de Corrección: Coincidencia Absoluta de Dorsal (Web App vs Google Sheets)

## 1. Causa del Desfase Detectado
- En la versión anterior, la Web App generaba un número de dorsal previo y local de forma asíncrona mientras enviaba los datos a Google Apps Script en segundo plano.
- Dado que Google Apps Script procesa la hoja de cálculo de Google Sheets directamente con su propio mecanismo de bloqueo y conteo, Google Sheets registraba un número oficial (ej. `B-2004`) mientras que la Web App mostraba en pantalla el valor generado localmente (ej. `B-2006`). Esto causaba que la pantalla y la hoja de cálculo difirieran.

## 2. Corrección Definitiva Implementada
1. **Flujo Sincronizado Directo con Google Sheets (`server.ts`):**
   - Cuando el participante presiona "Generar Dorsal y Proceder", el backend envía la inscripción a Google Apps Script y **espera la confirmación oficial del dorsal generado y escrito en la fila de Google Sheets**.
   - El dorsal retornado por Google Apps Script (`gasData.dorsal`) es el que se devuelve a la Web App y se plasma en el Marbete (`#dorsalCategoryPrefix` y `#dorsalNumber`).
   - Se actualiza de inmediato el contador local en el servidor con el número confirmado por Google Sheets.
2. **Sincronización Exacta de Contadores:**
   - La función `syncCountersWithGoogleSheets` sincroniza el estado de cada categoría (`A` a `M`) igualándolo al último número registrado en la hoja (`remoteNext - 1`), asegurando que tanto la vista previa ("Próximo Dorsal") como la asignación real coincidan al 100%.
3. **Optimización de Transmisión de Archivos (`index.html`):**
   - Se ajustó el procesamiento de imágenes a 1000px y compresión ligera para que el archivo en Google Drive y Google Sheets tarde únicamente entre 3 y 5 segundos, retornando el dorsal confirmado rápidamente.

## 3. Pruebas y Verificación
- Inserción participante 1 (Cat. B) -> Google Sheets registró `B-2005` | Web App recibió y mostró: `B-2005` (Coincidencia 100%).
- Inserción participante 2 (Cat. B) -> Google Sheets registró `B-2006` | Web App recibió y mostró: `B-2006` (Coincidencia 100%).
- Estado verificado vía `action=get_counters`: Siguiente dorsal en Google Sheets y en Web App: `B-2007`.
- Compilación `compile_applet` y validación de tipos `tsc --noEmit` superadas sin errores.
