export const fcfa = (n: number | null | undefined) => {
  const v = Number(n ?? 0);
  return new Intl.NumberFormat("fr-FR").format(Math.round(v)) + " FCFA";
};

/** Turns internal enum or field values into readable copy without changing stored data. */
export const humanizeSystemValue = (value: string | null | undefined) => {
  if (!value) return "";
  const readable = value.replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
  return readable.charAt(0).toLocaleUpperCase("fr-FR") + readable.slice(1);
};
