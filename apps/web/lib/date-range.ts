// Bornes de période partagées entre Transactions et Rapports — un seul endroit à corriger
// si la logique change (ex: définition du début de semaine).
//
// Pour une borne "to" issue d'un <input type="date"> (ex: "2026-08-27"), `new Date(...)`
// tombe à minuit UTC : filtrer avec `lte` sur cette valeur exclurait toute la journée
// sélectionnée. `endOfDayIso` ramène la borne à 23:59:59.999 ce jour-là pour que "au 27 août"
// inclue bien tout le 27 août.
export function endOfDayIso(dateOnly: string): string {
  const [year, month, day] = dateOnly.split('-').map(Number);
  return new Date(year, month - 1, day, 23, 59, 59, 999).toISOString();
}

export function startOfDayIso(dateOnly: string): string {
  const [year, month, day] = dateOnly.split('-').map(Number);
  return new Date(year, month - 1, day).toISOString();
}

export type PeriodOption = 'today' | 'week' | 'month' | 'year' | 'custom';

export function periodRange(period: Exclude<PeriodOption, 'custom'>): { from: string; to: string } {
  const now = new Date();
  if (period === 'today') {
    return { from: new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString(), to: now.toISOString() };
  }
  if (period === 'week') {
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
    return { from: start.toISOString(), to: now.toISOString() };
  }
  if (period === 'year') {
    return { from: new Date(now.getFullYear(), 0, 1).toISOString(), to: now.toISOString() };
  }
  return { from: new Date(now.getFullYear(), now.getMonth(), 1).toISOString(), to: now.toISOString() };
}
