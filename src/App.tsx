import React from 'react';
import { AppProvider } from '@/state/AppProvider';
import { AppShell } from '@/components/shell/AppShell';
import { ModelPage } from '@/pages/ModelPage';

import { useAppState } from '@/state/AppProvider';
import { useAppCommands } from '@/api/useAppCommands';
import { HistoryPanel } from '@/components/history/HistoryPanel';
import { ScenarioPage } from '@/pages/ScenarioPage';
import { PerformanceLabPage } from '@/pages/PerformanceLabPage';

function AppContent(): React.JSX.Element {
  const { activeTab, changeHistory, canUndo, isMutating } = useAppState();
  const commands = useAppCommands();

  const isUndoAvailable =
    (typeof canUndo === 'boolean' ? canUndo : changeHistory.length > 0) && !isMutating;

  if (activeTab === 'history') {
    return (
      <HistoryPanel
        history={changeHistory}
        canUndo={isUndoAvailable}
        onUndoLast={() => commands.undoLastTransaction().catch(() => {})}
      />
    );
  }

  if (activeTab === 'compare') {
    return <ScenarioPage />;
  }

  if (activeTab === 'performance') {
    return <PerformanceLabPage />;
  }

  return <ModelPage />;
}

export function App(): React.JSX.Element {
  return (
    <AppProvider>
      <AppShell>
        <AppContent />
      </AppShell>
    </AppProvider>
  );
}

export default App;
