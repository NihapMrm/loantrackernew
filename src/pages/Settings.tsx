import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { MobileLayout } from "@/components/layout/MobileLayout";
import { LoanTrackerLogo } from "@/components/ui/LoanTrackerLogo";
import { Button } from "@/components/ui/button";
import { db } from "@/lib/db";
import { prepareImport, restoreTables, buildBackupJson, markExported, getLastBackupDate, runAutoBackup, ImportReport, AUTO_BACKUP_FOLDER } from "@/lib/backup";
import { useSecurity, allowExternalActivity } from "@/lib/security";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Capacitor } from "@capacitor/core";
import { Filesystem, Directory, Encoding } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";
import {
  Upload,
  Trash2,
  CheckCircle,
  Loader2,
  AlertCircle,
  Shield,
  Download,
  Lock,
  Fingerprint,
  ChevronRight,
  DollarSign,
  Hash,
  Calendar,
  Vibrate,
  ChevronDown,
  Delete,
  WifiOff,
  Database,
} from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useSettings, AppSettings } from "@/hooks/useSettings";
import { formatAmount, formatDate } from "@/lib/formatting";
import { cn } from "@/lib/utils";

export default function Settings() {
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{
    people: number;
    accounts: number;
    loans: number;
    payments: number;
    report: ImportReport;
  } | null>(null);
  const [importError, setImportError] = useState("");

  // File picked -> wait for the user to confirm before replacing anything
  const [pendingFile, setPendingFile] = useState<File | null>(null);

  const handleFilePicked = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPendingFile(e.target.files?.[0] ?? null);
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleImport = async (file: File) => {
    setImporting(true);
    setImportResult(null);
    setImportError("");

    try {
      let raw: unknown;
      try {
        raw = JSON.parse(await file.text());
      } catch {
        throw new Error("This file is not a LoanTracker backup (not valid JSON).");
      }
      const { tables, report } = prepareImport(raw);
      await restoreTables(tables);
      queryClient.invalidateQueries();

      setImportResult({
        people: tables.people.length,
        accounts: tables.accounts.length,
        loans: tables.loans.length,
        payments: tables.payments.length,
        report,
      });

      toast.success("Data imported successfully!");
    } catch (err: any) {
      console.error(err);
      setImportError(err.message || "Import failed.");
      toast.error("Import failed: " + (err.message || "Unknown error"));
    } finally {
      setImporting(false);
    }
  };

  const handleClearData = async () => {
    try {
      await db.transaction("rw", db.people, db.accounts, db.loans, db.payments, async () => {
        await db.people.clear();
        await db.accounts.clear();
        await db.loans.clear();
        await db.payments.clear();
      });
      setImportResult(null);
      queryClient.invalidateQueries();
      toast.success("All data cleared.");
    } catch (err: any) {
      toast.error("Failed to clear data: " + err.message);
    }
  };

  const handleExport = async () => {
    try {
      const json = await buildBackupJson();
      const fileName = `loantracker-backup-${new Date().toISOString().slice(0, 10)}.json`;

      if (Capacitor.isNativePlatform()) {
        // Write to cache directory then share — no storage permissions required
        await Filesystem.writeFile({
          path: fileName,
          data: json,
          directory: Directory.Cache,
          encoding: Encoding.UTF8,
        });
        const { uri } = await Filesystem.getUri({
          path: fileName,
          directory: Directory.Cache,
        });
        allowExternalActivity();
        await Share.share({
          title: "LoanTracker Backup",
          text: "LoanTracker backup file",
          url: uri,
          dialogTitle: "Save backup to…",
        });
        markExported();
      } else {
        // Browser fallback
        const blob = new Blob([json], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        markExported();
        toast.success("Backup downloaded!");
      }
    } catch (err: any) {
      // Share cancelled by user — not a real error
      if (err?.message?.includes("cancel") || err?.errorMessage?.includes("cancel")) return;
      toast.error("Export failed: " + err.message);
    }
  };

  return (
    <MobileLayout>
      <div className="pb-10 max-w-2xl mx-auto">

        {/* ── Header ── */}
        <div className="px-4 pt-6 pb-4 lg:px-10 lg:pt-8">
          <div className="flex items-center gap-2 mb-5">
            <div className="w-1.5 h-5 rounded-full bg-primary" />
            <span className="text-sm font-black tracking-tight text-foreground">Settings</span>
          </div>

          {/* App hero tile */}
          <div className="rounded-2xl bg-foreground p-5 flex items-center gap-4 relative overflow-hidden">
            <div className="absolute -bottom-8 -right-8 w-36 h-36 rounded-full bg-white/5 pointer-events-none" />
            <div className="absolute -top-6 -left-6 w-24 h-24 rounded-full bg-white/5 pointer-events-none" />
            <div className="w-16 h-16 rounded-[18px] overflow-hidden shrink-0 z-10 shadow-lg bg-white p-2">
              <LoanTrackerLogo className="w-full h-full" />
            </div>
            <div className="z-10">
              <p className="text-xl font-black text-white leading-tight tracking-tight">LoanTracker</p>
              <p className="text-[11px] text-white/50 font-medium mt-0.5">Version 1.0.0 · 100% Offline</p>
              <div className="flex items-center gap-1 mt-2">
                <WifiOff className="w-3 h-3 text-white/40" />
                <span className="text-[10px] text-white/40">All data stays on this device</span>
              </div>
            </div>
          </div>
        </div>

        <div className="px-4 space-y-1 lg:px-10">

          {/* ── Display Section ── */}
          <DisplaySection />

          {/* ── Data Section ── */}
          <SectionLabel>Data</SectionLabel>
          <div className="grid grid-cols-2 gap-2.5">

            {/* Export tile */}
            <button
              onClick={handleExport}
              className="rounded-2xl bg-card border border-border p-4 flex flex-col gap-3 text-left active:scale-[0.97] transition-transform shadow-sm"
            >
              <span className="w-10 h-10 rounded-[12px] bg-emerald-100 dark:bg-emerald-950 flex items-center justify-center">
                <Download className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              </span>
              <div>
                <p className="text-sm font-bold text-foreground">Export</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">Save a backup</p>
              </div>
            </button>

            {/* Import tile */}
            <button
              onClick={() => { allowExternalActivity(); fileRef.current?.click(); }}
              className="rounded-2xl bg-card border border-border p-4 flex flex-col gap-3 text-left active:scale-[0.97] transition-transform shadow-sm"
            >
              <span className="w-10 h-10 rounded-[12px] bg-emerald-100 dark:bg-emerald-950 flex items-center justify-center">
                {importing
                  ? <Loader2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 animate-spin" />
                  : <Upload className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                }
              </span>
              <div>
                <p className="text-sm font-bold text-foreground">Import</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">{importing ? 'Importing…' : 'Restore backup'}</p>
              </div>
            </button>

          </div>

          {/* Import feedback */}
          {importResult && (
            <div className="rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 p-3.5 flex items-start gap-2.5">
              <CheckCircle className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
              <div className="text-sm text-emerald-700 dark:text-emerald-400 space-y-1">
                <p>Imported {importResult.people} people, {importResult.accounts} accounts, {importResult.loans} loans, {importResult.payments} payments.</p>
                {importNotes(importResult.report).map(note => <p key={note} className="text-xs opacity-80">{note}</p>)}
              </div>
            </div>
          )}
          {importError && (
            <div className="rounded-2xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 p-3.5 flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-rose-600 mt-0.5 shrink-0" />
              <p className="text-sm text-rose-700 dark:text-rose-400">{importError}</p>
            </div>
          )}
          <AutoBackupRow />
          <input ref={fileRef} type="file" accept=".json,application/json" className="hidden" onChange={handleFilePicked} />
          <AlertDialog open={!!pendingFile} onOpenChange={(o) => !o && setPendingFile(null)}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Replace all data?</AlertDialogTitle>
                <AlertDialogDescription>
                  Importing "{pendingFile?.name}" will delete everything currently on this device and replace it with the backup. Export first if you want to keep your current data.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={() => { const f = pendingFile; setPendingFile(null); if (f) handleImport(f); }}>
                  Replace
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          {/* ── Security Section ── */}
          {Capacitor.isNativePlatform() && <SecuritySection />}

          {/* ── Danger Zone ── */}
          <SectionLabel>Danger Zone</SectionLabel>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <button className="w-full rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 p-4 flex items-center gap-3 text-left active:scale-[0.98] transition-transform">
                <span className="w-10 h-10 rounded-[12px] bg-rose-500 flex items-center justify-center shrink-0">
                  <Trash2 className="w-5 h-5 text-white" />
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-rose-600 dark:text-rose-400">Clear All Data</p>
                  <p className="text-xs text-rose-500/70 dark:text-rose-500/60 mt-0.5">Permanently delete everything on this device</p>
                </div>
                <ChevronRight className="w-4 h-4 text-rose-400/50 shrink-0" />
              </button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Clear all data?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently delete all people, accounts, loans, and payments from this device. This cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleClearData} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                  Clear All Data
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <div className="h-2" />

        </div>
      </div>
    </MobileLayout>
  );
}

/* ── Display Settings Section ── */

const CURRENCY_PRESETS = [
  { label: 'Rs. — Sri Lankan Rupee', symbol: 'Rs.', position: 'before' as const },
  { label: '₹ — Indian Rupee',       symbol: '₹',   position: 'before' as const },
  { label: '$ — US Dollar',          symbol: '$',   position: 'before' as const },
  { label: '€ — Euro',               symbol: '€',   position: 'before' as const },
  { label: '£ — British Pound',      symbol: '£',   position: 'before' as const },
  { label: '¥ — Japanese Yen',       symbol: '¥',   position: 'before' as const },
  { label: 'kr — Swedish Krona',     symbol: 'kr',  position: 'after'  as const },
  { label: 'Custom',                  symbol: '',    position: 'before' as const },
];

const NUMBER_LOCALES: { value: AppSettings['numberLocale']; label: string; example: string }[] = [
  { value: 'en-US', label: 'US (1,000.50)',       example: '1,000.50' },
  { value: 'en-IN', label: 'India (1,00,000.50)', example: '1,00,000.50' },
  { value: 'de-DE', label: 'German (1.000,50)',   example: '1.000,50' },
  { value: 'fr-FR', label: 'French (1 000,50)',   example: '1 000,50' },
];

const DATE_FORMATS: { value: AppSettings['dateFormat']; label: string }[] = [
  { value: 'MMM d, yyyy',  label: 'Jan 5, 2025' },
  { value: 'dd/MM/yyyy',   label: '05/01/2025' },
  { value: 'MM/dd/yyyy',   label: '01/05/2025' },
  { value: 'yyyy-MM-dd',   label: '2025-01-05' },
];

function DisplaySection() {
  const { settings, update } = useSettings();
  const [customSymbol, setCustomSymbol] = useState('');
  const [showCustomDialog, setShowCustomDialog] = useState(false);

  const currentPreset = CURRENCY_PRESETS.find(
    p => p.symbol === settings.currencySymbol && p.symbol !== ''
  );
  const currencySelectValue = currentPreset ? settings.currencySymbol : 'custom';

  const handleCurrencyChange = (value: string) => {
    if (value === 'custom') {
      setCustomSymbol('');
      setShowCustomDialog(true);
    } else {
      const preset = CURRENCY_PRESETS.find(p => p.symbol === value)!;
      update({ currencySymbol: preset.symbol, currencyPosition: preset.position });
    }
  };

  const handleCustomSubmit = () => {
    if (customSymbol.trim()) {
      update({ currencySymbol: customSymbol.trim() });
      setShowCustomDialog(false);
    }
  };

  return (
    <>
      <SectionLabel>Display</SectionLabel>

      {/* Bento grid for display settings */}
      <div className="grid grid-cols-2 gap-2.5">

        {/* Currency tile */}
        <div className="rounded-2xl bg-card border border-border p-4 flex flex-col gap-2 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="w-10 h-10 rounded-[12px] bg-emerald-100 dark:bg-emerald-950 flex items-center justify-center shrink-0">
              <DollarSign className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            </span>
          </div>
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Currency</p>
            <p className="text-base font-black text-foreground mt-0.5">{formatAmount(12500, settings)}</p>
          </div>
          <Select value={currencySelectValue} onValueChange={handleCurrencyChange}>
            <SelectTrigger className="h-7 text-xs border-muted w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CURRENCY_PRESETS.map(p => (
                <SelectItem key={p.symbol || 'custom'} value={p.symbol || 'custom'} className="text-xs">
                  {p.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Number format tile */}
        <div className="rounded-2xl bg-card border border-border p-4 flex flex-col gap-2 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="w-10 h-10 rounded-[12px] bg-emerald-100 dark:bg-emerald-950 flex items-center justify-center shrink-0">
              <Hash className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            </span>
          </div>
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Numbers</p>
            <p className="text-base font-black text-foreground mt-0.5">
              {NUMBER_LOCALES.find(l => l.value === settings.numberLocale)?.example ?? '—'}
            </p>
          </div>
          <Select value={settings.numberLocale} onValueChange={v => update({ numberLocale: v as AppSettings['numberLocale'] })}>
            <SelectTrigger className="h-7 text-xs border-muted w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {NUMBER_LOCALES.map(opt => (
                <SelectItem key={opt.value} value={opt.value} className="text-xs">{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Date format tile */}
        <div className="rounded-2xl bg-card border border-border p-4 flex flex-col gap-2 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="w-10 h-10 rounded-[12px] bg-emerald-100 dark:bg-emerald-950 flex items-center justify-center shrink-0">
              <Calendar className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            </span>
          </div>
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Date</p>
            <p className="text-base font-black text-foreground mt-0.5">{formatDate(new Date().toISOString(), settings)}</p>
          </div>
          <Select value={settings.dateFormat} onValueChange={v => update({ dateFormat: v as AppSettings['dateFormat'] })}>
            <SelectTrigger className="h-7 text-xs border-muted w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DATE_FORMATS.map(opt => (
                <SelectItem key={opt.value} value={opt.value} className="text-xs">{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Symbol position tile */}
        <div className="rounded-2xl bg-card border border-border p-4 flex flex-col gap-2 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="w-10 h-10 rounded-[12px] bg-emerald-100 dark:bg-emerald-950 flex items-center justify-center shrink-0">
              <ChevronDown className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            </span>
          </div>
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Symbol</p>
            <p className="text-base font-black text-foreground capitalize mt-0.5">{settings.currencyPosition}</p>
          </div>
          <Select
            value={settings.currencyPosition}
            onValueChange={v => update({ currencyPosition: v as 'before' | 'after' })}
          >
            <SelectTrigger className="h-7 text-xs border-muted w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="before" className="text-xs">Before</SelectItem>
              <SelectItem value="after" className="text-xs">After</SelectItem>
            </SelectContent>
          </Select>
        </div>

      </div>

      {/* Custom symbol dialog */}
      <Dialog open={showCustomDialog} onOpenChange={setShowCustomDialog}>
        <DialogContent className="max-w-sm rounded-3xl p-0 overflow-hidden mx-4 w-[calc(100%-2rem)] margin-0-auto">
          <div className="flex flex-col items-center px-6 pt-8 pb-6 gap-5">

            <div className="w-14 h-14 rounded-2xl bg-emerald-100 dark:bg-emerald-950 flex items-center justify-center relative overflow-hidden shrink-0">
              <div className="absolute -bottom-3 -right-3 w-10 h-10 rounded-full bg-emerald-200/50 dark:bg-emerald-800/30 pointer-events-none" />
              <DollarSign className="w-7 h-7 text-emerald-600 dark:text-emerald-400 z-10" />
            </div>

            <DialogHeader className="text-center space-y-1 p-0">
              <DialogTitle className="text-xl font-black tracking-tight">Custom Symbol</DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground">
                Enter a currency symbol and choose its position
              </DialogDescription>
            </DialogHeader>

            <div className="w-full space-y-3">
              <input
                type="text"
                maxLength={6}
                value={customSymbol}
                onChange={e => setCustomSymbol(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleCustomSubmit()}
                placeholder="e.g. CHF, Fr, ฿"
                autoFocus
                className="w-full h-12 px-4 text-center text-xl font-black tracking-widest border rounded-2xl bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
              <Select
                value={settings.currencyPosition}
                onValueChange={v => update({ currencyPosition: v as 'before' | 'after' })}
              >
                <SelectTrigger className="w-full h-10 text-sm rounded-2xl border-muted">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="before">Symbol before amount (e.g. ₹ 100)</SelectItem>
                  <SelectItem value="after">Symbol after amount (e.g. 100 kr)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="w-full flex gap-2">
              <Button variant="ghost" className="flex-1 rounded-2xl text-muted-foreground" onClick={() => setShowCustomDialog(false)}>
                Cancel
              </Button>
              <Button className="flex-1 rounded-2xl" onClick={handleCustomSubmit} disabled={!customSymbol.trim()}>
                Save
              </Button>
            </div>

          </div>
        </DialogContent>
      </Dialog>

      {/* Haptic feedback (native only) */}
      {Capacitor.isNativePlatform() && (
        <div className="rounded-2xl bg-card border border-border p-4 flex items-center gap-3 shadow-sm">
          <span className="w-10 h-10 rounded-[12px] bg-emerald-100 dark:bg-emerald-950 flex items-center justify-center shrink-0">
            <Vibrate className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-foreground">Haptic Feedback</p>
            <p className="text-xs text-muted-foreground">Vibrate on swipe actions</p>
          </div>
          <Switch
            checked={settings.hapticFeedback}
            onCheckedChange={v => update({ hapticFeedback: v })}
          />
        </div>
      )}

    </>
  );
}

/* ── Small helpers ── */

/** Plain-language lines for what the import had to repair */
function importNotes(r: ImportReport): string[] {
  const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
  const notes: string[] = [];
  if (r.droppedPayments) notes.push(`Skipped ${plural(r.droppedPayments, "payment")} not linked to any loan.`);
  if (r.droppedLoans) notes.push(`Skipped ${plural(r.droppedLoans, "loan")} whose person was missing.`);
  if (r.clearedAccounts) notes.push(`Cleared the account on ${plural(r.clearedAccounts, "loan")} (account missing).`);
  if (r.fixedStatuses) notes.push(`Corrected the status of ${plural(r.fixedStatuses, "loan")}.`);
  return notes;
}

/** Daily auto-backup toggle (Android) or last-export note (browser) */
function AutoBackupRow() {
  const { settings, update } = useSettings();
  const [lastBackup, setLastBackup] = useState(getLastBackupDate);
  const native = Capacitor.isNativePlatform();
  const lastText = lastBackup ? `Last backup ${formatDate(lastBackup)}` : "No backup yet";

  const handleToggle = async (on: boolean) => {
    update({ autoBackup: on });
    if (on) {
      // Settings are read from storage, so the new value is already visible to runAutoBackup
      if (await runAutoBackup()) toast.success(`Backup saved to Documents/${AUTO_BACKUP_FOLDER}`);
      setLastBackup(getLastBackupDate());
    }
  };

  return (
    <div className="rounded-2xl bg-card border border-border p-4 flex items-center gap-3 shadow-sm mt-2.5">
      <span className="w-10 h-10 rounded-[12px] bg-emerald-100 dark:bg-emerald-950 flex items-center justify-center shrink-0">
        <Database className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-foreground">{native ? "Daily Auto-Backup" : "Backups"}</p>
        <p className="text-xs text-muted-foreground">
          {native
            ? `Keeps 7 days in Documents/${AUTO_BACKUP_FOLDER}, even after uninstall. ${lastText}.`
            : `Export regularly; browser data can be cleared. ${lastText}.`}
        </p>
      </div>
      {native && <Switch checked={settings.autoBackup} onCheckedChange={handleToggle} />}
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="pt-5 pb-2 text-[11px] font-bold text-muted-foreground uppercase tracking-widest">
      {children}
    </p>
  );
}

/* ── PIN numpad dialog ── */
function PinSetDialog({
  open, onOpenChange, title, description, onConfirm, loading,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  description: string;
  onConfirm: (pin: string) => Promise<void>;
  loading: boolean;
}) {
  const [step, setStep] = useState<'enter' | 'confirm'>('enter');
  const [length, setLength] = useState<4 | 6>(4);
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [error, setError] = useState('');
  const [shake, setShake] = useState(false);

  const reset = () => {
    setStep('enter');
    setPin('');
    setConfirmPin('');
    setError('');
    setShake(false);
  };

  const handleOpen = (v: boolean) => {
    if (!v) reset();
    onOpenChange(v);
  };

  const triggerShake = (msg: string) => {
    setError(msg);
    setShake(true);
    setTimeout(() => setShake(false), 500);
  };

  const handleNumber = (num: string) => {
    if (step === 'enter') {
      if (pin.length >= length) return;
      const next = pin + num;
      setPin(next);
      setError('');
      if (next.length === length) {
        setTimeout(() => setStep('confirm'), 180);
      }
    } else {
      if (confirmPin.length >= length) return;
      const next = confirmPin + num;
      setConfirmPin(next);
      setError('');
      if (next.length === length) {
        setTimeout(async () => {
          if (next !== pin) {
            setConfirmPin('');
            triggerShake('PINs do not match — try again');
          } else {
            await onConfirm(pin);
            reset();
          }
        }, 180);
      }
    }
  };

  const handleDelete = () => {
    setError('');
    if (step === 'enter') {
      setPin(p => p.slice(0, -1));
    } else {
      if (confirmPin.length > 0) {
        setConfirmPin(c => c.slice(0, -1));
      } else {
        setStep('enter');
        setPin('');
      }
    }
  };

  const activePin = step === 'enter' ? pin : confirmPin;

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogContent className="max-w-sm p-0 overflow-hidden rounded-3xl mx-4 w-[calc(100%-2rem)]">
        <div className="flex flex-col items-center px-6 pt-8 pb-6 gap-6">

          {/* Icon */}
          <div className="w-16 h-16 rounded-2xl bg-primary flex items-center justify-center relative overflow-hidden shrink-0">
            <div className="absolute -bottom-3 -right-3 w-12 h-12 rounded-full bg-white/10 pointer-events-none" />
            <Lock className="w-7 h-7 text-primary-foreground z-10" strokeWidth={2.5} />
          </div>

          {/* Header */}
          <DialogHeader className="text-center space-y-1 p-0">
            <DialogTitle className="text-xl font-black tracking-tight">{title}</DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              {step === 'enter' ? description : 'Re-enter PIN to confirm'}
            </DialogDescription>
          </DialogHeader>

          {/* Step indicator */}
          <div className="flex gap-1.5">
            <div className={`h-1 w-8 rounded-full transition-colors ${step === 'enter' ? 'bg-primary' : 'bg-primary/30'}`} />
            <div className={`h-1 w-8 rounded-full transition-colors ${step === 'confirm' ? 'bg-primary' : 'bg-muted'}`} />
          </div>

          {/* PIN length (only before typing) */}
          {step === 'enter' && pin.length === 0 && (
            <div className="flex rounded-xl bg-muted p-1 -mt-2">
              {([4, 6] as const).map(n => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setLength(n)}
                  className={cn(
                    "px-3 py-1 rounded-lg text-xs font-bold transition-colors",
                    length === n ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
                  )}
                >
                  {n} digits
                </button>
              ))}
            </div>
          )}

          {/* PIN dots */}
          <div className={`flex gap-5 ${shake ? 'animate-shake' : ''}`}>
            {Array(length).fill(0).map((_, i) => (
              <div
                key={i}
                className={`w-4 h-4 rounded-full border-2 transition-all duration-150 ${
                  i < activePin.length
                    ? 'bg-primary border-primary scale-110'
                    : 'bg-transparent border-muted-foreground/30 scale-100'
                }`}
              />
            ))}
          </div>

          {/* Error */}
          {error
            ? <p className="text-sm text-rose-600 dark:text-rose-400 font-medium text-center -mt-2">{error}</p>
            : <div className="h-[20px] -mt-2" />
          }

          {/* Numpad */}
          <div className="grid grid-cols-3 gap-2 w-full">
            {['1','2','3','4','5','6','7','8','9','','0','del'].map((num, i) => {
              if (num === '') return <div key={i} />;
              if (num === 'del') {
                return (
                  <button
                    key={i}
                    type="button"
                    disabled={loading}
                    className="h-14 rounded-2xl flex items-center justify-center text-muted-foreground active:scale-95 active:bg-muted transition-transform hover:bg-muted/50 disabled:opacity-30"
                    onPointerDown={(e) => { e.preventDefault(); handleDelete(); }}
                  >
                    <Delete className="w-5 h-5" />
                  </button>
                );
              }
              return (
                <button
                  key={i}
                  type="button"
                  disabled={loading}
                  className="h-14 rounded-2xl flex items-center justify-center text-2xl font-black text-foreground active:scale-95 active:bg-primary/10 transition-transform hover:bg-muted/50 disabled:opacity-30"
                  onPointerDown={(e) => { e.preventDefault(); handleNumber(num); }}
                >
                  {num}
                </button>
              );
            })}
          </div>

          {/* Cancel */}
          <Button variant="ghost" className="w-full rounded-2xl text-muted-foreground" onClick={() => handleOpen(false)} disabled={loading}>
            Cancel
          </Button>

        </div>
      </DialogContent>
    </Dialog>
  );
}

// Security section for PIN and biometric auth
function SecuritySection() {
  const { hasPIN, biometricEnabled, biometricType, setPIN, removePIN, enableBiometric, disableBiometric } = useSecurity();
  const [loading, setLoading] = useState(false);
  const [showSetPin, setShowSetPin] = useState(false);
  const [showChangePin, setShowChangePin] = useState(false);

  const handlePinConfirm = async (pin: string) => {
    setLoading(true);
    try {
      await setPIN(pin);
      toast.success('PIN set successfully');
      setShowSetPin(false);
      setShowChangePin(false);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRemovePIN = async () => {
    setLoading(true);
    try {
      await removePIN();
      toast.success('PIN removed. Security disabled.');
    } catch (err: any) {
      toast.error('Failed: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleBiometricToggle = async () => {
    setLoading(true);
    try {
      if (biometricEnabled) {
        await disableBiometric();
        toast.success('Biometric authentication disabled');
      } else {
        await enableBiometric();
        toast.success('Biometric authentication enabled');
      }
    } catch (err: any) {
      toast.error('Failed: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <SectionLabel>Security</SectionLabel>
      <>

        {/* PIN tile */}
        <div className="rounded-2xl bg-card border border-border p-4 flex items-center gap-3 shadow-sm">
          <span className="w-10 h-10 rounded-[12px] bg-emerald-100 dark:bg-emerald-950 flex items-center justify-center shrink-0">
            <Lock className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-foreground">4-Digit PIN</p>
            <p className="text-xs text-muted-foreground">{hasPIN ? 'PIN is active' : 'Secure your app'}</p>
          </div>
          {!hasPIN ? (
            <>
              <Button size="sm" className="h-7 text-xs px-3 rounded-xl" onClick={() => setShowSetPin(true)}>Set PIN</Button>
              <PinSetDialog
                open={showSetPin}
                onOpenChange={setShowSetPin}
                title="Set PIN"
                description="Choose a 4 or 6-digit PIN to secure your app"
                onConfirm={handlePinConfirm}
                loading={loading}
              />
            </>
          ) : (
            <div className="flex gap-1.5 shrink-0">
              <Button size="sm" variant="outline" className="h-7 text-xs px-2.5 rounded-xl" onClick={() => setShowChangePin(true)}>Change</Button>
              <PinSetDialog
                open={showChangePin}
                onOpenChange={setShowChangePin}
                title="Change PIN"
                description="Enter a new 4 or 6-digit PIN"
                onConfirm={handlePinConfirm}
                loading={loading}
              />
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button size="sm" variant="destructive" className="h-7 text-xs px-2.5 rounded-xl">Remove</Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Remove PIN?</AlertDialogTitle>
                    <AlertDialogDescription>This will disable app security.</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleRemovePIN} disabled={loading}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                      Remove PIN
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          )}
        </div>

        {/* Biometric tile */}
        {hasPIN && biometricType && (
          <div className="rounded-2xl bg-card border border-border p-4 flex items-center gap-3 shadow-sm">
            <span className="w-10 h-10 rounded-[12px] bg-emerald-100 dark:bg-emerald-950 flex items-center justify-center shrink-0">
              <Fingerprint className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-foreground">{biometricType} Unlock</p>
              <p className="text-xs text-muted-foreground">Use {biometricType.toLowerCase()} to unlock</p>
            </div>
            <Switch checked={biometricEnabled} onCheckedChange={handleBiometricToggle} disabled={loading} />
          </div>
        )}

        {!hasPIN && (
          <p className="text-xs text-muted-foreground px-1">Set a PIN first to enable biometric authentication.</p>
        )}
      </>
    </>
  );
}
