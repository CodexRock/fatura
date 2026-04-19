import React, { createContext, useContext, useEffect, useState } from 'react';
import type { User, ConfirmationResult } from 'firebase/auth';
import { onAuthChange, signInWithPhone, verifyOTP, signOut } from '../lib/auth';
import { getBusinessByOwner } from '../lib/firestore';
import type { Business } from '../types';

interface AuthContextType {
  user: User | null;
  business: Business | null;
  loading: boolean;
  isOnboarded: boolean;
  signIn: (phone: string, containerId?: string) => Promise<ConfirmationResult>;
  verify: (confirmationResult: ConfirmationResult, code: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshBusiness: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

// Exposes contextual bounds downstream avoiding explicit prop-drilling
export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [business, setBusiness] = useState<Business | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthChange(async (firebaseUser) => {
      setUser(firebaseUser);
      
      if (firebaseUser) {
        try {
          const bz = await getBusinessByOwner(firebaseUser.uid);
          setBusiness(bz);
        } catch (e) {
          console.error("Failed fetching business binding:", e);
          setBusiness(null);
        }
      } else {
        setBusiness(null);
      }
      
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const signIn = async (phone: string, containerId?: string) => {
    return await signInWithPhone(phone, containerId);
  };

  const verify = async (res: ConfirmationResult, code: string) => {
    await verifyOTP(res, code);
  };

  const logout = async () => {
    setBusiness(null);
    setUser(null);
    await signOut();
  };

  const refreshBusiness = async () => {
    if (user) {
      try {
        const bz = await getBusinessByOwner(user.uid);
        setBusiness(bz);
      } catch (e) {
        console.error("Failed fetching business binding:", e);
      }
    }
  };

  // Onboarded signifies the user is authenticated natively AND has generated the necessary DGI compliance boundaries.
  const isOnboarded = !!user && !!business;

  return (
    <AuthContext.Provider value={{ user, business, loading, isOnboarded, signIn, verify, logout, refreshBusiness }}>
      {children}
    </AuthContext.Provider>
  );
}
