import type { HTMLAttributes, ReactNode } from "react";
import clsx from "clsx";

export type AlertProps = HTMLAttributes<HTMLDivElement> & {
  title?: string;
  children: ReactNode;
  variant?: "info" | "success" | "warning" | "error";
};

export function Alert({ children, className, title, variant = "info", ...props }: AlertProps) {
  return (
    <div
      className={clsx("shared-alert", `shared-alert--${variant}`, className)}
      role={variant === "error" ? "alert" : "status"}
      {...props}
    >
      {title ? <strong className="shared-alert__title">{title}</strong> : null}
      <div>{children}</div>
    </div>
  );
}
