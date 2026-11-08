export const statuses = ['unknown', 'planned', 'in_progress', 'blocked', 'completed'] as const;
export const areas = ['governance', 'education', 'research', 'digital'] as const;
export const roles = ['admin', 'editor', 'viewer'] as const;
export function isOverdue(action: { due_date?: string | null; status?: string; archived?: number }, today: string) {
 return !action.archived && !!action.due_date && action.due_date < today && !['unknown', 'completed'].includes(action.status || 'unknown');
}
export function targetNumber(value?: string | null) {
 if (value == null || !/^\d+(?:[.,]\d+)?$/.test(value.trim())) return null;
 return Number(value.replace(',', '.'));
}
export function achievement(actual: number | null | undefined, target?: string | null) {
 const n = targetNumber(target);
 return actual == null || n == null || n === 0 ? null : Math.round(actual / n * 100);
}
export function csvCell(value: unknown) {
 let s = value == null ? '' : String(value);
 if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
 return '"' + s.replaceAll('"', '""') + '"';
}
export function todayAshgabat() { return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ashgabat', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()); }
