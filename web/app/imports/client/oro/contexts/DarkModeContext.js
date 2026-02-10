/**
 * DarkMode context
 * Simple context to handle the state management for dark mode.
 */
import React, { useState, useMemo } from 'react';

const DarkModeContext = React.createContext(false);
DarkModeContext.displayName = 'darkModeContext';

function DarkModeProvider(props) {
  const [isDarkMode, setIsDarkMode] = useState(false);

  const value = useMemo(() => ({
    isDarkMode,
    setIsDarkMode,
  }), [isDarkMode]);

  return (
    <DarkModeContext.Provider value={value} {...props} />
  );
}

function useDarkModeContext() {
  const context = React.useContext(DarkModeContext);
  if (context === undefined) {
    throw new Error('useDarkModeContext must be used within a DarkModePorvider');
  }
  // Context should have this schema:
  // { isDarkMode, setIsDarkMode }
  return context;
}

export {
  DarkModeContext,
  DarkModeProvider,
  useDarkModeContext
};
