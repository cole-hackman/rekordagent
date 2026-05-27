pub mod add_mix_parens;
pub mod casing;
pub mod encoded_chars;
pub mod extract_artist;
pub mod extract_remixer;
pub mod remove_common_text;
pub mod remove_garbage;
pub mod remove_number_prefix;
pub mod remove_promo;
pub mod remove_urls;
pub mod replace_with_space;

/// Iterate the four standard text fields with a closure. Skips empty / None.
pub(crate) fn for_each_text_field<F: FnMut(&str, &str)>(
    track: &crate::TrackView,
    fields: &[&str],
    mut f: F,
) {
    for &field in fields {
        let value = match field {
            "Title" => track.title.as_deref(),
            "Artist" => track.artist.as_deref(),
            "Album" => track.album.as_deref(),
            "Commnt" => track.comment.as_deref(),
            _ => None,
        };
        if let Some(v) = value {
            if !v.is_empty() {
                f(field, v);
            }
        }
    }
}
