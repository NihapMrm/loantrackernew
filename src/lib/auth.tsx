import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { 
  User,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  updateProfile,
  GoogleAuthProvider,
  signInWithCredential
} from 'firebase/auth';
import { auth } from '@/integrations/firebase/client';
import { FirebaseAuthentication } from '@capacitor-firebase/authentication';
import { Capacitor } from '@capacitor/core';

interface AuthContextType {
  user: User | null;
  session: User | null;
  loading: boolean;
  signUp: (email: string, password: string, name?: string) => Promise<{ error: Error | null }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signInWithGoogle: () => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Set up auth state listener
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const signUp = async (email: string, password: string, name?: string) => {
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      
      // Update profile with name if provided
      if (name && userCredential.user) {
        await updateProfile(userCredential.user, { displayName: name });
      }
      
      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      await signInWithEmailAndPassword(auth, email, password);
      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  };

  const signInWithGoogle = async () => {
    try {
      // Check if running on native platform
      if (Capacitor.isNativePlatform()) {
        // Use native Google Sign-In
        const result = await FirebaseAuthentication.signInWithGoogle();
        
        // Create credential from the result
        const credential = GoogleAuthProvider.credential(result.credential?.idToken);
        
        // Sign in to Firebase with the credential
        await signInWithCredential(auth, credential);
      } else {
        // Use web popup for browser
        const { signInWithPopup } = await import('firebase/auth');
        const provider = new GoogleAuthProvider();
        await signInWithPopup(auth, provider);
      }
      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  };

  const signOut = async () => {
    await firebaseSignOut(auth);
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      session: user, 
      loading, 
      signUp, 
      signIn, 
      signInWithGoogle, 
      signOut 
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
