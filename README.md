# Documentador de casos

## Creación de suites

Los proyectos nuevos comienzan sin suites predeterminadas. En **QA Casos**,
pulsa **+ Nueva suite**, escribe su nombre y selecciona **Crear**. Para agregar
casos dentro de una suite, primero crea y abre esa suite. Los proyectos
existentes conservan sus suites y casos; las suites creadas durante una
importación de casos también se mantienen.

## Título de hallazgos automáticos

En cada evidencia del documentador puedes escribir un **Título del paso**
opcional. Al marcarla con novedad o fallo, ese título se muestra como título
del hallazgo en la bitácora; el comentario sigue siendo la descripción.
Si varias imágenes están unidas en un paso, se usa el primer título no vacío
del grupo. El título puede añadirse al editar evidencias existentes.

Los cambios del título se sincronizan con el issue automático, salvo que su
título se haya editado manualmente en la bitácora: en ese caso se conserva.
Los títulos ya existentes en issues antiguos también se consideran manuales.
Sin título, el hallazgo seguirá mostrándose sin título.

## Resumen y recomendación de cierre de ciclos

En QA Casos, al activar un ciclo se muestra una recomendación de cierre. Requiere
atención si el ciclo no tiene casos, contiene casos sin ejecutar, en progreso o
fallidos, o si hay issues Critical o High sin cerrar en el proyecto. Los casos
Not Applicable no impiden el cierre. Los issues se consideran a nivel de
proyecto, ya que no están vinculados a un ciclo específico. La recomendación es
orientativa: el informe PDF conserva su criterio independiente de no tener
issues Critical abiertos.

Para un ciclo de reejecución se muestra el estado actual de los casos
seleccionados originalmente por fallar, junto con los casos que ahora figuren
como fallidos en el ciclo de origen. Se distinguen Pass, Failed, sin ejecutar,
en progreso y Not Applicable. Los casos nuevos ajenos a esos fallos no se
incluyen en este resumen. Si faltan casos seleccionados o el ciclo de origen, se
advierte y la recomendación de cierre requiere atención.

Las razones con casos pendientes o fallidos y las cifras de reejecución con
resultados permiten abrir la lista correspondiente y acceder al detalle de cada
caso. Las razones de issues Critical o High abren la bitácora con filtros de
severidad y estado «Sin cerrar»; estos filtros se pueden cambiar manualmente.
Los issues incluyen todos los estados distintos de Closed y pertenecen al
proyecto completo.

## Exportación de la bitácora a Excel

La exportación aplica los filtros activos y genera un archivo `.xlsx` localmente.
Cada evidencia se inserta en la misma fila de su issue como un paquete OLE
independiente. El archivo incluye la imagen, sin requerir un archivo externo.
Para abrir los objetos se requiere Microsoft Excel de escritorio en Windows y
una aplicación asociada al formato de imagen; Excel web y otros programas
pueden no abrirlos. La configuración de seguridad de Office puede bloquear
la activación de objetos.

Las imágenes PNG y JPEG que se adjuntan o pegan se guardan sin recomprimir;
las marcas y recortes producen una nueva versión de la imagen. Evidencias
guardadas antes de este cambio pueden haber sido reducidas o convertidas por
el documentador y no es posible recuperar su calidad original desde ellas.
Otros formatos se convierten al guardarse o exportarse. Si una evidencia no
puede procesarse, la exportación se cancela y muestra el issue afectado.
Las imágenes originales pueden incrementar el espacio usado en el navegador.

En un Excel nuevo, puedes cambiar el estado de un issue usando la lista de la
columna Estado. Los conteos, gráficos e indicadores relacionados se recalculan
para los registros exportados. Los cambios del Excel no se sincronizan con el
documentador y no crean fechas de cierre ni entradas de historial. Los cálculos
de antigüedad y fechas utilizan los datos disponibles al exportar; la tasa de
reapertura permanece como una instantánea del historial exportado. Para tener
fechas o historial actualizados, modifica el issue en el documentador y vuelve
a exportar.

Después de modificar el código del exportador OLE o sus dependencias, ejecuta
`npm run build:excel-ole`. Para ejecutar las pruebas, usa `npm test`.
El módulo OLE incluye `cfb`, `adler-32` y `crc-32` de SheetJS bajo Apache 2.0;
sus licencias están en `CFB-LICENSE` y `SHEETJS-CHECKSUM-LICENSE`.
