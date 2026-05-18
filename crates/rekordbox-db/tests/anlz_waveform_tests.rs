use rekordbox_db::anlz::*;
use std::io::Write;
use std::path::PathBuf;
use tempfile::NamedTempFile;

#[test]
fn test_preview_waveform_real_fixture() {
    let path = PathBuf::from("../../fixtures/anlz/track1/ANLZ0000.EXT");
    if path.exists() {
        let preview = read_preview_waveform(&path).unwrap();
        assert_eq!(preview.len(), 1200); // PWV4 has 1200 points
    }
}

#[test]
fn test_detail_waveform_real_fixture() {
    let path = PathBuf::from("../../fixtures/anlz/track1/ANLZ0000.EXT");
    if path.exists() {
        let detail = read_detail_waveform(&path).unwrap();
        assert_eq!(detail.len(), 289); // PWV5 has 289 points for track 1
    }
}

/// Build a single ANLZ section: `tag(4) | section_header_len(4 BE) | section_total_len(4 BE) | header_pad | content`.
fn build_section(tag: &[u8; 4], header_pad: &[u8], content: &[u8]) -> Vec<u8> {
    let section_header_len = 12 + header_pad.len();
    let section_total_len = section_header_len + content.len();
    let mut out = Vec::with_capacity(section_total_len);
    out.extend_from_slice(tag);
    out.extend_from_slice(&(section_header_len as u32).to_be_bytes());
    out.extend_from_slice(&(section_total_len as u32).to_be_bytes());
    out.extend_from_slice(header_pad);
    out.extend_from_slice(content);
    out
}

/// Build a minimal PMAI-wrapped ANLZ blob containing the given sections.
fn build_anlz(sections: &[Vec<u8>]) -> Vec<u8> {
    const PMAI_HEADER_LEN: usize = 28;
    let total = PMAI_HEADER_LEN + sections.iter().map(Vec::len).sum::<usize>();
    let mut out = Vec::with_capacity(total);
    out.extend_from_slice(b"PMAI");
    out.extend_from_slice(&(PMAI_HEADER_LEN as u32).to_be_bytes());
    out.extend_from_slice(&(total as u32).to_be_bytes());
    out.extend_from_slice(&[0u8; 16]); // reserved
    for section in sections {
        out.extend_from_slice(section);
    }
    out
}

fn write_temp_anlz(data: &[u8]) -> NamedTempFile {
    let mut file = NamedTempFile::new().expect("tempfile");
    file.write_all(data).expect("write");
    file
}

#[test]
fn parses_synthetic_pwav_monochrome_preview() {
    // 1 byte per entry, encoding (color << 5) | (height & 0x1F).
    let content: Vec<u8> = (0..8).map(|i| ((i & 0x07) << 5) | (i & 0x1F)).collect();
    let blob = build_anlz(&[build_section(b"PWAV", &[], &content)]);
    let file = write_temp_anlz(&blob);
    let preview = read_preview_waveform(file.path()).expect("preview");
    assert_eq!(preview.len(), 8);
    assert_eq!(preview[0].height, 0);
    assert_eq!(preview[7].height, 7);
    assert!(matches!(preview[0].color, WaveformColor::Blue(_)));
}

#[test]
fn parses_synthetic_pwv3_monochrome_detail() {
    let content: Vec<u8> = (0..16).map(|i| ((i & 0x07) << 5) | (i & 0x1F)).collect();
    let blob = build_anlz(&[build_section(b"PWV3", &[], &content)]);
    let file = write_temp_anlz(&blob);
    let detail = read_detail_waveform(file.path()).expect("detail");
    assert_eq!(detail.len(), 16);
}

#[test]
fn parses_synthetic_pwv4_color_preview() {
    // 6 bytes per entry; bytes 3..6 are the R/G/B nibbles used by the parser.
    let mut content = Vec::new();
    for i in 0..4u8 {
        content.extend_from_slice(&[0, 0, 0, i * 10, i * 11, i * 12]);
    }
    let blob = build_anlz(&[build_section(b"PWV4", &[], &content)]);
    let file = write_temp_anlz(&blob);
    let preview = read_preview_waveform(file.path()).expect("preview");
    assert_eq!(preview.len(), 4);
    assert!(matches!(preview[1].color, WaveformColor::Rgb(_, _, _)));
}

#[test]
fn parses_synthetic_pwv5_color_detail() {
    // 2 bytes per entry, big-endian u16 packed RGB+height.
    let mut content = Vec::new();
    for i in 0..6u16 {
        content.extend_from_slice(&(0x1234u16 | i).to_be_bytes());
    }
    let blob = build_anlz(&[build_section(b"PWV5", &[], &content)]);
    let file = write_temp_anlz(&blob);
    let detail = read_detail_waveform(file.path()).expect("detail");
    assert_eq!(detail.len(), 6);
    assert!(matches!(detail[0].color, WaveformColor::Rgb(_, _, _)));
}

#[test]
fn pwv5_preferred_over_pwv3_for_detail() {
    let pwv3 = build_section(b"PWV3", &[], &[0u8; 4]);
    let pwv5_content: Vec<u8> = (0..10u8).collect(); // 5 PWV5 entries
    let pwv5 = build_section(b"PWV5", &[], &pwv5_content);
    let blob = build_anlz(&[pwv3, pwv5]);
    let file = write_temp_anlz(&blob);
    let detail = read_detail_waveform(file.path()).expect("detail");
    // PWV5 wins over PWV3 — 5 entries, not 4.
    assert_eq!(detail.len(), 5);
}
