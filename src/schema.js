// src/schema.js - Complete Mihon Protobuf Schema (from official source)
// https://github.com/mihonapp/mihon/tree/main/app/src/main/java/eu/kanade/tachiyomi/data/backup/models

const MIHON_PROTO_SCHEMA = `
syntax = "proto2";

message Backup {
  repeated BackupManga backupManga = 1;
  repeated BackupCategory backupCategories = 2;
  repeated BackupSource backupSources = 101;
  repeated BackupPreference backupPreferences = 104;
  repeated BackupSourcePreferences backupSourcePreferences = 105;
  repeated BackupExtensionRepos backupExtensionRepo = 106;
}

message BackupManga {
  optional int64 source = 1;
  optional string url = 2;
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
  optional int64 lastModifiedAt = 106;
  optional int64 favoriteModifiedAt = 107;
  repeated string excludedScanlators = 108;
  optional int64 version = 109;
  optional string notes = 110;
  optional bool initialized = 111;
}

message BackupCategory {
  optional string name = 1;
  optional int64 order = 2;
  optional int64 id = 3;
  optional int64 flags = 100;
}

message BackupChapter {
  optional string url = 1;
  optional string name = 2;
  optional string scanlator = 3;
  optional bool read = 4;
  optional bool bookmark = 5;
  optional int64 lastPageRead = 6;
  optional int64 dateFetch = 7;
  optional int64 dateUpload = 8;
  optional float chapterNumber = 9;
  optional int64 sourceOrder = 10;
  optional int64 lastModifiedAt = 11;
  optional int64 version = 12;
}

message BackupHistory {
  optional string url = 1;
  optional int64 lastRead = 2;
  optional int64 readDuration = 3;
}

message BackupSource {
  optional string name = 1;
  optional int64 sourceId = 2;
}

message BackupTracking {
  optional int32 syncId = 1;
  optional int64 libraryId = 2;
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
  optional string key = 1;
  // PreferenceValue is polymorphic - use oneof to handle all types
  oneof value {
    IntPreferenceValue intValue = 2;
    LongPreferenceValue longValue = 3;
    FloatPreferenceValue floatValue = 4;
    StringPreferenceValue stringValue = 5;
    BooleanPreferenceValue boolValue = 6;
    StringSetPreferenceValue stringSetValue = 7;
  }
}

message IntPreferenceValue {
  optional int32 value = 1;
}

message LongPreferenceValue {
  optional int64 value = 1;
}

message FloatPreferenceValue {
  optional float value = 1;
}

message StringPreferenceValue {
  optional string value = 1;
}

message BooleanPreferenceValue {
  optional bool value = 1;
}

message StringSetPreferenceValue {
  repeated string value = 1;
}

message BackupSourcePreferences {
  optional string sourceKey = 1;
  repeated BackupPreference prefs = 2;
}

message BackupExtensionRepos {
  optional string baseUrl = 1;
  optional string name = 2;
  optional string shortName = 3;
  optional string website = 4;
  optional string signingKeyFingerprint = 5;
}
`;

// Export for use in other modules
if (typeof window !== 'undefined') {
  window.MIHON_PROTO_SCHEMA = MIHON_PROTO_SCHEMA;
}
