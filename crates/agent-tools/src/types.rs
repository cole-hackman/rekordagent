use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "tool", rename_all = "snake_case")]
pub enum ToolRequest {
    LibrarySearch {
        library_path: String,
        query: String,
        limit: Option<usize>,
    },
    LibraryGetTrack {
        library_path: String,
        id: String,
    },
    LibraryListPlaylists {
        library_path: String,
    },
    LibraryGetPlaylist {
        library_path: String,
        id: String,
    },
    LibraryListCues {
        library_path: String,
        track_id: String,
    },
    HealthOrphanScan {
        library_path: String,
    },
    HealthDuplicateScan {
        library_path: String,
    },
    HealthBrokenLinkScan {
        library_path: String,
    },
    StagingListChanges {
        library_path: Option<String>,
    },
    ExportAcceptedChanges {
        library_path: String,
        output_path: String,
    },
}
