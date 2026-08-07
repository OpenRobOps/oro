---
sidebar_position: 4
---

# Theming & UI

OpenRobOps ships with a multi-theme UI built on **Material UI (MUI) v7** and a
design-token system. Users pick a theme visually, the choice is stored per
user, and switching applies live — no page reload.

## Built-in themes

| Theme | Mode | Inspired by |
|-------|------|-------------|
| **ORO** (default) | dark | The original "Deep Navy" look |
| **Monokai** | dark | The classic editor palette |
| **Tokyo Night** | dark | [folke/tokyonight.nvim](https://github.com/folke/tokyonight.nvim) |
| **Tokyo Day** | light | Tokyo Night's day style |
| **Catppuccin Mocha** | dark | [catppuccin/palette](https://github.com/catppuccin/palette) |
| **Catppuccin Latte** | light | Catppuccin's light flavor |

## Selecting a theme

Themes are selected in **Settings → Appearance**, which shows a live preview
card per theme (rendered with that theme's real component styles). Clicking a
card applies the theme immediately and saves it to the user's profile; the
grid is keyboard-accessible (arrow keys move and select, like a radio group).

The theme is resolved with the following precedence:

1. **URL parameter** — `https://your-app/?theme=monokai`. Handy for testing
   and sharing links; overrides everything else and is not persisted.
2. **User preference** — whatever the user picked in Settings → Appearance.
   Stored per user in the `preferences` collection (`ui.theme`, written by the
   `preferences.setUserUi` method) and applied automatically after login —
   including in other open tabs, which pick the change up live through the
   `userPreferences` subscription.
3. **Deployment default** — optional, in `settings.json`:

   ```json
   {
     "public": { "defaultTheme": "catppuccin-mocha" }
   }
   ```

4. **`oro`** — the fallback when none of the above apply.

Valid theme names are the keys of the `THEMES` registry in
`app/imports/client/Styles.js`: `oro`, `monokai`, `tokyo-night`, `tokyo-day`,
`catppuccin-mocha`, `catppuccin-latte`.

## How theming works

Colors live in **design-token files** under `app/imports/client/themes/`, one
per theme. `oro.js` is the complete token contract — every color the app uses
comes from it (grouped as `text`, `background`, `incidents`, `teleop`, `map`,
`severityColor`, and so on). Other themes override only what differs and
inherit the rest:

```js
// app/imports/client/themes/monokai.js (excerpt)
import { cloneDeep, merge } from 'lodash';
import oro from './oro';

const monokai = merge(cloneDeep(oro), {
  mode: 'dark',
  text: { primary: '#F8F8F2' /* ... */ },
  background: { default: '#272822' /* ... */ },
  secondary: { main: '#A6E22E' },
  // anything not overridden inherits from oro
});
export default monokai;
```

`app/imports/client/Styles.js` builds a full MUI theme from the active token
set (palette, component style overrides, and the CSS custom properties that
plain CSS files use, e.g. `--color-background`). It keeps the current theme in
module state and exposes:

- `setTheme(name)` — hot-applies a theme and notifies subscribers
- `useOroTheme()` — React hook the app root uses to re-render on switch
- `getThemeInstance(name)` — cached built theme per name (used by the
  Settings preview cards through nested `ThemeProvider`s)
- default export — a **live proxy view** of the current theme, for the few
  non-React modules (OpenLayers map layers, some SVG icon modules) that import
  the theme directly

Hot switching restyles everything MUI/emotion renders. Widgets that paint
imperatively (OpenLayers maps) pick the new colors up when they next mount,
i.e. on the next route navigation.

## Adding a theme

1. Create a token file in `app/imports/client/themes/` following the pattern
   above: define named consts for the source palette, `merge` over `oro`, and
   override at least the `text`, `background`, status (`modes`, `incidents`,
   `diagnostics`, `snackbar`), accent (`secondary.main` and friends) and
   `severityColor` groups.
2. Register it in the `THEMES` object in `app/imports/client/Styles.js`. The
   key becomes the URL/preference name; the Settings selector labels it by
   capitalizing hyphenated words (`tokyo-night` → "Tokyo Night") and shows a
   live preview automatically.

For **light themes**, override everything that assumes a dark background —
all `text` slots, surfaces/borders, `shadowColor.white` (use a dark tint),
and any pastel `tags`/`zeroData` colors that would wash out. Set
`mode: 'light'` so MUI and mode-dependent assets (like the app logo, which has
a dark-glyph variant picked by `theme.palette.mode`) follow along.

## Rules for themable UI code

- **Never hardcode colors in components.** Reference theme tokens via
  `sx`, `makeStyles` from `tss-react/mui`, or `useTheme()`. If no token fits,
  add one to `oro.js` (all themes inherit it) rather than inlining a hex.
- **Never capture theme values in module-level constants** — that freezes the
  load-time theme and breaks hot switching. Read `theme.palette.*` at render
  or call time instead.
- **Include `theme` (or `classes`) in memo dependencies** when a
  `useMemo`/`useCallback` bakes theme colors into data or renderers (Plotly
  layouts, react-calendar-timeline renderers). Otherwise the widget keeps the
  old theme's styles until remount.
- **Compute on-color text with `theme.palette.getContrastText(bg)`** instead
  of assuming black or white (see the severity chips) — it stays readable for
  any theme's palette.
- **Text on themed surfaces is `text.primary`** (or an
  `alpha(theme.palette.text.primary, x)` dim of it), never `common.white` /
  `rgba(255,255,255,…)` — those break on light themes.
- **Plain CSS files** should use the theme-synced custom properties
  (`--color-background`, `--color-card`, `--color-border`, …) that `Styles.js`
  injects on `:root`, as `IncidentTimeline.css` does.

## Styling reference

Component-level styling uses `tss-react/mui`:

```jsx
import { makeStyles } from 'tss-react/mui';

const useStyles = makeStyles()((theme) => ({
  myComponent: {
    backgroundColor: theme.palette.background.paper,
    color: theme.palette.text.primary,
    padding: theme.spacing(2),
  },
}));
```

| Library | Purpose |
|---------|---------|
| **React 18** | UI framework |
| **Material UI 7** | Component library and theming |
| **tss-react** / **@emotion** | CSS-in-JS styling |
| **lucide-react** / **@mui/icons-material** | Icons |

## Next Steps

- [Custom Widgets](./custom-widgets.md) — build new widget components
- [Project Structure](../contributing/project-structure.md) — where UI code lives
- [Dashboards & Widgets](../guides/dashboards-widgets.md) — available widgets
