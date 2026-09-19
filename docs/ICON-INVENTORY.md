# Inventario de iconos de Jano

Estado revisado el 19 de septiembre de 2026 a partir de `jano-iconset-v2.zip`.
El sprite integrado contiene 77 iconos.

## Criterio

- Un control **solo con icono** necesita un dibujo propio y un nombre accesible (`aria-label` y `title`).
- Un botón que ya tiene texto visible puede llevar icono, pero no depende de él para entenderse.
- No se reutiliza un icono con otro significado solo para eliminar un glifo provisional.
- El set usa `currentColor`, formato 24 × 24 y trazo de 1.75 px. En la interfaz se muestra normalmente a 14–18 px.

## Integrados en la interfaz actual

| Característica | Icono del set | Uso actual |
| --- | --- | --- |
| Mostrar/ocultar biblioteca lateral | `sidebar` | Barra superior |
| Abrir biblioteca desde la lectura | `biblioteca` | Barra inferior |
| Ajustes | `ajustes` | Barra superior |
| Cerrar modal o quitar un reciente | `cerrar` | Modales e inicio |
| Proyecto reciente | `biblioteca` | Inicio |
| Importar archivo | `importar` | Herramientas de biblioteca |
| Crear carpeta | `nueva-carpeta` | Herramientas de biblioteca |
| Carpeta | `carpeta` | Árbol de biblioteca |
| Documento/página | `pagina` | Árbol de biblioteca |
| Par completo | `par-completo` | Estado de documento |
| Falta traducción | `falta-traduccion` | Estado de documento |
| Falta original | `falta-original` | Estado de documento |
| Ruta perdida | `ruta-perdida` | Estado de documento |
| Vínculo recuperado manualmente | `vinculo-manual` | Estado de documento |
| Conflicto de correspondencia | `conflicto-pareja` | Estado de documento |
| Desplazamiento sincronizado | `sync-scroll` | Barra de lectura |
| Realinear visores | `realinear` | Barra de lectura |
| Proporciones 50/50, 70/30 y 30/70 | `proporcion-igual`, `proporcion-original`, `proporcion-traduccion` | Barra de lectura |
| Mostrar solo original o traducción | `solo-original`, `solo-traduccion` | Barra de lectura |
| Dirección/par de idiomas | `par-idiomas` | Barra de lectura |
| Extraer y traducir | `traducir` | Panel de traducción |
| Regenerar traducción | `regenerar` | Panel de traducción |
| Página anterior y siguiente | `pagina-anterior`, `pagina-siguiente` | Barra de lectura |
| Alejar y acercar | `zoom-menos`, `zoom-mas` | Barra de lectura |
| Bloquear y desbloquear panel | `bloquear-panel`, `desbloquear-panel` | Barra de lectura |
| Información de sincronización | `informacion` | Barra de lectura |
| Actualizar proyecto | `actualizar` | Inicio y barra superior |
| Ordenar, localizar y colapsar | `ordenar`, `localizar-documento`, `colapsar-todo` | Biblioteca |
| Expandir y contraer carpeta | `expandir-carpeta`, `contraer-carpeta` | Árbol de biblioteca |
| Inicio, crear y abrir proyecto | `inicio`, `nuevo-proyecto`, `abrir-proyecto` | Barra superior e inicio |
| Quitar, eliminar y restaurar | `quitar-de-jano`, `eliminar`, `restaurar` | Biblioteca y diálogos |
| Opción seleccionada | `seleccionado` | Menú de orden |

El modo asincrónico no necesita otro icono por ahora: es el estado no activo del control `sync-scroll` y siempre conserva su texto visible. Los bloqueos de panel siguen siendo controles separados.

## Cobertura de la interfaz actual

La v2 resuelve todos los iconos que la interfaz implementada necesitaba. Ya no quedan caracteres provisionales en los controles de lectura, biblioteca o navegación. `advertencia`, `error` y `exito` quedan disponibles para notificaciones generales cuando ese componente se implemente.

## Ya disponibles para próximas funciones

No hace falta redibujar estos conceptos: el ZIP ya contiene iconos para ellos.

- Alineación y lectura: `alineacion`, `segmento`, `buscar`, `tamano-texto`.
- Anotación académica: `destacar`, `comentario`, `etiqueta`, `nota`, `cita`.
- Procesamiento: `traduccion-en-proceso`, `ocr`, `modelo-local`, `glosario`.
- Plataforma: `extensiones`, `clave-api`, `respaldo`, `privacidad-local`, `gestor-bibliografico`, `mas-opciones`, `atras`.

## Columna futura de alineación

La v2 también entrega todos los iconos previstos para la columna desplegable propuesta:

| Icono disponible | Acción o estado futuro |
| --- | --- |
| `segmento-sin-alinear` | Pasaje sin contraparte |
| `problema-alineacion` | Correspondencia ambigua o conflictiva |
| `filtrar` | Filtrar alineados, sin alinear y problemas |
| `vincular`, `desvincular` | Corregir una relación entre segmentos |
| `dividir`, `unir` | Editar la granularidad de la alineación |
| `aceptar`, `rechazar` | Validar o descartar una sugerencia automática |

Los estados `segmento-sin-alinear` y `problema-alineacion` deberían conservar el vocabulario del mockup: gris para ausencia, ámbar para revisión y cian para una correspondencia válida. También pueden compartir formas base con `falta-*` y `conflicto-pareja`, pero necesitan pruebas ópticas a 14–16 px.

## Pendientes técnicos del propio set

- Redibujar ópticamente a 16 px los iconos más complejos: `ocr`, `modelo-local`, `glosario` y `gestor-bibliografico`.
- Definir estados deshabilitado, foco de teclado, activo y peligro en CSS; no duplicarlos como SVG diferentes.
- Decidir si `par-idiomas` será fijo o si mostrará dinámicamente el par configurado.
- Probar contraste y legibilidad a 14, 16, 18 y 24 px antes de cerrar la versión 1.1.
