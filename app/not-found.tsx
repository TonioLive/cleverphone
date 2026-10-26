import { withBase } from "@/lib/base-path";

export const metadata = { title: "Página no encontrada | CleverPhone" };

export default function NotFound() {
  return (
    <main className="section-wrap" style={{ minHeight: "70vh", display: "grid", placeItems: "center", textAlign: "center" }}>
      <div>
        <span className="eyebrow">ERROR 404</span>
        <h1 style={{ fontSize: "clamp(32px, 6vw, 56px)", letterSpacing: "-1.5px", margin: "12px 0" }}>
          Este móvil se nos ha escapado.
        </h1>
        <p style={{ color: "var(--subtle)", marginBottom: 24 }}>
          La página que buscas no existe o ha cambiado de dirección.
        </p>
        <a className="button primary" href={withBase("/moviles/todos/")}>
          Ver todos los móviles
        </a>
      </div>
    </main>
  );
}
