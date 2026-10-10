import React from 'react';
import { cn } from '@/lib/utils';

export type StatusBadgeVariant = 'default' | 'info' | 'success' | 'warning' | 'danger' | 'stale';

export interface StatusBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: StatusBadgeVariant;
  children: React.ReactNode;
}

const VARIANT_STYLES: Record<StatusBadgeVariant, string> = {
  default: 'bg-neutral-100 text-neutral-800 border-neutral-300',
  info: 'bg-blue-50 text-blue-800 border-blue-200',
  success: 'bg-green-50 text-green-800 border-green-200',
  warning: 'bg-amber-50 text-amber-800 border-amber-200',
  danger: 'bg-red-50 text-red-800 border-red-200',
  stale: 'bg-red-50 text-red-800 border-red-300 font-semibold'
};

export function StatusBadge({
  variant = 'default',
  className,
  children,
  ...props
}: StatusBadgeProps): React.JSX.Element {
  return (
    <span
      role="status"
      className={cn(
        'inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium border select-none',
        VARIANT_STYLES[variant],
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
}
