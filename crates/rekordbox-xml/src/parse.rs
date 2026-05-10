use crate::types::{Collection, Node, PositionMark, PositionMarkType, Product, Tempo, Track};
use anyhow::{bail, Context, Result};
use roxmltree::Node as XmlNode;

pub fn parse(xml: &str) -> Result<Collection> {
    let doc = roxmltree::Document::parse(xml).context("parsing Rekordbox XML")?;
    let root = doc.root_element();
    if root.tag_name().name() != "DJ_PLAYLISTS" {
        bail!(
            "expected root element DJ_PLAYLISTS, got {}",
            root.tag_name().name()
        );
    }

    let mut collection = Collection::default();
    for child in root.children().filter(|n| n.is_element()) {
        match child.tag_name().name() {
            "PRODUCT" => collection.product = parse_product(child)?,
            "COLLECTION" => collection.tracks = parse_collection_tracks(child)?,
            "PLAYLISTS" => collection.playlists = parse_playlist_nodes(child)?,
            _ => {}
        }
    }
    Ok(collection)
}

fn parse_product(node: XmlNode<'_, '_>) -> Result<Product> {
    Ok(Product {
        name: attr(node, "Name")?.to_owned(),
        version: attr(node, "Version")?.to_owned(),
        company: attr(node, "Company")?.to_owned(),
    })
}

fn parse_collection_tracks(node: XmlNode<'_, '_>) -> Result<Vec<Track>> {
    node.children()
        .filter(|n| n.is_element() && n.tag_name().name() == "TRACK")
        .map(parse_track)
        .collect()
}

fn parse_track(node: XmlNode<'_, '_>) -> Result<Track> {
    let track_id = attr(node, "TrackID")?
        .parse::<u32>()
        .context("TrackID must be u32")?;
    let name = attr(node, "Name")?.to_owned();
    let location = attr(node, "Location")?.to_owned();

    let mut tempos = Vec::new();
    let mut position_marks = Vec::new();
    for child in node.children().filter(|n| n.is_element()) {
        match child.tag_name().name() {
            "TEMPO" => tempos.push(parse_tempo(child)?),
            "POSITION_MARK" => position_marks.push(parse_position_mark(child)?),
            _ => {}
        }
    }

    Ok(Track {
        track_id,
        name,
        location,
        artist: opt_attr(node, "Artist"),
        composer: opt_attr(node, "Composer"),
        album: opt_attr(node, "Album"),
        grouping: opt_attr(node, "Grouping"),
        genre: opt_attr(node, "Genre"),
        kind: opt_attr(node, "Kind"),
        size: opt_attr_parse(node, "Size")?,
        total_time: opt_attr_parse(node, "TotalTime")?,
        disc_number: opt_attr_parse(node, "DiscNumber")?,
        track_number: opt_attr_parse(node, "TrackNumber")?,
        year: opt_attr_parse(node, "Year")?,
        average_bpm: opt_attr_parse(node, "AverageBpm")?,
        date_added: opt_attr(node, "DateAdded"),
        bit_rate: opt_attr_parse(node, "BitRate")?,
        sample_rate: opt_attr_parse(node, "SampleRate")?,
        comments: opt_attr(node, "Comments"),
        play_count: opt_attr_parse(node, "PlayCount")?,
        rating: opt_attr_parse(node, "Rating")?,
        remixer: opt_attr(node, "Remixer"),
        tonality: opt_attr(node, "Tonality"),
        label: opt_attr(node, "Label"),
        mix: opt_attr(node, "Mix"),
        colour: opt_attr(node, "Colour"),
        tempos,
        position_marks,
    })
}

fn parse_tempo(node: XmlNode<'_, '_>) -> Result<Tempo> {
    Ok(Tempo {
        inizio: attr(node, "Inizio")?.parse().context("Inizio")?,
        bpm: attr(node, "Bpm")?.parse().context("Bpm")?,
        metro: attr(node, "Metro")?.to_owned(),
        battito: attr(node, "Battito")?.parse().context("Battito")?,
    })
}

fn parse_position_mark(node: XmlNode<'_, '_>) -> Result<PositionMark> {
    let type_val: u8 = attr(node, "Type")?.parse().context("Type")?;
    let mark_type = PositionMarkType::from_u8(type_val)
        .with_context(|| format!("unknown POSITION_MARK Type {type_val}"))?;
    Ok(PositionMark {
        name: opt_attr(node, "Name"),
        mark_type,
        start: attr(node, "Start")?.parse().context("Start")?,
        end: opt_attr_parse(node, "End")?,
        num: attr(node, "Num")?.parse().context("Num")?,
    })
}

fn parse_playlist_nodes(node: XmlNode<'_, '_>) -> Result<Vec<Node>> {
    node.children()
        .filter(|n| n.is_element() && n.tag_name().name() == "NODE")
        .map(parse_node)
        .collect()
}

fn parse_node(node: XmlNode<'_, '_>) -> Result<Node> {
    let name = attr(node, "Name")?.to_owned();
    let node_type: u8 = attr(node, "Type")?.parse().context("NODE Type")?;
    match node_type {
        0 => {
            let children: Result<Vec<_>> = node
                .children()
                .filter(|n| n.is_element() && n.tag_name().name() == "NODE")
                .map(parse_node)
                .collect();
            Ok(Node::Folder {
                name,
                children: children?,
            })
        }
        1 => {
            let key_type: u8 = opt_attr_parse(node, "KeyType")?.unwrap_or(0);
            let track_ids: Result<Vec<u32>> = node
                .children()
                .filter(|n| n.is_element() && n.tag_name().name() == "TRACK")
                .map(|t| {
                    attr(t, "Key")?
                        .parse::<u32>()
                        .context("TRACK Key must be u32")
                })
                .collect();
            Ok(Node::Playlist {
                name,
                key_type,
                track_ids: track_ids?,
            })
        }
        other => bail!("unknown NODE Type {other}"),
    }
}

// ── Helpers ────────────────────────────────────────────────────────────────

fn attr<'a>(node: XmlNode<'a, '_>, name: &str) -> Result<&'a str> {
    node.attribute(name).with_context(|| {
        format!(
            "missing required attribute {name} on <{}>",
            node.tag_name().name()
        )
    })
}

fn opt_attr(node: XmlNode<'_, '_>, name: &str) -> Option<String> {
    node.attribute(name).map(|s| s.to_owned())
}

fn opt_attr_parse<T>(node: XmlNode<'_, '_>, name: &str) -> Result<Option<T>>
where
    T: std::str::FromStr,
    T::Err: std::error::Error + Send + Sync + 'static,
{
    match node.attribute(name) {
        Some(s) if !s.is_empty() => s
            .parse::<T>()
            .map(Some)
            .with_context(|| format!("parsing attribute {name}={s:?}")),
        _ => Ok(None),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn minimal_xml(track_attrs: &str) -> String {
        format!(
            r#"<?xml version="1.0" encoding="UTF-8"?>
<DJ_PLAYLISTS Version="1.0.0">
  <PRODUCT Name="rekordbox" Version="7.0" Company="Pioneer DJ"/>
  <COLLECTION Entries="1">
    <TRACK TrackID="1" Name="Test" Location="file://localhost/music/test.mp3" {track_attrs}/>
  </COLLECTION>
  <PLAYLISTS>
    <NODE Type="0" Name="ROOT" Count="0"/>
  </PLAYLISTS>
</DJ_PLAYLISTS>"#
        )
    }

    #[test]
    fn parse_minimal_collection() {
        let xml = minimal_xml("");
        let col = parse(&xml).unwrap();
        assert_eq!(col.tracks.len(), 1);
        assert_eq!(col.tracks[0].name, "Test");
        assert_eq!(col.tracks[0].track_id, 1);
    }

    #[test]
    fn parse_optional_attrs() {
        let xml = minimal_xml(r#"Artist="DJ One" AverageBpm="128.00" Rating="255""#);
        let col = parse(&xml).unwrap();
        let t = &col.tracks[0];
        assert_eq!(t.artist.as_deref(), Some("DJ One"));
        assert!((t.average_bpm.unwrap() - 128.0).abs() < 0.001);
        assert_eq!(t.rating, Some(255));
    }

    #[test]
    fn parse_position_mark() {
        let xml = r#"<?xml version="1.0" encoding="UTF-8"?>
<DJ_PLAYLISTS Version="1.0.0">
  <PRODUCT Name="rb" Version="7.0" Company="Pioneer DJ"/>
  <COLLECTION Entries="1">
    <TRACK TrackID="1" Name="T" Location="file://localhost/t.mp3">
      <POSITION_MARK Name="Drop" Type="0" Start="32.500" Num="0"/>
      <POSITION_MARK Name="" Type="4" Start="64.000" End="96.000" Num="-1"/>
    </TRACK>
  </COLLECTION>
  <PLAYLISTS><NODE Type="0" Name="ROOT" Count="0"/></PLAYLISTS>
</DJ_PLAYLISTS>"#;
        let col = parse(xml).unwrap();
        let marks = &col.tracks[0].position_marks;
        assert_eq!(marks.len(), 2);
        assert_eq!(marks[0].mark_type, PositionMarkType::Cue);
        assert_eq!(marks[0].num, 0);
        assert_eq!(marks[1].mark_type, PositionMarkType::Loop);
        assert_eq!(marks[1].end, Some(96.0));
    }

    #[test]
    fn parse_tempo() {
        let xml = r#"<?xml version="1.0" encoding="UTF-8"?>
<DJ_PLAYLISTS Version="1.0.0">
  <PRODUCT Name="rb" Version="7.0" Company="Pioneer DJ"/>
  <COLLECTION Entries="1">
    <TRACK TrackID="1" Name="T" Location="file://localhost/t.mp3">
      <TEMPO Inizio="0.000" Bpm="132.00" Metro="4/4" Battito="1"/>
    </TRACK>
  </COLLECTION>
  <PLAYLISTS><NODE Type="0" Name="ROOT" Count="0"/></PLAYLISTS>
</DJ_PLAYLISTS>"#;
        let col = parse(xml).unwrap();
        let tempo = &col.tracks[0].tempos[0];
        assert_eq!(tempo.metro, "4/4");
        assert!((tempo.bpm - 132.0).abs() < 0.001);
    }

    #[test]
    fn parse_playlist_folder_and_playlist() {
        let xml = r#"<?xml version="1.0" encoding="UTF-8"?>
<DJ_PLAYLISTS Version="1.0.0">
  <PRODUCT Name="rb" Version="7.0" Company="Pioneer DJ"/>
  <COLLECTION Entries="0"/>
  <PLAYLISTS>
    <NODE Type="0" Name="ROOT" Count="1">
      <NODE Type="1" Name="Techno Set" Entries="2" KeyType="0">
        <TRACK Key="1"/>
        <TRACK Key="2"/>
      </NODE>
    </NODE>
  </PLAYLISTS>
</DJ_PLAYLISTS>"#;
        let col = parse(xml).unwrap();
        assert_eq!(col.playlists.len(), 1);
        if let Node::Folder { children, .. } = &col.playlists[0] {
            assert_eq!(children.len(), 1);
            if let Node::Playlist {
                name, track_ids, ..
            } = &children[0]
            {
                assert_eq!(name, "Techno Set");
                assert_eq!(track_ids, &[1, 2]);
            } else {
                panic!("expected Playlist");
            }
        } else {
            panic!("expected Folder");
        }
    }

    #[test]
    fn missing_required_attr_is_error() {
        // No Location attribute on TRACK
        let xml = r#"<?xml version="1.0" encoding="UTF-8"?>
<DJ_PLAYLISTS Version="1.0.0">
  <PRODUCT Name="rb" Version="7.0" Company="Pioneer DJ"/>
  <COLLECTION Entries="1">
    <TRACK TrackID="1" Name="T"/>
  </COLLECTION>
  <PLAYLISTS/>
</DJ_PLAYLISTS>"#;
        assert!(parse(xml).is_err());
    }

    #[test]
    fn wrong_root_element_is_error() {
        let xml = r#"<?xml version="1.0"?><WRONG/>"#;
        assert!(parse(xml).is_err());
    }
}
