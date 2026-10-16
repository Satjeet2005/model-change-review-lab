import React, {
  createContext,
  useContext,
  useReducer,
  useEffect,
  ReactNode,
  Dispatch
} from 'react';
import { AppState, createInitialState } from './appState';
import { AppAction, appReducer } from './appReducer';
import { appCommands } from '@/api/appCommands';
import { isApiConfigured } from '@/api/client';

const AppStateContext = createContext<AppState | null>(null);
const AppDispatchContext = createContext<Dispatch<AppAction> | null>(null);

export interface AppProviderProps {
  children: ReactNode;
  initialState?: AppState;
  autoInit?: boolean;
}

export function AppProvider({
  children,
  initialState,
  autoInit
}: AppProviderProps): React.JSX.Element {
  const shouldAutoInit = autoInit ?? (import.meta.env.MODE !== 'test' && !initialState);
  const [state, dispatch] = useReducer(
    appReducer,
    initialState ?? createInitialState(shouldAutoInit)
  );

  useEffect(() => {
    if (!shouldAutoInit) return;

    if (!isApiConfigured()) {
      dispatch({
        type: 'SET_CONFIG_ERROR',
        error:
          'Missing required environment variable VITE_API_BASE_URL. Please set VITE_API_BASE_URL in your environment.'
      });
      return;
    }

    let isMounted = true;
    dispatch({ type: 'SET_INITIALIZING', isInitializing: true });

    appCommands
      .initSession()
      .then((snapshot) => {
        if (isMounted) {
          dispatch({ type: 'SERVER_SNAPSHOT_APPLIED', snapshot });
        }
      })
      .catch((err) => {
        if (isMounted) {
          const message =
            err instanceof Error
              ? err.message
              : 'Failed to connect to the backend server. Please verify the API is running.';
          dispatch({ type: 'SET_NETWORK_ERROR', error: message });
          dispatch({ type: 'SET_INITIALIZING', isInitializing: false });
        }
      });

    return () => {
      isMounted = false;
    };
  }, [shouldAutoInit]);

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
