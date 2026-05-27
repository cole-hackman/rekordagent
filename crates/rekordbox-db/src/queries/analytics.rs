use crate::types::LibraryAnalytics;
use anyhow::Result;
use rusqlite::Connection;
use std::collections::HashMap;

pub fn library_analytics(conn: &Connection) -> Result<LibraryAnalytics> {
    // Real Rekordbox 7 stores Genre and Key as FK IDs; join through djmdGenre /
    // djmdKey to recover their string names (matches the pattern in queries::tracks).
    let mut stmt = conn.prepare(
        "SELECT
            g.Name                  AS Genre,
            CAST(c.BPM AS INTEGER)  AS BPM,
            k.ScaleName             AS MusicKey
         FROM djmdContent c
         LEFT JOIN djmdGenre g ON c.GenreID = g.ID
         LEFT JOIN djmdKey   k ON c.KeyID   = k.ID
         WHERE (c.rb_local_deleted IS NULL OR c.rb_local_deleted = 0)",
    )?;

    let mut genre_distribution: HashMap<String, usize> = HashMap::new();
    let mut bpm_histogram: HashMap<u16, usize> = HashMap::new();
    let mut key_distribution: HashMap<String, usize> = HashMap::new();
    let mut total_tracks = 0;

    let rows = stmt.query_map([], |row| {
        let genre: Option<String> = row.get(0)?;
        // BPM in DB is stored as BPM * 100 (integer)
        let bpm_x100: Option<i64> = row.get(1)?;
        let key: Option<String> = row.get(2)?;
        Ok((genre, bpm_x100, key))
    })?;

    for (genre, bpm_x100, key) in rows.flatten() {
        total_tracks += 1;

        if let Some(g) = genre {
            let g = g.trim();
            if !g.is_empty() {
                *genre_distribution.entry(g.to_string()).or_default() += 1;
            }
        }

        if let Some(bpm_val) = bpm_x100 {
            if bpm_val > 0 {
                let bpm_floor = (bpm_val as f64 / 100.0).floor() as u16;
                *bpm_histogram.entry(bpm_floor).or_default() += 1;
            }
        }

        if let Some(k) = key {
            let k = k.trim();
            if !k.is_empty() {
                *key_distribution.entry(k.to_string()).or_default() += 1;
            }
        }
    }

    Ok(LibraryAnalytics {
        total_tracks,
        genre_distribution,
        bpm_histogram,
        key_distribution,
    })
}
