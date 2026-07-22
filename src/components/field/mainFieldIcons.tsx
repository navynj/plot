import { createElement } from 'react';
import {
  Activity,
  BookOpen,
  Calendar,
  CheckCircle2,
  Clock,
  DollarSign,
  Droplet,
  Flag,
  Gauge,
  Hash,
  Heart,
  List,
  MapPin,
  Moon,
  Music,
  Ruler,
  Star,
  Tag,
  Timer,
  Zap,
  type LucideIcon,
} from 'lucide-react';

/** Show-on-main fields wear a small filled icon (FieldDef.icon). The default is
 *  `List` — kept in ONE place so it's trivial to change. The picker is limited
 *  to this curated set; an unknown/legacy name falls back to the default. */
export const MAIN_FIELD_ICON_DEFAULT = 'List';

const ICONS: Record<string, LucideIcon> = {
  List,
  Clock,
  Timer,
  Calendar,
  Hash,
  Tag,
  DollarSign,
  MapPin,
  Star,
  Heart,
  Flag,
  Moon,
  Activity,
  Music,
  BookOpen,
  Zap,
  Droplet,
  Ruler,
  Gauge,
  CheckCircle2,
};

/** The curated names offered by the icon picker (order = display order). */
export const MAIN_FIELD_ICON_NAMES = Object.keys(ICONS);

export function mainFieldIcon(name: string | null | undefined): LucideIcon {
  return (name && ICONS[name]) || List;
}

/** Render a show-on-main field's icon by name, filled where it reads well.
 *  The icon component comes from the static registry (not created during
 *  render); createElement keeps that explicit for the linter. */
export function MainFieldIcon({
  name,
  className,
}: {
  name: string | null | undefined;
  className?: string;
}) {
  return createElement(mainFieldIcon(name), { className });
}
