# Tool Inventory

> Authoritative list of agent tools. Each tool has: name, summary, parameters (typed), return type, idempotency, side effects, cost class.
>
> Cost classes: **free** (pure computation / local DB read), **network** (HTTP call to external service), **model-call** (LLM invocation).
>
> Living document — every new tool must be added here in the same commit it is implemented.

---

## Library tools

### `library.search`
Search tracks by text query across title, artist, album, genre, comment.

| Field | Value |
|-------|-------|
| Parameters | `query: string`, `limit?: number` (default 50) |
| Returns | `Track[]` |
| Idempotent | yes |
| Side effects | none |
| Cost | free |

### `library.get_track`
Fetch full track details by ID.

| Field | Value |
|-------|-------|
| Parameters | `id: number` |
| Returns | `Track` |
| Idempotent | yes |
| Side effects | none |
| Cost | free |

### `library.list_playlists`
List all playlists and folders.

| Field | Value |
|-------|-------|
| Parameters | — |
| Returns | `Playlist[]` |
| Idempotent | yes |
| Side effects | none |
| Cost | free |

### `library.list_cues`
List hot cues for a track.

| Field | Value |
|-------|-------|
| Parameters | `track_id: number` |
| Returns | `HotCue[]` |
| Idempotent | yes |
| Side effects | none |
| Cost | free |

---

## Audio tools

### `audio.analyze`
Trigger (or retrieve cached) BPM, key, and feature analysis for a track.

| Field | Value |
|-------|-------|
| Parameters | `track_id: number`, `force?: boolean` |
| Returns | `AudioFeatures` |
| Idempotent | yes |
| Side effects | writes to cache DB |
| Cost | free (CPU) |

### `audio.get_waveform`
Return waveform data for rendering.

| Field | Value |
|-------|-------|
| Parameters | `track_id: number` |
| Returns | `WaveformData` |
| Idempotent | yes |
| Side effects | none |
| Cost | free |

---

## Enrichment tools

### `enrichment.discogs_lookup`
Look up track metadata on Discogs.

| Field | Value |
|-------|-------|
| Parameters | `track_id: number` |
| Returns | `DiscogsResult` |
| Idempotent | yes |
| Side effects | network call, caches result |
| Cost | network |

### `enrichment.mb_lookup`
Look up track metadata on MusicBrainz.

| Field | Value |
|-------|-------|
| Parameters | `track_id: number` |
| Returns | `MusicBrainzResult` |
| Idempotent | yes |
| Side effects | network call, caches result |
| Cost | network |

---

## Classify tools

### `classify.genre_classify`
Classify the genre of a track using the decision tree.

| Field | Value |
|-------|-------|
| Parameters | `track_id: number` |
| Returns | `GenreClassification` |
| Idempotent | yes |
| Side effects | none |
| Cost | free |

### `classify.genre_audit`
Audit a playlist or the whole library for genre inconsistencies.

| Field | Value |
|-------|-------|
| Parameters | `playlist_id?: number` |
| Returns | `GenreAuditReport` |
| Idempotent | yes |
| Side effects | none |
| Cost | free |

---

## Health tools

### `health.orphan_scan`
Find tracks whose audio files are missing from disk.

| Field | Value |
|-------|-------|
| Parameters | — |
| Returns | `Track[]` |
| Idempotent | yes |
| Side effects | none |
| Cost | free |

### `health.duplicate_scan`
Find likely duplicate tracks.

| Field | Value |
|-------|-------|
| Parameters | — |
| Returns | `DuplicateGroup[]` |
| Idempotent | yes |
| Side effects | none |
| Cost | free |

### `health.broken_link_scan`
Find tracks with broken metadata links (bad BPM, missing key, etc.).

| Field | Value |
|-------|-------|
| Parameters | — |
| Returns | `BrokenLinkReport` |
| Idempotent | yes |
| Side effects | none |
| Cost | free |

---

## Sets tools

### `sets.score_transition`
Score a transition between two tracks.

| Field | Value |
|-------|-------|
| Parameters | `from_id: number`, `to_id: number` |
| Returns | `TransitionScore` |
| Idempotent | yes |
| Side effects | none |
| Cost | free |

### `sets.sequence_set`
Build an optimal track sequence from a pool using beam search.

| Field | Value |
|-------|-------|
| Parameters | `track_ids: number[]`, `target_duration_min?: number` |
| Returns | `TrackSequence` |
| Idempotent | yes |
| Side effects | none |
| Cost | free |

### `sets.plan_chapters`
Divide a set into energy chapters.

| Field | Value |
|-------|-------|
| Parameters | `sequence_id: string` |
| Returns | `Chapter[]` |
| Idempotent | yes |
| Side effects | none |
| Cost | free |

---

## Pools tools

### `pools.find_pool`
Find tracks matching a semantic description.

| Field | Value |
|-------|-------|
| Parameters | `query: string`, `limit?: number` |
| Returns | `Track[]` |
| Idempotent | yes |
| Side effects | none |
| Cost | free / model-call |

### `pools.expand_pool`
Expand an existing track pool with similar tracks.

| Field | Value |
|-------|-------|
| Parameters | `track_ids: number[]`, `limit?: number` |
| Returns | `Track[]` |
| Idempotent | yes |
| Side effects | none |
| Cost | free |

---

## Staging tools

### `staging.list_changes`
List all staged changes.

| Field | Value |
|-------|-------|
| Parameters | — |
| Returns | `Change[]` |
| Idempotent | yes |
| Side effects | none |
| Cost | free |

### `staging.accept_change`
Accept a staged change (marks it ready for export).

| Field | Value |
|-------|-------|
| Parameters | `change_id: string` |
| Returns | `void` |
| Idempotent | yes |
| Side effects | mutates change state |
| Cost | free |

### `staging.reject_change`
Reject and discard a staged change.

| Field | Value |
|-------|-------|
| Parameters | `change_id: string` |
| Returns | `void` |
| Idempotent | yes |
| Side effects | mutates change state |
| Cost | free |

### `staging.export_xml`
Export all accepted changes as a Rekordbox-importable XML file.

| Field | Value |
|-------|-------|
| Parameters | `output_path?: string` |
| Returns | `ExportResult` |
| Idempotent | no (writes file) |
| Side effects | writes XML file to disk |
| Cost | free |

---

## Embeddings tools (Phase 4)

_Not yet implemented._

---

## Live tools (Phase 5)

_Not yet implemented._

---

## Plugin tools (Phase 6)

_Not yet implemented._
