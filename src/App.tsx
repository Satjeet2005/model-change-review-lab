import React from 'react';
import { AppProvider } from '@/state/AppProvider';
import { AppShell } from '@/components/shell/AppShell';
import { ModelPage } from '@/pages/ModelPage';

export function App(): React.JSX.Element {
  return (
    <AppProvider>
      <AppShell>
        <ModelPage />
      </AppShell>
    </AppProvider>
  );
}

export default App;
