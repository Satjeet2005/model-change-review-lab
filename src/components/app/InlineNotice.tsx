import React from 'react';
import { cn } from '@/lib/utils';

export type InlineNoticeVariant = 'info' | 'warning' | 'error' | 'success';

export interface InlineNoticeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: InlineNoticeVariant;
  title?: string;
  children: React.ReactNode;
}

const NOTICE_STYLES: Record<InlineNoticeVariant, string> = {
  info: 'bg-blue-50 border-blue-200 text-blue-900',
  warning: 'bg-amber-50 border-amber-200 text-amber-900',
  error: 'bg-red-50 border-red-300 text-red-900',
  success: 'bg-green-50 border-green-200 text-green-900'
};

export function InlineNotice({
  variant = 'info',
  title,
  className,
  children,
  ...props
}: InlineNoticeProps): React.JSX.Element {
  return (
    <div
      role={variant === 'error' ? 'alert' : 'status'}
      aria-live={variant === 'error' ? 'assertive' : 'polite'}
      className={cn(
        'p-3 rounded-lg border text-xs flex flex-col gap-1',
        NOTICE_STYLES[variant],
        className
      )}
      {...props}
    >
      {title && <span className="font-semibold text-xs tracking-tight">{title}</span>}
      <div className="leading-relaxed">{children}</div>
    </div>
  );
}
