// French plural: 0 and 1 take the singular ("0 titre", "1 titre", "2 titres").
export function pl(n: number, one: string, many: string = `${one}s`): string {
  return `${n.toLocaleString("fr-FR")} ${Math.abs(n) < 2 ? one : many}`;
}
