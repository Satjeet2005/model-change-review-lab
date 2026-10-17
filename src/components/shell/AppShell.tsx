import React, { ReactNode, useState } from 'react';
import { useAppState, useAppDispatch } from '@/state/AppProvider';
import { useAppCommands } from '@/api/useAppCommands';
import { NavTabId } from '@/state/appState';
import { Button } from '@/components/ui/Button';
import { ResetDialog } from '@/components/history/ResetDialog';
import { ColdBootToast } from '@/components/app/ColdBootToast';

export interface AppShellProps {
  children: ReactNode;
}

interface NavItem {
  id: NavTabId;
  label: string;
  implemented: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { id: 'model', label: 'Model', implemented: true },
  { id: 'compare', label: 'Scenario Compare', implemented: true },
  { id: 'history', label: 'History', implemented: true },
  { id: 'performance', label: 'Performance Lab', implemented: true }
];

export function AppShell({ children }: AppShellProps): React.JSX.Element {
  const {
    activeTab,
    changeHistory,
    canUndo,
    isInitializing,
    isMutating,
    networkError,
    configError,
    sessionExpiredNotice
  } = useAppState();
  const dispatch = useAppDispatch();
  const commands = useAppCommands();
  const [isResetDialogOpen, setIsResetDialogOpen] = useState<boolean>(false);

  const isUndoAvailable =
    (typeof canUndo === 'boolean' ? canUndo : changeHistory.length > 0) &&
    !isMutating &&
    !isInitializing;

  function handleUndo() {
    if (!isUndoAvailable) return;
    commands.undoLastTransaction().catch(() => {});
  }

  function handleOpenReset() {
    setIsResetDialogOpen(true);
  }

  function handleCancelReset() {
    setIsResetDialogOpen(false);
  }

  function handleConfirmReset() {
    commands.resetToBaseline().catch(() => {});
    setIsResetDialogOpen(false);
  }

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900 flex flex-col font-sans">
      {/* Global Application Header */}
      <header className="sticky top-0 z-30 bg-white border-b border-neutral-200 shadow-xs">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 min-h-16 py-2.5 sm:py-0 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          {/* Brand & Disclosure Landmark */}
          <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
            <h1 className="text-base sm:text-xl font-bold tracking-tight text-neutral-900">
              Model Change Review Lab
            </h1>
            <span
              className="inline-flex items-center px-2 py-0.5 rounded text-[11px] sm:text-xs font-medium bg-neutral-100 text-neutral-700 border border-neutral-300"
              role="status"
              aria-label="Prototype status"
            >
              Independent prototype · Synthetic data
            </span>
          </div>

          {/* Navigation Tabs */}
          <nav
            className="flex items-center gap-1 overflow-x-auto py-1 max-w-full min-w-0"
            aria-label="Main Navigation"
          >
            {NAV_ITEMS.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    if (item.implemented) {
                      dispatch({ type: 'SET_ACTIVE_TAB', tab: item.id });
                    }
                  }}
                  disabled={!item.implemented}
                  aria-current={isActive ? 'page' : undefined}
                  className={`px-3 py-1.5 text-xs sm:text-sm font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer select-none ${
                    isActive
                      ? 'bg-blue-50 text-blue-700 font-semibold border border-blue-200'
                      : item.implemented
                        ? 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100'
                        : 'text-neutral-400 cursor-not-allowed opacity-60'
                  }`}
                  title={!item.implemented ? `${item.label} (Planned for later phase)` : undefined}
                >
                  {item.label}
                  {!item.implemented && (
                    <span className="ml-1 text-[10px] text-neutral-400 font-normal">(Soon)</span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* History / Scenario Actions */}
          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="outline"
              size="sm"
              disabled={!isUndoAvailable}
              onClick={handleUndo}
              title={isUndoAvailable ? 'Undo latest transaction' : 'No transactions to undo'}
              aria-disabled={!isUndoAvailable ? 'true' : undefined}
            >
              Undo
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={isMutating || isInitializing}
              onClick={handleOpenReset}
              title="Reset scenario to baseline seed model"
            >
              Reset
            </Button>
          </div>
        </div>
      </header>

      {/* Global Status & Error Banners */}
      {configError && (
        <div
          role="alert"
          className="bg-red-50 border-b border-red-200 px-4 py-2 text-sm text-red-800"
        >
          <strong>Configuration Error:</strong> {configError}
        </div>
      )}

      {networkError && (
        <div
          role="alert"
          className="bg-amber-50 border-b border-amber-200 px-4 py-2 text-sm text-amber-800 flex items-center justify-between gap-4"
        >
          <span>
            <strong>Connection Warning:</strong> {networkError}
          </span>
          <button
            type="button"
            onClick={() => commands.retryInit()}
            className="shrink-0 px-2.5 py-1 text-xs font-semibold bg-amber-600 text-white rounded hover:bg-amber-700 cursor-pointer"
          >
            Retry Connection
          </button>
        </div>
      )}

      {sessionExpiredNotice && (
        <div
          role="status"
          className="bg-blue-50 border-b border-blue-200 px-4 py-2 text-sm text-blue-900 flex items-center justify-between gap-4"
        >
          <span>
            Your anonymous demo data expired after 30 days of inactivity and a clean workspace
            session was created.
          </span>
          <button
            type="button"
            onClick={() => dispatch({ type: 'CLEAR_SESSION_EXPIRED_NOTICE' })}
            className="shrink-0 text-xs font-semibold text-blue-700 hover:text-blue-900 underline cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Reset Confirmation Dialog */}
      <ResetDialog
        isOpen={isResetDialogOpen}
        onConfirm={handleConfirmReset}
        onCancel={handleCancelReset}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-[1440px] w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {isInitializing ? (
          <div
            role="status"
            aria-live="polite"
            className="flex flex-col items-center justify-center p-12 text-center text-neutral-600"
          >
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-3" />
            <p className="text-sm font-medium text-neutral-800">
              Connecting to Model Change Review Lab workspace...
            </p>
            <p className="text-xs text-neutral-500 mt-2 max-w-md leading-relaxed">
              The backend runs on Render's free tier. If the service was sleeping, cold boot
              typically takes <strong>30–60 seconds (~50s)</strong>. Thank you for your patience!
            </p>
          </div>
        ) : (
          children
        )}
      </main>

      {/* Free Tier Cold Boot Toast */}
      <ColdBootToast isInitializing={isInitializing} />

      {/* Footer Landmark */}
      <footer className="border-t border-neutral-200 bg-white py-4 text-center text-xs text-neutral-500">
        <p>Proof-of-Impact Prototype · Deterministic Synthetic Assumptions · No External APIs</p>
      </footer>
    </div>
  );
}
