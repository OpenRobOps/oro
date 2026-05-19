---
sidebar_position: 1
---

# Custom Widgets

OpenRobOps dashboards are built with React 18 and Material UI. You can create new widgets by following the existing patterns in the codebase.

## Widget Structure

Each widget lives in its own directory under either:

- `app/imports/client/oro/robotWidgets/` — for robot-specific widgets
- `app/imports/client/oro/fleetWidgets/` — for fleet-level widgets

A typical widget consists of:

```
MyWidget/
├── index.js              # Export and widget metadata
└── MyWidgetComponent.js  # React component
```

## Creating a Robot Widget

### 1. Create the Component

Create `app/imports/client/oro/robotWidgets/MyWidget/MyWidgetComponent.js`:

```jsx
import React from 'react';
import { Box, Typography } from '@mui/material';

const MyWidgetComponent = ({ robotId, data }) => {
  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="h6">My Custom Widget</Typography>
      <Typography>Robot: {robotId}</Typography>
      {/* Render your widget content here */}
    </Box>
  );
};

export default MyWidgetComponent;
```

### 2. Create the Index

Create `app/imports/client/oro/robotWidgets/MyWidget/index.js`:

```javascript
export { default as MyWidgetComponent } from './MyWidgetComponent';
```

## Accessing Robot Data

Widgets receive data through React context. Use the `WidgetDataContext` for shared robot data:

```jsx
import React, { useContext } from 'react';
import { WidgetDataContext } from '../path/to/context';

const MyWidgetComponent = () => {
  const widgetData = useContext(WidgetDataContext);
  // Access robot data from context
};
```

For custom data sources, use the `useCustomWidgetData()` hook:

```jsx
import { useCustomWidgetData } from '../path/to/hooks';

const MyWidgetComponent = ({ robotId }) => {
  const customData = useCustomWidgetData(robotId);
  // Access custom key-value data, text, or images
};
```

## Widget Wrapper

All widgets should be rendered within the `DashboardWidgetWrapper` component for consistent layout and styling:

```jsx
import DashboardWidgetWrapper from '../shared/DashboardWidgetWrapper';

const MyWidget = (props) => (
  <DashboardWidgetWrapper title="My Widget">
    <MyWidgetComponent {...props} />
  </DashboardWidgetWrapper>
);
```

## Styling

Widgets use Material UI (v7) with `tss-react` for styling:

```jsx
import { makeStyles } from 'tss-react/mui';

const useStyles = makeStyles()((theme) => ({
  root: {
    padding: theme.spacing(2),
  },
}));

const MyWidgetComponent = () => {
  const { classes } = useStyles();
  return <div className={classes.root}>...</div>;
};
```

## Existing Widget Examples

Study these widgets for reference:

| Widget | Location | Pattern |
|--------|----------|---------|
| **VitalsWidget** | `robotWidgets/VitalsWidget/` | System metrics display |
| **CustomDataWidget** | `robotWidgets/CustomDataWidget/` | Multi-format data (KV, text, image) |
| **Lock** | `robotWidgets/Lock/` | Interactive state management |
| **Timeline (Chart)** | `robotWidgets/TimelineWidget/` | Time-series visualization with aggregations |
| **IncidentTimeline** | `fleetWidgets/IncidentTimeline/` | Calendar-based fleet view |
| **Navigation Detail** | `navigationWidgets/NavigationDetail/` | Composite widget with map + teleop + cameras |

## Next Steps

- [Theming & UI](./theming-ui.md) — Material UI theme customization
- [Custom Data Sources](./custom-data-sources.md) — feed data to your widgets
- [Dashboards & Widgets](../guides/dashboards-widgets.md) — widget overview
