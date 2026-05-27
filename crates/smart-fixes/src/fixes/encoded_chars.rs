use crate::{FixProposal, TrackView};

const HTML_ENTITY_REPLACEMENTS: &[(&str, &str)] = &[
    ("&amp;", "&"),
    ("&apos;", "'"),
    ("&#39;", "'"),
    ("&quot;", "\""),
    ("&lt;", "<"),
    ("&gt;", ">"),
    ("&nbsp;", " "),
];

const MOJIBAKE_REPLACEMENTS: &[(&str, &str)] = &[
    ("â€™", "'"),
    ("â€œ", "\""),
    ("â€\u{009d}", "\""),
    ("â€“", "–"),
    ("â€”", "—"),
    ("Ã©", "é"),
    ("Ã¨", "è"),
    ("Ã ", "à"),
];

pub fn propose(track: &TrackView) -> Vec<FixProposal> {
    let mut out = Vec::new();
    super::for_each_text_field(
        track,
        &["Title", "Artist", "Album", "Commnt"],
        |field, val| {
            let mut new = val.to_string();
            for (from, to) in HTML_ENTITY_REPLACEMENTS
                .iter()
                .chain(MOJIBAKE_REPLACEMENTS.iter())
            {
                if new.contains(from) {
                    new = new.replace(from, to);
                }
            }
            if new != val {
                out.push(FixProposal::new(
                    "fix_encoded_chars",
                    track,
                    field,
                    val,
                    &new,
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
    fn html_entities_decoded() {
        let p = propose(&tv("Rock &amp; Roll"));
        assert_eq!(p[0].new_value, "Rock & Roll");
    }

    #[test]
    fn mojibake_em_dash() {
        let p = propose(&tv("End â€” Times"));
        assert_eq!(p[0].new_value, "End — Times");
    }
}
