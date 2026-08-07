"use client";

import type { ReactNode } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";

import { Button } from "@/components/shared/Button";

export type DialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
};

export function Dialog({ children, description, footer, onOpenChange, open, title }: DialogProps) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="shared-dialog__overlay" />
        <DialogPrimitive.Content className="shared-dialog__content">
          <DialogPrimitive.Title className="shared-dialog__title">{title}</DialogPrimitive.Title>
          {description ? (
            <DialogPrimitive.Description className="shared-dialog__description">
              {description}
            </DialogPrimitive.Description>
          ) : null}
          <div className="shared-dialog__body">{children}</div>
          {footer ? <div className="shared-dialog__footer">{footer}</div> : null}
          <DialogPrimitive.Close asChild>
            <Button className="shared-dialog__close" variant="secondary" aria-label="Fechar janela">
              Fechar
            </Button>
          </DialogPrimitive.Close>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
