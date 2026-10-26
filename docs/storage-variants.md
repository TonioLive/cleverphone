# Auditoría de configuraciones del catálogo

Fuente: `data/catalog.json`, revisión del 25-10-2026. El catálogo público contiene 112 referencias y 88 modelos. Los dos productos ocultos no participan en las opciones ni en la agrupación.

Hay **17 modelos con más de una capacidad**. Las opciones usan exclusivamente SKU y PVP existentes en la lista. Los modelos 4G, 5G, Pro, Plus, etc. permanecen separados; también se separan productos nuevos, segunda mano y grados de estado diferentes.

| Modelo | Configuraciones de almacenamiento y RAM | Regiones del catálogo |
| --- | --- | --- |
| Samsung A06 | 64 GB · 4 GB RAM; 128 GB · 4 GB RAM | NO EU |
| Samsung A07 | 64 GB · 4 GB RAM; 128 GB · 4 GB RAM | NO EU |
| Samsung A17 | 128 GB · 4 GB RAM; 256 GB · 8 GB RAM | NO EU; EU |
| Samsung A27 5G | 128 GB · 6 GB RAM; 256 GB · 8 GB RAM | EU |
| Samsung A37 5G | 128 GB · 6 GB RAM; 256 GB · 8 GB RAM | EU |
| Samsung A57 5G | 128 GB · 8 GB RAM; 256 GB · 8 GB RAM | EU |
| Xiaomi Redmi 15C | 128 GB · 4 GB RAM; 256 GB · 4 GB RAM | NO EU; EU |
| Xiaomi Redmi Note 12 4G | 128 GB · 6 GB RAM; 256 GB · 8 GB RAM | NO EU |
| Xiaomi Redmi A5 | 64 GB · 3 GB RAM; 128 GB · 4 GB RAM | EU |
| Xiaomi Redmi A7 Pro | 64 GB; 128 GB | EU |
| Xiaomi Redmi 17 | 128 GB · 4 GB RAM; 256 GB · 4 GB RAM | EU |
| Xiaomi Redmi 17 5G | 128 GB · 4 GB RAM; 256 GB · 4 GB RAM | EU |
| Xiaomi Redmi Note 17 | 128 GB · 4 GB RAM; 256 GB · 6 GB RAM | EU |
| Xiaomi POCO C81 Pro | 64 GB · 4 GB RAM; 128 GB · 4 GB RAM | EU |
| Motorola G05 | 128 GB · 4 GB RAM; 256 GB · 8 GB RAM | Sin confirmar |
| ZTE Blade V80 Max 4G | 128 GB · 4+8 GB RAM; 256 GB · 4+8 GB RAM | Sin confirmar |
| ZTE Blade A57 | 64 GB · 4 GB RAM; 128 GB · 4+8 GB RAM | Sin confirmar |

## Reglas de selección

- Cada opción de capacidad muestra su precio con el color seleccionado. La identidad incluye almacenamiento y RAM para que dos SKU con igual almacenamiento pero distinta RAM nunca se fundan accidentalmente. Actualmente no hay dos RAM distintas para una misma capacidad de un mismo modelo.
- Si una capacidad cambia también la RAM, la opción lo muestra. En las referencias “4+8 GB” se conserva la indicación de RAM combinada del proveedor, sin presentarla como 12 GB de RAM física.
- Se mantiene la región y la base de carga elegidas siempre que exista esa combinación en la lista. Una opción que requiere otra región lo indica antes de pulsarla. El precio procede de la referencia elegida.
- Samsung A17: 128 GB / 4 GB RAM existe en EU y NO EU; 256 GB / 8 GB RAM solo aparece en NO EU. Por eso cambiar desde 256 GB NO EU a la versión EU cambia explícitamente a 128 GB / 4 GB RAM.
- Redmi 15C: 128 GB / 4 GB RAM aparece en NO EU; 256 GB / 4 GB RAM aparece en EU. Sus capacidades muestran la región del SKU correspondiente.
- Samsung A57 5G 256 GB Violeta tiene su propio SKU de 410,90 €. Otros colores usan la referencia general de 404,90 €; el selector de capacidad refleja esa diferencia.
- Samsung A16 y Redmi Note 15 Pro Plus 5G tienen alternativas de región, con la misma capacidad y RAM. Se eligen en “Versión”.
- Qubo X340 4G y XD340 4G tienen referencias distintas con y sin base de carga. Se eligen en “Base de carga” y conservan su PVP exacto.
- En los iPhone de la lista no hay dos capacidades del mismo modelo y condición; no se añaden capacidades ni precios que el proveedor no ha enviado.

## Comprobación

`tests/product-variants.test.mjs` recorre todas las referencias públicas y comprueba que cada opción de capacidad/RAM apunta a un SKU existente con su precio original. Incluye cambios de color, región y base de carga, separación de estado/grado, rechazo de combinaciones inexistentes y orden de capacidades GB/TB.
