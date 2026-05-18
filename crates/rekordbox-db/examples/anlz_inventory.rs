use anyhow::{Context, Result};
use std::fs;
use std::path::{Path, PathBuf};

const PMAI_MAGIC: &[u8; 4] = b"PMAI";

fn dump_sections(path: &Path) -> Result<()> {
    let data = fs::read(path).with_context(|| format!("reading ANLZ file {}", path.display()))?;

    if data.len() < 12 || &data[0..4] != PMAI_MAGIC {
        println!(
            "  {}: invalid magic or too short",
            path.file_name().unwrap().to_string_lossy()
        );
        return Ok(());
    }

    let header_len = u32::from_be_bytes(data[4..8].try_into().unwrap()) as usize;
    println!(
        "  {}: header_len={}",
        path.file_name().unwrap().to_string_lossy(),
        header_len
    );

    let mut pos = header_len;
    while pos + 12 <= data.len() {
        let tag = &data[pos..pos + 4];
        let section_total_len =
            u32::from_be_bytes(data[pos + 8..pos + 12].try_into().unwrap()) as usize;

        if section_total_len == 0 {
            break;
        }

        let tag_str = String::from_utf8_lossy(tag);
        println!("    - {} (len: {})", tag_str, section_total_len);

        pos += section_total_len;
    }

    Ok(())
}

fn main() -> Result<()> {
    println!("ANLZ Inventory Dump\n");
    let tracks = vec!["track1", "track2", "track3", "track4", "track5"];
    let exts = vec!["DAT", "EXT", "2EX", "3EX"];

    for track in tracks {
        println!("{}:", track);
        for ext in &exts {
            let file_name = format!("ANLZ0000.{}", ext);
            let path = PathBuf::from("../../fixtures/anlz")
                .join(track)
                .join(&file_name);
            if path.exists() {
                if let Err(e) = dump_sections(&path) {
                    println!("  {}: Error - {}", file_name, e);
                }
            } else {
                println!("  {}: (not found)", file_name);
            }
        }
        println!();
    }

    Ok(())
}
