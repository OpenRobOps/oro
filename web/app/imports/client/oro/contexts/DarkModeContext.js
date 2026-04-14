/**
 * Copyright 2026 InOrbit, Inc.
 *
 *    Licensed under the Apache License, Version 2.0 (the "License");
 *    you may not use this file except in compliance with the License.
 *    You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 *    Unless required by applicable law or agreed to in writing, software
 *    distributed under the License is distributed on an "AS IS" BASIS,
 *    WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *    See the License for the specific language governing permissions and
 *    limitations under the License.
 */

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
