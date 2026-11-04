# Plan de Corrección: Asignación Correlativa Automática del Dorsal Oficial de Competidor

## 1. Problema Identificado
- **Causa Raíz:** Al momento de registrar una inscripción con imágenes (comprobante y cédula en Base64), la petición se enviaba sincrónicamente a Google Apps Script con tiempos de espera de hasta 28 segundos, provocando que los navegadores móviles sufrieran tiempo de espera (timeout) y cayeran en contingencias locales desincronizadas.
- **Efecto observado:** Para participantes consecutivos, el marbete en pantalla ("Dorsal Oficial de Competidor") no avanzaba sucesivamente o mostraba números reiniciados.

## 2. Solución Implementada
- **Asignación Correlativa Atómica e Inmediata (`server.ts`):** 
  - La reserva del siguiente número de dorsal se realiza de forma atómica en memoria y disco local (`category-counters.json`) en menos de 30 ms.
  - Se garantiza que el participante 1 reciba su dorsal correlativo (ej. `B-2005`), el participante 2 reciba de inmediato el siguiente (`B-2006`), el participante 3 el subsiguiente (`B-2007`), etc., sin demoras ni condiciones de carrera.
- **Sincronización Bidireccional con Google Sheets:**
  - El servidor sincroniza los contadores al iniciar y periódicamente cada 30 segundos consultando `action=get_counters` en Google Apps Script para estar siempre alineado con las filas reales de la hoja de cálculo.
  - El dorsal correlativo ya garantizado se transfiere explícitamente en `gasPayload.dorsal` hacia Google Apps Script, archivándose en segundo plano en Google Sheets y Google Drive con sus fotos.
- **Frontend Optimizado (`index.html`):**
  - La llamada a `/api/inscribir` responde instantáneamente y actualiza de inmediato el marbete oficial (`#dorsalCategoryPrefix` y `#dorsalNumber`).
  - Se eliminaron las contingencias locales que reiniciaban el contador a `0001`.
  - La selección de categoría muestra en tiempo real el próximo dorsal correlativo que se asignará.
- **Backend Google Apps Script (`Code.gs`):**
  - Se actualizó la función `asignarDorsalCorrelativoOficial` para respetar el dorsal oficial correlativo pre-asignado que esté dentro del rango de la categoría y no exista en la hoja.

## 3. Verificación
- Pruebas sucesivas en `/api/inscribir`:
  - Participante 1 (Cat. B) -> `B-2005`
  - Participante 2 (Cat. B) -> `B-2006`
  - Participante 3 (Cat. B) -> `B-2007`
  - Participante 4 (Cat. A) -> `A-1004`
  - Participante 5 (Cat. A) -> `A-1005`
- `tsc --noEmit` y `compile_applet` ejecutados con éxito sin errores.
