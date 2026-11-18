# Documentador de casos

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
