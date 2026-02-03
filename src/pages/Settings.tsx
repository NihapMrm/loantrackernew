import { useNavigate } from 'react-router-dom';
import { MobileLayout } from '@/components/layout/MobileLayout';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { LogOut, User, Shield, Wallet } from 'lucide-react';
import { toast } from 'sonner';

export default function Settings() {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();

  const handleSignOut = async () => {
    await signOut();
    toast.success('Signed out successfully');
    navigate('/auth');
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
