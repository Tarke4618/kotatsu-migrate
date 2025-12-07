const TACHIYOMI_PROTO_STRING = `
syntax = "proto3";

message Backup {
    repeated BackupManga backupManga = 1;
    repeated BackupCategory backupCategories = 2;
    repeated BackupSource backupSources = 101;
    repeated BackupPreference backupPreferences = 104;
}

message BackupManga {
    int64 source = 1;
    string url = 2;
    string title = 3;
    string artist = 4;
    string author = 5;
    string description = 6;
    repeated string genre = 7;
    int32 status = 8;
    string thumbnailUrl = 9;
    int64 lastUpdate = 10;
    int64 dateAdded = 11;
    int32 viewer = 12;
    int32 chapterFlags = 13;
    repeated int32 categories = 14;
    repeated BackupChapter backupChapters = 16;
    repeated BackupHistory backupHistory = 17;
    // Possible new fields in Mihon that confuse parser if missing?
    // repeated BackupTracking backupTracking = 30; // Sources suggest tracing is separate?
    // Actually, Tachi schema allows skipping unknown fields.
    // The index out of range 636461 + 10 > 636461 suggests reading an int64 at EOF-10?
    // Or reading a field tag that claims to be 10 bytes long?
    // If we assume a standard schema, maybe 'source' (field 1) of the LAST manga is failing?
    // Or maybe the file is just slightly truncated.
}

message BackupCategory {
    string name = 1;
    int32 order = 2;
    int32 flags = 100;
}

message BackupChapter {
    string url = 1;
    string name = 2;
    string scanlator = 3;
    bool read = 4;
    bool bookmark = 5;
    int32 lastPageRead = 6;
    int64 dateFetch = 7;
    int64 dateUpload = 8;
    float chapterNumber = 9;
    int64 sourceOrder = 10;
}

message BackupHistory {
    string url = 1;
    int64 lastRead = 2;
    int64 readDuration = 3;
}

message BackupSource {
    string name = 1;
    int64 sourceId = 2;
}

message BackupPreference {
    string key = 1;
    string value = 2; // Value heavily depends on type
}
`;
