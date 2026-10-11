import React from 'react';
import { AppProvider } from '@/state/AppProvider';
import { AppShell } from '@/components/shell/AppShell';
import { ModelPage } from '@/pages/ModelPage';

import { useAppState, useAppDispatch } from '@/state/AppProvider';
import { HistoryPanel } from '@/components/history/HistoryPanel';
import { ScenarioPage } from '@/pages/ScenarioPage';

function AppContent(): React.JSX.Element {
  const { activeTab, changeHistory } = useAppState();
  const dispatch = useAppDispatch();

  if (activeTab === 'history') {
    return (
      <HistoryPanel
        history={changeHistory}
        canUndo={changeHistory.length > 0}
        onUndoLast={() => dispatch({ type: 'UNDO_LAST_TRANSACTION' })}
      />
    );
  }

  if (activeTab === 'compare') {
    return <ScenarioPage />;
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
