import type { ComponentType } from 'react';

/** Props every desktop view component receives.
 *  Views stay MOUNTED once visited (keep-alive, like the legacy DOM) and are hidden with CSS when not
 *  active — so heavy views (3D twin, charts) must pause their own loops/work when `active` is false. */
export interface ViewProps { active: boolean; }

export type NavGroup = 'operations' | 'revenue' | 'intelligence' | 'erp';

export interface ViewDef {
  id: string;
  /** English title/subtitle shown in the topbar (translated through tr()). */
  title: string;
  sub: string;
  group: NavGroup;
  /** kebab-case lucide icon name */
  icon: string;
  navLabel?: string;
  load: () => Promise<{ default: ComponentType<ViewProps> }>;
}
