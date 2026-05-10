# Journal

## Session 1 — 2026-05-10

### Plan
- Bootstrap the repo per §12 of CLAUDE_CODE_PROMPT.md (session 1 = STATUS.md absent).
- Goals:
  1. Create the full directory scaffold from §3.
  2. Set up Cargo workspace, pnpm workspace, CI, and toolchain pin.
  3. Create STATUS.md, JOURNAL.md, DECISIONS.md, and empty docs stubs.
- End state: `chore: bootstrap repo` committed and pushed; STATUS.md set to phase 1 / next task = "scaffold rekordbox-db crate".

### End of session
- Shipped: full repo scaffold per §3. Cargo workspace with 14 placeholder crates, pnpm workspace, CI workflow (fmt + clippy + test on macOS + Windows), rust-toolchain.toml, LICENSE (MIT), NOTICE (reklawdbox attribution), DECISIONS.md (ADR-0001 Tauri v2), and empty docs stubs.
- Next: scaffold `crates/rekordbox-db` — SQLCipher key derivation, open master.db read-only, query tracks/playlists/cues/beat grid, integration test against fixtures/tiny-library/.
- Blockers: none.

## Session 2 — 2026-05-10

### Plan
- Task: implement `crates/rekordbox-db` per STATUS.md.
- Goals:
  1. Fix Cargo.toml workspace (remove invalid `edition` key from `[workspace]`; switch rusqlite to `bundled-sqlcipher-vendored-openssl`).
  2. Implement `RekordboxDb` — read-only open with `PRAGMA key` (key = `402fd482...`), `busy_timeout`.
  3. Implement queries: tracks (with artist/album/genre/key JOINs), playlists, playlist entries, hot cues from `djmdCue`.
  4. Implement ANLZ beat grid parser (PQTZ binary tag, big-endian, 8-byte beat entries).
  5. Create synthetic SQLCipher test fixture; write integration test covering all query paths + error paths.
  6. Ensure `cargo clippy -- -D warnings` and `cargo test --workspace` pass.
- Key facts from research:
  - SQLCipher key: `402fd482c38817c35ffa8ffb8c7d93143b749e7d315df7a81732a1ff43608497` (universal RB6/7)
  - `BPM` column: integer × 100 (12800 → 128.00 bpm); `Length`: seconds
  - `djmdCue.Kind`: 0 = memory cue, else hot cue slot number (1–8)
  - Beat grid in ANLZ `.DAT` file, PQTZ section; entries are big-endian {beat_num:u16, tempo_bpm×100:u16, time_ms:u32}

### End of session
- Shipped:
  - `crates/rekordbox-db` fully implemented: `RekordboxDb` (read-only open, PRAGMA key + busy_timeout), track queries with JOIN to artist/album/genre/key (BPM converted from int×100), playlist + playlist-entry queries, hot-cue queries from `djmdCue`, ANLZ beat-grid parser for PQTZ binary sections.
  - 38 tests: 21 unit tests (tracks, playlists, cues, ANLZ, connection safety) + 16 integration tests against a synthetic SQLCipher fixture + 1 doc-test.
  - Fixed workspace Cargo.toml (`edition` key removed; rusqlite moved out of workspace deps to per-crate with `bundled-sqlcipher-vendored-openssl`).
  - `cargo clippy -- -D warnings` and `cargo test --workspace` all pass.
  - Bug fixed mid-session: ANLZ parser `parse_pqtz_section` had wrong byte offset for `content_start` (was jumping 12 extra bytes into beat entries). Fixed by passing `section_start` directly and computing offsets from it.
- Next: implement `crates/rekordbox-xml` — parse and emit Rekordbox XML; round-trip property tests.
- Blockers: none.
