import {
  Bell, BellPlus, BookOpen, CalendarCheck, CalendarDays, CalendarPlus, Check, ChevronDown, ChevronLeft, ChevronRight,
  CircleAlert, ClipboardList, Clock, Download, ExternalLink, FileSpreadsheet, FileText, Files, Folder, GraduationCap,
  House, Inbox, Landmark, LayoutGrid, LogOut, MapPin, Maximize2, Megaphone, MessageCircle, Minimize2, Moon, Newspaper,
  Plus, RotateCw, Save, Send, ShieldCheck, Sun, TrendingUp, Upload, User, Users, X, ChartColumn, Search, UserCheck,
  ClipboardCheck, PencilLine, Mail, History, DoorOpen, Eye, ArrowRightLeft, NotebookPen, Repeat2, Table2, type LucideIcon,
} from "lucide-react";

const ICONS = {
  bell: Bell, "bell-plus": BellPlus, "book-open": BookOpen, "calendar-check": CalendarCheck, "calendar-days": CalendarDays,
  "calendar-plus": CalendarPlus, check: Check, "chevron-down": ChevronDown, "chevron-left": ChevronLeft,
  "chevron-right": ChevronRight, alert: CircleAlert, clipboard: ClipboardList, clock: Clock, download: Download,
  "external-link": ExternalLink, sheet: FileSpreadsheet, "file-text": FileText, files: Files, folder: Folder,
  "graduation-cap": GraduationCap, house: House, inbox: Inbox, landmark: Landmark, "layout-grid": LayoutGrid,
  "log-out": LogOut, "map-pin": MapPin, "maximize-2": Maximize2, megaphone: Megaphone, "message-circle": MessageCircle,
  "minimize-2": Minimize2, moon: Moon, newspaper: Newspaper, plus: Plus, retry: RotateCw, save: Save, send: Send,
  "shield-check": ShieldCheck, sun: Sun, "trending-up": TrendingUp, upload: Upload, user: User, users: Users, x: X,
  chart: ChartColumn, search: Search, "user-check": UserCheck, "clipboard-check": ClipboardCheck, pen: PencilLine, mail: Mail,
  history: History, door: DoorOpen, eye: Eye, transfer: ArrowRightLeft, notebook: NotebookPen, repeat: Repeat2, table: Table2,
} satisfies Record<string, LucideIcon>;

export type IconName = keyof typeof ICONS;

/** Lucide, 1.75 stroke, currentColor, hidden from screen readers (the label is next to it). */
export function Icon({ name }: { name: IconName }) {
  const C = ICONS[name];
  return <C aria-hidden="true" focusable="false" strokeWidth={1.75} className="lucide" />;
}
