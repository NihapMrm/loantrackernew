import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { App as CapacitorApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { toast } from 'sonner';
import { db } from '@/lib/db';
import { runAutoBackup, getLastBackupDate, daysSince } from '@/lib/backup';

const REMIND_AFTER_DAYS = 30;
let remindedThisSession = false;

/** Runs the daily auto-backup and nudges the user when nothing has been backed up for a month */
export function BackupManager() {
  const navigate = useNavigate();

  useEffect(() => {
    const check = async () => {
      await runAutoBackup();
      if (remindedThisSession || (await db.loans.count()) === 0) return;
      const last = getLastBackupDate();
      if (last && daysSince(last) < REMIND_AFTER_DAYS) return;
      remindedThisSession = true;
      toast.warning(last ? `No backup in ${daysSince(last)} days` : 'Your data has never been backed up', {
        description: 'Uninstalling or clearing the app would delete everything.',
        action: { label: 'Back up', onClick: () => navigate('/settings') },
        duration: 10000,
      });
    };
    check();

    if (!Capacitor.isNativePlatform()) return;
    const listener = CapacitorApp.addListener('resume', () => { runAutoBackup(); });
    return () => { listener.then(l => l.remove()); };
  }, [navigate]);

  return null;
}
