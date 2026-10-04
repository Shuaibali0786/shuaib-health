import {
  Activity,
  Bean,
  CalendarCheck,
  Candy,
  ClipboardCheck,
  Clock,
  Droplet,
  Flame,
  Flower2,
  Hourglass,
  Sparkles,
  Sun,
  TestTube,
  FileText,
  FlaskConical,
  HeartPulse,
  House,
  MapPin,
  Package,
  Phone,
  Receipt,
  Siren,
  Stethoscope,
  type LucideIcon,
} from "lucide-react";
import type { IconName } from "@/types/content";

/** The icon name when it is one we have an icon for, else `fallback`. API data carries plain strings. */
export function toIconName(name: string, fallback: IconName): IconName {
  return Object.hasOwn(ICONS, name) ? (name as IconName) : fallback;
}

/** Data files store icon names as strings; this maps them to lucide-react components. */
export const ICONS: Record<IconName, LucideIcon> = {
  activity: Activity,
  bean: Bean,
  "calendar-check": CalendarCheck,
  candy: Candy,
  "clipboard-check": ClipboardCheck,
  clock: Clock,
  droplet: Droplet,
  flame: Flame,
  flower: Flower2,
  hourglass: Hourglass,
  sparkles: Sparkles,
  sun: Sun,
  "test-tube": TestTube,
  "file-text": FileText,
  "flask-conical": FlaskConical,
  "heart-pulse": HeartPulse,
  house: House,
  "map-pin": MapPin,
  package: Package,
  phone: Phone,
  receipt: Receipt,
  siren: Siren,
  stethoscope: Stethoscope,
};
