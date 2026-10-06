import { z } from 'zod';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { db, todayISODate, PersonRow, AccountRow, LoanRow, PaymentRow } from '@/lib/db';
import { deriveStatus } from '@/hooks/useLoans';
import { getSettings } from '@/hooks/useSettings';

// ===== Backup file format =====

const iso = z.string().min(1);
const nullStr = z.string().nullable().optional().transform(v => v ?? null);

const importSchema = z.object({
  people: z.array(z.object({ id: z.string().min(1), name: z.string().min(1), phone: nullStr, notes: nullStr, created_at: iso, updated_at: iso }).passthrough()),
  accounts: z.array(z.object({ id: z.string().min(1), name: z.string().min(1), description: nullStr, icon: z.string().default('wallet'), created_at: iso, updated_at: iso }).passthrough()).default([]),
  loans: z.array(z.object({
    id: z.string().min(1), person_id: z.string().min(1), account_id: nullStr,
    amount: z.number().positive(), type: z.enum(['GIVEN', 'TAKEN']), status: z.enum(['OPEN', 'PARTIAL', 'PAID']),
    due_date: nullStr, notes: nullStr, created_at: iso, updated_at: iso,
  }).passthrough()),
  // loan_id may be missing in old backups; those rows are dropped and reported, not fatal
  payments: z.array(z.object({
    id: z.string().min(1), loan_id: nullStr, amount: z.number().positive(),
    payment_date: iso, notes: nullStr, created_at: iso,
  }).passthrough()),
});

export interface BackupTables {
  people: PersonRow[];
  accounts: AccountRow[];
  loans: LoanRow[];
  payments: PaymentRow[];
}

export interface ImportReport {
  droppedLoans: number;      // loans whose person isn't in the file
  droppedPayments: number;   // payments with no loan_id, or whose loan isn't in the file
  clearedAccounts: number;   // loans pointing to a missing account (kept, account cleared)
  fixedStatuses: number;     // loans whose stored status didn't match their payments
}

/** Midnight-UTC timestamps written by older versions are really calendar days */
function normalizePaymentDate(s: string): string {
  return /^\d{4}-\d{2}-\d{2}T00:00:00(\.0+)?Z$/.test(s) ? s.slice(0, 10) : s;
}

/**
 * Validate a parsed backup and repair what can be repaired: rows that point at missing
 * records are dropped (or unlinked) and every loan status is recomputed from its payments.
 * Throws with the first failing field when the file can't be used at all.
 */
export function prepareImport(raw: unknown): { tables: BackupTables; report: ImportReport } {
  const parsed = importSchema.safeParse(raw);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw new Error(`Invalid backup file (${issue.path.join('.')}: ${issue.message}).`);
  }
  // Drop user_id (from the old cloud version) and any other extra keys we don't store
  const strip = <T extends object>(obj: T) => {
    const { user_id, ...rest } = obj as T & { user_id?: unknown };
    return rest as T;
  };
  const data = parsed.data;
  const report: ImportReport = { droppedLoans: 0, droppedPayments: 0, clearedAccounts: 0, fixedStatuses: 0 };

  const people = data.people.map(strip) as PersonRow[];
  const accounts = data.accounts.map(strip) as AccountRow[];
  const personIds = new Set(people.map(p => p.id));
  const accountIds = new Set(accounts.map(a => a.id));

  const loans: LoanRow[] = [];
  for (const l of data.loans) {
    if (!personIds.has(l.person_id)) { report.droppedLoans++; continue; }
    const loan = strip(l) as LoanRow;
    if (loan.account_id && !accountIds.has(loan.account_id)) {
      loan.account_id = null;
      report.clearedAccounts++;
    }
    loans.push(loan);
  }

  const loanIds = new Set(loans.map(l => l.id));
  const payments: PaymentRow[] = [];
  for (const p of data.payments) {
    if (!p.loan_id || !loanIds.has(p.loan_id)) { report.droppedPayments++; continue; }
    payments.push({ ...strip(p), payment_date: normalizePaymentDate(p.payment_date) } as PaymentRow);
  }

  const paidByLoan = new Map<string, number>();
  for (const p of payments) paidByLoan.set(p.loan_id, (paidByLoan.get(p.loan_id) ?? 0) + Number(p.amount));
  for (const loan of loans) {
    const status = deriveStatus(loan.amount, paidByLoan.get(loan.id) ?? 0);
    if (status !== loan.status) { loan.status = status; report.fixedStatuses++; }
  }

  return { tables: { people, accounts, loans, payments }, report };
}

/** Replace everything on the device with the given tables, all or nothing */
export async function restoreTables(t: BackupTables) {
  await db.transaction('rw', db.people, db.accounts, db.loans, db.payments, async () => {
    await Promise.all([db.people.clear(), db.accounts.clear(), db.loans.clear(), db.payments.clear()]);
    if (t.people.length) await db.people.bulkAdd(t.people);
    if (t.accounts.length) await db.accounts.bulkAdd(t.accounts);
    if (t.loans.length) await db.loans.bulkAdd(t.loans);
    if (t.payments.length) await db.payments.bulkAdd(t.payments);
  });
}

/** The whole database as a backup file's JSON text */
export async function buildBackupJson(): Promise<string> {
  const [people, accounts, loans, payments] = await Promise.all([
    db.people.toArray(),
    db.accounts.toArray(),
    db.loans.toArray(),
    db.payments.toArray(),
  ]);
  return JSON.stringify({ exportedAt: new Date().toISOString(), version: 1, people, accounts, loans, payments }, null, 2);
}

// ===== Backup tracking =====

const LAST_AUTO_KEY = 'lt_last_auto_backup';
const LAST_EXPORT_KEY = 'lt_last_export';

export const AUTO_BACKUP_FOLDER = 'LoanTracker';
const AUTO_BACKUP_KEEP = 7;
const AUTO_BACKUP_FILE = /^loantracker-auto-\d{4}-\d{2}-\d{2}\.json$/;

function readKey(key: string): string | null {
  try { return localStorage.getItem(key); } catch { return null; }
}

export function markExported() {
  try { localStorage.setItem(LAST_EXPORT_KEY, todayISODate()); } catch { /* ignore */ }
}

/** Most recent yyyy-MM-dd on which a manual export or auto-backup succeeded */
export function getLastBackupDate(): string | null {
  const dates = [readKey(LAST_AUTO_KEY), readKey(LAST_EXPORT_KEY)].filter((d): d is string => !!d);
  return dates.length ? dates.sort().at(-1)! : null;
}

export function daysSince(isoDate: string, today = todayISODate()): number {
  const [a, b] = [isoDate, today].map(d => Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10)));
  return Math.round((b - a) / 864e5);
}

/**
 * Once a day on Android, write a backup to Documents/LoanTracker and keep the newest 7.
 * Public Documents survives an uninstall, and Settings → Import can read it back.
 * Returns true when a backup was written.
 */
export async function runAutoBackup(): Promise<boolean> {
  if (!Capacitor.isNativePlatform() || !getSettings().autoBackup) return false;
  const today = todayISODate();
  if (readKey(LAST_AUTO_KEY) === today) return false;
  // Nothing to protect yet: don't let empty files rotate out real backups
  if ((await db.people.count()) === 0) return false;

  try {
    await Filesystem.writeFile({
      path: `${AUTO_BACKUP_FOLDER}/loantracker-auto-${today}.json`,
      data: await buildBackupJson(),
      directory: Directory.Documents,
      encoding: Encoding.UTF8,
      recursive: true,
    });
    localStorage.setItem(LAST_AUTO_KEY, today);
  } catch (err) {
    console.log('Auto-backup failed:', err);
    return false;
  }

  // Rotate; files left by an earlier install may not be deletable, which is fine
  try {
    const { files } = await Filesystem.readdir({ path: AUTO_BACKUP_FOLDER, directory: Directory.Documents });
    const old = files.map(f => f.name).filter(n => AUTO_BACKUP_FILE.test(n)).sort().slice(0, -AUTO_BACKUP_KEEP);
    for (const name of old) {
      await Filesystem.deleteFile({ path: `${AUTO_BACKUP_FOLDER}/${name}`, directory: Directory.Documents }).catch(() => {});
    }
  } catch (err) {
    console.log('Auto-backup rotation failed:', err);
  }
  return true;
}
