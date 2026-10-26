# CleverPhone: puesta en marcha

Estado a 25 de octubre de 2026: escaparate y carrito de demostración. Los pagos están desactivados por defecto. El catálogo procedente del TXT tiene `verified:false` y disponibilidad pendiente; ningún producto de esa lista puede cobrarse todavía. Los precios son propuestas sujetas a validar costes, fiscalidad, variante y disponibilidad. Las imágenes de IA son ilustrativas.

## Configuración del servidor

Conservar `STORE_LIVE=false` mientras se revisan catálogo, stock, cobertura de envío y documentación comercial. `.env.example` contiene únicamente nombres y valores vacíos. Para desarrollo Cloudflare admite un archivo local `.dev.vars`, excluido de Git. En producción utilizar el gestor de secretos del alojamiento; nunca variables `NEXT_PUBLIC_`, código cliente o archivos públicos.

| Nombre | Uso |
| --- | --- |
| `STORE_LIVE` | Solo el texto exacto `true` permite intentar nuevas compras. No basta por sí solo. |
| `SITE_URL` | Origen HTTPS real, por ejemplo `https://tienda.example`; sin rutas, usuario, query ni fragmentos. Los destinos de éxito y cancelación se construyen exclusivamente desde este origen. |
| `STRIPE_SECRET_KEY` | Clave secreta de la cuenta Stripe de la empresa. Usar primero una clave de prueba `sk_test_…`; no se ha configurado ninguna. |
| `STRIPE_WEBHOOK_SECRET` | Secreto `whsec_…` del endpoint concreto; los secretos de Stripe CLI y producción son diferentes. |
| `DB` | Binding Cloudflare D1, configurado mediante `d1: "DB"` en `.openai/hosting.json`. |

La API Stripe se fija en `2026-09-30.endive`. Configurar la misma versión en el destino de eventos y probar cualquier actualización antes de adoptarla. [Versionado de Stripe](https://docs.stripe.com/api/versioning).

## Base de datos y stock real

El esquema de Drizzle y las migraciones incluidas crean `inventory`, `orders`, `order_lines` y `stripe_events`. Ejecutar `npm run db:generate` cuando se cambie el esquema; incluir todo `drizzle/` en la publicación y aplicar las migraciones a la D1 correcta antes de activar cobros. El alojamiento Sites utiliza las migraciones del proyecto. Para una instalación Cloudflare propia, vincular una D1 real y aplicar los archivos SQL por el procedimiento de migraciones de ese alojamiento. No usar el identificador de base de datos de ejemplo del entorno local en producción.

No hay inventario sembrado: cero unidades se consideran confirmadas. Para habilitar un SKU hay que verificar su variante exacta, estado, capacidad, región, batería si procede, precio final, coste con impuestos, garantía y unidades físicamente disponibles. Después actualizar solo ese registro del catálogo a `verified:true` y `availabilityStatus:"in_stock"`, y registrar su stock confirmado en D1. No cambiar todos los registros en bloque por comodidad.

Ejemplo conceptual de alta de stock, que debe ejecutar un administrador autenticado en la base correcta después de comprobar la mercancía:

```sql
INSERT INTO inventory (sku, available, enabled, updated_at)
VALUES ('SKU_EXACTO_CONFIRMADO', 1, 1, 'FECHA_ISO_REAL');
```

Las compras reservan unidades mediante una transacción D1. Las restricciones SQL impiden cantidades negativas y revierten todo el pedido si otro comprador agotó el stock. Cada compra admite como máximo 5 unidades por SKU y 20 unidades en total. La existencia física vendida en otros canales debe sincronizarse con D1; no utilizar esta tabla como copia atrasada de un stock compartido. [Transacciones batch de D1](https://developers.cloudflare.com/d1/worker-api/d1-database/#batch).

## Flujo de pago implementado

`POST /api/checkout` acepta únicamente un carrito con `items:[{id,quantity}]`. Ignora cualquier precio enviado por el navegador y calcula importes en céntimos desde el catálogo del servidor. Verifica mismo origen, configuración, productos confirmados y stock D1 antes de crear una sesión Stripe Checkout alojada. Stripe recopila dirección, correo y datos de pago; no hay un formulario propio para guardar esos datos personales.

Enviar `Idempotency-Key` con un UUIDv4 generado por el navegador por cada carrito. Reutilizarlo en los reintentos del mismo carrito y generar otro al cambiar productos o cantidades. El servidor vincula ese intento a una sola reserva y recupera la misma sesión. El identificador funciona como capacidad privada: no compartirlo, registrarlo en analítica ni incorporarlo a una URL. Una cookie `HttpOnly`, `Secure`, `SameSite=Lax` permite consultar posteriormente ese pedido en el mismo navegador.

El retorno correcto es `/?session_id={CHECKOUT_SESSION_ID}` y la cancelación es `/?checkout=cancelled`. Estos parámetros no demuestran que haya un pago. `GET /api/checkout/status?session_id=…` comprueba la cookie, recupera la sesión en Stripe y exige también que el webhook haya dejado el pedido pagado en D1. Devuelve únicamente `{paid,total,currency}`, con total en céntimos y sin datos personales. Mientras el webhook esté pendiente, el frontend debe mostrar que está verificando y permitir reintentar; nunca vaciar el carrito ni afirmar que el pedido está pagado solo por la URL.

El cobro y el total del carrito incorporan un envío propuesto de **4,90 €**. Antes de activar ventas hay que aprobar tarifa y fiscalidad. Stripe Checkout recopila país ES, que incluye territorios que no son peninsulares. **Falta implementar y probar la restricción previa al cobro por código postal y zona**: el texto informativo actual no bloquea Canarias (35/38), Ceuta (51), Melilla (52) ni define cobertura de Baleares. Mantener los cobros desactivados hasta resolverlo y alinear la web, el transportista y el checkout. No es un checkout de producción listo para todas las direcciones españolas.

## Webhook, pedidos y conciliación

Registrar `https://DOMINIO_REAL/api/stripe/webhook` como destino de eventos **snapshot**, de la propia cuenta Stripe y con estos tipos:

- `checkout.session.completed`
- `checkout.session.async_payment_succeeded`
- `checkout.session.async_payment_failed`
- `checkout.session.expired`

El endpoint verifica HMAC SHA-256 sobre los bytes originales y una tolerancia de cinco minutos, recupera el estado actual en Stripe y compara importe, moneda, tienda y pedido. La clave primaria del evento evita duplicados persistentes. El cambio del pedido y el registro del evento se escriben en una misma transacción; un fallo de D1 devuelve error para que Stripe reintente. Desactivar nuevas ventas no desactiva la recepción de eventos de pagos ya iniciados. [Firmas y reintentos de Stripe](https://docs.stripe.com/events/manage-webhook-endpoints).

Una sesión caducada o un fallo asíncrono confirmado devuelve el stock una sola vez. Una respuesta Stripe 4xx definitiva y validada también revierte la reserva; conflictos de idempotencia, 429, red, timeout, respuestas no interpretables y errores 5xx conservan la reserva porque su resultado puede ser incierto. No liberar esas unidades a ciegas: conciliar con Stripe usando `metadata.order_id`, la clave estable `cleverphone-ID_DEL_PEDIDO` y los registros D1. Las sesiones expiran una hora después del inicio y su evento permite liberar reservas abandonadas. Un fallo antes de crear una sesión puede requerir conciliación manual porque no habrá evento posterior.

No hay preparación ni envío automático de mercancía, panel de administración, facturación o emails de pedido conectados. El operador debe consultar pedidos en un entorno administrativo protegido, preparar solo registros `paid`, confirmar el pago en Stripe y gestionar logística y facturación. `payment_review` exige revisión manual y nunca debe enviarse automáticamente. Los reembolsos, disputas y cambios posteriores al pago se gestionan en Stripe; falta integrar su sincronización operativa y sus eventos antes de automatizar esas tareas.

## Pruebas y activación

Primero utilizar un despliegue HTTPS de pruebas, una D1 separada, claves Stripe de prueba y un SKU de prueba confirmado con inventario limitado. No modificar la lista comercial original para saltarse bloqueos. Probar pago aprobado y rechazado, producto no confirmado, stock agotado, dos compradores para la última unidad, reintentos con la misma clave, duplicados y retrasos de webhook, firma inválida, importe alterado, cancelación, caducidad y caída de D1. Verificar que una query de éxito inventada no produce un pedido pagado. Los tests de backend incluidos se ejecutan con `node --test tests/payments.test.mjs` usando Node 24 y las dependencias del proyecto.

Antes de pasar a real: dominio y empresa configurados; términos de compra, privacidad, devoluciones, garantías y fiscalidad revisados para el negocio; variantes y stock confirmados; tarifa y zonas de envío resueltas; cuenta Stripe de la empresa verificada; webhook y migraciones comprobados; proceso de conciliación, atención al cliente y devoluciones definido. Configurar límites de solicitudes para `/api/checkout` y supervisión de fallos en el alojamiento para evitar reservas abusivas. El último cambio es habilitar `STORE_LIVE=true` en el servidor. Hasta entonces el endpoint devuelve 503 con un mensaje de pagos no activos.

## Confianza, imágenes y reseñas

No se han importado reseñas de Amazon, fotos de compradores ni puntuaciones inventadas. Solo publicar reseñas propias con permiso y trazabilidad a una compra. Un perfil externo real de Trustpilot u otra plataforma puede enlazarse cuando exista su URL; no usar estrellas, número de opiniones ni una supuesta verificación inexistentes. Las afirmaciones de distribución oficial de Apple, Samsung, Xiaomi u otras marcas requieren documentación que respalde la relación específica de esta tienda. Las imágenes generadas son ilustrativas y deben sustituirse o complementarse con fotos autorizadas de cada variante y fotos reales de la unidad usada cuando corresponda.

## Alojamiento y contrato Stripe revisados

Esta versión se publica con acceso privado para revisión. Stripe no podrá entregar webhooks a un sitio que exija inicio de sesión: antes de cobrar hace falta un dominio/endpoint públicamente accesible, con la firma Stripe validada como en este código. No activar STORE_LIVE hasta probar la entrega externa real y confirmar el cambio de audiencia de la tienda. No exponer un secreto de acceso al alojamiento como sustituto de la firma.

Se fija la API Stripe `2026-09-30.endive`, confirmada el 25/10/2026 en https://docs.stripe.com/api/versioning . La creación de Checkout usa `allowed_payment_method_types`, que filtra los métodos dinámicos habilitados en la cuenta. No usa el parámetro retirado `payment_method_types`. Referencia oficial: https://docs.stripe.com/api/checkout/sessions/create . El webhook debe configurarse con la misma versión.

## Selección de colores

Los acabados mostrados proceden de las galerías del modelo; el proveedor no ha confirmado una lista de colores. La vista previa permite elegirlos y guardarlos en el carrito. Antes de activar cobros hay que crear/confirmar una referencia de inventario para cada color: el servidor rechaza un color que no coincide con un SKU confirmado y no combina colores distintos en una única referencia. No tratar el color elegido como un comentario que pueda perderse al cobrar.
