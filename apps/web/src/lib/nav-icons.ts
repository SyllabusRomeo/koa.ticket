import type { LucideIcon } from 'lucide-react';
import {
  BarChart3,
  Building2,
  CalendarClock,
  ClipboardCheck,
  Columns3,
  GitBranchPlus,
  Hexagon,
  Home,
  KeyRound,
  LayoutGrid,
  MapPin,
  Monitor,
  Paintbrush,
  Plug,
  Route,
  ScrollText,
  Siren,
  Ticket,
  UserRound,
  Users,
  BookOpen,
} from 'lucide-react';

/** Brand mark when no custom logo is set. */
export const BrandMarkIcon: LucideIcon = Hexagon;

/** Sidebar / top-nav glyph per route. */
export const NAV_ICONS: Record<string, LucideIcon> = {
  '/app': Home,
  '/app/tickets': Ticket,
  '/app/queue': Columns3,
  '/app/major-incidents': Siren,
  '/app/problems': GitBranchPlus,
  '/app/changes': CalendarClock,
  '/app/approvals': ClipboardCheck,
  '/app/knowledge': BookOpen,
  '/app/catalog': LayoutGrid,
  '/app/assets': Monitor,
  '/app/reports': BarChart3,
  '/app/audit': ScrollText,
  '/app/profile': UserRound,
  '/app/admin/roles': KeyRound,
  '/app/admin/teams': Users,
  '/app/admin/departments': Building2,
  '/app/admin/locations': MapPin,
  '/app/admin/routing': Route,
  '/app/admin/approvals': ClipboardCheck,
  '/app/admin/integrations': Plug,
  '/app/admin/branding': Paintbrush,
};
