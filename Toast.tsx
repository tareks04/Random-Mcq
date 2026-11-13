/**
 * Toast.tsx — minimal accessible toast notifications.
 * Mount <ToastProvider> once; call useToast() anywhere beneath it.
 */
import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from "react";
import { AlertTriangle, CheckCircle2, Info, X } from "lucide-react";

export type ToastKind = "success" | "error" | "info";

interface ToastItem {
  id: number;
  kind: ToastKind;
  message: string;
}

type Push = (kind: ToastKind, message: string) => void;

const ToastContext = createContext<Push>(() => undefined);

/** Returns the push(kind, message) function. */
export function useToast(): Push {
  return useContext(ToastContext);
}

const ICON: Record<ToastKind, typeof Info> = {
  success: CheckCircle2,
  error: AlertTriangle,
  info: Info,
};

const ICON_CLASS: Record<ToastKind, string> = {
  success: "text-leaf",
  error: "text-brick",
  info: "text-gold",
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const push = useCallback<Push>((kind, message) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t.slice(-3), { id, kind, message }]);
    window.setTimeout(() => {
      setToasts((t) => t.filter((x) => x.id !== id));
    }, 3800);
  }, []);

  const dismiss = useCallback((id: number) => {
    setToasts((t) => t.filter((x) => x.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={push}>
      {children}
      {/* aria-live region announces every toast to screen readers */}
      <div
        aria-live="polite"
        role="status"
        className="pointer-events-none fixed right-4 top-4 z-[90] flex w-[min(22rem,92vw)] flex-col gap-2"
      >
        {toasts.map((t) => {
          const Icon = ICON[t.kind];
          return (
            <div
              key={t.id}
              className="pointer-events-auto flex animate-toast items-start gap-2.5 rounded-xl border border-line bg-card px-4 py-3 shadow-lift"
            >
              <Icon className={`mt-0.5 size-4 shrink-0 ${ICON_CLASS[t.kind]}`} aria-hidden />
              <p className="text-sm font-medium leading-snug">{t.message}</p>
              <button
                type="button"
                onClick={() => dismiss(t.id)}
                aria-label="Dismiss notification"
                className="ml-auto -mr-1 rounded-md p-1 text-ink-3 transition hover:bg-paper-2 hover:text-ink"
              >
                <X className="size-3.5" aria-hidden />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}
