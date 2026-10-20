/**
 * The app's single icon funnel.
 *
 * Every screen draws icons through `<Icon name="..." />`, so swapping the
 * artwork underneath is a change to this one file rather than 33 call sites.
 * The glyphs now come from `lucide-react` - the same stroke width, cap and
 * join as the hand-rolled paths this replaces, but a real, maintained set.
 *
 * The public API is deliberately unchanged: `name`, `size`, `color`, `style`
 * and any extra prop still behave exactly as before, so no caller needed
 * editing.  Unknown names fall back to `Info` rather than rendering nothing - * and `icons.test.jsx` walks the source tree to prove no name is actually
 * unknown.
 */
import {
  AlertTriangle,
  Award,
  Bell,
  BookOpen,
  Briefcase,
  Calendar,
  Check,
  Clock,
  FileText,
  Home,
  Inbox,
  Info,
  LayoutDashboard,
  LogOut,
  MapPin,
  Menu,
  Moon,
  Search,
  Sun,
  Target,
  User,
  Users,
  X
} from 'lucide-react';

/**
 * Name → Lucide component.  These are the names the app actually asks for;
 * `ICON_NAMES` is exported so a test can assert that stays true.
 */
export const ICON_COMPONENTS = {
  alert: AlertTriangle,
  award: Award,
  bell: Bell,
  book: BookOpen,
  briefcase: Briefcase,
  calendar: Calendar,
  check: Check,
  clock: Clock,
  dashboard: LayoutDashboard,
  file: FileText,
  home: Home,
  inbox: Inbox,
  info: Info,
  logout: LogOut,
  menu: Menu,
  moon: Moon,
  pin: MapPin,
  search: Search,
  sun: Sun,
  target: Target,
  user: User,
  users: Users,
  x: X
};

export const ICON_NAMES = Object.keys(ICON_COMPONENTS);

export function Icon({ name, size = 20, color = 'currentColor', strokeWidth = 2, style = {}, ...props }) {
  // An unmapped name is a bug, not a crash: `Info` keeps the layout intact
  // while the test below names the offender.
  const Glyph = ICON_COMPONENTS[name] || Info;

  return (
    <Glyph
      size={size}
      color={color}
      strokeWidth={strokeWidth}
      style={{ flexShrink: 0, verticalAlign: 'middle', ...style }}
      aria-hidden="true"
      focusable="false"
      {...props}
    />
  );
}

export const NAV_ICONS = {
  dashboard: 'dashboard',
  applicationReview: 'inbox',
  students: 'users',
  programs: 'book',
  opportunities: 'target',
  attendance: 'check',
  ot: 'clock',
  reports: 'file',
  requirements: 'file',
  certificates: 'award',
  announcements: 'bell'
};
