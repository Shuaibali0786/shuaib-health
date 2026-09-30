import {
  CalendarCheck,
  Clock,
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

/** Data files store icon names as strings; this maps them to lucide-react components. */
export const ICONS: Record<IconName, LucideIcon> = {
  "calendar-check": CalendarCheck,
  clock: Clock,
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
