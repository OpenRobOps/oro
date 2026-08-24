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
├── index.js              # Container: data loading, default export
└── MyWidgetComponent.js  # Presentational React component
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

### 2. Create the Container (Index)

By convention, `index.js` **default-exports a container** that loads data with
Meteor's `useTracker` and renders the presentational component, usually wrapped
with `WithNoDataMessage`. Create
`app/imports/client/oro/robotWidgets/MyWidget/index.js`:

```javascript
import React from 'react';
import { useTracker } from 'meteor/react-meteor-data';
import { Meteor } from 'meteor/meteor';
import WithNoDataMessage from '../../util/WithNoDataMessage';
import MyWidgetComponent from './MyWidgetComponent';

const MyWidgetContainer = (props) => {
  const { robotId } = props;
  const trackerData = useTracker(() => {
    // Subscribe to publications and fetch what the widget needs
    return {};
  }, [robotId]);
  return <MyWidgetComponent {...props} {...trackerData} />;
};

export default WithNoDataMessage(MyWidgetContainer);
```

See `robotWidgets/VitalsWidget/index.js` for a complete example.

### 3. Register the Widget

A widget only renders on dashboards after it is registered in two places:

1. **Widget type id** — add an entry to `WIDGET_TYPES_IDS` in
   `app/imports/lib/uiPreferences.js`. This id is what dashboard configs
   (Config API `DashboardDefinition`) reference as the widget `type`.
2. **Renderer** — add the component to `WIDGET_FACTORY` in
   `app/imports/client/oro/Dashboard/Dashboard_index.js` (and optionally a
   toolbar to `TOOLBAR_FACTORY` in the same file).

Finally, reference the new type from a dashboard/section configuration so it
appears somewhere. Without the factory entry the dashboard renders
"Unknown widget type".

## Accessing Widget and Robot Data

Robot data is loaded in the container via Meteor subscriptions (see above).
For state shared between a widget and its toolbar (such as the widget title),
use the `useWidgetData()` hook — `WidgetDataContext` itself is exported only
for legacy class components:

```jsx
import { useWidgetData } from '../../contexts/WidgetDataContext';

const MyWidgetComponent = () => {
  const { setWidgetTitle } = useWidgetData();
  // ...
};
```

For custom data sources, use the `useCustomWidgetData()` hook (default export;
`dataType` is `'key_value'` for key-value data):

```jsx
import useCustomWidgetData from '../../hooks/useCustomWidgetData';

const MyWidgetComponent = ({ robotId }) => {
  const { isLoading, data } = useCustomWidgetData(robotId, 'key_value', customField);
  // Access custom key-value data, text, or images
};
```

## Widget Wrapper

Widgets are wrapped **automatically**: the dashboard's `SectionComponent`
renders each registered widget inside `DashboardWidgetWrapper` (via its
`contents` prop) for consistent layout and styling. Do not import or apply the
wrapper yourself — just export the bare widget from `index.js`.

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
