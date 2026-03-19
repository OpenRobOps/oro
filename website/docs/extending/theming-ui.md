---
sidebar_position: 4
---

# Theming & UI

OpenRobOps uses **Material UI (MUI) v7** with React 18 for its frontend. This guide covers how to customize the look and feel.

## Material UI Theme

The application uses MUI's theming system. Theme customization follows standard MUI patterns:

```jsx
import { createTheme, ThemeProvider } from '@mui/material/styles';

const theme = createTheme({
  palette: {
    primary: {
      main: '#1976d2',
    },
    secondary: {
      main: '#dc004e',
    },
  },
  typography: {
    fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
  },
});
```

## CSS Customization

Global CSS overrides can be applied in the standard Meteor way through the client-side stylesheets. The application uses `tss-react/mui` for component-level styling:

```jsx
import { makeStyles } from 'tss-react/mui';

const useStyles = makeStyles()((theme) => ({
  myComponent: {
    backgroundColor: theme.palette.background.paper,
    padding: theme.spacing(2),
    borderRadius: theme.shape.borderRadius,
  },
}));
```

## Key UI Libraries

| Library | Version | Purpose |
|---------|---------|---------|
| **React** | 18.2 | UI framework |
| **Material UI** | 7.x | Component library |
| **tss-react** | — | CSS-in-JS styling |
| **@emotion/react** | — | Styling engine |
| **react-calendar-timeline** | — | Timeline visualization |
| **@tanstack/react-query** | — | Server state management |

## Component Patterns

### Dashboard Widgets

Widgets use `DashboardWidgetWrapper` for consistent layout:

```jsx
<DashboardWidgetWrapper title="Widget Title">
  <YourContent />
</DashboardWidgetWrapper>
```

### Data Context

Robot data is shared through React context:

```jsx
import { WidgetDataContext } from '../context';

const MyComponent = () => {
  const data = useContext(WidgetDataContext);
  // ...
};
```

## Icons

The project uses `@mui/icons-material` for icons:

```jsx
import SensorsIcon from '@mui/icons-material/Sensors';
import WarningIcon from '@mui/icons-material/Warning';
```

## Responsive Design

Material UI's responsive utilities are available:

```jsx
<Box sx={{
  display: { xs: 'none', md: 'block' },
  width: { xs: '100%', lg: '50%' },
}}>
```

## Build System

The frontend is bundled using **rspack** (configured via Meteor 3). This is the standard Meteor build system — no additional bundler configuration is needed.

## Next Steps

- [Custom Widgets](./custom-widgets.md) — build new widget components
- [Project Structure](../contributing/project-structure.md) — where UI code lives
- [Dashboards & Widgets](../guides/dashboards-widgets.md) — available widgets
