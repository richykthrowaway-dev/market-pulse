import React, { createContext, useContext, useState } from 'react';

interface NavbarSlotContextValue {
  slot: React.ReactNode;
  setSlot: (node: React.ReactNode) => void;
}

const NavbarSlotContext = createContext<NavbarSlotContextValue>({
  slot: null,
  setSlot: () => {},
});

export function NavbarSlotProvider({ children }: { children: React.ReactNode }) {
  const [slot, setSlot] = useState<React.ReactNode>(null);
  return (
    <NavbarSlotContext.Provider value={{ slot, setSlot }}>
      {children}
    </NavbarSlotContext.Provider>
  );
}

export function useNavbarSlot() {
  return useContext(NavbarSlotContext);
}
