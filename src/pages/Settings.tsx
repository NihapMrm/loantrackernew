import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MobileLayout } from '@/components/layout/MobileLayout';
import { useAuth } from '@/lib/auth';
import { signInWithEmailAndPassword, updatePassword } from 'firebase/auth';
import { auth } from '@/integrations/firebase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { LogOut, User, Shield, Wallet, Lock } from 'lucide-react';
import { toast } from 'sonner';
import { z } from 'zod';

const passwordSchema = z.object({
  currentPassword: z.string().min(1, { message: "Current password is required" }),
  newPassword: z.string().min(6, { message: "Password must be at least 6 characters" }),
  confirmPassword: z.string(),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

export default function Settings() {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errors, setErrors] = useState<{ currentPassword?: string; newPassword?: string; confirmPassword?: string }>({});

  const handleSignOut = async () => {
    await signOut();
    toast.success('Signed out successfully');
    navigate('/auth');
  };

  const validateForm = () => {
    try {
      passwordSchema.parse({ currentPassword, newPassword, confirmPassword });
      setErrors({});
      return true;
    } catch (err) {
      if (err instanceof z.ZodError) {
        const fieldErrors: typeof errors = {};
        err.errors.forEach((e) => {
          const field = e.path[0] as keyof typeof errors;
          fieldErrors[field] = e.message;
        });
        setErrors(fieldErrors);
      }
      return false;
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;
    
    setIsSubmitting(true);

    try {
      // First verify current password by attempting to sign in
      await signInWithEmailAndPassword(auth, user?.email || '', currentPassword);

      // Update to new password
      if (user) {
        await updatePassword(user, newPassword);
        toast.success('Password updated successfully!');
        setIsChangingPassword(false);
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        setErrors({});
      }
    } catch (err: any) {
      if (err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        setErrors({ currentPassword: 'Current password is incorrect' });
      } else {
        toast.error(err.message || 'An error occurred. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancelPasswordChange = () => {
    setIsChangingPassword(false);
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setErrors({});
  };

  return (
    <MobileLayout>
      <div className="px-4 pt-6 pb-4 space-y-6 max-w-2xl mx-auto lg:px-8 lg:pt-8">
        {/* Header */}
        <h1 className="text-xl lg:text-2xl font-bold text-foreground">Settings</h1>

        {/* Profile Card */}
        <Card className="shadow-card">
          <CardContent className="p-4 lg:p-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 lg:w-16 lg:h-16 rounded-full bg-primary flex items-center justify-center">
                <User className="w-6 h-6 lg:w-8 lg:h-8 text-primary-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-foreground truncate lg:text-lg">
                  {user?.email?.split('@')[0] || 'User'}
                </p>
                <p className="text-sm text-muted-foreground truncate">
                  {user?.email}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Security Section */}
        <div className="space-y-3">
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Security</h2>
          
          <Card className="shadow-card">
            <CardContent className="p-4 lg:p-6">
              {isChangingPassword ? (
                <form onSubmit={handleChangePassword} className="space-y-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Lock className="w-5 h-5 text-muted-foreground" />
                    <p className="font-medium text-foreground">Change Password</p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="currentPassword">Current Password</Label>
                    <Input
                      id="currentPassword"
                      type="password"
                      placeholder="••••••••"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      autoComplete="current-password"
                    />
                    {errors.currentPassword && <p className="text-sm text-destructive">{errors.currentPassword}</p>}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="newPassword">New Password</Label>
                    <Input
                      id="newPassword"
                      type="password"
                      placeholder="••••••••"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      autoComplete="new-password"
                    />
                    {errors.newPassword && <p className="text-sm text-destructive">{errors.newPassword}</p>}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword">Confirm New Password</Label>
                    <Input
                      id="confirmPassword"
                      type="password"
                      placeholder="••••••••"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      autoComplete="new-password"
                    />
                    {errors.confirmPassword && <p className="text-sm text-destructive">{errors.confirmPassword}</p>}
                  </div>

                  <div className="flex gap-2 pt-2">
                    <Button type="submit" disabled={isSubmitting}>
                      {isSubmitting ? 'Updating...' : 'Update Password'}
                    </Button>
                    <Button type="button" variant="outline" onClick={handleCancelPasswordChange}>
                      Cancel
                    </Button>
                  </div>
                </form>
              ) : (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Lock className="w-5 h-5 text-muted-foreground" />
                    <div>
                      <p className="font-medium text-foreground">Password</p>
                      <p className="text-sm text-muted-foreground">Change your account password</p>
                    </div>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => setIsChangingPassword(true)}>
                    Change
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* App Info */}
        <div className="space-y-3">
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">About</h2>
          
          <Card className="shadow-card">
            <CardContent className="p-4 space-y-4 lg:p-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 lg:w-12 lg:h-12 rounded-lg bg-primary flex items-center justify-center">
                  <Wallet className="w-5 h-5 lg:w-6 lg:h-6 text-primary-foreground" />
                </div>
                <div>
                  <p className="font-medium text-foreground lg:text-lg">LoanTracker</p>
                  <p className="text-sm text-muted-foreground">Version 1.0.0</p>
                </div>
              </div>

              <div className="flex items-start gap-3 pt-3 border-t border-border">
                <Shield className="w-5 h-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="font-medium text-foreground">Your Data is Private</p>
                  <p className="text-sm text-muted-foreground">
                    All your loan data is securely stored and only accessible by you.
                    This app is for personal tracking only.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Actions */}
        <div className="space-y-3">
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Account</h2>
          
          <Button
            variant="outline"
            className="w-full justify-start gap-3 text-destructive hover:text-destructive hover:bg-destructive/10 lg:w-auto"
            onClick={handleSignOut}
          >
            <LogOut className="w-5 h-5" />
            Sign Out
          </Button>
        </div>
      </div>
    </MobileLayout>
  );
}
