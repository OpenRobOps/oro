import {useEffect, useState, type ReactNode} from 'react';
import {useColorMode, type ColorMode} from '@docusaurus/theme-common';

// Palettes live in src/css/custom.css, keyed by html[data-oro-theme].
// The inline script in docusaurus.config.ts applies the stored choice
// pre-paint; this component only reflects and changes it.
const THEMES: Record<string, {label: string; mode: ColorMode}> = {
  'oro': {label: 'ORO Moon', mode: 'dark'},
  'oro-sun': {label: 'ORO Sun', mode: 'light'},
  'tokyo-night': {label: 'Tokyo Night', mode: 'dark'},
  'tokyo-day': {label: 'Tokyo Day', mode: 'light'},
  'catppuccin-mocha': {label: 'Catppuccin Mocha', mode: 'dark'},
  'catppuccin-latte': {label: 'Catppuccin Latte', mode: 'light'},
  'rose-pine-moon': {label: 'Rosé Pine Moon', mode: 'dark'},
  'rose-pine-dawn': {label: 'Rosé Pine Dawn', mode: 'light'},
  'monokai': {label: 'Monokai', mode: 'dark'},
};

export default function OroThemePicker(): ReactNode {
  const {setColorMode} = useColorMode();
  const [theme, setTheme] = useState('oro');

  useEffect(() => {
    setTheme(document.documentElement.getAttribute('data-oro-theme') ?? 'oro');
  }, []);

  const onChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const name = e.target.value;
    setTheme(name);
    if (name === 'oro') {
      document.documentElement.removeAttribute('data-oro-theme');
    } else {
      document.documentElement.setAttribute('data-oro-theme', name);
    }
    setColorMode(THEMES[name].mode);
    try {
      localStorage.setItem('oro-theme', name);
    } catch {}
  };

  return (
    <select
      className="oro-theme-picker"
      value={theme}
      onChange={onChange}
      aria-label="Color theme">
      {Object.entries(THEMES).map(([name, {label}]) => (
        <option key={name} value={name}>
          {label}
        </option>
      ))}
    </select>
  );
}
