// src/shared/themes.ts
export const themes = [
  {
    id: "dark",
    name: "Graphite",
    description: "Le contraste familier de Liora.",
    world: "classique",
  },
  {
    id: "light",
    name: "Papier",
    description: "Une interface claire et sobre.",
    world: "classique",
  },
  {
    id: "dusk",
    name: "Crépuscule",
    description: "Une palette chaude et douce.",
    world: "classique",
  },
  {
    id: "midnight",
    name: "Minuit",
    description: "Bleu lumineux sur fond profond.",
    world: "classique",
  },
  {
    id: "forest",
    name: "Forêt",
    description: "Des nuances végétales.",
    world: "classique",
  },
  {
    id: "ember",
    name: "Braise",
    description: "Une palette rouge et cuivrée.",
    world: "classique",
  },
  {
    id: "atelier",
    name: "Atelier",
    description: "Papier ivoire, titres sérif et lignes éditoriales.",
    world: "éditorial",
  },
  {
    id: "orbit",
    name: "Orbital",
    description: "Surfaces arrondies, espaces ouverts et accents cobalt.",
    world: "souple",
  },
  {
    id: "terminal",
    name: "Terminal",
    description: "Typographie monospace, angles nets et grille précise.",
    world: "technique",
  },
  {
    id: "lagoon",
    name: "Lagune",
    description: "Teintes minérales claires, accents turquoise et rythme aéré.",
    world: "minéral",
  },
] as const;
export const themeIds = themes.map((t) => t.id);
export function themeId(value: unknown) {
  return themes.find((t) => t.id === value)?.id || "dark";
}
