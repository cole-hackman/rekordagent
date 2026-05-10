/// Convert a `file://localhost/...` URI to an OS path string.
pub fn location_to_path(location: &str) -> String {
    let s = location
        .strip_prefix("file://localhost")
        .unwrap_or(location);
    percent_decode(s)
}

/// Convert an OS file path to a `file://localhost/...` URI.
pub fn path_to_location(path: &str) -> String {
    // Normalise Windows backslashes.
    let forward = path.replace('\\', "/");
    // Ensure leading slash for absolute paths on all platforms.
    let with_slash = if forward.starts_with('/') {
        forward
    } else {
        format!("/{forward}")
    };
    format!("file://localhost{}", percent_encode(&with_slash))
}

fn percent_encode(s: &str) -> String {
    let mut out = String::with_capacity(s.len());
    for b in s.bytes() {
        match b {
            // unreserved + path chars safe to leave as-is
            b'A'..=b'Z'
            | b'a'..=b'z'
            | b'0'..=b'9'
            | b'-'
            | b'_'
            | b'.'
            | b'~'
            | b'/'
            | b':'
            | b'@'
            | b'!'
            | b'$'
            | b'&'
            | b'\''
            | b'('
            | b')'
            | b'*'
            | b'+'
            | b','
            | b';'
            | b'=' => out.push(b as char),
            _ => {
                use std::fmt::Write;
                write!(out, "%{b:02X}").unwrap();
            }
        }
    }
    out
}

fn percent_decode(s: &str) -> String {
    let bytes = s.as_bytes();
    let mut out = Vec::with_capacity(bytes.len());
    let mut i = 0;
    while i < bytes.len() {
        if bytes[i] == b'%' && i + 2 < bytes.len() {
            if let (Some(hi), Some(lo)) = (
                hex_digit(bytes[i + 1]),
                hex_digit(bytes[i + 2]),
            ) {
                out.push((hi << 4) | lo);
                i += 3;
                continue;
            }
        }
        out.push(bytes[i]);
        i += 1;
    }
    String::from_utf8_lossy(&out).into_owned()
}

fn hex_digit(b: u8) -> Option<u8> {
    match b {
        b'0'..=b'9' => Some(b - b'0'),
        b'A'..=b'F' => Some(b - b'A' + 10),
        b'a'..=b'f' => Some(b - b'a' + 10),
        _ => None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn roundtrip_simple_path() {
        let path = "/Users/dj/Music/track.mp3";
        assert_eq!(location_to_path(&path_to_location(path)), path);
    }

    #[test]
    fn encodes_spaces() {
        let path = "/Users/dj/My Music/track.mp3";
        let loc = path_to_location(path);
        assert!(loc.contains("%20"));
        assert_eq!(location_to_path(&loc), path);
    }

    #[test]
    fn windows_backslashes_normalised() {
        let path = "C:\\Music\\track.mp3";
        let loc = path_to_location(path);
        assert!(loc.starts_with("file://localhost/C:"));
        assert!(!loc.contains('\\'));
    }

    #[test]
    fn decode_percent_encoded() {
        let loc = "file://localhost/path/with%20space/track.mp3";
        assert_eq!(location_to_path(loc), "/path/with space/track.mp3");
    }

    #[test]
    fn non_localhost_uri_passthrough() {
        // if there's no localhost prefix, return as-is
        let loc = "/already/a/path";
        assert_eq!(location_to_path(loc), "/already/a/path");
    }
}
