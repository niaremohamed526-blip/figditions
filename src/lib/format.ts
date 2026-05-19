export const fcfa = (n: number | null | undefined) => {
  const v = Number(n ?? 0);
  return new Intl.NumberFormat("fr-FR").format(Math.round(v)) + " FCFA";
};
