import React, { ReactNode, useState } from 'react';
import { useAppState, useAppDispatch } from '@/state/AppProvider';
import { NavTabId } from '@/state/appState';
import { Button } from '@/components/ui/Button';
import { ResetDialog } from '@/components/history/ResetDialog';

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
  { id: 'compare', label: 'Scenario Compare', implemented: false },
  { id: 'history', label: 'History', implemented: true },
  { id: 'performance', label: 'Performance Lab', implemented: false }
];

export function AppShell({ children }: AppShellProps): React.JSX.Element {
  const { activeTab, changeHistory } = useAppState();
  const dispatch = useAppDispatch();
  const [isResetDialogOpen, setIsResetDialogOpen] = useState<boolean>(false);

  const canUndo = changeHistory.length > 0;

  function handleUndo() {
    if (!canUndo) return;
    dispatch({ type: 'UNDO_LAST_TRANSACTION' });
  }

  function handleOpenReset() {
    setIsResetDialogOpen(true);
  }

  function handleCancelReset() {
    setIsResetDialogOpen(false);
  }

  function handleConfirmReset() {
    dispatch({ type: 'RESET_TO_BASELINE' });
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
              disabled={!canUndo}
              onClick={handleUndo}
              title={canUndo ? 'Undo latest transaction' : 'No transactions to undo'}
              aria-disabled={!canUndo ? 'true' : undefined}
            >
              Undo
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleOpenReset}
              title="Reset scenario to baseline seed model"
            >
              Reset
            </Button>
          </div>
        </div>
      </header>

      {/* Reset Confirmation Dialog */}
      <ResetDialog
        isOpen={isResetDialogOpen}
        onConfirm={handleConfirmReset}
        onCancel={handleCancelReset}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-[1440px] w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {children}
      </main>

      {/* Footer Landmark */}
      <footer className="border-t border-neutral-200 bg-white py-4 text-center text-xs text-neutral-500">
        <p>Proof-of-Impact Prototype · Deterministic Synthetic Assumptions · No External APIs</p>
      </footer>
    </div>
  );
}
