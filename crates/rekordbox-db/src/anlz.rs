/// Parse ANLZ `.DAT` beat-grid files produced by Rekordbox.
///
/// File layout (all integers big-endian):
///
/// ```text
/// File header (28 bytes):
///   [0..4]   magic "PMAI"
///   [4..8]   header length (u32) — typically 28 (0x1C)
///   [8..12]  total file length (u32)
///   [12..28] reserved
///
/// Sections (repeated until EOF):
///   [0..4]   four-char tag ("PQTZ", "PCOB", …)
///   [4..8]   section header length (u32)
///   [8..12]  total section length including header (u32)
///   [12..]   tag-specific content
///
/// PQTZ content (after 12-byte section header):
///   [0..4]   reserved (0x00800000)
///   [4..8]   beat count (u32)
///   [8..12]  reserved
///   then beat_count × 8-byte entries:
///     [0..2]  beat_number within bar (u16, 1–4)
///     [2..4]  tempo = BPM × 100 (u16)
///     [4..8]  time_ms (u32)
/// ```
use crate::types::BeatGridEntry;
use anyhow::{ensure, Context, Result};
use std::{fs, path::Path};

const PMAI_MAGIC: &[u8; 4] = b"PMAI";
const PQTZ_TAG: &[u8; 4] = b"PQTZ";

pub fn read_beat_grid(path: &Path) -> Result<Vec<BeatGridEntry>> {
    let data = fs::read(path).with_context(|| format!("reading ANLZ file {}", path.display()))?;
    parse_beat_grid(&data)
}

fn parse_beat_grid(data: &[u8]) -> Result<Vec<BeatGridEntry>> {
    ensure!(data.len() >= 12, "ANLZ file too short");
    ensure!(&data[0..4] == PMAI_MAGIC, "ANLZ file missing PMAI magic");

    let header_len = u32::from_be_bytes(data[4..8].try_into().unwrap()) as usize;
    ensure!(
        data.len() >= header_len,
        "ANLZ file shorter than declared header"
    );

    let mut pos = header_len;
    while pos + 12 <= data.len() {
        let tag = &data[pos..pos + 4];
        let section_total_len =
            u32::from_be_bytes(data[pos + 8..pos + 12].try_into().unwrap()) as usize;

        if section_total_len == 0 {
            break;
        }

        if tag == PQTZ_TAG {
            return parse_pqtz_section(data, pos, section_total_len);
        }

        pos += section_total_len;
    }

    Ok(vec![])
}

/// Parse a PQTZ section starting at `section_start` (the byte offset of the
/// "PQTZ" tag itself).
///
/// Section layout (all big-endian):
/// ```text
///  [0..4]   "PQTZ"
///  [4..8]   section_header_len (u32) = 24
///  [8..12]  section_total_len (u32)
///  [12..16] reserved
///  [16..20] beat_count (u32)
///  [20..24] reserved
///  [24..]   beat entries (8 bytes each)
/// ```
fn parse_pqtz_section(
    data: &[u8],
    section_start: usize,
    section_total_len: usize,
) -> Result<Vec<BeatGridEntry>> {
    ensure!(
        data.len() >= section_start + 24,
        "PQTZ section too short for header"
    );

    let beat_count = u32::from_be_bytes(
        data[section_start + 16..section_start + 20]
            .try_into()
            .unwrap(),
    ) as usize;

    let beats_start = section_start + 24;
    let section_end = section_start + section_total_len;

    ensure!(
        data.len() >= section_end,
        "ANLZ data truncated inside PQTZ section"
    );
    ensure!(
        beats_start + beat_count * 8 <= section_end,
        "PQTZ beat entries extend beyond section boundary"
    );

    let mut entries = Vec::with_capacity(beat_count);
    for i in 0..beat_count {
        let off = beats_start + i * 8;
        let beat_number = u16::from_be_bytes(data[off..off + 2].try_into().unwrap());
        let tempo = u16::from_be_bytes(data[off + 2..off + 4].try_into().unwrap());
        let time_ms = u32::from_be_bytes(data[off + 4..off + 8].try_into().unwrap());
        entries.push(BeatGridEntry {
            beat_number,
            tempo_bpm_x100: tempo,
            time_ms,
        });
    }
    Ok(entries)
}

// ── Tests ────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    /// Build a minimal valid ANLZ .DAT byte blob with PQTZ section.
    fn make_anlz(beats: &[(u16, u16, u32)]) -> Vec<u8> {
        let beat_count = beats.len() as u32;
        let section_header_len: u32 = 24; // 12 (tag+lens) + 12 (reserved+count+reserved)
        let section_total_len = section_header_len + beat_count * 8;
        let file_header_len: u32 = 28;
        let file_total_len = file_header_len + section_total_len; // +12 for section header

        let mut buf = Vec::new();

        // File header (28 bytes)
        buf.extend_from_slice(b"PMAI");
        buf.extend_from_slice(&file_header_len.to_be_bytes());
        buf.extend_from_slice(&file_total_len.to_be_bytes());
        buf.extend_from_slice(&[0u8; 16]); // reserved

        // PQTZ section header (12 bytes)
        buf.extend_from_slice(b"PQTZ");
        buf.extend_from_slice(&section_header_len.to_be_bytes());
        buf.extend_from_slice(&section_total_len.to_be_bytes());

        // PQTZ content prefix (12 bytes: reserved, beat_count, reserved)
        buf.extend_from_slice(&[0x00, 0x80, 0x00, 0x00]);
        buf.extend_from_slice(&beat_count.to_be_bytes());
        buf.extend_from_slice(&[0u8; 4]);

        // Beat entries
        for &(beat_num, tempo, time_ms) in beats {
            buf.extend_from_slice(&beat_num.to_be_bytes());
            buf.extend_from_slice(&tempo.to_be_bytes());
            buf.extend_from_slice(&time_ms.to_be_bytes());
        }

        buf
    }

    #[test]
    fn parse_two_beats() {
        let beats = [(1u16, 12800u16, 0u32), (2u16, 12800u16, 468u32)];
        let blob = make_anlz(&beats);
        let entries = parse_beat_grid(&blob).unwrap();
        assert_eq!(entries.len(), 2);
        assert_eq!(entries[0].beat_number, 1);
        assert_eq!(entries[0].tempo_bpm_x100, 12800);
        assert_eq!(entries[0].time_ms, 0);
        assert_eq!(entries[1].time_ms, 468);
    }

    #[test]
    fn bpm_helper() {
        let entry = BeatGridEntry {
            beat_number: 1,
            tempo_bpm_x100: 13200,
            time_ms: 0,
        };
        assert!((entry.bpm() - 132.0).abs() < 0.001);
    }

    #[test]
    fn empty_beat_grid() {
        let blob = make_anlz(&[]);
        let entries = parse_beat_grid(&blob).unwrap();
        assert!(entries.is_empty());
    }

    #[test]
    fn no_pqtz_section_returns_empty() {
        // Valid ANLZ file but no PQTZ — just a file header.
        let mut buf = Vec::new();
        let header_len: u32 = 28;
        let file_len: u32 = 28;
        buf.extend_from_slice(b"PMAI");
        buf.extend_from_slice(&header_len.to_be_bytes());
        buf.extend_from_slice(&file_len.to_be_bytes());
        buf.extend_from_slice(&[0u8; 16]);
        let entries = parse_beat_grid(&buf).unwrap();
        assert!(entries.is_empty());
    }

    #[test]
    fn bad_magic_returns_error() {
        let blob = b"BADM\x00\x00\x00\x1c\x00\x00\x00\x1c".to_vec();
        assert!(parse_beat_grid(&blob).is_err());
    }

    #[test]
    fn too_short_returns_error() {
        assert!(parse_beat_grid(&[0u8; 4]).is_err());
    }
}
