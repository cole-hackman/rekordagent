use crate::{FixProposal, TrackView};
use regex::Regex;
use std::sync::OnceLock;

fn url_re() -> &'static Regex {
    static R: OnceLock<Regex> = OnceLock::new();
    R.get_or_init(|| {
        Regex::new(
            r"(?i)(https?://\S+|www\.\S+|\b[\w.-]+@[\w-]+\.[\w.-]+\b|\b[\w-]+\.(?:com|net|org|io|fm|tv|co|me)\b\S*)",
        )
        .unwrap()
    })
}

pub fn propose(track: &TrackView) -> Vec<FixProposal> {
    let mut out = Vec::new();
    let re = url_re();
    super::for_each_text_field(
        track,
        &["Title", "Artist", "Album", "Commnt"],
        |field, val| {
            if !re.is_match(val) {
                return;
            }
            // Strip the URL plus any surrounding brackets if the URL was the
            // sole content inside them.
            let stripped = re.replace_all(val, "").to_string();
            let stripped = stripped
                .replace("()", "")
                .replace("[]", "")
                .replace("{}", "");
            let mut collapsed = stripped;
            while collapsed.contains("  ") {
                collapsed = collapsed.replace("  ", " ");
            }
            let trimmed = collapsed.trim().to_string();
            if trimmed != val && !trimmed.is_empty() {
                out.push(FixProposal::new("remove_urls", track, field, val, &trimmed));
            }
        },
    );
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    fn tv(field: &str, v: &str) -> TrackView {
        TrackView {
            id: "t".into(),
            title: if field == "Title" {
                Some(v.into())
            } else {
                None
            },
            artist: None,
            album: None,
            comment: if field == "Commnt" {
                Some(v.into())
            } else {
                None
            },
        }
    }

    #[test]
    fn strips_https_url() {
        let p = propose(&tv("Commnt", "Buy at https://example.com/foo"));
        assert!(p[0].new_value.contains("Buy at"));
        assert!(!p[0].new_value.contains("https"));
    }

    #[test]
    fn strips_email() {
        let p = propose(&tv("Commnt", "Send to foo@bar.com please"));
        assert!(!p[0].new_value.contains("foo@bar.com"));
    }
}
