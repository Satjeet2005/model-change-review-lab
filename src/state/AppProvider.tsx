import React, { createContext, useContext, useReducer, ReactNode, Dispatch } from 'react';
import { AppState, createInitialState } from './appState';
import { AppAction, appReducer } from './appReducer';

const AppStateContext = createContext<AppState | null>(null);
const AppDispatchContext = createContext<Dispatch<AppAction> | null>(null);

export interface AppProviderProps {
  children: ReactNode;
  initialState?: AppState;
}

export function AppProvider({ children, initialState }: AppProviderProps): React.JSX.Element {
  const [state, dispatch] = useReducer(appReducer, initialState ?? createInitialState());

  return (
    <AppStateContext.Provider value={state}>
      <AppDispatchContext.Provider value={dispatch}>{children}</AppDispatchContext.Provider>
    </AppStateContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAppState(): AppState {
  const context = useContext(AppStateContext);
  if (!context) {
    throw new Error('useAppState must be used within an AppProvider');
  }
  return context;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAppDispatch(): Dispatch<AppAction> {
  const context = useContext(AppDispatchContext);
  if (!context) {
    throw new Error('useAppDispatch must be used within an AppProvider');
  }
  return context;
}
