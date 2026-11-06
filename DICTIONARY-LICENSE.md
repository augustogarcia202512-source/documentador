# Licencia del diccionario español

El corrector del navegador incluye `dictionary-es` (versión 4.x), un
diccionario Hunspell generado a partir de
[sbosio/rla-es](https://github.com/sbosio/rla-es) y empaquetado por
[wooorm/dictionaries](https://github.com/wooorm/dictionaries). El diccionario
se ofrece bajo una de estas licencias: GPL-3.0, LGPL-3.0 o MPL-1.1.

Este proyecto opta por MPL-1.1 para el diccionario. El texto completo está en
`MPL-1.1.txt` y el aviso de autoría del paquete en `dictionary-es.LICENSE`.
Los metadatos del paquete y el código fuente del diccionario están disponibles
en la dependencia npm.

`nspell` y `esbuild` usan licencia MIT. La revisión y las sugerencias se
ejecutan en el navegador con el diccionario incluido en el bundle; el texto
ingresado no se envía a ningún servicio. Después de actualizar dependencias,
genera el bundle con `npm run build`.
