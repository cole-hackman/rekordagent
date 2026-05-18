# Plan: Community-Research Feature Follow-ups

Companion to `2026-05-11-community-research.md`. Each proposal below maps a
takeaway from that research onto a concrete, scoped feature for `decks`,
with a value/effort read so we can sequence them.

Status of the related research takeaways before this plan:

- Synthetic-peak waveforms are now real (decoded amplitudes via Symphonia,
  shipped in `2026-05-11-high-impact-polish.md`). The *Pioneer-fidelity*
  waveform from ANLZ is still untouched.
- Broken-link surface today: `health_orphan_scan` lists missing-file
  tracks and a "Missing files" filter exists; there is **no relocation**.
- We have only `master.db` (SQLCipher) and Rekordbox XML readers — no
  USB/`export.pdb` reader.
- No analytics dashboards; no broker-mediated enrichment; no audio
  fingerprinting; no Device Library Plus support.

## Feature Proposals

### F1. Native Pioneer waveform rendering from ANLZ
**Source:** `pyrekordbox` ANLZ parser + Deep Symmetry docs.
**Today:** `crates/rekordbox-db/src/anlz.rs` only parses `PQTZ` (beat grid).
The track inspector uses Symphonia-decoded amplitude peaks — useful, but
not the colored frequency-band waveform DJs recognise from CDJs.
**Proposed work:**
- Extend `anlz.rs` to parse `PWAV`/`PWV2`/`PWV3` (preview color), `PWV4`
  (color detailed scroll), and `PWV5` (3-band detailed scroll) sections.
- Add `read_color_waveform(path) -> Vec<WaveformPoint>` returning per-pixel
  (height, red, green, blue) or 3-band (lows/mids/highs).
- New Tauri command `get_anlz_waveform(track_id)` that resolves
  `analysis_data_path`, falls back to the existing decoded peaks if absent
  (e.g. tracks Rekordbox hasn't analysed).
- Frontend: render the color/3-band data instead of monochrome bars when
  available; keep the current `Waveform` as a fallback.
**Value:** High — biggest perceived "looks like the gear" UX upgrade and
unblocks future cue/loop overlays drawn against real spectral content.
**Effort:** Medium-large. ANLZ parsing is well-documented but stable
testing requires fixture files from real libraries. ~2–3 days.

### F2. Smart broken-path relocation
**Source:** `rekordbox-library-fixer`.
**Today:** The "Missing files" filter lists candidates; the user has to
fix paths in Rekordbox. No assisted recovery.
**Proposed work:**
- New crate or module `relocate` with:
  - `RelocateCandidate { track_id, original_path, suggestions: Vec<Match> }`
  - `Match { path, score, reasons: ["filename", "size", "tags"] }`
- Search strategies (cheap → expensive, short-circuit on high-confidence):
  1. Exact filename match under a user-chosen "music root".
  2. Filename + duration (±2s) match.
  3. Filename + ID3 title/artist match.
  4. Fuzzy filename (Levenshtein ≤ 3) within the same parent-dir name.
- New Tauri command `relocate_scan(library_path, search_roots)` returning
  candidates; `relocate_apply(track_id, new_path)` stages a
  `TrackMetadataEdit { field: "folder_path" }` change so it flows through
  the existing review/export pipeline.
- New `crates/agent-tools` request `RelocateScan` + `RelocateApply` for
  agent automation.
- UI: a "Relocate" action button in the Missing-Files filtered view that
  opens a panel listing the top three candidates with a one-click
  accept-and-stage.
**Value:** High — concrete user pain (track with `!` icon in Rekordbox)
that we can fix without touching the live DB.
**Effort:** Medium. ~2 days for the matcher + IPC; ~1 day for UI.

### F3. Library analytics dashboard
**Source:** `rekordbox-mcp`.
**Today:** We expose individual track/playlist/health queries but no
aggregate view. The Audit view exists but only surfaces health prompts.
**Proposed work:**
- New `crates/analytics` (or just `queries::analytics` inside
  `rekordbox-db`) with pure-function aggregations over `Vec<Track>`:
  - Genre distribution (count + percentage).
  - BPM histogram (5-BPM buckets).
  - Key wheel coverage (12 major / 12 minor counts).
  - Year/era distribution.
  - Top-played tracks (`dj_play_count` desc, with rating filter).
  - "Recently added but never played" set.
  - Library size stats (total duration, total filesize estimate if path
    exists).
- Tauri commands + matching `agent-tools` requests so the agent can ask
  "summarize this library" without bespoke prompts per stat.
- UI: new sidebar entry `Analytics` rendering compact cards (charts can
  be small inline SVGs — no chart-lib dependency in v1).
**Value:** Medium-high — pure read-only payoff for end users, and gives
the agent richer signal for proposing playlists/cleanups.
**Effort:** Medium. Aggregations are simple; the chart UI is the time
sink. ~2 days for backend+tools+three cards.

### F4. Audio fingerprinting for true duplicates
**Source:** `rekordbox-library-fixer`.
**Today:** We have exact + fuzzy metadata duplicate detection
(`duplicate_tracks`, `fuzzy_duplicate_tracks`). Same audio with totally
different tags slips through.
**Proposed work:**
- Add a fast perceptual fingerprint to `crates/audio-analysis`:
  Chromaprint via the `chromaprint` Rust crate (FFmpeg-style) **or** a
  homegrown 32-bit-per-second chromagram hash from stratum-dsp's chroma
  features (no new C deps). Recommendation: start homegrown — we already
  compute chroma during BPM/key analysis, so we can capture it almost
  for free.
- Cache fingerprints in `cache::CacheDb` keyed on file path + size + mtime.
- `health_audio_duplicate_scan` Tauri command + agent tool: groups tracks
  whose fingerprints fall within a Hamming-distance threshold.
- Surfaces in the existing duplicates UI as a third tier ("audio
  duplicates") alongside exact + fuzzy metadata matches.
**Value:** Medium. Catches the genuinely-tricky cases the metadata
heuristics miss (mis-tagged rips, alternate sources of the same master).
**Effort:** Medium-large. Fingerprint quality tuning is where this lives
or dies; expect ~3 days including fixture libraries.

### F5. PDB (USB export) reader
**Source:** Deep Symmetry documentation.
**Today:** We read `master.db` (SQLCipher) and Rekordbox XML. We cannot
read a stick straight out of a CDJ/XDJ.
**Proposed work:**
- New crate `rekordbox-pdb` parsing `export.pdb`:
  - File / page header / row group / row decoding (big-endian, 16-bit
    page indices, Pioneer string encodings — ASCII/UCS-2/UTF-16LE).
  - Row types we need first: Track, Artist, Album, Genre, Key, Color,
    Playlist, PlaylistEntry. Defer ANLZ-on-stick lookup and history
    until v2.
- Adapter so `decks_core::rekordbox_db::Track`/`Playlist` can be produced
  from either source — the rest of the app (filters, agent tools, XML
  export, staged changes) keeps working unchanged.
- CLI: `decks pdb dump --path /Volumes/PIONEER/PIONEER/rekordbox/export.pdb`
  for smoke testing.
**Value:** Medium today, strategic long-term. Lets the app be useful
mid-gig from just a stick, and is a prerequisite for any "edit on
laptop, write back to stick" workflow.
**Effort:** Large. ~5–7 days; PDB encoding edges (extended-string blobs,
multi-page rows) are the time risk. **Do not start without fixture
sticks in hand.**

### F6. Broker-mediated metadata enrichment
**Source:** `reklawdbox`'s Cloudflare-Worker pattern.
**Today:** No external enrichment at all. Editing genre/year/key by hand.
**Proposed work:**
- Define an enrichment broker contract (Discogs first, Beatport later):
  `POST /enrich/discogs/lookup { title, artist, album, isrc? }`
  → `{ candidates: [{ source, fields: {…}, confidence }] }`
- Reference Cloudflare Worker repo (separate from `decks`) that holds
  the Discogs OAuth secret and returns sanitised results.
- In `decks`: `crates/enrichment` already exists — add a `broker` client
  that hits the Worker over HTTPS, with the Worker URL configurable in
  Settings. Each candidate field becomes a staged
  `TrackMetadataEdit` change with a confidence and `reason`.
- Agent tool `enrichment_propose_for_track` so an agent can request a
  lookup and stage the proposals in one step.
**Value:** Medium. The hand-tagging pain is real; the auth-without-leaking-secrets
solution is the unlock.
**Effort:** Medium for the client + UI (~2 days); separate Worker repo
is its own scoped effort (~1–2 days, mostly OAuth wiring).
**Risk:** Network calls outside the local app — needs an opt-in toggle
and never-on-by-default behaviour.

## Fixture inventory (2026-05-12)

What is on disk under `fixtures/` right now:

- ✅ `fixtures/anlz/track1..track5/` — five real ANLZ sets. Every track
  has `.DAT` + `.EXT` + `.2EX`; tracks 2–5 also have `.3EX`. Track1 has
  no `.3EX`, which is a useful "older Rekordbox" negative case for F1.
- ✅ `fixtures/master.db` — full real Rekordbox 7 SQLCipher database (~95 MB).
  Decrypts with the well-known Rekordbox key; lets us correlate ANLZ
  files to track rows via `analysis_data_path`.
- ⏳ `fixtures/audio-dupes/` — empty. User will drop pairs manually.
- ⏳ `fixtures/pdb/` — empty (no USB mounted at fixture-collection time).
- 🔒 `.gitignore` already excludes `fixtures/master.db`, `fixtures/anlz/`,
  `fixtures/audio-dupes/`, `fixtures/pdb/`.

This reshuffles priorities: F1 is now fully unblocked, F4 is partially
unblocked (we can build/test against synthetic dupes derived from the
real library), F5 is still blocked.

## Sequencing (revised after fixtures landed)

### Sprint 1 — Visible wins (now)

**S1.1. F1 ANLZ waveform reader** *(unblocked)*

Concrete first slice — do these in order; merge each before starting
the next:

1. **Inventory pass.** Write a one-off bin or test that opens each of
   `fixtures/anlz/track*/ANLZ0000.{DAT,EXT,2EX,3EX}` and dumps every
   top-level four-char tag + section length to stdout. Snapshot the
   output to `fixtures/anlz/SECTIONS.txt` so we can see at a glance
   which tags Rekordbox 7 actually emits today (vs. the ones referenced
   in pyrekordbox / Deep Symmetry docs that may be deprecated).
2. **Extend `crates/rekordbox-db/src/anlz.rs`** from PQTZ-only to a
   generic section walker (`for_each_section(data, |tag, body| …)`),
   keeping `read_beat_grid` working as a wrapper. Add tests against the
   fixtures asserting both that PQTZ still parses and that the new
   walker can enumerate every section in the five files.
3. **Parse the preview waveform first** (small, ships fast value):
   `PWAV` and/or `PWV2` (color preview). Add
   `read_preview_waveform(path) -> Vec<PreviewPoint>` returning
   `{height: u8, color: WaveformColor}`. New `WaveformColor` enum mirrors
   what Rekordbox stores (monochrome vs. RGB by section type). Tests
   against the fixtures: byte counts, expected ranges.
4. **Parse the detailed scroll** next: `PWV4` (color detail) and `PWV5`
   (3-band detail). Same shape: `read_detail_waveform(path) -> Vec<DetailPoint>`.
   These are the ones that look "like a CDJ".
5. **Wire it through.** New Tauri command `get_anlz_waveform(track_id)`:
   reads `analysis_data_path` from the DB, returns `{ preview, detail,
   beat_grid }`. Falls back to the existing decoded-amplitude peaks
   command if `analysis_data_path` is null or the file is missing.
6. **Render.** Replace the inspector's monochrome `<Waveform>` with a
   `<ColorWaveform>` (new component) when ANLZ data is available. Keep
   the existing decoded-peaks path for unanalysed tracks. Playhead/cue
   overlays stay where they are — only the bar rendering changes.

Definition of done: opening any of the five fixture tracks in the
inspector shows the colored waveform; the test suite parses all five
fixture sets without panicking; existing PQTZ test still green.

**Estimated effort:** 2–3 days. Risk concentrated in step 1 (some
sections may be opaque or version-gated).

**S1.2. F2 broken-path relocation** *(parallelisable with S1.1)*

No fixtures needed — runs against the user's live library and any music
root they point us at. Start once S1.1 step 3 is in (so a second person
or session can pick it up without merge conflicts in `anlz.rs`).

Slices, smallest first:

1. **Filename index.** `crates/relocate/src/lib.rs`: walk a search root,
   build a `HashMap<String /*filename*/, Vec<PathBuf>>`. Pure function
   plus a Tauri-level cache.
2. **Match strategies as a pipeline** with confidence scores:
   1.0 exact-filename-unique → 0.9 exact-filename + size match → 0.7
   exact-filename + duration match → 0.5 fuzzy-filename (Levenshtein ≤ 3)
   under same grandparent directory.
3. **Tauri command** `relocate_scan(library_path, search_roots)` returns
   `Vec<RelocateCandidate>` (one per orphaned track, with top 3 matches).
4. **Agent tools.** `relocate.scan` + `relocate.apply` so the agent can
   say "I found N broken tracks, you have 12 high-confidence relocations
   queued for review".
5. **UI.** New action in the Missing-Files filter view: a "Relocate"
   button that opens a panel. One-click "Accept top match" stages a
   `TrackMetadataEdit{field: "folder_path"}` change — it flows through
   the existing review/export pipeline so nothing touches `master.db`.

Definition of done: with a small synthetic broken library (we can
generate one from `master.db` by renaming a few files in a temp dir),
the scan finds matches and the apply path stages a change that the
existing XML export emits correctly.

**Estimated effort:** 2 days backend + 1 day UI.

### Sprint 2 — Read-only payoff (next)

**S2.1. F3 analytics dashboard.** Independent of S1; can start any time.
No fixtures beyond `fixtures/master.db`. Build the pure aggregations
first under `queries::analytics`, then a single Tauri command
`library_analytics(library_path)` returning the whole bundle, then the
sidebar `Analytics` view with three cards (genre distribution, BPM
histogram, key wheel). Defer "recently added" until we have a clear
timestamp column to sort on.

**Estimated effort:** 2 days.

**S2.2. F4 audio-fingerprint duplicates (partially-blocked).** We can
build everything *except* threshold tuning without `fixtures/audio-dupes/`:
the chromagram hash, the cache schema, the Hamming-distance grouper,
the Tauri command, the UI tier in the duplicates view. Tuning the
similarity threshold is where the dupe pairs matter, and we should call
this feature "experimental" in the UI until the user has dropped 2–4
true-duplicate pairs and we've verified the threshold catches them
without false positives. *Park threshold defaults at conservative
values (e.g. ≥95% similarity) until tuning data exists.*

**Estimated effort:** 2 days for the plumbing; +1 day for tuning once
fixtures arrive.

### Sprint 3 — Strategic / external (later)

- **F6 broker enrichment** — independent track. Worth doing once
  Sprint 1+2 give us a richer "propose change" pipeline to drop the
  suggestions into. Needs a decision on broker hosting (see open
  questions).
- **F5 PDB reader** — still blocked on USB fixtures. Schedule once the
  user plugs a stick in and copies `/PIONEER/rekordbox/` into
  `fixtures/pdb/export-<label>/`.
- **F7 Device Library Plus** — defer; revisit if F5 lands or a user
  asks.

## What I'm waiting on from you

- Nothing to start Sprint 1.
- For S2.2 tuning: drop 2–4 dupe pairs into `fixtures/audio-dupes/`
  whenever convenient. Useful pairs: same recording at different
  bitrates, same recording from different sources, plus 1–2 negative
  cases (remix vs. original of the same track) so we can tune false
  positives.
- For F5: a USB export copied to `fixtures/pdb/export-<label>/` if/when
  you have a stick mounted.

## Open questions still standing

- **F2:** is the user OK with us walking their entire music root tree
  on demand, or do we need an explicit "pick which folders to scan"
  gesture? Default: explicit scan roots, configured in Settings.
- **F6:** who runs the broker? Self-hosted Worker → much bigger OAuth
  UX. Centralised Worker → one of us holds the Discogs secret.
- **F5:** read-only first, or design for write-back from day one? That
  decision changes how rows are modelled internally.
