use crate::types::{Collection, Node, PositionMark, Tempo, Track};
use anyhow::Result;
use quick_xml::{
    events::{BytesDecl, BytesEnd, BytesStart, BytesText, Event},
    Writer,
};

pub fn to_xml(collection: &Collection) -> Result<String> {
    let mut buf = Vec::new();
    let mut w = Writer::new_with_indent(&mut buf, b' ', 2);

    w.write_event(Event::Decl(BytesDecl::new("1.0", Some("UTF-8"), None)))?;

    // <DJ_PLAYLISTS Version="1.0.0">
    let mut root = BytesStart::new("DJ_PLAYLISTS");
    root.push_attribute(("Version", "1.0.0"));
    w.write_event(Event::Start(root))?;

    // <PRODUCT …/>
    {
        let mut prod = BytesStart::new("PRODUCT");
        prod.push_attribute(("Name", collection.product.name.as_str()));
        prod.push_attribute(("Version", collection.product.version.as_str()));
        prod.push_attribute(("Company", collection.product.company.as_str()));
        w.write_event(Event::Empty(prod))?;
    }

    // <COLLECTION Entries="N"> … </COLLECTION>
    {
        let mut col_el = BytesStart::new("COLLECTION");
        col_el.push_attribute(("Entries", collection.tracks.len().to_string().as_str()));
        w.write_event(Event::Start(col_el))?;
        for track in &collection.tracks {
            write_track(&mut w, track)?;
        }
        w.write_event(Event::End(BytesEnd::new("COLLECTION")))?;
    }

    // <PLAYLISTS> … </PLAYLISTS>
    {
        w.write_event(Event::Start(BytesStart::new("PLAYLISTS")))?;
        for node in &collection.playlists {
            write_node(&mut w, node)?;
        }
        w.write_event(Event::End(BytesEnd::new("PLAYLISTS")))?;
    }

    w.write_event(Event::End(BytesEnd::new("DJ_PLAYLISTS")))?;
    // trailing newline
    w.write_event(Event::Text(BytesText::new("\n")))?;

    Ok(String::from_utf8(buf)?)
}

fn write_track<W: std::io::Write>(w: &mut Writer<W>, t: &Track) -> Result<()> {
    let mut el = BytesStart::new("TRACK");
    el.push_attribute(("TrackID", t.track_id.to_string().as_str()));
    el.push_attribute(("Name", t.name.as_str()));
    el.push_attribute(("Location", t.location.as_str()));
    opt_attr(&mut el, "Artist", &t.artist);
    opt_attr(&mut el, "Composer", &t.composer);
    opt_attr(&mut el, "Album", &t.album);
    opt_attr(&mut el, "Grouping", &t.grouping);
    opt_attr(&mut el, "Genre", &t.genre);
    opt_attr(&mut el, "Kind", &t.kind);
    opt_attr_display(&mut el, "Size", &t.size);
    opt_attr_display(&mut el, "TotalTime", &t.total_time);
    opt_attr_display(&mut el, "DiscNumber", &t.disc_number);
    opt_attr_display(&mut el, "TrackNumber", &t.track_number);
    opt_attr_display(&mut el, "Year", &t.year);
    if let Some(bpm) = t.average_bpm {
        el.push_attribute(("AverageBpm", format!("{bpm:.2}").as_str()));
    }
    opt_attr(&mut el, "DateAdded", &t.date_added);
    opt_attr_display(&mut el, "BitRate", &t.bit_rate);
    opt_attr_display(&mut el, "SampleRate", &t.sample_rate);
    opt_attr(&mut el, "Comments", &t.comments);
    opt_attr_display(&mut el, "PlayCount", &t.play_count);
    opt_attr_display(&mut el, "Rating", &t.rating);
    opt_attr(&mut el, "Remixer", &t.remixer);
    opt_attr(&mut el, "Tonality", &t.tonality);
    opt_attr(&mut el, "Label", &t.label);
    opt_attr(&mut el, "Mix", &t.mix);
    opt_attr(&mut el, "Colour", &t.colour);

    if t.tempos.is_empty() && t.position_marks.is_empty() {
        w.write_event(Event::Empty(el))?;
    } else {
        w.write_event(Event::Start(el))?;
        for tempo in &t.tempos {
            write_tempo(w, tempo)?;
        }
        for pm in &t.position_marks {
            write_position_mark(w, pm)?;
        }
        w.write_event(Event::End(BytesEnd::new("TRACK")))?;
    }
    Ok(())
}

fn write_tempo<W: std::io::Write>(w: &mut Writer<W>, t: &Tempo) -> Result<()> {
    let mut el = BytesStart::new("TEMPO");
    el.push_attribute(("Inizio", format!("{:.3}", t.inizio).as_str()));
    el.push_attribute(("Bpm", format!("{:.2}", t.bpm).as_str()));
    el.push_attribute(("Metro", t.metro.as_str()));
    el.push_attribute(("Battito", t.battito.to_string().as_str()));
    w.write_event(Event::Empty(el))?;
    Ok(())
}

fn write_position_mark<W: std::io::Write>(w: &mut Writer<W>, pm: &PositionMark) -> Result<()> {
    let mut el = BytesStart::new("POSITION_MARK");
    opt_attr(&mut el, "Name", &pm.name);
    el.push_attribute(("Type", pm.mark_type.as_u8().to_string().as_str()));
    el.push_attribute(("Start", format!("{:.3}", pm.start).as_str()));
    if let Some(end) = pm.end {
        el.push_attribute(("End", format!("{end:.3}").as_str()));
    }
    el.push_attribute(("Num", pm.num.to_string().as_str()));
    w.write_event(Event::Empty(el))?;
    Ok(())
}

fn write_node<W: std::io::Write>(w: &mut Writer<W>, node: &Node) -> Result<()> {
    match node {
        Node::Folder { name, children } => {
            let mut el = BytesStart::new("NODE");
            el.push_attribute(("Type", "0"));
            el.push_attribute(("Name", name.as_str()));
            el.push_attribute(("Count", children.len().to_string().as_str()));
            if children.is_empty() {
                w.write_event(Event::Empty(el))?;
            } else {
                w.write_event(Event::Start(el))?;
                for child in children {
                    write_node(w, child)?;
                }
                w.write_event(Event::End(BytesEnd::new("NODE")))?;
            }
        }
        Node::Playlist { name, key_type, track_ids } => {
            let mut el = BytesStart::new("NODE");
            el.push_attribute(("Type", "1"));
            el.push_attribute(("Name", name.as_str()));
            el.push_attribute(("Entries", track_ids.len().to_string().as_str()));
            el.push_attribute(("KeyType", key_type.to_string().as_str()));
            if track_ids.is_empty() {
                w.write_event(Event::Empty(el))?;
            } else {
                w.write_event(Event::Start(el))?;
                for id in track_ids {
                    let mut t = BytesStart::new("TRACK");
                    t.push_attribute(("Key", id.to_string().as_str()));
                    w.write_event(Event::Empty(t))?;
                }
                w.write_event(Event::End(BytesEnd::new("NODE")))?;
            }
        }
    }
    Ok(())
}

// ── Helpers ────────────────────────────────────────────────────────────────

fn opt_attr(el: &mut BytesStart, name: &str, val: &Option<String>) {
    if let Some(s) = val {
        el.push_attribute((name, s.as_str()));
    }
}

fn opt_attr_display<T: std::fmt::Display>(el: &mut BytesStart, name: &str, val: &Option<T>) {
    if let Some(v) = val {
        el.push_attribute((name, v.to_string().as_str()));
    }
}


#[cfg(test)]
mod tests {
    use super::*;
    use crate::types::{Collection, Node, PositionMark, PositionMarkType, Product, Tempo, Track};

    fn sample_collection() -> Collection {
        Collection {
            product: Product {
                name: "decks".into(),
                version: "0.1.0".into(),
                company: "decks contributors".into(),
            },
            tracks: vec![Track {
                track_id: 1,
                name: "Test & Track".into(),
                location: "file://localhost/music/test.mp3".into(),
                artist: Some("DJ One".into()),
                average_bpm: Some(128.0),
                rating: Some(255),
                tempos: vec![Tempo {
                    inizio: 0.0,
                    bpm: 128.0,
                    metro: "4/4".into(),
                    battito: 1,
                }],
                position_marks: vec![PositionMark {
                    name: Some("Drop".into()),
                    mark_type: PositionMarkType::Cue,
                    start: 32.5,
                    end: None,
                    num: 0,
                }],
                ..Default::default()
            }],
            playlists: vec![Node::Folder {
                name: "ROOT".into(),
                children: vec![Node::Playlist {
                    name: "Techno Set".into(),
                    key_type: 0,
                    track_ids: vec![1],
                }],
            }],
        }
    }

    #[test]
    fn emits_valid_xml() {
        let xml = to_xml(&sample_collection()).unwrap();
        assert!(xml.starts_with("<?xml"));
        assert!(xml.contains("<DJ_PLAYLISTS"));
        assert!(xml.contains("<TRACK"));
        assert!(xml.contains("AverageBpm=\"128.00\""));
        // quick-xml escapes & → &amp; in attribute values automatically
        assert!(xml.contains("&amp;"), "ampersand should be escaped in XML");
    }

    #[test]
    fn emits_tempo_and_position_mark() {
        let xml = to_xml(&sample_collection()).unwrap();
        assert!(xml.contains("<TEMPO"));
        assert!(xml.contains("Metro=\"4/4\""));
        assert!(xml.contains("<POSITION_MARK"));
        assert!(xml.contains("Start=\"32.500\""));
    }

    #[test]
    fn emits_playlist_structure() {
        let xml = to_xml(&sample_collection()).unwrap();
        assert!(xml.contains("Type=\"0\""));
        assert!(xml.contains("Type=\"1\""));
        assert!(xml.contains("Techno Set"));
        assert!(xml.contains("Key=\"1\""));
    }
}
