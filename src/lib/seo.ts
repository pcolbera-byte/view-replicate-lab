export function pageHead(
  title: string,
  description = "Gestão da carteira da corretora de seguros.",
) {
  const full = `${title} — Vigentt`;
  return {
    meta: [
      { title: full },
      { name: "description", content: description },
      { property: "og:title", content: full },
      { property: "og:description", content: description },
    ],
  };
}
