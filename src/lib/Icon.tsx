import { icons } from 'lucide-react';
import type { CSSProperties } from 'react';

// Names the legacy markup used that lucide has since renamed/removed.
const ALIAS: Record<string, string> = {
  'alert-triangle': 'triangle-alert', 'building-2': 'building', 'check-circle': 'circle-check', 'file-bar-chart': 'file-chart-column',
  history: 'rotate-ccw', home: 'house', 'more-horizontal': 'ellipsis', 'plus-circle': 'circle-plus', 'user-circle': 'circle-user',
};

const pascal = (kebab: string) => kebab.split('-').map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join('');

/** <Icon name="layout-dashboard" /> — takes the same kebab-case lucide names the legacy markup used
 *  (data-lucide="..."), so ported JSX can keep them. Unknown names render nothing (and warn in dev). */
export function Icon({ name, size = 24, className, style }: { name: string; size?: number; className?: string; style?: CSSProperties }) {
  const C = (icons as Record<string, any>)[pascal(ALIAS[name] ?? name)];
  if (!C) {
    if (import.meta.env.DEV) console.warn(`[Icon] unknown lucide icon: ${name}`);
    return null;
  }
  return <C size={size} className={className} style={style} strokeWidth={2} />;
}
