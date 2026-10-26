# CleverPhone

**Web pública:** https://toniolive.github.io/cleverphone/

Tienda de móviles diseñada primero para móvil, con estética de cristal azul, catálogo con filtros, favoritos, fichas de producto con galería por color y carrito persistente en el navegador. Incluye la base de Stripe Checkout (validación de precio e inventario en servidor) para el despliegue con backend.

## Dos formas de desplegar

| Modo | Comando | Qué incluye |
| --- | --- | --- |
| **Estático (GitHub Pages)** — actual | `npm run build:static` → `./out` | Escaparate, catálogo, fichas, favoritos y carrito. Sin pagos: el botón indica «Compra online próximamente». |
| Con servidor (Cloudflare Workers + D1) | `npm run build` | Todo lo anterior + `/api/checkout` y webhook de Stripe. Ver `PUESTA-EN-MARCHA.md`. |

Cada push a `main` publica automáticamente la versión estática con `.github/workflows/pages.yml`. En dominio propio, cambiar `NEXT_PUBLIC_BASE_PATH` a vacío y `NEXT_PUBLIC_SITE_URL` al dominio.

## Desarrollo

Requiere Node.js ≥22.13 y npm.

```sh
npm ci
npm run dev            # http://127.0.0.1:5173
npm run typecheck
npm test
npm run check:media
NEXT_PUBLIC_BASE_PATH=/cleverphone npm run build:static   # prueba local del sitio estático
```

## Catálogo y datos privados

El repositorio es **público**: nunca subir costes, márgenes ni datos del proveedor.

- `private/catalog.private.json` — catálogo de trabajo con costes y márgenes. **Excluido de Git** (`.gitignore`). Junto a él, el análisis de precios y la auditoría de importación.
- `data/catalog.json` — catálogo **público** generado con `npm run catalog:public`. Solo incluye campos de venta (modelo, capacidad, estado, PVP, notas, verificación). El workflow falla si detecta campos privados.
- `lib/catalog.ts` — selección de campos que llegan al navegador.

Flujo para cambiar precios o stock: editar `private/catalog.private.json` → `npm run catalog:public` → commit de `data/catalog.json`.

Para habilitar un SKU hay que confirmar EAN, región, memoria, color, garantía y estado real; no basta con cambiar `verified`: hay inventario y configuración de servidor adicionales.

## Páginas, colores y fotografías

- Inicio: `/` con movimiento al bajar y revelado de secciones; respeta la preferencia de reducir movimiento.
- Catálogos: `/moviles/nuevos`, `/moviles/reacondicionados` y `/moviles/todos`.
- Producto: `/producto/iphone-17`, por ejemplo. El parámetro `variante` conserva capacidad/versión y `color` conserva el acabado seleccionado. Las URL antiguas por SKU siguen resolviendo.
- Galería ampliable con fotos reales de catálogo del modelo. Las fotografías de productos usados no muestran el estado de la unidad concreta.
- Los colores cambian la imagen y se guardan en el carrito. Cuando la lista diferencia un precio por color, se selecciona su variante correspondiente.

`data/media-*.json` recoge galerías y procedencia por imagen. `node scripts/merge-product-media.mjs` valida las rutas y genera `data/media-index.json` y `data/media-coverage.json`. El catálogo público sólo recibe las miniaturas necesarias; la página de producto recibe su galería completa. 

La portada conserva la imagen editorial generada con IA. Las fichas ya no usan imágenes genéricas de otra marca/modelo. La cobertura actual es de 88 modelos visibles, 112 variantes y 202 galerías de color con cuatro imágenes distintas. Algunos básicos incluyen detalles ampliados identificados. Ver `docs/catalogue-photos.md`. El Samsung XCover se retiró por petición del usuario; Nubia Focus 4G y Denver BAS-1860L están ocultos hasta identificar su referencia exacta.

No hay reseñas ficticias ni importadas de Amazon. El apartado de opiniones está vacío y señala su estado. Trustpilot está pendiente de perfil. La acreditación como distribuidor autorizado se incorporará cuando esté documentada.

## Estado de lanzamiento

La web pública es un escaparate en preparación. Los cobros están desactivados por defecto; faltan cuenta Stripe, datos legales, políticas definitivas, validación de inventario y producto y pruebas completas del flujo de pago. Ver los pasos concretos en `PUESTA-EN-MARCHA.md`.

## Trabajo compartido

Crear una rama por cambio y abrir una pull request. No versionar nunca `private/` ni costes del proveedor. Las credenciales se guardan en el gestor de secretos del hosting, nunca en commits, issues o chat.
