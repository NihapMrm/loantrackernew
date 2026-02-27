import { useRef, useState } from "react";
import { MobileLayout } from "@/components/layout/MobileLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { db } from "@/lib/db";
import {
  Upload,
  Trash2,
  CheckCircle,
  Loader2,
  AlertCircle,
  Wallet,
  Shield,
  Database,
  Download,
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
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `loantracker-backup-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success("Backup downloaded!");
    } catch (err: any) {
      toast.error("Export failed: " + err.message);
    }
  };

  return (
    <MobileLayout>
      <div className="px-4 pt-6 pb-4 space-y-6 max-w-2xl mx-auto lg:px-8 lg:pt-8">
        <h1 className="text-xl lg:text-2xl font-bold text-foreground">Settings</h1>

        {/* Import Data */}
        <div className="space-y-3">
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
            Data
          </h2>

          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Database className="w-5 h-5" />
                Data Management
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Export a backup of your data or import a previously exported file.
              </p>

              {importResult && (
                <div className="rounded-lg bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 p-3 space-y-1">
                  <div className="flex items-center gap-2 text-green-700 dark:text-green-300 font-medium text-sm">
                    <CheckCircle className="w-4 h-4" />
                    Import successful!
                  </div>
                  <p className="text-xs text-green-600 dark:text-green-400">
                    {importResult.people} people  {importResult.accounts} accounts {" "}
                    {importResult.loans} loans  {importResult.payments} payments
                  </p>
                </div>
              )}

              {importError && (
                <div className="rounded-lg bg-red-50 dark:bg-red-950 border border-red-200 p-3 flex items-start gap-2 text-sm text-red-700 dark:text-red-300">
                  <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  {importError}
                </div>
              )}

              <input
                ref={fileRef}
                type="file"
                accept=".json,application/json"
                className="hidden"
                onChange={handleImport}
              />

              <Button
                variant="outline"
                className="w-full"
                onClick={handleExport}
              >
                <Download className="w-4 h-4 mr-2" />
                Export / Backup Data
              </Button>

              <Button
                className="w-full"
                onClick={() => fileRef.current?.click()}
                disabled={importing}
              >
                {importing ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Importing...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4 mr-2" />
                    Choose JSON File & Import
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Danger Zone */}
        <div className="space-y-3">
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
            Danger Zone
          </h2>
          <Card className="shadow-card border-destructive/30">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-foreground">Clear All Data</p>
                  <p className="text-sm text-muted-foreground">Delete all local data permanently</p>
                </div>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" size="sm">
                      <Trash2 className="w-4 h-4 mr-1" />
                      Clear
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Clear all data?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will permanently delete all people, accounts, loans, and payments from
                        this device. This cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={handleClearData}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        Clear All Data
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* About */}
        <div className="space-y-3">
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
            About
          </h2>
          <Card className="shadow-card">
            <CardContent className="p-4 space-y-4 lg:p-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center">
                  <Wallet className="w-5 h-5 text-primary-foreground" />
                </div>
                <div>
                  <p className="font-medium text-foreground">LoanTracker</p>
                  <p className="text-sm text-muted-foreground">Version 2.0.0  Offline</p>
                </div>
              </div>
              <div className="flex items-start gap-3 pt-3 border-t border-border">
                <Shield className="w-5 h-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="font-medium text-foreground">100% Offline</p>
                  <p className="text-sm text-muted-foreground">
                    All data is stored locally on this device. No internet connection required.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </MobileLayout>
  );
}
