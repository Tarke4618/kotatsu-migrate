const TACHIYOMI_PROTO_STRING = `
syntax = "proto2";

message Backup {
  repeated BackupManga backupManga = 1;
  repeated BackupCategory backupCategories = 2;
  repeated BackupSource backupSources = 101;
  repeated BackupPreference backupPreferences = 104;
}

message BackupCategory {
  required string name = 1;
  optional int64 order = 2;
  optional int64 flags = 100;
}

message BackupChapter {
  required string url = 1;
  required string name = 2;
  optional string scanlator = 3;
  optional bool read = 4;
  optional bool bookmark = 5;
  optional int64 lastPageRead = 6;
  optional int64 dateFetch = 7;
  optional int64 dateUpload = 8;
  optional float chapterNumber = 9;
  optional int64 sourceOrder = 10;
}

message BackupHistory {
  required string url = 1;
  required int64 lastRead = 2;
  optional int64 readDuration = 3;
}

message BackupManga {
  required int64 source = 1;
  required string url = 2;
  optional string title = 3;
  optional string artist = 4;
  optional string author = 5;
  optional string description = 6;
  repeated string genre = 7;
  optional int32 status = 8;
  optional string thumbnailUrl = 9;
  optional int64 dateAdded = 13;
  optional int32 viewer = 14;
  repeated BackupChapter chapters = 16;
  repeated int64 categories = 17;
  repeated BackupTracking tracking = 18;
  optional bool favorite = 100;
  optional int32 chapterFlags = 101;
  optional int32 viewer_flags = 103;
  repeated BackupHistory history = 104;
  optional int32 updateStrategy = 105;
}

message BackupSource {
  optional string name = 1;
  required int64 sourceId = 2;
}

message BackupTracking {
  required int32 syncId = 1;
  required int64 libraryId = 2;
  optional int32 mediaIdInt = 3;
  optional string trackingUrl = 4;
  optional string title = 5;
  optional float lastChapterRead = 6;
  optional int32 totalChapters = 7;
  optional float score = 8;
  optional int32 status = 9;
  optional int64 startedReadingDate = 10;
  optional int64 finishedReadingDate = 11;
  optional int64 mediaId = 100;
}

message BackupPreference {
  required string key = 1;
  required string value = 2; 
}
`;
