import React, { useState, useEffect } from 'react';

export interface ColdBootToastProps {
  isInitializing: boolean;
}

export function ColdBootToast({ isInitializing }: ColdBootToastProps): React.JSX.Element | null {
  const [isVisible, setIsVisible] = useState<boolean>(true);
  const [hasConnected, setHasConnected] = useState<boolean>(false);

  useEffect(() => {
    if (isInitializing) {
      return undefined;
    }
    setHasConnected(true);
    // Auto-dismiss 4 seconds after successful connection
    const timer = setTimeout(() => {
      setIsVisible(false);
    }, 4000);
    return () => clearTimeout(timer);
  }, [isInitializing]);

  if (!isVisible) {
    return null;
  }

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Backend status notice"
      className="fixed bottom-4 right-4 z-50 max-w-sm w-[calc(100vw-2rem)] sm:w-96 bg-white border border-amber-300 rounded-xl shadow-lg p-3.5 text-neutral-800 transition-all duration-300 animate-in fade-in slide-in-from-bottom-2"
    >
      <div className="flex items-start gap-2.5">
        {/* Status Indicator Icon */}
        <div className="mt-0.5 shrink-0">
          {hasConnected ? (
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 text-xs font-bold">
              ✓
            </span>
          ) : (
            <span className="relative flex h-3.5 w-3.5 m-0.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-amber-500" />
            </span>
          )}
        </div>

        {/* Message Content */}
        <div className="flex-1 min-w-0 pr-1">
          <div className="flex items-center gap-1.5 font-semibold text-xs text-neutral-900">
            <span>{hasConnected ? 'Connected to Workspace' : 'Free-Tier Backend Notice'}</span>
            {!hasConnected && (
              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 border border-amber-200">
                Cold Boot ~50s
              </span>
            )}
          </div>
          <p className="mt-1 text-[11px] leading-relaxed text-neutral-600">
            {hasConnected ? (
              'Backend is active. Your session is loaded and ready to test.'
            ) : (
              <>
                Free web services on Render spin down after 15 minutes of inactivity. Cold boot
                typically takes <strong>30–60 seconds (~50s)</strong> to wake up. Thank you for your
                patience while your session connects!
              </>
            )}
          </p>
        </div>

        {/* Dismiss Button */}
        <button
          type="button"
          onClick={() => setIsVisible(false)}
          className="shrink-0 -mr-1 -mt-1 p-1 text-neutral-400 hover:text-neutral-700 rounded-md hover:bg-neutral-100 transition-colors cursor-pointer"
          aria-label="Dismiss notice"
          title="Dismiss notice"
        >
          <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <path
              fillRule="evenodd"
              d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
              clipRule="evenodd"
            />
          </svg>
        </button>
      </div>
    </div>
  );
}
