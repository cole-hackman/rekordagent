//! Target: Title contains a remix attribution but track has no Remixer field
//! recorded. We don't have a Remixer column on `djmdContent` in our schema,
//! so this proposal only normalises the Title: strip the parenthetical when
//! a remixer pattern is detected, leaving the cleaner title.
//!
//! The actual Remixer write-back can be added when the schema supports it.

use crate::{FixProposal, TrackView};
use regex::Regex;
use std::sync::OnceLock;

fn pattern() -> &'static Regex {
    static R: OnceLock<Regex> = OnceLock::new();
    R.get_or_init(|| {
        Regex::new(
            r"(?i)\s*[\(\[]\s*([^\(\)\[\]]+?)\s+(remix|edit|re[- ]edit|bootleg|vip)\s*[\)\]]\s*$",
        )
        .unwrap()
    })
}

pub fn propose(track: &TrackView) -> Vec<FixProposal> {
    let title = match track.title.as_deref() {
        Some(t) if !t.is_empty() => t,
        _ => return Vec::new(),
    };
    let re = pattern();
    if let Some(m) = re.find(title) {
        let stripped = title[..m.start()].trim_end().to_string();
        if !stripped.is_empty() && stripped != title {
            return vec![FixProposal::new(
                "extract_remixer",
                track,
                "Title",
                title,
                &stripped,
            )];
        }
    }
    Vec::new()
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
    fn strips_remix_parenthetical() {
        let p = propose(&tv("Song (Joe Remix)"));
        assert_eq!(p[0].new_value, "Song");
    }

    #[test]
    fn brackets_also_work() {
        let p = propose(&tv("Song [DJ X Edit]"));
        assert_eq!(p[0].new_value, "Song");
    }

    #[test]
    fn untouched_when_no_remix_suffix() {
        let p = propose(&tv("Just a Song"));
        assert!(p.is_empty());
    }
}
