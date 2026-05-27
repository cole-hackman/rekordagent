use crate::{FixProposal, TrackView};

/// Strips control chars, U+FFFD replacement, zero-width spaces, soft hyphens,
/// LRM/RLM marks, and collapses runs of `!`, `?`, `.`.
pub fn propose(track: &TrackView) -> Vec<FixProposal> {
    let mut out = Vec::new();
    super::for_each_text_field(
        track,
        &["Title", "Artist", "Album", "Commnt"],
        |field, val| {
            let mut new = val
                .chars()
                .filter(|&c| {
                    c != '\u{FFFD}'      // replacement
                        && c != '\u{200B}'   // zero-width space
                        && c != '\u{200C}'   // zero-width non-joiner
                        && c != '\u{200D}'   // zero-width joiner
                        && c != '\u{00AD}'   // soft hyphen
                        && c != '\u{200E}'   // LRM
                        && c != '\u{200F}'   // RLM
                        && !(c.is_control() && c != '\n' && c != '\t')
                })
                .collect::<String>();
            for p in ['!', '?'] {
                let runs = format!("{p}{p}");
                while new.contains(&runs) {
                    new = new.replace(&runs, &p.to_string());
                }
            }
            if new != val {
                out.push(FixProposal::new(
                    "remove_garbage",
                    track,
                    field,
                    val,
                    new.trim(),
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
    fn strips_replacement_char() {
        let p = propose(&tv("Bad\u{FFFD}Title"));
        assert_eq!(p[0].new_value, "BadTitle");
    }

    #[test]
    fn collapses_repeated_punctuation() {
        let p = propose(&tv("Yes!!!"));
        assert_eq!(p[0].new_value, "Yes!");
    }
}
