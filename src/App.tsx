import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useAuth } from './contexts/AuthContext';

// Existing Pages
import Login from './pages/Login';
import Onboarding from './pages/Onboarding';

import InvoiceCreate from './pages/InvoiceCreate';
import Invoices from './pages/Invoices';
import InvoiceView from './pages/InvoiceView';
import Settings from './pages/Settings';
// Layout Components
import Sidebar from './components/layout/Sidebar';
import Header from './components/layout/Header';
import MobileNav from './components/layout/MobileNav';

import Dashboard from './pages/Dashboard';
import Clients from './pages/Clients';
import Products from './pages/Products';

const NotFound = () => <div className="min-h-screen flex flex-col items-center justify-center p-4 text-center"><h1 className="text-4xl font-bold text-[#1B4965] mb-2">404</h1><p className="text-slate-500">La page que vous recherchez n'existe pas.</p><a href="/" className="mt-4 text-[#5FA8D3] font-medium hover:underline">Retourner à l'accueil</a></div>;

// ---- LAYOUT WRAPPER ----
const MainLayout = ({ children, fullWidth = false }: { children: React.ReactNode; fullWidth?: boolean }) => {
  return (
    <div className="flex h-screen bg-[#F8F9FA] overflow-hidden dir-ltr">
      {/* Desktop Sidebar: Hidden on screens < 1024px */}
      <div className="hidden lg:flex w-[260px] flex-shrink-0 flex-col bg-white border-r border-slate-200">
        <Sidebar />
      </div>

      {/* Main Execution Area */}
      <div className="flex-1 flex flex-col overflow-hidden relative">
        <Header />
        
        {/* Main Content Pane */}
        <main className="flex-1 overflow-y-auto pb-32 lg:pb-0 scroll-smooth"> 
          <div className={`w-full h-full animate-in fade-in slide-in-from-bottom-4 duration-500 ${fullWidth ? '' : 'max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6'}`}>
            {children}
          </div>
        </main>
        
        {/* Mobile Navigation Tabset: Hidden on screens >= 1024px */}
        <div className="lg:hidden absolute bottom-0 left-0 w-full z-50">
          <MobileNav />
        </div>
      </div>
    </div>
  );
};

// ---- ROUTE PROTECTION PIPELINE ----
const ProtectedRoute = ({ 
  children, 
  requireOnboarding = true 
}: { 
  children: React.ReactNode; 
  requireOnboarding?: boolean;
}) => {
  const { user, loading, isOnboarded } = useAuth();
  
  // Awaiting deeply cascaded boundaries synchronously
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-10 h-10 animate-spin text-[#1B4965]" />
      </div>
    );
  }

  // Not authenticated natively
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Auth is valid, but missing Firestore configuration
  if (requireOnboarding && !isOnboarded) {
    return <Navigate to="/onboarding" replace />;
  }

  // Active business mapped inside Onboarding page path? Force them downstream to Dashboard
  if (!requireOnboarding && isOnboarded) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};

// ---- PRIMARY APPLICATION DOM ----
export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public Routes */}
        <Route path="/login" element={<Login />} />

        {/* Unbound Onboarding Bounds */}
        <Route 
          path="/onboarding" 
          element={
            <ProtectedRoute requireOnboarding={false}>
              <Onboarding />
            </ProtectedRoute>
          } 
        />

        {/* Protected Dashboard Sandbox */}
        <Route path="/" element={<ProtectedRoute><MainLayout><Dashboard /></MainLayout></ProtectedRoute>} />
        <Route path="/invoices" element={<ProtectedRoute><MainLayout><Invoices /></MainLayout></ProtectedRoute>} />
        <Route path="/invoices/new" element={<ProtectedRoute><MainLayout fullWidth={true}><InvoiceCreate /></MainLayout></ProtectedRoute>} />
        <Route path="/invoices/:id" element={<ProtectedRoute><MainLayout><InvoiceView /></MainLayout></ProtectedRoute>} />
        <Route path="/clients" element={<ProtectedRoute><MainLayout><Clients /></MainLayout></ProtectedRoute>} />
        <Route path="/products" element={<ProtectedRoute><MainLayout><Products /></MainLayout></ProtectedRoute>} />
        <Route path="/settings" element={<ProtectedRoute><MainLayout><Settings /></MainLayout></ProtectedRoute>} />

        {/* Null Routings */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
}
