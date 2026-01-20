'use client';

import * as React from 'react';

// Toast types
export interface Toast {
  id: string;
  title?: string;
  description?: string;
  variant?: 'default' | 'destructive';
  duration?: number;
}

interface ToastContextValue {
  toasts: Toast[];
  toast: (props: Omit<Toast, 'id'>) => void;
  dismiss: (id: string) => void;
}

const ToastContext = React.createContext<ToastContextValue | undefined>(undefined);

let toastCount = 0;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<Toast[]>([]);

  const toast = React.useCallback((props: Omit<Toast, 'id'>) => {
    const id = `toast-${++toastCount}`;
    const newToast: Toast = { id, duration: 5000, ...props };
    
    setToasts((prev) => [...prev, newToast]);

    // Auto dismiss
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, newToast.duration);

    return id;
  }, []);

  const dismiss = React.useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ toasts, toast, dismiss }}>
      {children}
      <ToastContainer toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

function ToastContainer({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: string) => void }) {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-md">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`
            rounded-lg border p-4 shadow-lg transition-all
            ${toast.variant === 'destructive' 
              ? 'border-red-200 bg-red-50 text-red-900 dark:border-red-800 dark:bg-red-950 dark:text-red-100' 
              : 'border-gray-200 bg-white text-gray-900 dark:border-gray-800 dark:bg-gray-950 dark:text-gray-100'
            }
          `}
          role="alert"
        >
          <div className="flex items-start gap-3">
            <div className="flex-1">
              {toast.title && (
                <div className="font-semibold">{toast.title}</div>
              )}
              {toast.description && (
                <div className="text-sm opacity-90 mt-1">{toast.description}</div>
              )}
            </div>
            <button
              onClick={() => onDismiss(toast.id)}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              ×
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

export function useToast() {
  const context = React.useContext(ToastContext);
  
  // Fallback for components outside provider - create inline toast function
  if (!context) {
    return {
      toast: (props: Omit<Toast, 'id'>) => {
        // Simple console fallback when no provider
        console.log(`[Toast] ${props.title}: ${props.description}`);
      },
      toasts: [],
      dismiss: () => {},
    };
  }
  
  return context;
}
