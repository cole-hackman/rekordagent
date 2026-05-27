/**
 * Camelot-wheel conversion utilities.
 *
 * Rekordbox / many tag editors store keys in a mixture of formats:
 *   - "C minor", "F# major"
 *   - "Cm", "F#"
 *   - already-camelot "8A" / "5B"
 *
 * Here we normalise all of those into the canonical Camelot Wheel notation
 * (`<1-12><A|B>`), then map each Camelot code to a colour for tinting the Key
 * cell in the track table.
 *
 * Palette: derived from the Mixed In Key colour wheel — the de-facto standard
 * harmonic-mixing reference. Same colour for an A/B pair (relative
 * minor/major share a position on the wheel).
 */

// Camelot wheel:
//   "A" suffix = minor key, "B" suffix = major key.
//   Number 1–12 around the wheel; ±1 = perfect-fifth neighbour.
//
// Lookup is keyed by canonical pitch class + mode. We resolve enharmonic
// equivalents (e.g. F# == Gb, C# == Db) at parse time.
const MAJOR_TO_CAMELOT: Record<string, string> = {
  B: "1B",
  "F#": "2B",
  Gb: "2B",
  "C#": "3B",
  Db: "3B",
  "G#": "4B",
  Ab: "4B",
  "D#": "5B",
  Eb: "5B",
  "A#": "6B",
  Bb: "6B",
  F: "7B",
  C: "8B",
  G: "9B",
  D: "10B",
  A: "11B",
  E: "12B",
};

const MINOR_TO_CAMELOT: Record<string, string> = {
  "G#": "1A",
  Ab: "1A",
  "D#": "2A",
  Eb: "2A",
  "A#": "3A",
  Bb: "3A",
  F: "4A",
  C: "5A",
  G: "6A",
  D: "7A",
  A: "8A",
  E: "9A",
  B: "10A",
  "F#": "11A",
  Gb: "11A",
  "C#": "12A",
  Db: "12A",
};

/**
 * Mixed In Key palette — chosen because it's the most widely-recognised
 * Camelot colour scheme in the DJ tooling ecosystem (Rekordbox, Serato DJ Pro,
 * Mixed In Key all use minor variations of this). Same hue for the A/B pair.
 */
export const CAMELOT_COLORS: Record<string, string> = {
  "1A": "#48F2A4",
  "1B": "#48F2A4",
  "2A": "#08D7C7",
  "2B": "#08D7C7",
  "3A": "#01C7F6",
  "3B": "#01C7F6",
  "4A": "#00B6E9",
  "4B": "#00B6E9",
  "5A": "#418EE2",
  "5B": "#418EE2",
  "6A": "#5B73D6",
  "6B": "#5B73D6",
  "7A": "#735BCC",
  "7B": "#735BCC",
  "8A": "#9F4FCA",
  "8B": "#9F4FCA",
  "9A": "#D33DAA",
  "9B": "#D33DAA",
  "10A": "#EE4477",
  "10B": "#EE4477",
  "11A": "#F2613F",
  "11B": "#F2613F",
  "12A": "#EFBE2C",
  "12B": "#EFBE2C",
};

/**
 * Canonicalise the root note string: capitalise the letter, keep the
 * accidental as-typed.
 *
 *   "c"  -> "C"
 *   "f#" -> "F#"
 *   "db" -> "Db"
 *   "DB" -> "Db"
 */
function normaliseRoot(root: string): string {
  if (!root) return root;
  const letter = root[0].toUpperCase();
  const accidental = root.slice(1).toLowerCase().replace(/♯/g, "#").replace(/♭/g, "b");
  return letter + accidental;
}

/**
 * Convert a musical-key string (in any common notation) to the Camelot Wheel
 * code (e.g. `"8A"`, `"11B"`). Returns `null` for unrecognised input.
 */
export function toCamelot(key: string | null | undefined): string | null {
  if (key == null) return null;
  const trimmed = key.trim();
  if (trimmed === "") return null;

  // Already in Camelot notation: "8A", "11b", " 5  B ".
  const camelotMatch = trimmed.match(/^([0-9]{1,2})\s*([aAbB])$/);
  if (camelotMatch) {
    const num = Number(camelotMatch[1]);
    const suffix = camelotMatch[2].toUpperCase();
    if (num >= 1 && num <= 12) return `${num}${suffix}`;
    return null;
  }

  // "C", "C major", "C maj", "Cmaj", "C minor", "Cm", "C min", "Cmin",
  // "F# minor", "Db major", etc.
  const m = trimmed.match(/^([A-Ga-g])\s*([#♯b♭]?)\s*(.*)$/);
  if (!m) return null;
  const root = normaliseRoot(m[1] + m[2]);
  const tail = m[3].toLowerCase().replace(/\./g, "").trim();

  let isMinor: boolean;
  if (tail === "" || tail === "maj" || tail === "major") {
    isMinor = false;
  } else if (tail === "m" || tail === "min" || tail === "minor") {
    isMinor = true;
  } else {
    return null;
  }

  const table = isMinor ? MINOR_TO_CAMELOT : MAJOR_TO_CAMELOT;
  return table[root] ?? null;
}

/**
 * Resolve the display colour for a musical-key string, or `null` if the key
 * can't be parsed.
 */
export function colorForKey(key: string | null | undefined): string | null {
  const c = toCamelot(key);
  return c ? (CAMELOT_COLORS[c] ?? null) : null;
}
