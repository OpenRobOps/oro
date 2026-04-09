/**
 * LayoutManager
 * Provides a single fixed layout for NavigationDetail (map-centric).
 * Panels are arranged in a 100x100 grid where each unit = 1% of the container.
 */
import React from 'react';

// Keys for each panel in the grid
const KEY_BACKGROUND = 'background';
const KEY_CAMERA = 'camera';
const KEY_LOCALIZATION = 'localization';
const KEY_INTERACTION = 'interactive';
const KEY_GAUGES = 'gauges';
const KEY_TELEOP = 'teleop';
const KEY_ZONES_LIST = 'zones_list';

const COLUMNS = 100;
const ROWS = 100;

// Responsive Grid Layout breakpoints (in pixels)
const LAYOUT_BREAKPOINTS = { xl: 3000, lg: 2000, md: 1500, sm: 0 };

// All breakpoints use 100 columns so layout values act as percentages
const LAYOUT_COLUMNS = { xl: COLUMNS, lg: COLUMNS, md: COLUMNS, sm: COLUMNS };

/**
 * Single default layout: map fills the left ~70%, right panel stacks camera → gauges → joystick.
 * Values are percentages of the container (100×100 grid).
 *
 *  ┌──────────────────────────┬──────────┬──┐
 *  │                          │  Camera  │  │
 *  │          Map             │  (55%)   │I │
 *  │                          ├──────────│n │
 *  │                          │  Gauges  │t │
 *  │                          │  (20%)   │  │
 *  │                          ├──────────│  │
 *  │                          │  Teleop  │  │
 *  │                          │  (25%)   │  │
 *  └──────────────────────────┴──────────┴──┘
 */
const DEFAULT_LAYOUT = {
  sm: [
    { i: KEY_BACKGROUND,  x: 0,  y: 0,  w: 70, h: ROWS, static: true },
    { i: KEY_CAMERA,      x: 70, y: 0,  w: 25, h: 55 },
    { i: KEY_INTERACTION, x: 95, y: 0,  w: 5,  h: ROWS },
    { i: KEY_GAUGES,      x: 70, y: 55, w: 25, h: 20 },
    { i: KEY_TELEOP,      x: 70, y: 75, w: 25, h: 25 },
  ],
  md: [
    { i: KEY_BACKGROUND,  x: 0,  y: 0,  w: 70, h: ROWS, static: true },
    { i: KEY_CAMERA,      x: 70, y: 0,  w: 27, h: 55 },
    { i: KEY_INTERACTION, x: 97, y: 0,  w: 3,  h: ROWS },
    { i: KEY_GAUGES,      x: 70, y: 55, w: 27, h: 20 },
    { i: KEY_TELEOP,      x: 70, y: 75, w: 27, h: 25 },
  ],
  lg: [
    { i: KEY_BACKGROUND,  x: 0,  y: 0,  w: 70, h: ROWS, static: true },
    { i: KEY_CAMERA,      x: 70, y: 0,  w: 28, h: 55 },
    { i: KEY_INTERACTION, x: 98, y: 0,  w: 2,  h: ROWS },
    { i: KEY_GAUGES,      x: 70, y: 55, w: 28, h: 20 },
    { i: KEY_TELEOP,      x: 70, y: 75, w: 28, h: 25 },
  ],
  xl: [
    { i: KEY_BACKGROUND,  x: 0,  y: 0,  w: 70, h: ROWS, static: true },
    { i: KEY_CAMERA,      x: 70, y: 0,  w: 28, h: 55 },
    { i: KEY_INTERACTION, x: 98, y: 0,  w: 2,  h: ROWS },
    { i: KEY_GAUGES,      x: 70, y: 55, w: 28, h: 20 },
    { i: KEY_TELEOP,      x: 70, y: 75, w: 28, h: 25 },
  ],
};

const LayoutContext = React.createContext(null);
LayoutContext.displayName = 'layoutContext';

function LayoutProvider(props) {
  return (
    <LayoutContext.Provider value={DEFAULT_LAYOUT} {...props} />
  );
}

function useLayoutContext() {
  const context = React.useContext(LayoutContext);
  if (context === undefined || context === null) throw new Error('useLayoutContext must be used within a LayoutProvider');
  return context;
}

function getRowHeight(containerSize) {
  if (!containerSize) return 0;
  return containerSize.height / ROWS;
}

export {
  LayoutProvider,
  useLayoutContext,
  getRowHeight,
  KEY_BACKGROUND,
  KEY_CAMERA,
  KEY_LOCALIZATION,
  KEY_INTERACTION,
  KEY_GAUGES,
  KEY_TELEOP,
  KEY_ZONES_LIST,
  LAYOUT_BREAKPOINTS,
  LAYOUT_COLUMNS,
};
