import React, { useEffect, useRef } from 'react';
import { Button } from '@/components/ui/Button';

export interface ResetDialogProps {
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ResetDialog({
  isOpen,
  onConfirm,
  onCancel
}: ResetDialogProps): React.JSX.Element | null {
  const cancelBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (isOpen) {
      // Focus cancel button by default to prevent accidental confirmation
      cancelBtnRef.current?.focus();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="reset-dialog-title"
      aria-describedby="reset-dialog-description"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs"
    >
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full border border-neutral-200 p-6 space-y-4">
        <div className="space-y-1">
          <h2 id="reset-dialog-title" className="text-base font-bold text-neutral-900">
            Reset Scenario to Baseline?
          </h2>
          <p id="reset-dialog-description" className="text-xs text-neutral-600 leading-relaxed">
            This action will restore all working assumptions to the immutable baseline seed values.
            Committed change history and any pending proposal will be cleared, and model revision
            will advance. This action cannot be undone.
          </p>
        </div>

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-neutral-100">
          <Button
            ref={cancelBtnRef}
            variant="outline"
            size="sm"
            onClick={onCancel}
            className="text-xs"
          >
            Cancel
          </Button>
          <Button variant="destructive" size="sm" onClick={onConfirm} className="text-xs">
            Confirm Reset
          </Button>
        </div>
      </div>
    </div>
  );
}
