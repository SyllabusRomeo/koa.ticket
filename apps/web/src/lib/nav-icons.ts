import type { LucideIcon } from 'lucide-react';
import {
  BarChart3,
  ClipboardCheck,
  Hexagon,
  Home,
  KeyRound,
  LayoutGrid,
  Monitor,
  Paintbrush,
  Plug,
  Route,
  ScrollText,
  Ticket,
  Users,
  BookOpen,
} from 'lucide-react';

/** Brand mark when no custom logo is set. */
export const BrandMarkIcon: LucideIcon = Hexagon;

/** Sidebar / top-nav glyph per route. */
export const NAV_ICONS: Record<string, LucideIcon> = {
  '/app': Home,
  '/app/tickets': Ticket,
  '/app/approvals': ClipboardCheck,
  '/app/knowledge': BookOpen,
  '/app/catalog': LayoutGrid,
  '/app/assets': Monitor,
  '/app/reports': BarChart3,
  '/app/audit': ScrollText,
  '/app/admin/roles': KeyRound,
  '/app/admin/teams': Users,
  '/app/admin/routing': Route,
  '/app/admin/integrations': Plug,
  '/app/admin/branding': Paintbrush,
};
