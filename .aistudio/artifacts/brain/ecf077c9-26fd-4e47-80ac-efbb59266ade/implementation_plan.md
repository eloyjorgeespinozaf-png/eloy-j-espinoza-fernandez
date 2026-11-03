# Cuadro Oficial de Categorías y Distancias - Carrera Pedestre ECEME 10 KM

Registro oficial de las 13 categorías (A hasta M), asignación de colores tácticos, distancias correspondientes y patronos históricos del Ejército de Bolivia.

---

## 1. Categorías Civiles (10 KM)

1. **A.- Categoría Juvenil Damas y Varones (ROSADO)**
   - **Rango de Edad**: Desde los 14 hasta los 17 años.
   - **Distancia**: 10 KM.
   - **Patrono Histórico**: Mcal. Juana Azurduy de Padilla – Mariscal de la Patria Grande.
   - **Color Asignado**: Rosado (`#ec4899` / `pink-500`).

2. **B.- Categoría Mayores Damas y Varones (AZUL)**
   - **Rango de Edad**: Desde los 18 hasta los 29 años.
   - **Distancia**: 10 KM.
   - **Patrono Histórico**: Mcal. Antonio José de Sucre 1 – Gran Mariscal de Ayacucho.
   - **Color Asignado**: Azul (`#2563eb` / `blue-600`).

3. **C.- Categoría Master A Damas y Varones (CAFÉ)**
   - **Rango de Edad**: Desde los 30 hasta los 37 años.
   - **Distancia**: 10 KM.
   - **Patrono Histórico**: Mcal. Andrés de Santa Cruz 1 – Gran Mariscal de Zepita.
   - **Color Asignado**: Café (`#854d0e` / `amber-800`).

4. **D.- Categoría Master B Damas y Varones (GRIS)**
   - **Rango de Edad**: Desde los 38 hasta los 45 años.
   - **Distancia**: 10 KM.
   - **Patrono Histórico**: Mcal. Otto Felipe Braun – Mariscal de Montenegro.
   - **Color Asignado**: Gris (`#6b7280` / `gray-500`).

5. **E.- Categoría Master C Damas y Varones (AMARILLO)**
   - **Rango de Edad**: Desde los 46 años en adelante.
   - **Distancia**: 10 KM.
   - **Patrono Histórico**: Mcal. Esteban Arze – Mariscal de Aroma.
   - **Color Asignado**: Amarillo (`#eab308` / `yellow-500`).

---

## 2. Categorías Militares y Policiales (10 KM)

6. **F.- Categoría Militar Soldados y Premilitares Damas y Varones (NEGRO)**
   - **Requisito**: Personal de tropa que cumple su Servicio Militar Obligatorio y/o su Servicio Premilitar.
   - **Distancia**: 10 KM.
   - **Patrono Histórico**: Mal. Bernardino Bilbao Rioja – Mariscal del Kilómetro 7.
   - **Color Asignado**: Negro (`#171717` / `neutral-900`).

7. **G.- Categoría Militar y Policial “A” Damas y Varones (ROJO)**
   - **Requisito**: Personal en etapa de formación profesional (Damas y Caballeros Cadetes; Alumnos y Alumnas).
   - **Distancia**: 10 KM.
   - **Patrono Histórico**: Mcal. José Ballivián Segurola – Mariscal de Ingavi.
   - **Color Asignado**: Rojo (`#dc2626` / `red-600`).

8. **H.- Categoría Militar y Policial “B” Damas y Varones (AMARILLO)**
   - **Requisito**: Oficiales Subalternos, Sargentos y Suboficiales hasta 15 años de servicio.
   - **Distancia**: 10 KM.
   - **Patrono Histórico**: Mcal. Antonio José de Sucre 2 – Gran Mariscal de Ayacucho.
   - **Color Asignado**: Amarillo (`#facc15` / `yellow-400`).

9. **I.- Categoría Militar y Policial “C” Damas y Varones (VERDE)**
   - **Requisito**: Oficiales Generales, Oficiales Superiores y Suboficiales a partir de 16 años de servicio.
   - **Distancia**: 10 KM.
   - **Patrono Histórico**: Mcal. Andrés de Santa Cruz 2 – Gran Mariscal de Zepita.
   - **Color Asignado**: Verde (`#16a34a` / `emerald-600`).

---

## 3. Categorías Infantiles (Niñas y Niños) con Colores Asignados

10. **J.- Categoría niñas y niños U-4 (CELESTE)**
    - **Rango de Edad**: Hasta los 4 años de edad.
    - **Distancia Oficial**: 80 metros.
    - **Color Asignado**: Celeste (`#06b6d4` / `cyan-500`).

11. **K.- Categoría niñas y niños U-6 (NARANJA)**
    - **Rango de Edad**: Hasta los 6 años de edad.
    - **Distancia Oficial**: 200 metros.
    - **Color Asignado**: Naranja (`#f97316` / `orange-500`).

12. **L.- Categoría niñas y niños U-8 (MORADO)**
    - **Rango de Edad**: Hasta los 8 años de edad.
    - **Distancia Oficial**: 400 metros.
    - **Color Asignado**: Morado (`#a855f7` / `purple-500`).

13. **M.- Categoría niñas y niños U-13 (TURQUESA)**
    - **Rango de Edad**: Hasta los 13 años de edad.
    - **Distancia Oficial**: 1000 metros (1 KM).
    - **Color Asignado**: Turquesa (`#14b8a6` / `teal-500`).

---

## 4. Componentes y Funcionalidades Integradas en la WebApp

- **Selector Dinámico**: Selector de 13 opciones organizadas en 3 grupos (`optgroup` Civiles, Militares/Policiales e Infantiles).
- **Cuadro Guía Desplegable**: Botón interactivo *"Ver cuadro de categorías (A - M)"* que muestra a los participantes las 13 categorías con sus colores, edades y patronos.
- **Indicador de Color en Tiempo Real**: Círculo de color dinámico al lado del selector que refleja el tono oficial de la categoría elegida.
- **Marbete / Dorsal Dinámico**: Borde del dorsal, color de la etiqueta de categoría y subtítulo de distancia adaptados automáticamente según la categoría (p. ej. *CARRERA INFANTIL · 80 METROS* o *CARRERA PEDESTRE 10 KM*).
- **Banner de Confirmación Sincronizado**: Notificación de registro con el color exacto de la categoría seleccionada.
- **Persistencia en Google Sheets & Drive**: Envío del nombre completo de la categoría a Google Apps Script y almacenamiento del registro.
