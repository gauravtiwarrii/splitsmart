"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/* ---------- Toast Types ---------- */
export type ToastVariant = "default" | "destructive" | "success";

export interface ToastData {
  id: string;
  title?: string;
  description?: string;
  variant?: ToastVariant;
}

/* ---------- Toast Component ---------- */
interface ToastProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: ToastVariant;
  onClose?: () => void;
}

const Toast = React.forwardRef<HTMLDivElement, ToastProps>(
  ({ className, variant = "default", onClose, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "group pointer-events-auto relative flex w-full items-center justify-between space-x-2 overflow-hidden rounded-lg border p-4 shadow-lg transition-all animate-slide-up",
          variant === "default" && "border-border bg-card text-card-foreground",
          variant === "destructive" && "border-destructive bg-destructive text-destructive-foreground",
          variant === "success" && "border-emerald-500/50 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
          className
        )}
        {...props}
      >
        <div className="flex-1">{children}</div>
        {onClose && (
          <button
            onClick={onClose}
            className="rounded-md p-1 opacity-70 transition-opacity hover:opacity-100"
          >
            ✕
          </button>
        )}
      </div>
    );
  }
);
Toast.displayName = "Toast";

function ToastTitle({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("text-sm font-semibold", className)} {...props} />;
}

function ToastDescription({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("text-sm opacity-90", className)} {...props} />;
}

export { Toast, ToastTitle, ToastDescription };
