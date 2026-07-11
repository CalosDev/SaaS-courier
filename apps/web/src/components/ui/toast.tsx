"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  useEffect,
} from "react";
import { onApiError } from "@/lib/api/api-events";

const ToastContext = createContext<{
  pushToast: (message: string) => void;
} | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [messages, setMessages] = useState<string[]>([]);

  const pushToast = useCallback((message: string) => {
    setMessages((current) => [...current, message]);

    window.setTimeout(() => {
      setMessages((current) => current.filter((item) => item !== message));
    }, 3000);
  }, []);

  useEffect(() => {
    return onApiError((message) => {
      pushToast(message);
    });
  }, [pushToast]);

  const value = useMemo(() => ({ pushToast }), [pushToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="ui-toast-stack" aria-live="polite">
        {messages.map((message) => (
          <div key={message} className="ui-toast">
            {message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);

  if (!context) {
    throw new Error("useToast must be used within ToastProvider.");
  }

  return context;
}
