import { useState } from 'react';

import {
  applyTheme,
  getCurrentTheme,
  type AppTheme,
} from '../theme';

function ThemeToggle() {
  const [theme, setTheme] =
    useState<AppTheme>(() =>
      getCurrentTheme(),
    );

  const dark = theme === 'dark';

  function toggleTheme() {
    const nextTheme: AppTheme =
      dark ? 'light' : 'dark';

    applyTheme(nextTheme);
    setTheme(nextTheme);
  }

  return (
    <button
      type="button"
      className="app-theme-toggle"
      onClick={toggleTheme}
      aria-pressed={dark}
      aria-label={
        dark
          ? '切换到日间模式'
          : '切换到深夜模式'
      }
      title={
        dark
          ? '切换到日间模式'
          : '切换到深夜模式'
      }
    >
      <span
        className="app-theme-toggle-icon"
        aria-hidden="true"
      >
        {dark ? '☀' : '☾'}
      </span>

      <span>
        {dark ? '日间' : '深夜'}
      </span>
    </button>
  );
}

export default ThemeToggle;
