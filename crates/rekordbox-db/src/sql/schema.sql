CREATE TABLE IF NOT EXISTS djmdArtist (
    ID      INTEGER PRIMARY KEY,
    Name    TEXT,
    SearchStr TEXT
);

CREATE TABLE IF NOT EXISTS djmdAlbum (
    ID              INTEGER PRIMARY KEY,
    Name            TEXT,
    AlbumArtistID   INTEGER,
    SearchStr       TEXT
);

CREATE TABLE IF NOT EXISTS djmdGenre (
    ID   INTEGER PRIMARY KEY,
    Name TEXT
);

CREATE TABLE IF NOT EXISTS djmdKey (
    ID        INTEGER PRIMARY KEY,
    ScaleName TEXT,
    Seq       INTEGER
);

CREATE TABLE IF NOT EXISTS djmdContent (
    ID                 INTEGER PRIMARY KEY,
    Title              TEXT,
    ArtistID           INTEGER,
    AlbumID            INTEGER,
    GenreID            INTEGER,
    KeyID              INTEGER,
    BPM                INTEGER,
    Length             INTEGER,
    Rating             INTEGER,
    Commnt             TEXT,
    FolderPath         TEXT,
    AnalysisDataPath   TEXT,
    FileType           INTEGER,
    SampleRate         INTEGER,
    BitRate            INTEGER,
    ReleaseYear        INTEGER,
    DJPlayCount        INTEGER,
    rb_local_deleted   INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS djmdPlaylist (
    ID        INTEGER PRIMARY KEY,
    Seq       INTEGER,
    Name      TEXT,
    Attribute INTEGER DEFAULT 0,
    ParentID  INTEGER
);

CREATE TABLE IF NOT EXISTS djmdSongPlaylist (
    ID         INTEGER PRIMARY KEY,
    PlaylistID INTEGER,
    ContentID  INTEGER,
    TrackNo    INTEGER
);

CREATE TABLE IF NOT EXISTS djmdCue (
    ID        INTEGER PRIMARY KEY,
    ContentID INTEGER,
    InMsec    INTEGER,
    OutMsec   INTEGER,
    Kind      INTEGER DEFAULT 0,
    Color     INTEGER DEFAULT -1,
    Commnt    TEXT
);
