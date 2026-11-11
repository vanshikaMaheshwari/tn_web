'use client';
import { createContext, useCallback, useContext, useState } from 'react';
import Icon from './Icon';

const ToastCtx = createContext(() => {});

export function ToastProvider({ children }) {
  const [toast, setToast] = useState(null);
  const show = useCallback((message, type = 'success') => {
    const id = Date.now();
    setToast({ id, message, type });
    setTimeout(() => setToast((t) => (t && t.id === id ? null : t)), 4200);
  }, []);
  return (
    <ToastCtx.Provider value={show}>
      {children}
      {toast && (
        <div className={`tn-toast ${toast.type}`} role="status" aria-live="polite">
          <Icon name={toast.type === 'error' ? 'zap' : 'check'} size={20} />
          <span>{toast.message}</span>
        </div>
      )}
    </ToastCtx.Provider>
  );
}

export const useToast = () => useContext(ToastCtx);
