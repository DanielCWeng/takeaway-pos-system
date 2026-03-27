/**
 * client/src/context/UIContext.tsx
 *
 * Manages global UI state (modals, notifications).
 */

/* eslint-disable react-refresh/only-export-components */

import { createContext, useContext, useState, type ReactNode } from "react";

type ModalType = "none" | "customer" | "address-selection" | "settings";

interface UIContextType {
  activeModal: ModalType;
  openModal: (type: ModalType) => void;
  closeModal: () => void;
}

const UIContext = createContext<UIContextType | undefined>(undefined);

export function UIProvider({ children }: { children: ReactNode }) {
  const [activeModal, setActiveModal] = useState<ModalType>("none");

  const openModal = (type: ModalType) => setActiveModal(type);
  const closeModal = () => setActiveModal("none");

  return (
    <UIContext.Provider value={{ activeModal, openModal, closeModal }}>
      {children}
    </UIContext.Provider>
  );
}

export function useUI() {
  const context = useContext(UIContext);
  if (!context) throw new Error("useUI must be used within UIProvider");
  return context;
}
