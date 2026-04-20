import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useAuth } from './contexts/AuthContext';
import { SidebarProvider } from './contexts/SidebarContext';
import { ToastProvider } from './components/ui/Toast';

// Pages
import Login from './pages/Login';
import Onboarding from './pages/Onboarding';
import Dashboard from './pages/Dashboard';
import Clients from './pages/Clients';
import Products from './pages/Products';
import InvoiceCreate from './pages/InvoiceCreate';
import Invoices from './pages/Invoices';
import InvoiceView from './pages/InvoiceView';
import Settings from './pages/Settings';

// Layout
import Sidebar from './components/layout/Sidebar';
import Header from './components/layout/Header';
import MobileNav from './components/layout/MobileNav';
import Drawer from './components/layout/Drawer';

const NotFound = () => (
  <div className="min-h-screen flex flex-col items-center justify-center p-4 text-center bg-background">
    <div className="text-7xl font-bold text-primary-100 mb-2">404</div>
    <h1 className="text-2xl font-bold text-primary-700 mb-2">Page introuvable</h1>
    <p className="text-slate-500 mb-6">La page que vous recherchez n'existe pas.</p>
    <a href="/" className="text-sm font-semibold text-primary-700 hover:text-primary-800 hover:underline">
      ← Retourner à l'accueil
    </a>
  </div>
);

function AnimatedPage({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  return (
    <div key={location.pathname} className="animate-page-enter h-full">
      {children}
    </div>
  );
}

const MainLayout = ({ children, fullWidth = false }: { children: React.ReactNode; fullWidth?: boolean }) => {
  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Desktop Sidebar */}
      <div className="hidden lg:flex w-64 flex-shrink-0 flex-col bg-white border-r border-slate-100">
        <Sidebar />
      </div>

      {/* Mobile Drawer */}
      <Drawer />

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header />

        <main className="flex-1 overflow-y-auto scroll-smooth">
          <div className={`w-full h-full ${fullWidth ? '' : 'max-w-screen-xl mx-auto px-4 sm:px-6 lg:px-8 py-8'}`}>
            <AnimatedPage>{children}</AnimatedPage>
          </div>
        </main>

        {/* Mobile nav — bottom, above safe area */}
        <div className="lg:hidden flex-shrink-0">
          <MobileNav />
        </div>
      </div>
    </div>
  );
};

const ProtectedRoute = ({
  children,
  requireOnboarding = true,
}: {
  children: React.ReactNode;
  requireOnboarding?: boolean;
}) => {
  const { user, loading, isOnboarded } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-10 h-10 animate-spin text-primary-700" />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;
  if (requireOnboarding && !isOnboarded) return <Navigate to="/onboarding" replace />;
  if (!requireOnboarding && isOnboarded) return <Navigate to="/" replace />;

  return <>{children}</>;
};

export default function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <SidebarProvider>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route
              path="/onboarding"
              element={
                <ProtectedRoute requireOnboarding={false}>
                  <Onboarding />
                </ProtectedRoute>
              }
            />
            <Route path="/" element={<ProtectedRoute><MainLayout><Dashboard /></MainLayout></ProtectedRoute>} />
            <Route path="/invoices" element={<ProtectedRoute><MainLayout><Invoices /></MainLayout></ProtectedRoute>} />
            <Route path="/invoices/new" element={<ProtectedRoute><MainLayout fullWidth><InvoiceCreate /></MainLayout></ProtectedRoute>} />
            <Route path="/invoices/:id" element={<ProtectedRoute><MainLayout><InvoiceView /></MainLayout></ProtectedRoute>} />
            <Route path="/clients" element={<ProtectedRoute><MainLayout><Clients /></MainLayout></ProtectedRoute>} />
            <Route path="/products" element={<ProtectedRoute><MainLayout><Products /></MainLayout></ProtectedRoute>} />
            <Route path="/settings" element={<ProtectedRoute><MainLayout><Settings /></MainLayout></ProtectedRoute>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </SidebarProvider>
      </ToastProvider>
    </BrowserRouter>
  );
}
