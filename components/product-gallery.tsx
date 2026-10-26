"use client";
import { withBase } from "@/lib/base-path";
import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Expand, Smartphone, X } from "lucide-react";
import type { ProductColor } from "@/lib/catalog";

export function ProductPlaceholder({ model }: { model: string }) {
  return (
    <div className="product-photo-placeholder">
      <Smartphone strokeWidth={1} />
      <span>{model}</span>
      <small>Fotografías en preparación</small>
    </div>
  );
}

export default function ProductGallery({
  color,
  model,
  condition,
}: {
  color?: ProductColor;
  model: string;
  condition: string;
}) {
  const [index, setIndex] = useState(0),
    [zoom, setZoom] = useState(false);
  const lightbox = useRef<HTMLDialogElement>(null);
  const photos = color?.images || [],
    active = photos[index] || photos[0];
  useEffect(() => setIndex(0), [color?.key, model]);
  useEffect(() => {
    const el = lightbox.current;
    if (zoom && !el?.open) el?.showModal();
    if (!zoom && el?.open) el.close();
  }, [zoom]);
  function move(delta: number) {
    setIndex((i) => (i + delta + photos.length) % photos.length);
  }
  return (
    <div className="product-gallery">
      <div className="gallery-main">
        {active ? (
          <button
            className="gallery-image-button"
            onClick={() => setZoom(true)}
            aria-label={`Ampliar imagen ${index + 1} de ${model}`}
          >
            <img
              key={active.src}
              src={withBase(active.src)}
              alt={active.alt}
              width="900"
              height="900"
              fetchPriority="high"
            />
            <span className="gallery-expand">
              <Expand size={17} /> Ampliar
            </span>
          </button>
        ) : (
          <ProductPlaceholder model={model} />
        )}
        {photos.length > 1 && (
          <>
            <button
              className="gallery-arrow previous"
              aria-label="Imagen anterior"
              onClick={() => move(-1)}
            >
              <ChevronLeft size={20} />
            </button>
            <button
              className="gallery-arrow next"
              aria-label="Imagen siguiente"
              onClick={() => move(1)}
            >
              <ChevronRight size={20} />
            </button>
            <span className="gallery-count">
              {index + 1} / {photos.length}
            </span>
          </>
        )}
      </div>
      {photos.length > 0 && (
        <div
          className="gallery-thumbnails"
          aria-label="Fotografías del producto"
        >
          {photos.map((photo, i) => (
            <button
              key={photo.src}
              className={index === i ? "selected" : ""}
              aria-label={`Ver imagen ${i + 1}: ${photo.view}`}
              aria-pressed={index === i}
              onClick={() => setIndex(i)}
            >
              <img
                src={withBase(photo.src)}
                alt={photo.view}
                width="100"
                height="100"
                loading="lazy"
              />
            </button>
          ))}
        </div>
      )}
      {photos.length > 0 && (
        <p className="gallery-source">
          Fotos de catálogo de {model}. {active?.view ? `${active.view}. ` : ""}
          {active?.colorLabel ? `Acabado: ${active.colorLabel}.` : ""}
          {condition === "refurbished"
            ? " No muestran el estado de la unidad usada."
            : ""}
        </p>
      )}
      <dialog
        ref={lightbox}
        className="gallery-lightbox"
        aria-label={`Galería ampliada de ${model}`}
        onCancel={(e) => {
          e.preventDefault();
          setZoom(false);
        }}
        onClick={(e) => {
          if (e.target === e.currentTarget) setZoom(false);
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowRight") move(1);
          if (e.key === "ArrowLeft") move(-1);
        }}
      >
        <button
          className="lightbox-close icon-button"
          aria-label="Cerrar imagen ampliada"
          onClick={() => setZoom(false)}
        >
          <X />
        </button>
        {active && (
          <img src={withBase(active.src)} alt={active.alt} width="1200" height="1200" />
        )}
        {photos.length > 1 && (
          <>
            <button
              className="gallery-arrow previous"
              aria-label="Imagen ampliada anterior"
              onClick={() => move(-1)}
            >
              <ChevronLeft />
            </button>
            <button
              className="gallery-arrow next"
              aria-label="Imagen ampliada siguiente"
              onClick={() => move(1)}
            >
              <ChevronRight />
            </button>
          </>
        )}
        <span className="lightbox-caption">
          {model} ·{" "}
          {[active?.colorLabel, active?.view].filter(Boolean).join(" · ") ||
            color?.label}{" "}
          · {index + 1}/{photos.length}
        </span>
      </dialog>
    </div>
  );
}
