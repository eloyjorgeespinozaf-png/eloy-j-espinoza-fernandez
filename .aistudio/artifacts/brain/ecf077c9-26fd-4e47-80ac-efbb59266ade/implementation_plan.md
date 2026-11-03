# Corrección del Despliegue de Google Apps Script (Resolución de doGet y doPost)

Plan táctico para corregir el error **"No se encontró la función de la secuencia de comandos: doGet"**, publicar una versión funcional de la Web App en Google Apps Script y verificar la recepción en tiempo real en Google Sheets y Google Drive.

---

## Revisión del Usuario y Diagnóstico Confirmado

> [!IMPORTANT]
> **Causa Raíz Identificada**: El mensaje *"No se encontró la función de la secuencia de comandos: doGet"* confirma que la URL actualmente desplegada (`/exec`) corresponde a una versión antigua de Apps Script donde no existía o no se guardó la función `doGet`. En Google Apps Script, guardar cambios en el código **no actualiza automáticamente la URL de producción** hasta que se genera una **Nueva versión** en el gestor de implementaciones.

- **Diagnóstico Confirmado**: El enlace actual de la Web App está desactualizado respecto al código fuente.
- **Solución Táctica**:
  1. Proveer el código fuente final y consolidado de `Code.gs` (con `doGet`, `doPost` y `testSetup`).
  2. Ejecutar la función de prueba `testSetup` en el editor para conceder permisos a Drive y Sheets.
  3. Publicar una **Nueva versión** bajo la modalidad **Aplicación Web** con acceso para **Cualquier persona** (*Anyone*).
  4. Sincronizar la URL final en `index.html` y realizar la prueba de campo.

---

## 1. Visión General y Flujo de Datos

El sistema permite que los corredores se inscriban desde la interfaz web, elijan su categoría institucional, reciban su dorsal asignado y transmitan sus datos junto con el comprobante bancario hacia el almacenamiento seguro de la institución militar.

```
┌────────────────────────────────────────────────────────┐
│             Web App (index.html en Vercel)             │
│                                                        │
│  [Formulario] ──> [Compresión Canvas] ──> [Dorsal]    │
└───────────────────────────┬────────────────────────────┘
                            │
                            │ fetch() POST en texto plano (Anti-CORS)
                            ▼
┌────────────────────────────────────────────────────────┐
│           Google Apps Script Web App (Code.gs)         │
│                                                        │
│   doGet()  ──> Verifica estado online de la Web App   │
│   doPost() ──> Parsea JSON, decodifica Base64          │
└───────────────┬────────────────────────┬───────────────┘
                │                        │
                ▼                        ▼
┌─────────────────────────┐    ┌─────────────────────────┐
│     Google Drive        │    │      Google Sheets      │
│                         │    │                         │
│ Carpeta:                │    │ Fila con Marca Temporal,│
│ "Comprobantes 10KM"     │    │ Dorsal, Datos, CI, Tel  │
│ Archivo: CI_Nombre.jpg  │    │ y URL pública del Drive │
└─────────────────────────┘    └─────────────────────────┘
```

---

## 2. Instrucciones Precisas de Publicación en Apps Script

Para que la URL deje de arrojar error y procese las inscripciones:

1. **Pegar el código en Google Apps Script**:
   Copiar el código íntegro de `Code.gs` en el editor de Apps Script vinculado al Google Sheet.
2. **Autorizar Permisos con `testSetup`**:
   - En el menú superior de funciones del editor, seleccionar **`testSetup`**.
   - Hacer clic en **Ejecutar**.
   - Aceptar la ventana emergente de permisos de Google (*Revisar permisos > Avanzado > Ir a proyecto (no seguro) > Permitir*).
   - Verificar en la consola inferior: `✅ Google Drive conectado` y `✅ Google Sheets conectado`.
3. **Generar Nueva Versión en Implementación**:
   - Ir a la esquina superior derecha: **Implementar > Administrar implementaciones**.
   - Seleccionar la implementación activa y hacer clic en el lápiz (**Editar**).
   - En el desplegable **Versión**, cambiar de versión actual a **Nueva versión**.
   - En **Ejecutar como**, asegurar: **Yo**.
   - En **Quién tiene acceso**, asegurar: **Cualquier persona** (*Anyone*).
   - Hacer clic en **Implementar**.
4. **Verificación de URL**:
   - Al abrir la URL `/exec` en una pestaña, responderá:
     `{"status":"online","service":"Backend Carrera Pedestre 10KM ECEME"}`
   - Si la URL cambió, se actualizará en `index.html`.

---

## 3. Plan Técnico de Frontend (`index.html`)

- Mantener la compresión de comprobantes con Canvas HTML5 (máximo 1200px a 85% calidad JPEG) para garantizar que las fotos no excedan tiempos de ejecución en Apps Script.
- Mantener la transmisión en `mode: 'no-cors'` con `Content-Type: text/plain;charset=utf-8` para evitar bloqueos por redirección 302.
- Desplegar la pantalla de éxito con dorsal asignado una vez transmitido el registro.
