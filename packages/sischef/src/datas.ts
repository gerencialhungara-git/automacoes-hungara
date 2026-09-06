/** Conversões entre o ISO que a API usa e o dd/MM/aaaa que o Sischef exige. */

/** "2026-09-01" -> "01/09/2026" */
export function isoParaBr(iso: string): string {
  const [ano, mes, dia] = iso.split("-");
  if (!ano || !mes || !dia) throw new Error(`Data fora do formato AAAA-MM-DD: ${iso}`);
  return `${dia}/${mes}/${ano}`;
}

/** "31/08/2026" ou "31/08/2026 15:17:05" -> "2026-08-31" / "2026-08-31T15:17:05" */
export function brParaIso(br: string): string {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})(?:[ T](\d{2}:\d{2}(?::\d{2})?))?$/.exec(br.trim());
  if (!m) return br;
  const [, dia, mes, ano, hora] = m;
  return hora ? `${ano}-${mes}-${dia}T${hora}` : `${ano}-${mes}-${dia}`;
}

/**
 * "1.234,56" -> 1234.56 · "8,00" -> 8 · "" -> null
 * O export do Sischef manda número como texto em pt-BR.
 */
export function brParaNumero(valor: unknown): number | null {
  if (typeof valor === "number") return valor;
  if (valor === null || valor === undefined) return null;
  const s = String(valor).trim();
  if (s === "" || s === "-") return null;
  const n = Number(s.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
}
