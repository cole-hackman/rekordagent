//! CSV-to-`MatchInput` parsing for the Track Matcher UI.
//!
//! Accepts arbitrary CSV with a header row; the caller specifies which header
//! names map to title (required) and artist (optional). Extra columns are
//! ignored. Rows with an empty title are skipped.

use crate::MatchInput;
use anyhow::{anyhow, Result};

pub fn parse_csv(
    input: &str,
    title_col: &str,
    artist_col: Option<&str>,
) -> Result<Vec<MatchInput>> {
    let mut rdr = csv::Reader::from_reader(input.as_bytes());
    let headers = rdr.headers()?.clone();
    let title_idx = headers
        .iter()
        .position(|h| h == title_col)
        .ok_or_else(|| anyhow!("missing title column: {}", title_col))?;
    let artist_idx = artist_col.and_then(|c| headers.iter().position(|h| h == c));

    let mut out = Vec::new();
    for rec in rdr.records() {
        let rec = rec?;
        let title = rec.get(title_idx).unwrap_or("").trim().to_string();
        if title.is_empty() {
            continue;
        }
        let artist = artist_idx
            .and_then(|i| rec.get(i).map(|s| s.trim().to_string()))
            .filter(|s| !s.is_empty());
        out.push(MatchInput { title, artist });
    }
    Ok(out)
}

/// Return just the header row from a CSV string. Useful for the UI when it
/// wants to populate column-picker dropdowns before committing to a mapping.
pub fn parse_headers(input: &str) -> Result<Vec<String>> {
    let mut rdr = csv::Reader::from_reader(input.as_bytes());
    let headers = rdr.headers()?.clone();
    Ok(headers.iter().map(|s| s.to_string()).collect())
}
