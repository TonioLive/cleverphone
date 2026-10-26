export function colorFamily(value: string): string {
  const s = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  for (const [family, words] of Object.entries({
    orange: ["orange", "naranja"],
    burgundy: ["burgundy", "burgandy", "burdeos"],
    blue: ["blue", "azul", "glaciar", "glacier"],
    purple: ["purple", "violet", "violeta", "lavender", "lavanda", "lila"],
    green: ["green", "verde", "sage"],
    pink: ["pink", "rosa", "rose"],
    white: ["white", "blanco"],
    silver: ["silver", "plata"],
    black: ["black", "negro", "graphite", "grafito"],
    gold: ["gold", "oro"],
    yellow: ["yellow", "amarillo"],
  })) {
    if (words.some((word) => s.includes(word))) return family;
  }
  return s;
}
