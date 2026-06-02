export type ToastSeverity = "error" | "info" | "success";

export interface AppToast {
  id: string;
  severity: ToastSeverity;
  title: string;
  detail?: string;
}

interface ToastStackProps {
  toasts: AppToast[];
  onDismiss: (toastId: string) => void;
}

export function ToastStack({ toasts, onDismiss }: ToastStackProps) {
  if (toasts.length === 0) return null;

  return (
    <div className="toast-stack" aria-live="polite" aria-relevant="additions removals">
      {toasts.map((toast) => (
        <article key={toast.id} className={`toast toast-${toast.severity}`}>
          <div className="toast-copy">
            <h2>{toast.title}</h2>
            {toast.detail ? <p>{toast.detail}</p> : null}
          </div>
          <button
            className="toast-dismiss"
            type="button"
            aria-label={`Dismiss ${toast.title}`}
            onClick={() => onDismiss(toast.id)}
          >
            ×
          </button>
        </article>
      ))}
    </div>
  );
}
