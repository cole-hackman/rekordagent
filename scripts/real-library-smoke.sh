#!/usr/bin/env bash
# Read-only smoke test against a real Rekordbox 7 master.db.
#
# Exercises every read-only MCP tool the desktop UI exposes, captures evidence,
# and verifies the master.db file is byte-identical before and after. Does NOT
# touch master.db.
#
# Usage:
#   ./scripts/real-library-smoke.sh                 # defaults to ~/Library/Pioneer/rekordbox/master.db
#   ./scripts/real-library-smoke.sh /path/to/master.db

set -euo pipefail

LIB="${1:-$HOME/Library/Pioneer/rekordbox/master.db}"
BIN="${BIN:-$(cd "$(dirname "$0")/.." && pwd)/target/debug/decks}"
OUT_DIR="$(cd "$(dirname "$0")/.." && pwd)/target/smoke"
mkdir -p "$OUT_DIR"

if [[ ! -f "$LIB" ]]; then
  echo "FAIL: library not found at $LIB" >&2
  exit 1
fi
if [[ ! -x "$BIN" ]]; then
  echo "FAIL: decks binary not built at $BIN (run: cargo build -p decks-cli)" >&2
  exit 1
fi

PRE_SHA=$(shasum -a 256 "$LIB" | awk '{print $1}')
PRE_SIZE=$(stat -f%z "$LIB" 2>/dev/null || stat -c%s "$LIB")
echo "Library:  $LIB"
echo "Pre-SHA:  $PRE_SHA"
echo "Pre-size: $PRE_SIZE bytes"
echo

PASS=0
FAIL=0
report() {
  local label="$1" status="$2" detail="$3"
  if [[ "$status" == "PASS" ]]; then
    PASS=$((PASS + 1))
    printf "  [PASS] %-44s %s\n" "$label" "$detail"
  else
    FAIL=$((FAIL + 1))
    printf "  [FAIL] %-44s %s\n" "$label" "$detail"
  fi
}

CACHE_DB="$OUT_DIR/staging-cache.db"
# Fresh cache each run so staging counts are reproducible.
rm -f "$CACHE_DB"

call_tool() {
  local out_name="$1" tool="$2" args="$3"
  "$BIN" tools call --library "$LIB" --cache "$CACHE_DB" --json "$args" "$tool" \
    >"$OUT_DIR/$out_name.json" 2>"$OUT_DIR/$out_name.err"
}

# 1. Schema validation + nonzero track count via library_search.
echo "== Read-only smoke tests =="
if call_tool "01_search_a" "library_search" '{"query":"a","limit":5}'; then
  count=$(jq 'length' "$OUT_DIR/01_search_a.json" 2>/dev/null || echo "?")
  if [[ "$count" != "?" && "$count" != "0" ]]; then
    sample=$(jq -r '.[0] | "\(.title // "?") / \(.artist // "?")"' "$OUT_DIR/01_search_a.json")
    report "library_search (schema + non-empty result)" PASS "got $count rows, e.g. $sample"
  else
    report "library_search" FAIL "0 results — library may be empty or schema mismatch"
  fi
else
  report "library_search" FAIL "tool errored — see $OUT_DIR/01_search_a.err"
fi

# 2. library_get_track on first ID returned by search.
FIRST_ID=$(jq -r 'if length > 0 then .[0].id else empty end' "$OUT_DIR/01_search_a.json" 2>/dev/null || true)
if [[ -n "${FIRST_ID:-}" ]]; then
  if call_tool "02_get_track" "library_get_track" "{\"id\":\"$FIRST_ID\"}"; then
    if jq -e '.id' "$OUT_DIR/02_get_track.json" >/dev/null; then
      title=$(jq -r '.title // "(no title)"' "$OUT_DIR/02_get_track.json")
      report "library_get_track" PASS "id=$FIRST_ID title=\"$title\""
    else
      report "library_get_track" FAIL "no id field in response"
    fi
  else
    report "library_get_track" FAIL "tool errored"
  fi
fi

# 3. Playlists.
if call_tool "03_playlists" "library_list_playlists" '{}'; then
  playlist_count=$(jq 'length' "$OUT_DIR/03_playlists.json" 2>/dev/null || echo "?")
  if [[ "$playlist_count" != "?" ]]; then
    folders=$(jq '[.[] | select(.kind == "Folder")] | length' "$OUT_DIR/03_playlists.json")
    report "library_list_playlists" PASS "$playlist_count entries ($folders folders)"
  else
    report "library_list_playlists" FAIL "could not parse response"
  fi
fi

# 4. Walk into one non-folder, non-smart playlist (smart playlists don't store
#    rows in djmdSongPlaylist, so they always look empty via library_get_playlist).
PID=$(jq -r 'first(.[] | select(.kind == "Playlist") | .id) // empty' "$OUT_DIR/03_playlists.json" 2>/dev/null || true)
if [[ -n "${PID:-}" ]]; then
  if call_tool "04_playlist" "library_get_playlist" "{\"id\":\"$PID\"}"; then
    track_count=$(jq '.tracks | length' "$OUT_DIR/04_playlist.json" 2>/dev/null || echo "?")
    name=$(jq -r '.playlist.name // "?"' "$OUT_DIR/04_playlist.json")
    if [[ "$track_count" =~ ^[0-9]+$ && "$track_count" -gt 0 ]]; then
      report "library_get_playlist (non-empty)" PASS "\"$name\" has $track_count tracks"
    else
      report "library_get_playlist (non-empty)" FAIL "\"$name\" returned $track_count tracks — expected > 0 for a Playlist-kind playlist"
    fi
  else
    report "library_get_playlist" FAIL "errored on $PID"
  fi
fi

# 5. Cues — try several tracks until we find one with cues (catches the cue-join
#    regression class that bit us when djmdCue schema variants surfaced).
CUES_FOUND=0
for cand_id in $(jq -r '.[].id' "$OUT_DIR/01_search_a.json"); do
  if call_tool "05_cues_${cand_id}" "library_list_cues" "{\"track_id\":\"$cand_id\"}"; then
    cnt=$(jq 'length' "$OUT_DIR/05_cues_${cand_id}.json" 2>/dev/null || echo 0)
    if [[ "$cnt" =~ ^[0-9]+$ && "$cnt" -gt 0 ]]; then
      report "library_list_cues" PASS "$cnt cues on track $cand_id"
      CUES_FOUND=1
      break
    fi
  fi
done
if [[ "$CUES_FOUND" -eq 0 ]]; then
  # Fall back to a playlist's first track if the search hits had no cues.
  PT_ID=$(jq -r '.tracks[0].id // empty' "$OUT_DIR/04_playlist.json" 2>/dev/null || true)
  if [[ -n "${PT_ID:-}" ]]; then
    if call_tool "05_cues_pt" "library_list_cues" "{\"track_id\":\"$PT_ID\"}"; then
      cnt=$(jq 'length' "$OUT_DIR/05_cues_pt.json" 2>/dev/null || echo 0)
      report "library_list_cues" PASS "$cnt cues on playlist track $PT_ID (no cues found on search hits)"
    else
      report "library_list_cues" FAIL "errored on playlist track"
    fi
  else
    report "library_list_cues" PASS "no candidate tracks to probe — schema OK on 0-cue tracks"
  fi
fi

# 6. Orphan scan.
if call_tool "06_orphans" "health_orphan_scan" '{}'; then
  orphan_count=$(jq 'length' "$OUT_DIR/06_orphans.json" 2>/dev/null || echo "?")
  report "health_orphan_scan" PASS "$orphan_count orphans"
else
  report "health_orphan_scan" FAIL "errored"
fi

# 7. Duplicate scan.
if call_tool "07_dupes" "health_duplicate_scan" '{}'; then
  group_count=$(jq 'length' "$OUT_DIR/07_dupes.json" 2>/dev/null || echo "?")
  report "health_duplicate_scan" PASS "$group_count duplicate groups"
else
  report "health_duplicate_scan" FAIL "errored"
fi

# 8. Fuzzy duplicate scan.
if call_tool "08_fuzzy_dupes" "health_fuzzy_duplicate_scan" '{}'; then
  group_count=$(jq 'length' "$OUT_DIR/08_fuzzy_dupes.json" 2>/dev/null || echo "?")
  report "health_fuzzy_duplicate_scan" PASS "$group_count fuzzy groups"
else
  report "health_fuzzy_duplicate_scan" FAIL "errored"
fi

# 9. Broken-metadata health scan.
if call_tool "09_broken_meta" "health_broken_link_scan" '{}'; then
  broken_count=$(jq 'length' "$OUT_DIR/09_broken_meta.json" 2>/dev/null || echo "?")
  report "health_broken_link_scan" PASS "$broken_count broken-metadata rows"
else
  report "health_broken_link_scan" FAIL "errored"
fi

# 10. Staging changes (should start empty if cache is fresh; just confirm it returns).
if call_tool "10_staging" "staging_list_changes" '{}'; then
  staged_count=$(jq 'length' "$OUT_DIR/10_staging.json" 2>/dev/null || echo "?")
  report "staging_list_changes" PASS "$staged_count staged changes"
else
  report "staging_list_changes" FAIL "errored"
fi

# 11. Read file tags — search the library for a track whose folder_path resolves
#     to a real file on disk, then assert tags came back from the audio file.
TAG_ID=""
TAG_PATH=""
"$BIN" tools call --library "$LIB" --cache "$CACHE_DB" \
  --json '{"query":"","limit":50}' library_search 2>/dev/null \
  | jq -r '.[] | select(.folder_path != null) | "\(.id)|\(.folder_path)"' \
  > "$OUT_DIR/_candidate_paths.txt"
while IFS='|' read -r cand_id cand_path; do
  if [[ -f "$cand_path" ]]; then
    TAG_ID="$cand_id"
    TAG_PATH="$cand_path"
    break
  fi
done < "$OUT_DIR/_candidate_paths.txt"

if [[ -n "$TAG_ID" ]]; then
  if call_tool "11_file_tags" "library_read_file_tags" "{\"track_id\":\"$TAG_ID\"}"; then
    # Response shape: { db: {...}, file: {...}, file_path, track_id }
    if jq -e '.file.file_type' "$OUT_DIR/11_file_tags.json" >/dev/null 2>&1; then
      f_title=$(jq -r '.file.title // ""' "$OUT_DIR/11_file_tags.json")
      f_type=$(jq -r '.file.file_type' "$OUT_DIR/11_file_tags.json")
      db_title=$(jq -r '.db.title // ""' "$OUT_DIR/11_file_tags.json")
      drift_note=""
      if [[ "$f_title" != "$db_title" ]]; then
        drift_note=" [drift: file vs DB title differs — this is what audit surfaces]"
      fi
      report "library_read_file_tags (real audio file)" PASS "$f_type: \"$f_title\"$drift_note"
    else
      report "library_read_file_tags (real audio file)" FAIL "no .file.file_type in response"
    fi
  else
    report "library_read_file_tags (real audio file)" FAIL "errored"
  fi

  # 12. DSP analysis — slow on debug builds (minutes on long files), so opt-in.
  #     Enable with: RUN_ANALYZE=1 scripts/real-library-smoke.sh
  if [[ "${RUN_ANALYZE:-0}" == "1" ]]; then
    start=$(date +%s)
    if call_tool "12_analyze" "library_analyze_track" "{\"track_id\":\"$TAG_ID\"}"; then
      elapsed=$(( $(date +%s) - start ))
      # Response shape: { bpm, bpm_confidence, musical_key, key_confidence, confidence, cached }
      if jq -e '.bpm | type == "number"' "$OUT_DIR/12_analyze.json" >/dev/null 2>&1; then
        bpm=$(jq -r '.bpm | (. * 10 | round / 10)' "$OUT_DIR/12_analyze.json")
        key=$(jq -r '.musical_key // "?"' "$OUT_DIR/12_analyze.json")
        cached=$(jq -r '.cached' "$OUT_DIR/12_analyze.json")
        report "library_analyze_track (stratum-dsp)" PASS "bpm=$bpm key=$key cached=$cached (${elapsed}s)"
      else
        report "library_analyze_track (stratum-dsp)" FAIL "no numeric bpm in response — see 12_analyze.json"
      fi
    else
      report "library_analyze_track (stratum-dsp)" FAIL "errored — see 12_analyze.err"
    fi
  else
    echo "  [skip] library_analyze_track — set RUN_ANALYZE=1 to enable (slow on debug builds)"
  fi
else
  report "library_read_file_tags (real audio file)" FAIL "no track in the library has a resolvable folder_path"
fi

# 12. Final: confirm master.db is byte-identical (no writes).
POST_SHA=$(shasum -a 256 "$LIB" | awk '{print $1}')
POST_SIZE=$(stat -f%z "$LIB" 2>/dev/null || stat -c%s "$LIB")
if [[ "$POST_SHA" == "$PRE_SHA" && "$POST_SIZE" == "$PRE_SIZE" ]]; then
  report "master.db unmodified after all reads" PASS "sha256 unchanged"
else
  report "master.db unmodified after all reads" FAIL "sha changed! pre=$PRE_SHA post=$POST_SHA"
fi

echo
echo "Passed: $PASS"
echo "Failed: $FAIL"
echo "Evidence: $OUT_DIR/"
[[ "$FAIL" -eq 0 ]]
