use crate::{FixProposal, TrackView};
use regex::Regex;
use std::sync::OnceLock;

// Wrap a known-mix suffix when it appears at end of title and is NOT already
// enclosed in () or [].
fn suffix_re() -> &'static Regex {
    static R: OnceLock<Regex> = OnceLock::new();
    R.get_or_init(|| {
        Regex::new(
            r"(?i)\s+([A-Za-z0-9'’\- ]*?(?:Original Mix|Extended Mix|Radio Edit|Club Mix|Dub Mix|Instrumental|Acapella|VIP|Bootleg|Remix|Edit|Mix))\s*$",
        )
        .unwrap()
    })
}

pub fn propose(track: &TrackView) -> Vec<FixProposal> {
    let title = match track.title.as_deref() {
        Some(t) if !t.is_empty() => t,
        _ => return Vec::new(),
    };
    let trimmed = title.trim_end();
    if trimmed.ends_with(')') || trimmed.ends_with(']') {
        return Vec::new();
    }
    let re = suffix_re();
    if let Some(caps) = re.captures(trimmed) {
        let whole = caps.get(0).unwrap();
        let suffix = caps.get(1).unwrap().as_str().trim();
        let base = trimmed[..whole.start()].trim_end();
        if base.is_empty() {
            return Vec::new();
        }
        let new_title = format!("{base} ({suffix})");
        if new_title != title {
            return vec![FixProposal::new(
                "add_mix_parens",
                track,
                "Title",
                title,
                &new_title,
            )];
        }
    }
    Vec::new()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn tv(t: &str) -> TrackView {
        TrackView {
            id: "t".into(),
            title: Some(t.into()),
            artist: None,
            album: None,
            comment: None,
        }
    }

    #[test]
    fn wraps_original_mix() {
        let p = propose(&tv("Song Original Mix"));
        assert_eq!(p[0].new_value, "Song (Original Mix)");
    }

    #[test]
    fn leaves_already_parenthesized() {
        let p = propose(&tv("Song (Original Mix)"));
        assert!(p.is_empty());
    }

    #[test]
    fn wraps_artist_remix() {
        let p = propose(&tv("Song DJ X Remix"));
        assert_eq!(p[0].new_value, "Song (DJ X Remix)");
    }
}
