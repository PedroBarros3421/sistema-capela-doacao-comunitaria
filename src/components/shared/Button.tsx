import { forwardRef, type ButtonHTMLAttributes } from "react";
import clsx from "clsx";

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "danger";
  size?: "default" | "large";
  loading?: boolean;
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, children, disabled, loading = false, size = "default", variant = "primary", ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      className={clsx("shared-button", `shared-button--${variant}`, `shared-button--${size}`, className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? <span aria-hidden="true" className="shared-button__spinner" /> : null}
      <span>{loading ? "Aguarde…" : children}</span>
    </button>
  );
});
