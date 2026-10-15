'use client';
import { useEffect, useState } from 'react';
import { useI18n } from './i18n';

const defaults = { mode: 'system', accent: 'green', size: 'normal', density: 'comfortable' };
export function Appearance() {
  const { t } = useI18n();
  const [value, setValue] = useState(defaults);
  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem('agentrelay.appearance.v1') || '{}');
      setValue({
        mode: ['light', 'dark', 'system'].includes(stored.mode) ? stored.mode : defaults.mode,
        accent: ['green', 'blue', 'purple'].includes(stored.accent)
          ? stored.accent
          : defaults.accent,
        size: ['normal', 'large'].includes(stored.size) ? stored.size : defaults.size,
        density: ['comfortable', 'compact'].includes(stored.density)
          ? stored.density
          : defaults.density,
      });
    } catch {
      /* Use defaults when storage is unavailable. */
    }
  }, []);
  function change(next: typeof defaults) {
    setValue(next);
    applyAppearance(next);
    try {
      localStorage.setItem('agentrelay.appearance.v1', JSON.stringify(next));
    } catch {
      /* Tab-only preferences still work. */
    }
  }
  return (
    <section className="panel settings-panel">
      <h2>{t('Appearance')}</h2>
      <p>{t('Preferences are saved in this browser.')}</p>
      <div className="form-grid">
        {(
          [
            [
              'mode',
              'Theme',
              [
                ['system', 'System'],
                ['light', 'Light'],
                ['dark', 'Dark'],
              ],
            ],
            [
              'accent',
              'Accent color',
              [
                ['green', 'Green'],
                ['blue', 'Blue'],
                ['purple', 'Purple'],
              ],
            ],
            [
              'size',
              'Text size',
              [
                ['normal', 'Normal'],
                ['large', 'Large'],
              ],
            ],
            [
              'density',
              'Layout density',
              [
                ['comfortable', 'Comfortable'],
                ['compact', 'Compact'],
              ],
            ],
          ] as const
        ).map(([key, label, options]) => (
          <label key={key}>
            {t(label)}
            <select
              value={value[key]}
              onChange={(e) => change({ ...value, [key]: e.target.value })}
            >
              {options.map(([id, label]) => (
                <option key={id} value={id}>
                  {t(label)}
                </option>
              ))}
            </select>
          </label>
        ))}
      </div>
      <button className="button secondary" onClick={() => change(defaults)}>
        {t('Reset appearance')}
      </button>
    </section>
  );
}
function applyAppearance(value: typeof defaults) {
  const root = document.documentElement;
  root.dataset.theme =
    value.mode === 'system'
      ? matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light'
      : value.mode;
  root.dataset.accent = value.accent;
  root.dataset.text = value.size;
  root.dataset.density = value.density;
}
export function AppearanceLoader() {
  useEffect(() => {
    const media = matchMedia('(prefers-color-scheme: dark)');
    const load = () => {
      try {
        const saved = JSON.parse(localStorage.getItem('agentrelay.appearance.v1') || '{}');
        applyAppearance({
          mode: ['system', 'light', 'dark'].includes(saved.mode) ? saved.mode : defaults.mode,
          accent: ['green', 'blue', 'purple'].includes(saved.accent)
            ? saved.accent
            : defaults.accent,
          size: ['normal', 'large'].includes(saved.size) ? saved.size : defaults.size,
          density: ['comfortable', 'compact'].includes(saved.density)
            ? saved.density
            : defaults.density,
        });
      } catch {
        applyAppearance(defaults);
      }
    };
    load();
    media.addEventListener('change', load);
    window.addEventListener('storage', load);
    return () => {
      media.removeEventListener('change', load);
      window.removeEventListener('storage', load);
    };
  }, []);
  return null;
}
