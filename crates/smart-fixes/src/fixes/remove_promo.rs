use crate::{FixProposal, TrackView};
use regex::Regex;
use std::sync::OnceLock;

const PROMO_PATTERNS: &[&str] = &[
    r"(?i)\bFree Download\b",
    r"(?i)\bFREE DL\b",
    r"(?i)\[FREE\]",
    r"(?i)\(FREE\)",
    r"(?i)\bOut Now\b",
    r"(?i)\bAvailable Now\b",
    r"(?i)\bReleased\b",
    r"(?i)\bBuy Now\b",
    r"(?i)\bExclusive\b",
    r"(?i)\bPromo\b",
    r"(?i)\bBeatport Exclusive\b",
    r"(?i)\bJuno Exclusive\b",
    r"(?i)\bWAV Download\b",
];

fn compiled() -> &'static Vec<Regex> {
    static R: OnceLock<Vec<Regex>> = OnceLock::new();
    R.get_or_init(|| PROMO_PATTERNS.iter().map(|p| Regex::new(p).unwrap()).collect())
}

pub fn propose(track: &TrackView) -> Vec<FixProposal> {
    let mut out = Vec::new();
    let res = compiled();
    super::for_each_text_field(
        track,
        &["Title", "Artist", "Album", "Commnt"],
        |field, val| {
            let mut new = val.to_string();
            for re in res {
                new = re.replace_all(&new, "").to_string();
            }
            // strip empty brackets/parens left behind
            new = new
                .replace("()", "")
                .replace("[]", "")
                .replace("{}", "");
            while new.contains("  ") {
                new = new.replace("  ", " ");
            }
            let trimmed = new.trim().trim_end_matches(['-', '–', '—', ' ']).trim().to_string();
            if trimmed != val && !trimmed.is_empty() {
                out.push(FixProposal::new(
                    "remove_promo",
                    track,
                    field,
                    val,
                    &trimmed,
                ));
            }
        },
    );
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    fn tv(title: &str) -> TrackView {
        TrackView {
            id: "t".into(),
            title: Some(title.into()),
            artist: None,
            album: None,
            comment: None,
        }
    }

    #[test]
    fn strips_promo_phrase() {
        let p = propose(&tv("Song [FREE]"));
        assert_eq!(p[0].new_value, "Song");
    }

    #[test]
    fn untouched_when_clean() {
        let p = propose(&tv("Just A Song"));
        assert!(p.is_empty());
    }
}
