import { createContext, useContext } from 'react';
import type { PushState } from './push';

export const PushContext = createContext<{ state: PushState; openSettings: () => void }>({ state: 'checking', openSettings: () => {} });
export const usePushState = () => useContext(PushContext);
