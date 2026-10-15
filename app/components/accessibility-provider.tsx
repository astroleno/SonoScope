'use client';
import { createContext, useContext, useEffect, useState } from 'react';
const Context = createContext({ reducedMotion: false, highContrast: false });
export function AccessibilityProvider({ children }: { children: React.ReactNode }) {
  const [preferences, setPreferences] = useState({ reducedMotion: false, highContrast: false });
  useEffect(() => {
    const motion = matchMedia('(prefers-reduced-motion: reduce)'), contrast = matchMedia('(prefers-contrast: more)');
    const update = () => setPreferences({ reducedMotion: motion.matches, highContrast: contrast.matches });
    update(); motion.addEventListener('change', update); contrast.addEventListener('change', update);
    return () => { motion.removeEventListener('change', update); contrast.removeEventListener('change', update); };
  }, []);
  return <Context.Provider value={preferences}>{children}</Context.Provider>;
}
export const useAccessibility = () => useContext(Context);
