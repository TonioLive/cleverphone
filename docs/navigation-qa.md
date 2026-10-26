# Navegación y configuración: revisión del 25-10-2026

## Corrección

En producción se reprodujo el clic normal de una tarjeta que no abría la ficha. La consola mostraba errores de navegación/prefetch RSC de Vinext (`TypeError: ... is not a function`). El enlace directo sí respondía. Los enlaces internos de tarjetas, cabecera y ficha usan ahora anclas HTML nativas, de forma que abrir un producto no depende de esa navegación cliente.

El catálogo muestra una tarjeta por modelo, condición y grado; las capacidades y otras variantes se eligen dentro de la ficha. Antes de agrupar se aplican los filtros y se elige una referencia real, conservando su precio. La auditoría completa de capacidades está en `storage-variants.md`.

Los favoritos se reconocen por modelo, condición y grado para que cambiar el color o la capacidad no oculte el dispositivo guardado. La vista de favoritos elimina los filtros que podrían esconderlo. «Teléfonos básicos» abre su catálogo sin heredar la condición ni otros filtros. Las fotos y los títulos del carrito enlazan a la configuración seleccionada.

## Comprobaciones

- 121 rutas HTTP comprobadas: 112 referencias visibles, inicio/categorías y respuestas 404 de referencias ocultas o inexistentes.
- 31 pruebas automatizadas: pagos, idempotencia, stock, webhooks, colores y configuración; cada capacidad/RAM apunta a una referencia y un precio existentes.
- Navegador de escritorio y móvil a 390 × 844: clic de tarjeta y título, categorías, enlaces desde el carrito, búsqueda, marcas, filtros de capacidad/región/presupuesto, ordenación, restablecimiento y carga de más productos.
- Galería: miniaturas, flechas, ampliación y cierre. Ficha: pestañas, colores, almacenamiento y conservación de la configuración al recargar.
- Favoritos: guardar y recuperar un modelo aunque cambie su capacidad/color, incluidos cambios de sección.
- Carrito: añadir, sumar, restar, eliminar, vaciar y volver al catálogo. «Continuar al pago» muestra el estado de pagos desactivados; no se ha realizado ningún cobro.
- Menú móvil y diálogos de garantía, envío, opiniones, aviso legal, privacidad y condiciones.
- Samsung A57 5G: 128 GB Lila a 362,90 €; 256 GB Lila a 410,90 €; 256 GB Azul oscuro a 404,90 €. URL y recarga conservan la configuración; el carrito conserva capacidad y color.
- Pantalla móvil sin desbordamiento horizontal: 390 px de contenido en una ventana de 390 px.

No se han importado reseñas ajenas ni se han atribuido compras externas a CleverPhone. El apartado de opiniones permanece sin valoraciones hasta recibir opiniones reales.
