import { File, Paths } from 'expo-file-system';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import type { DataState } from '@/store/useStore';
import { formatMoney } from './format';
import { computeEarnings } from './pay';
import { getInstances, toWorked } from './schedule';
import { buildXlsx } from './xlsx';

const cell = (v: string | number) => {
  const s = String(v);
  // quote, and neutralise spreadsheet formula injection from user-entered notes/titles
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};

function buildRows(state: DataState, from: string, to: string, advanced: boolean, now: number) {
  const templates = Object.fromEntries(state.templates.map((t) => [t.id, t]));
  const inst = getInstances(state.shifts, state.rotations, templates, from, to);
  const header = ['Date', 'Workplace', 'Shift', 'Start', 'End', 'Break (min)', 'Scheduled hours', 'Worked hours', 'Est. gross', 'Currency', 'Note'];
  const rows = [header];
  for (const wp of state.workplaces) {
    const opts = { weekStartsOn: state.settings.weekStartsOn, advanced };
    const sched = computeEarnings(inst, wp, opts);
    const worked = inst.map((i) => toWorked(i, now)).filter((i): i is NonNullable<typeof i> => !!i);
    const w = computeEarnings(worked, wp, opts);
    for (const i of inst.filter((x) => x.workplaceId === wp.id)) {
      const wb = w.get(i.id);
      rows.push([
        i.date, wp.name, i.title, i.actual?.start ?? i.start, i.actual?.end ?? i.end, String(i.actual?.breakMin ?? i.breakMin),
        (sched.get(i.id)!.paidMin / 60).toFixed(2),
        wb ? (wb.paidMin / 60).toFixed(2) : '',
        (wb ?? sched.get(i.id)!).pay.toFixed(2),
        state.settings.currency, i.note ?? '',
      ]);
    }
  }
  rows.splice(1, rows.length - 1, ...rows.slice(1).sort((a, b) => a[0].localeCompare(b[0])));
  return rows;
}

export const buildCsv = (state: DataState, from: string, to: string, advanced: boolean, now = Date.now()) =>
  buildRows(state, from, to, advanced, now).map((r) => r.map(cell).join(',')).join('\n');

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

/** Printable HTML report for a period; user text is escaped. */
export function buildReportHtml(state: DataState, from: string, to: string, advanced: boolean, now = Date.now()) {
  const [header, ...rows] = buildRows(state, from, to, advanced, now);
  const cols = [0, 1, 2, 3, 4, 5, 6, 7, 8]; // currency and note columns are left out of the printed table
  const sum = (k: number) => rows.reduce((a, r) => a + (Number(r[k]) || 0), 0);
  const money = (n: number) => formatMoney(n, state.settings.currency);
  const th = cols.map((k) => `<th>${esc(header[k])}</th>`).join('');
  const body = rows.map((r) => `<tr>${cols.map((k) => `<td>${esc(k === 8 ? money(Number(r[k])) : r[k])}</td>`).join('')}</tr>`).join('');
  return `<!doctype html><html><head><meta charset="utf-8"><style>
body{font-family:-apple-system,Roboto,Helvetica,sans-serif;color:#1b1714;padding:24px;font-size:11px}
h1{font-size:22px;margin:0}p{color:#6b625a;margin:4px 0 16px}
.sum{display:flex;gap:24px;margin-bottom:16px}.sum b{display:block;font-size:16px;color:#1b1714}
table{width:100%;border-collapse:collapse}th,td{text-align:left;padding:6px 4px;border-bottom:1px solid #e6dfd6}
th{font-size:10px;text-transform:uppercase;color:#6b625a}td:nth-child(n+6){text-align:right}
footer{margin-top:16px;color:#8a8178;font-size:9px}
</style></head><body>
<h1>Shiftly report</h1><p>${esc(from)} – ${esc(to)}</p>
<div class="sum"><div>Shifts<b>${rows.length}</b></div><div>Scheduled<b>${sum(6).toFixed(2)}h</b></div><div>Worked<b>${sum(7).toFixed(2)}h</b></div><div>Est. gross<b>${esc(money(sum(8)))}</b></div></div>
<table><thead><tr>${th}</tr></thead><tbody>${body}</tbody></table>
<footer>Estimate before taxes and deductions, generated from your schedule. Not a payroll document.</footer>
</body></html>`;
}

export async function exportPdf(state: DataState, from: string, to: string, advanced: boolean) {
  const { uri } = await Print.printToFileAsync({ html: buildReportHtml(state, from, to, advanced) });
  if (!(await Sharing.isAvailableAsync())) throw new Error('Sharing is not available on this device.');
  await Sharing.shareAsync(uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf', dialogTitle: `shiftly-${from}-to-${to}.pdf` });
}

async function share(name: string, content: string | Uint8Array, mimeType: string, UTI?: string) {
  const file = new File(Paths.cache, name);
  if (file.exists) file.delete();
  file.create();
  file.write(content);
  if (!(await Sharing.isAvailableAsync())) throw new Error('Sharing is not available on this device.');
  await Sharing.shareAsync(file.uri, { mimeType, UTI, dialogTitle: name });
}

export const exportCsv = (state: DataState, from: string, to: string, advanced: boolean) =>
  share(`shiftly-${from}-to-${to}.csv`, buildCsv(state, from, to, advanced), 'text/csv');

export const exportXlsx = (state: DataState, from: string, to: string, advanced: boolean) =>
  share(
    `shiftly-${from}-to-${to}.xlsx`,
    buildXlsx(buildRows(state, from, to, advanced, Date.now()), [5, 6, 7, 8]),
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'org.openxmlformats.spreadsheetml.sheet',
  );

export type ExportFormat = 'pdf' | 'xlsx' | 'csv';
export const EXPORT_FORMATS: { label: string; value: ExportFormat }[] = [
  { label: 'PDF report', value: 'pdf' },
  { label: 'Excel (.xlsx)', value: 'xlsx' },
  { label: 'CSV', value: 'csv' },
];
export const exportAs = (f: ExportFormat, state: DataState, from: string, to: string, advanced: boolean) =>
  ({ pdf: exportPdf, xlsx: exportXlsx, csv: exportCsv })[f](state, from, to, advanced);

export const exportBackup = (state: DataState) => {
  const { settings, workplaces, templates, shifts, rotations, paychecks } = state;
  return share(
    `shiftly-backup-${new Date().toISOString().slice(0, 10)}.json`,
    JSON.stringify({ app: 'shiftmate', version: 1, settings, workplaces, templates, shifts, rotations, paychecks }, null, 2),
    'application/json',
  );
};
