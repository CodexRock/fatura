import { createContext, useContext, useState } from 'react';

interface SidebarCtx {
  open: boolean;
  toggle: () => void;
  close: () => void;
}

const SidebarContext = createContext<SidebarCtx>({
  open: false,
  toggle: () => {},
  close: () => {},
});

export const useSidebar = () => useContext(SidebarContext);

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <SidebarContext.Provider value={{
      open,
      toggle: () => setOpen(p => !p),
      close: () => setOpen(false),
    }}>
      {children}
    </SidebarContext.Provider>
  );
}
