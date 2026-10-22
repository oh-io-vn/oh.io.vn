// @ts-check
// One registry for generated HTML, browser actions and native-control masks.
// Import individual Lucide nodes so Vite can discard the rest of the library.
import {
  Link2,
  List,
  ShieldCheck,
  LogIn,
  LogOut,
  Copy,
  Pencil,
  ChartColumn,
  Trash2,
  Search,
  SearchX,
  Plus,
  Minus,
  X,
  Check,
  CircleCheck,
  CircleAlert,
  Info,
  LoaderCircle,
  RotateCw,
  Undo2,
  Save,
  Download,
  ExternalLink,
  Mail,
  Ban,
  LockKeyhole,
  LockKeyholeOpen,
  ChevronDown,
  Moon,
  Sun,
} from "lucide";

const icons = {
  link: Link2,
  list: List,
  admin: ShieldCheck,
  login: LogIn,
  logout: LogOut,
  copy: Copy,
  edit: Pencil,
  stats: ChartColumn,
  delete: Trash2,
  search: Search,
  "search-empty": SearchX,
  plus: Plus,
  minus: Minus,
  close: X,
  check: Check,
  success: CircleCheck,
  error: CircleAlert,
  info: Info,
  loading: LoaderCircle,
  retry: RotateCw,
  restore: Undo2,
  save: Save,
  download: Download,
  external: ExternalLink,
  mail: Mail,
  block: Ban,
  lock: LockKeyhole,
  unlock: LockKeyholeOpen,
  chevron: ChevronDown,
  moon: Moon,
  sun: Sun,
};

/** @param {string | number | undefined} value */
const escapeAttribute = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (character) => `&#${character.charCodeAt(0)};`,
  );

/**
 * Decorative SVG only: keep the visible label on its containing control.
 * The shape data is exclusively from Lucide, never user-provided SVG/HTML.
 * @param {keyof typeof icons} name
 */
export function icon(name) {
  const nodes = icons[name]
    .map(
      ([tag, attributes]) =>
        `<${tag} ${Object.entries(attributes)
          .map(([key, value]) => `${key}="${escapeAttribute(value)}"`)
          .join(" ")}/>`,
    )
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" class="ui-icon" data-icon="${name}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${nodes}</svg>`;
}

/** CSS masks for pseudo-elements on native select/details controls.
 * @param {keyof typeof icons} name
 */
export function iconMask(name) {
  return `url("data:image/svg+xml,${encodeURIComponent(icon(name))}")`;
}
