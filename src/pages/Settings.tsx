import { useRef, useState } from "react";
import { MobileLayout } from "@/components/layout/MobileLayout";
import { Button } from "@/components/ui/button";
import { db } from "@/lib/db";
import { useSecurity } from "@/lib/security";
import { Switch } from "@/components/ui/switch";
import { Capacitor } from "@capacitor/core";
import { Filesystem, Directory, Encoding } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";
import {
  Upload,
  Trash2,
  CheckCircle,
  Loader2,
  AlertCircle,
  Wallet,
  Shield,
  Download,
  Lock,
  Fingerprint,
  ChevronRight,
  Wrench,
  DollarSign,
  Hash,
  Calendar,
  Vibrate,
  ChevronDown,
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

interface ImportData {
  version: number;
  exportedAt: string;
  people: any[];
  accounts: any[];
  loans: any[];
  payments: any[];
}

export default function Settings() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{
    people: number;
    accounts: number;
    loans: number;
    payments: number;
  } | null>(null);
  const [importError, setImportError] = useState("");

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    setImportResult(null);
    setImportError("");

    try {
      const text = await file.text();
      const data: ImportData = JSON.parse(text);

      if (!data.people || !data.loans || !data.payments) {
        throw new Error("Invalid export file format.");
      }

      // Strip user_id before importing (not needed offline)
      const strip = (obj: any) => {
        const { user_id, ...rest } = obj;
        return rest;
      };

      await db.transaction("rw", db.people, db.accounts, db.loans, db.payments, async () => {
        await db.people.clear();
        await db.accounts.clear();
        await db.loans.clear();
        await db.payments.clear();

        if (data.people?.length)   await db.people.bulkAdd(data.people.map(strip));
        if (data.accounts?.length) await db.accounts.bulkAdd(data.accounts.map(strip));
        if (data.loans?.length)    await db.loans.bulkAdd(data.loans.map(strip));
        if (data.payments?.length) await db.payments.bulkAdd(data.payments.map(strip));
      });

      // Fix statuses: recalculate every loan based on actual payments
      await recalculateAllStatuses();

      setImportResult({
        people: data.people?.length ?? 0,
        accounts: data.accounts?.length ?? 0,
        loans: data.loans?.length ?? 0,
        payments: data.payments?.length ?? 0,
      });

      toast.success("Data imported successfully!");
    } catch (err: any) {
      console.error(err);
      setImportError(err.message || "Import failed.");
      toast.error("Import failed: " + (err.message || "Unknown error"));
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = "";
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
      toast.success("All data cleared.");
    } catch (err: any) {
      toast.error("Failed to clear data: " + err.message);
    }
  };

  // Recalculate every loan's status from actual payment totals
  const recalculateAllStatuses = async () => {
    const loans = await db.loans.toArray();
    const now = new Date().toISOString();
    await Promise.all(
      loans.map(async (loan) => {
        const payments = await db.payments.where("loan_id").equals(loan.id).toArray();
        const totalPaid = payments.reduce((s, p) => s + Number(p.amount), 0);
        let status: "OPEN" | "PARTIAL" | "PAID";
        if (totalPaid >= Number(loan.amount)) status = "PAID";
        else if (totalPaid > 0) status = "PARTIAL";
        else status = "OPEN";
        if (status !== loan.status) {
          await db.loans.update(loan.id, { status, updated_at: now });
        }
      })
    );
  };

  const handleFixStatuses = async () => {
    try {
      await recalculateAllStatuses();
      toast.success("All loan statuses recalculated from payment history!");
    } catch (err: any) {
      toast.error("Fix failed: " + err.message);
    }
  };

  const handleExport = async () => {
    try {
      const [people, accounts, loans, payments] = await Promise.all([
        db.people.toArray(),
        db.accounts.toArray(),
        db.loans.toArray(),
        db.payments.toArray(),
      ]);
      const exportData = {
        exportedAt: new Date().toISOString(),
        version: 1,
        people,
        accounts,
        loans,
        payments,
      };
      const json = JSON.stringify(exportData, null, 2);
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
        await Share.share({
          title: "LoanTracker Backup",
          text: "LoanTracker backup file",
          url: uri,
          dialogTitle: "Save backup to…",
        });
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
      <div className="pb-8 max-w-2xl mx-auto">

        {/* ── App Profile Header ── */}
        <div className="flex flex-col items-center gap-3 px-4 pt-10 pb-8">
          <div className="w-20 h-20 rounded-[22px] bg-primary flex items-center justify-center shadow-lg shadow-primary/30">
            <Wallet className="w-10 h-10 text-primary-foreground" />
          </div>
          <div className="text-center">
            <h1 className="text-xl font-bold text-foreground">LoanTracker</h1>
            <div className="flex items-center justify-center gap-2 mt-1">
              <span className="text-xs text-muted-foreground">Version 2.0.0</span>
              <span className="w-1 h-1 rounded-full bg-muted-foreground/40" />
              <span className="text-xs font-medium text-emerald-600 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">Offline</span>
            </div>
          </div>
        </div>

        {/* ── Display Section ── */}
        <DisplaySection />

        {/* ── Data Section ── */}
        <SectionLabel>Data</SectionLabel>
        <SettingsGroup>

          {/* Export */}
          <SettingsRow
            icon={<Download className="w-4 h-4 text-white" />}
            iconBg="bg-blue-500"
            title="Export / Backup"
            subtitle="Save a backup of all your data"
            onClick={handleExport}
            action={<ChevronRight className="w-4 h-4 text-muted-foreground/50" />}
          />

          <RowDivider />

          {/* Import */}
          <SettingsRow
            icon={<Upload className="w-4 h-4 text-white" />}
            iconBg="bg-indigo-500"
            title="Import Data"
            subtitle={importing ? "Importing…" : "Restore from a backup file"}
            onClick={() => fileRef.current?.click()}
            action={importing
              ? <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
              : <ChevronRight className="w-4 h-4 text-muted-foreground/50" />
            }
          />

          <RowDivider />

          {/* Fix Statuses */}
          <SettingsRow
            icon={<Wrench className="w-4 h-4 text-white" />}
            iconBg="bg-orange-500"
            title="Recalculate Loan Statuses"
            subtitle="Fix statuses from payment history"
            onClick={handleFixStatuses}
            action={<ChevronRight className="w-4 h-4 text-muted-foreground/50" />}
          />
        </SettingsGroup>

        {/* Import feedback */}
        {importResult && (
          <div className="mx-4 mt-2 rounded-xl bg-emerald-50 border border-emerald-200 p-3 flex items-start gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
            <p className="text-sm text-emerald-700">
              Imported {importResult.people} people, {importResult.accounts} accounts, {importResult.loans} loans, {importResult.payments} payments.
            </p>
          </div>
        )}
        {importError && (
          <div className="mx-4 mt-2 rounded-xl bg-red-50 border border-red-200 p-3 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-red-600 mt-0.5 shrink-0" />
            <p className="text-sm text-red-700">{importError}</p>
          </div>
        )}
        <input ref={fileRef} type="file" accept=".json,application/json" className="hidden" onChange={handleImport} />

        {/* ── Security Section ── */}
        {Capacitor.isNativePlatform() && <SecuritySection />}

        {/* ── Danger Zone ── */}
        <SectionLabel>Danger Zone</SectionLabel>
        <SettingsGroup>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <button className="w-full flex items-center gap-3 px-4 py-3.5 text-left active:bg-muted/60 transition-colors">
                <span className="w-8 h-8 rounded-[10px] bg-red-500 flex items-center justify-center shrink-0">
                  <Trash2 className="w-4 h-4 text-white" />
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-destructive">Clear All Data</p>
                  <p className="text-xs text-muted-foreground">Permanently delete everything on this device</p>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground/50 shrink-0" />
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
        </SettingsGroup>

        {/* ── About ── */}
        <SectionLabel>About</SectionLabel>
        <SettingsGroup>
          <SettingsRow
            icon={<Shield className="w-4 h-4 text-white" />}
            iconBg="bg-slate-500"
            title="100% Offline"
            subtitle="All data stays on this device. No internet needed."
          />
        </SettingsGroup>

        <p className="text-center text-xs text-muted-foreground/50 mt-6 pb-2">LoanTracker v2.0.0</p>
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
  const [customSymbol, setCustomSymbol]     = useState('');
  const [showCustomInput, setShowCustomInput] = useState(false);

  const currentPreset = CURRENCY_PRESETS.find(
    p => p.symbol === settings.currencySymbol && p.symbol !== ''
  );
  const currencySelectValue = currentPreset ? settings.currencySymbol : 'custom';

  const handleCurrencyChange = (value: string) => {
    if (value === 'custom') {
      setShowCustomInput(true);
    } else {
      setShowCustomInput(false);
      const preset = CURRENCY_PRESETS.find(p => p.symbol === value)!;
      update({ currencySymbol: preset.symbol, currencyPosition: preset.position });
    }
  };

  const handleCustomSubmit = () => {
    if (customSymbol.trim()) {
      update({ currencySymbol: customSymbol.trim() });
      setShowCustomInput(false);
    }
  };

  return (
    <>
      <SectionLabel>Display</SectionLabel>
      <SettingsGroup>

        {/* Currency */}
        <div className="flex items-center gap-3 px-4 py-3">
          <span className="w-8 h-8 rounded-[10px] bg-green-500 flex items-center justify-center shrink-0">
            <DollarSign className="w-4 h-4 text-white" />
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground">Currency</p>
            <p className="text-xs text-muted-foreground">
              Preview: {formatAmount(12500, settings)}
            </p>
          </div>
          <Select value={currencySelectValue} onValueChange={handleCurrencyChange}>
            <SelectTrigger className="w-28 h-8 text-xs border-muted">
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

        {/* Custom symbol input */}
        {showCustomInput && (
          <div className="flex items-center gap-2 px-4 pb-3 ml-11">
            <input
              type="text"
              maxLength={6}
              value={customSymbol}
              onChange={e => setCustomSymbol(e.target.value)}
              placeholder="Symbol e.g. CHF"
              className="flex-1 h-8 px-3 text-sm border rounded-lg bg-background"
            />
            <Select
              value={settings.currencyPosition}
              onValueChange={v => update({ currencyPosition: v as 'before' | 'after' })}
            >
              <SelectTrigger className="w-24 h-8 text-xs border-muted">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="before" className="text-xs">Before</SelectItem>
                <SelectItem value="after" className="text-xs">After</SelectItem>
              </SelectContent>
            </Select>
            <Button size="sm" className="h-8 text-xs px-3" onClick={handleCustomSubmit}>Save</Button>
          </div>
        )}

        <RowDivider />

        {/* Currency position (for presets that could be after) */}
        {!showCustomInput && (
          <>
            <div className="flex items-center gap-3 px-4 py-3">
              <span className="w-8 h-8 rounded-[10px] bg-teal-500 flex items-center justify-center shrink-0">
                <ChevronDown className="w-4 h-4 text-white" />
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground">Symbol position</p>
                <p className="text-xs text-muted-foreground">Before or after the amount</p>
              </div>
              <Select
                value={settings.currencyPosition}
                onValueChange={v => update({ currencyPosition: v as 'before' | 'after' })}
              >
                <SelectTrigger className="w-24 h-8 text-xs border-muted">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="before" className="text-xs">Before</SelectItem>
                  <SelectItem value="after" className="text-xs">After</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <RowDivider />
          </>
        )}

        {/* Number format */}
        <div className="flex items-center gap-3 px-4 py-3">
          <span className="w-8 h-8 rounded-[10px] bg-violet-500 flex items-center justify-center shrink-0">
            <Hash className="w-4 h-4 text-white" />
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground">Number format</p>
            <p className="text-xs text-muted-foreground">Thousands &amp; decimal separators</p>
          </div>
          <Select value={settings.numberLocale} onValueChange={v => update({ numberLocale: v as AppSettings['numberLocale'] })}>
            <SelectTrigger className="w-36 h-8 text-xs border-muted">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {NUMBER_LOCALES.map(opt => (
                <SelectItem key={opt.value} value={opt.value} className="text-xs">
                  {opt.example}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <RowDivider />

        {/* Date format */}
        <div className="flex items-center gap-3 px-4 py-3">
          <span className="w-8 h-8 rounded-[10px] bg-sky-500 flex items-center justify-center shrink-0">
            <Calendar className="w-4 h-4 text-white" />
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground">Date format</p>
            <p className="text-xs text-muted-foreground">Preview: {formatDate(new Date().toISOString(), settings)}</p>
          </div>
          <Select value={settings.dateFormat} onValueChange={v => update({ dateFormat: v as AppSettings['dateFormat'] })}>
            <SelectTrigger className="w-32 h-8 text-xs border-muted">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DATE_FORMATS.map(opt => (
                <SelectItem key={opt.value} value={opt.value} className="text-xs">
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {Capacitor.isNativePlatform() && (
          <>
            <RowDivider />
            {/* Haptic feedback */}
            <div className="flex items-center gap-3 px-4 py-3">
              <span className="w-8 h-8 rounded-[10px] bg-pink-500 flex items-center justify-center shrink-0">
                <Vibrate className="w-4 h-4 text-white" />
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground">Haptic feedback</p>
                <p className="text-xs text-muted-foreground">Vibrate on swipe actions</p>
              </div>
              <Switch
                checked={settings.hapticFeedback}
                onCheckedChange={v => update({ hapticFeedback: v })}
              />
            </div>
          </>
        )}

      </SettingsGroup>
    </>
  );
}

/* ── Small helpers ── */

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="px-4 pt-6 pb-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
      {children}
    </p>
  );
}

function SettingsGroup({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-4 rounded-2xl bg-card border border-border overflow-hidden shadow-sm">
      {children}
    </div>
  );
}

function RowDivider() {
  return <div className="ml-[60px] h-px bg-border" />;
}

function SettingsRow({
  icon, iconBg, title, subtitle, action, onClick,
}: {
  icon: React.ReactNode;
  iconBg: string;
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  onClick?: () => void;
}) {
  const inner = (
    <div className="flex items-center gap-3 px-4 py-3.5">
      <span className={`w-8 h-8 rounded-[10px] ${iconBg} flex items-center justify-center shrink-0`}>
        {icon}
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground">{title}</p>
        {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
      </div>
      {action && <span className="shrink-0">{action}</span>}
    </div>
  );
  return onClick
    ? <button onClick={onClick} className="w-full text-left active:bg-muted/60 transition-colors">{inner}</button>
    : <div>{inner}</div>;
}

// Security section for PIN and biometric auth
function SecuritySection() {
  const { hasPIN, biometricEnabled, biometricType, setPIN, removePIN, enableBiometric, disableBiometric } = useSecurity();
  const [loading, setLoading] = useState(false);
  const [showPinDialog, setShowPinDialog] = useState(false);
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [pinError, setPinError] = useState('');

  const handlePinSubmit = async () => {
    setPinError('');
    
    if (pin.length !== 4 || !/^\d{4}$/.test(pin)) {
      setPinError('PIN must be exactly 4 digits');
      return;
    }
    
    if (pin !== confirmPin) {
      setPinError('PINs do not match');
      return;
    }

    setLoading(true);
    try {
      await setPIN(pin);
      toast.success('PIN set successfully');
      setShowPinDialog(false);
      setPin('');
      setConfirmPin('');
    } catch (err: any) {
      setPinError(err.message);
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

  const handlePinInput = (value: string, field: 'pin' | 'confirm') => {
    const cleaned = value.replace(/\D/g, '').slice(0, 4);
    if (field === 'pin') {
      setPin(cleaned);
    } else {
      setConfirmPin(cleaned);
    }
    setPinError('');
  };

  return (
    <>
      <SectionLabel>Security</SectionLabel>
      <SettingsGroup>

        {/* PIN row */}
        <div className="flex items-center gap-3 px-4 py-3.5">
          <span className="w-8 h-8 rounded-[10px] bg-yellow-500 flex items-center justify-center shrink-0">
            <Lock className="w-4 h-4 text-white" />
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground">4-Digit PIN</p>
            <p className="text-xs text-muted-foreground">{hasPIN ? 'PIN is set' : 'Set a PIN to secure your app'}</p>
          </div>
          {!hasPIN ? (
            <AlertDialog open={showPinDialog} onOpenChange={setShowPinDialog}>
              <AlertDialogTrigger asChild>
                <Button size="sm" className="h-7 text-xs px-3">Set PIN</Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Set 4-Digit PIN</AlertDialogTitle>
                  <AlertDialogDescription>Choose a 4-digit PIN to secure your app.</AlertDialogDescription>
                </AlertDialogHeader>
                <div className="space-y-4 py-4">
                  <div>
                    <label className="text-sm font-medium mb-2 block">Enter PIN</label>
                    <input type="password" inputMode="numeric" maxLength={4} value={pin}
                      onChange={(e) => handlePinInput(e.target.value, 'pin')}
                      className="w-full h-12 px-4 text-center text-2xl tracking-widest border rounded-md"
                      placeholder="••••" />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-2 block">Confirm PIN</label>
                    <input type="password" inputMode="numeric" maxLength={4} value={confirmPin}
                      onChange={(e) => handlePinInput(e.target.value, 'confirm')}
                      className="w-full h-12 px-4 text-center text-2xl tracking-widest border rounded-md"
                      placeholder="••••" />
                  </div>
                  {pinError && <p className="text-sm text-red-600">{pinError}</p>}
                </div>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handlePinSubmit} disabled={loading}>
                    {loading ? 'Setting…' : 'Set PIN'}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          ) : (
            <div className="flex gap-1.5 shrink-0">
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button size="sm" variant="outline" className="h-7 text-xs px-2.5">Change</Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Change PIN</AlertDialogTitle>
                    <AlertDialogDescription>Enter a new 4-digit PIN.</AlertDialogDescription>
                  </AlertDialogHeader>
                  <div className="space-y-4 py-4">
                    <div>
                      <label className="text-sm font-medium mb-2 block">New PIN</label>
                      <input type="password" inputMode="numeric" maxLength={4} value={pin}
                        onChange={(e) => handlePinInput(e.target.value, 'pin')}
                        className="w-full h-12 px-4 text-center text-2xl tracking-widest border rounded-md"
                        placeholder="••••" />
                    </div>
                    <div>
                      <label className="text-sm font-medium mb-2 block">Confirm New PIN</label>
                      <input type="password" inputMode="numeric" maxLength={4} value={confirmPin}
                        onChange={(e) => handlePinInput(e.target.value, 'confirm')}
                        className="w-full h-12 px-4 text-center text-2xl tracking-widest border rounded-md"
                        placeholder="••••" />
                    </div>
                    {pinError && <p className="text-sm text-red-600">{pinError}</p>}
                  </div>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handlePinSubmit} disabled={loading}>
                      {loading ? 'Changing…' : 'Change PIN'}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button size="sm" variant="destructive" className="h-7 text-xs px-2.5">Remove</Button>
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

        {/* Biometric row */}
        {hasPIN && biometricType && (
          <>
            <RowDivider />
            <div className="flex items-center gap-3 px-4 py-3.5">
              <span className="w-8 h-8 rounded-[10px] bg-purple-500 flex items-center justify-center shrink-0">
                <Fingerprint className="w-4 h-4 text-white" />
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground">{biometricType} Unlock</p>
                <p className="text-xs text-muted-foreground">Use {biometricType.toLowerCase()} instead of PIN</p>
              </div>
              <Switch checked={biometricEnabled} onCheckedChange={handleBiometricToggle} disabled={loading} />
            </div>
          </>
        )}

        {!hasPIN && (
          <>
            <RowDivider />
            <div className="px-4 py-3">
              <p className="text-xs text-muted-foreground">Set a PIN first to enable biometric authentication</p>
            </div>
          </>
        )}
      </SettingsGroup>
    </>
  );
}
