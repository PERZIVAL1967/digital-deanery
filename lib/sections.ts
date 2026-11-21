// One colour per section, used everywhere: the marker under its home number, the big number on its page,
// the frame of the desktop panel, the corner menu dot. `badge` is the deeper tone of the same hue for the
// white icons of the service tiles. Plain data, safe to import from client components.

export const SECTIONS = {
  timetable: { hl: "#FF9EC7", badge: "#D9488A" },
  plagiarism: { hl: "#9EE6B8", badge: "#2E9E5B" },
  grades: { hl: "#B7C8FF", badge: "#1F4FD8" },
  exams: { hl: "#FFD58A", badge: "#E0A21B" },
  moodle: { hl: "#B7C8FF", badge: "#F28C28" },
  requests: { hl: "#9EE6B8", badge: "#7B5CE0" },
  documents: { hl: "#B7C8FF", badge: "#3A4568" },
  ask: { hl: "#9EE6B8", badge: "#0E8C8C" },
  news: { hl: "#FFB38A", badge: "#E86A5C" },
  inbox: { hl: "#FF9EC7", badge: "#D9488A" },
  services: { hl: "#F07FB2", badge: "#C2185B" },
  profile: { hl: "#C9B8FF", badge: "#B44CC8" },
  // staff and teacher cabinets (/staff/<section>, /teacher/<section>)
  questions: { hl: "#9EE6B8", badge: "#0E8C8C" },
  students: { hl: "#C9B8FF", badge: "#7B5CE0" },
  resits: { hl: "#FFD58A", badge: "#E0A21B" },
  stats: { hl: "#FFB38A", badge: "#D9622B" },
  classes: { hl: "#FF9EC7", badge: "#D9488A" },
  journal: { hl: "#B7C8FF", badge: "#1F4FD8" },
  assignments: { hl: "#9EE6B8", badge: "#2E9E5B" },
  messages: { hl: "#FFB38A", badge: "#E86A5C" },
  deanery: { hl: "#9EE6B8", badge: "#7B5CE0" },
} as const;

export type SectionKey = keyof typeof SECTIONS;

/** the section a path belongs to: its first segment (`/requests/new/x` -> requests); in the cabinets the
 *  segment after /staff or /teacher (`/staff/students/x` -> students) */
export function sectionOf(path: string): SectionKey | null {
  const parts = path.split(/[/?#]/);
  const seg = (parts[1] === "staff" || parts[1] === "teacher" ? parts[2] : parts[1]) ?? "";
  return Object.hasOwn(SECTIONS, seg) ? (seg as SectionKey) : null;
}

/** highlight colour for a path; pages outside any section (404) fall back to the timetable pink */
export const hlOf = (path: string) => SECTIONS[sectionOf(path) ?? "timetable"].hl;

/** browser chrome colour (meta theme-color) = the top of the sky */
export const THEME_COLOR = { day: "#9EC3FF", night: "#060A20" } as const;
