import React, { useEffect, useRef } from 'react';
import { Button } from '@/components/ui/Button';

export interface SidePanelProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

export function SidePanel({
  isOpen,
  onClose,
  title,
  children
}: SidePanelProps): React.JSX.Element | null {
  const closeBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (isOpen) {
      closeBtnRef.current?.focus();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop for mobile viewports */}
      <div
        className="fixed inset-0 z-40 bg-black/30 lg:hidden"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Slide-out sheet / Drawer */}
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="fixed top-0 right-0 z-50 h-full w-full sm:w-[480px] bg-white border-l border-neutral-200 shadow-2xl flex flex-col transition-transform duration-200 ease-in-out"
      >
        <div className="flex items-center justify-between px-4 py-3.5 border-b border-neutral-200 bg-neutral-50/70">
          <h2 className="text-sm font-bold text-neutral-900 tracking-tight">{title}</h2>
          <Button
            ref={closeBtnRef}
            size="sm"
            variant="ghost"
            onClick={onClose}
            aria-label={`Close ${title}`}
            className="h-8 w-8 p-0 text-neutral-500 hover:text-neutral-900"
          >
            ✕
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 sm:p-5">{children}</div>
      </aside>
    </>
  );
}
