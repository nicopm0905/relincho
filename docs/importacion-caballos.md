# Importación de caballos desde Excel o CSV

Puedes probar el importador con el [CSV de ejemplo ficticio](ejemplo-importacion-caballos.csv). No contiene datos reales; la columna `Yeguada anterior` se deja deliberadamente sin mapear para ilustrar el aviso de columnas no importadas.

## Qué se importa

La importación crea fichas básicas de caballos desde un libro `.xlsx` o un archivo `.csv`, después de mostrar una vista previa y de confirmar. Los campos reconocidos son nombre, sexo, estado, raza, capa, nacimiento, UELN, número del Libro Genealógico PRE, microchip, hierro del criador y ubicación/box. También se puede reimportar el CSV de exportación de caballos; sus columnas de padre, madre y propietario se mostrarán como no importadas porque todavía no forman parte de la ficha básica de importación.

Para CSV, guarda el archivo como UTF-8. Se detectan automáticamente separadores punto y coma, coma o tabulador, y se admiten comillas escapadas y celdas multilínea. La exportación propia usa punto y coma para abrirse correctamente en Excel con configuración española.

La exportación CSV actual incluye los datos principales de las fichas de caballos; no es una copia de seguridad completa de la yeguada ni incluye historiales de otros módulos.

La cabecera puede estar en cualquiera de las primeras 10 filas de una hoja. Se busca entre las hojas del libro la tabla con mejor coincidencia; en caso de empate se prefiere la hoja `Caballos`. La primera fila identificada como tabla sirve de cabecera. Se aceptan encabezados en español e inglés habituales y se normalizan tildes, puntuación y espacios.

La importación no crea todavía historiales sanitarios, propietarios, ascendencia, movimientos, sesiones de entrenamiento, contratos ni documentos. Las columnas no reconocidas se advierten en pantalla: no se deben considerar migradas. Para no truncar en silencio, la confirmación se bloquea si hay más de 1.000 filas a procesar; se recomienda dividir el libro y repetir la operación.

## Controles

- Nombre y sexo son obligatorios.
- Fechas de nacimiento admiten celdas de fecha de Excel, `dd/mm/aaaa` y `aaaa-mm-dd`; una fecha inexistente es error.
- UELN y microchip se normalizan (espacios/guiones) y validan por formato.
- Los identificadores repetidos dentro del mismo archivo se señalan, aceptando solo la primera aparición válida.
- Los identificadores ya presentes en la yeguada se omiten al confirmar el alta masiva.
- Los errores de fila aparecen en la vista previa; esas filas no se crean.

## Preparar una prueba con datos de una yeguada

No hace falta enviar información personal para afinar los nombres de columna. Para compartir un ejemplo:

1. Duplica el archivo y conserva solo la fila de cabeceras y entre 3–5 filas ficticias o anonimizadas.
2. Sustituye nombres de caballos y personas, teléfonos, direcciones, NIF, emails, identificadores y cualquier nota clínica por valores ficticios.
3. Conserva los textos de encabezado y el tipo de dato (p. ej., fecha, microchip, PRE) si quieres comprobar su mapeo. Puedes enmascarar parte de los identificadores si no necesitas probar su validación.
4. Elimina hojas que no sean necesarias para probar caballos.
5. Comparte ese archivo de prueba, no el Excel de producción.

Para cada columna dudosa indica qué significa y si esperas importarla a la ficha. También conviene decir qué aplicación generó el Excel y si la tabla tiene filas de título o una pestaña de instrucciones.
