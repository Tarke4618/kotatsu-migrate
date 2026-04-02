// src/mihon.js - Mihon/Tachiyomi Backup Parser & Builder
// Format: GZipped Protobuf binary (.tachibk)

/**
 * Parse a Mihon backup file (.tachibk)
 * @param {File} file - The uploaded .tachibk file
 * @returns {Promise<Object>} Normalized backup data
 */
async function parseMihonBackup(file) {
  const result = {
    success: false,
    data: {
      manga: [],
      categories: [],
      sources: [],
    },
    debug: {
      isGzip: false,
      protoSize: 0,
      errors: [],
    }
  };

  try {
    const arrayBuffer = await file.arrayBuffer();
    let bytes = new Uint8Array(arrayBuffer);

    // Handle gzip (and double-gzip)
    let decompressAttempts = 0;
    while (bytes[0] === 0x1f && bytes[1] === 0x8b && decompressAttempts < 3) {
      result.debug.isGzip = true;
      bytes = pako.ungzip(bytes);
      decompressAttempts++;
    }
    result.debug.protoSize = bytes.length;

    if (typeof protobuf === 'undefined' || typeof window.MIHON_PROTO_SCHEMA === 'undefined') {
      throw new Error('Dependencies missing: protobuf.js or schema');
    }

    const root = protobuf.parse(window.MIHON_PROTO_SCHEMA).root;
    const BackupMessage = root.lookupType('Backup');
    
    let decoded;
    try {
      const reader = protobuf.Reader.create(bytes);
      decoded = BackupMessage.decode(reader);
    } catch (decodeErr) {
      console.warn('[mihon-parse] Decode failed:', decodeErr.message);
      result.debug.errors.push(`Decode error: ${decodeErr.message}`);
      throw decodeErr;
    }
    
    const backup = BackupMessage.toObject(decoded, {
      longs: String,
      enums: String,
      defaults: true,
    });

    // Extract manga
    result.data.manga = (backup.backupManga || []).map(m => ({
      source: m.source,
      url: m.url,
      title: m.title || '',
      artist: m.artist || '',
      author: m.author || '',
      description: m.description || '',
      genre: m.genre || [],
      status: m.status || 0,
      thumbnailUrl: m.thumbnailUrl || '',
      dateAdded: m.dateAdded || '0',
      favorite: m.favorite !== false,
      categories: m.categories || [],
      chapters: (m.chapters || []).map(ch => ({
        url: ch.url,
        name: ch.name,
        scanlator: ch.scanlator || '',
        read: ch.read || false,
        bookmark: ch.bookmark || false,
        lastPageRead: ch.lastPageRead || '0',
        dateFetch: ch.dateFetch || '0',
        dateUpload: ch.dateUpload || '0',
        chapterNumber: ch.chapterNumber || 0,
        sourceOrder: ch.sourceOrder || '0',
        lastModifiedAt: ch.lastModifiedAt || '0',
        version: ch.version || '0',
      })),
      history: (m.history || []).map(h => ({
        url: h.url,
        lastRead: h.lastRead,
        readDuration: h.readDuration || '0',
      })),
      tracking: m.tracking || [],
      excludedScanlators: m.excludedScanlators || [],
      viewer: m.viewer || 0,
      chapterFlags: m.chapterFlags || 0,
      viewerFlags: m.viewer_flags || 0,
      updateStrategy: m.updateStrategy || 0,
      lastModifiedAt: m.lastModifiedAt || '0',
      favoriteModifiedAt: m.favoriteModifiedAt || '0',
      version: m.version || '0',
      notes: m.notes || '',
      initialized: m.initialized || false,
    }));

    // Extract categories
    result.data.categories = (backup.backupCategories || []).map(c => ({
      name: c.name,
      order: c.order || 0,
      id: c.id || 0,
      flags: c.flags || 0,
    }));

    // Extract sources
    result.data.sources = (backup.backupSources || []).map(s => ({
      name: s.name || '',
      sourceId: s.sourceId,
    }));

    result.success = result.data.manga.length > 0;

  } catch (e) {
    result.debug.errors.push(`Parse failed: ${e.message}`);
  }

  return result;
}

/**
 * Create a Mihon backup file from Kotatsu parsed data
 * Produces a valid .tachibk that Mihon can actually import.
 * @param {Object} data - Parsed Kotatsu data (from parseKotatsuBackup)
 * @returns {Promise<Blob>} The .tachibk file as a Blob
 */
async function createMihonBackup(data) {
  if (typeof protobuf === 'undefined' || typeof window.MIHON_PROTO_SCHEMA === 'undefined') {
    throw new Error('Dependencies missing');
  }

  const root = protobuf.parse(window.MIHON_PROTO_SCHEMA).root;
  const BackupMessage = root.lookupType('Backup');
  const Long = protobuf.util.Long;

  // Helper: create a Long value from a number or string
  function toLong(val) {
    if (val === null || val === undefined) return Long ? Long.fromNumber(0, true) : 0;
    if (Long) {
      if (typeof val === 'string') {
        try { return Long.fromString(val, true); } catch(e) { return Long.fromNumber(0, true); }
      }
      return Long.fromNumber(Number(val) || 0, true);
    }
    return Number(val) || 0;
  }

  // --- Build category mapping ---
  // Kotatsu categories have category_id and title
  // Mihon categories use order as the reference
  const backupCategories = data.categories.map((c, idx) => {
    const catName = c.title || c.name || `Category ${idx + 1}`;
    return {
      name: String(catName),
      order: toLong(idx),
      id: toLong(idx + 1),
      flags: toLong(0),
    };
  });

  // Map Kotatsu category_id -> Mihon order index
  const kotatsuIdToMihonOrder = {};
  data.categories.forEach((c, idx) => {
    const catId = c.category_id || c.id || idx + 1;
    kotatsuIdToMihonOrder[catId] = idx;
  });

  // --- Build history lookup from separate history array ---
  const historyByMangaId = {};
  if (data.history && Array.isArray(data.history)) {
    data.history.forEach(h => {
      const mId = h.manga_id;
      if (!historyByMangaId[mId]) historyByMangaId[mId] = [];
      historyByMangaId[mId].push({
        url: String(h.url || h.chapter_url || ''),
        lastRead: toLong(h.updated_at || h.created_at || Date.now()),
        readDuration: toLong(0),
      });
    });
  }

  // --- Build manga list ---
  const sourceTracker = new Map(); // Track unique source IDs and names

  const backupManga = data.manga.map((rawManga, idx) => {
    // Kotatsu structure: { manga_id, category_id, manga: { id, title, url, source, ... } }
    const m = rawManga.manga || rawManga;
    const mangaId = m.id || rawManga.manga_id || rawManga.id || idx + 1;

    // Resolve source — Kotatsu uses names like "WEBTOON", "MANGADEX"
    const sourceName = m.source || '';
    let sourceId = '0';
    if (window.findMihonSourceId) {
      sourceId = window.findMihonSourceId(sourceName);
    }
    
    // Track source for backupSources
    if (!sourceTracker.has(sourceId)) {
      sourceTracker.set(sourceId, sourceName);
    }

    // Map category
    const mangaCategories = [];
    const catId = rawManga.category_id;
    if (catId !== undefined && catId !== 0 && kotatsuIdToMihonOrder[catId] !== undefined) {
      mangaCategories.push(toLong(kotatsuIdToMihonOrder[catId]));
    }

    // Build chapter list from history (basic reconstruction)
    const mangaHistory = historyByMangaId[mangaId] || [];

    // Extract tags/genres
    let genres = [];
    if (Array.isArray(m.genre)) {
      genres = m.genre.map(String);
    } else if (Array.isArray(m.tags)) {
      genres = m.tags.map(t => t.title || t.name || String(t));
    }

    // Keep original URL (don't strip domain)
    const mangaUrl = String(m.url || m.public_url || '');

    return {
      source: toLong(sourceId),
      url: mangaUrl,
      title: String(m.title || m.name || 'Unknown'),
      artist: String(m.artist || ''),
      author: String(m.author || ''),
      description: String(m.description || ''),
      genre: genres,
      status: window.mapKotatsuStatusToMihon ? window.mapKotatsuStatusToMihon(m.state || m.status) : 0,
      thumbnailUrl: String(m.cover_url || m.coverUrl || m.large_cover_url || m.thumbnail_url || m.thumbnailUrl || ''),
      dateAdded: toLong(rawManga.created_at || m.dateAdded || Date.now()),
      viewer: 0,
      favorite: true,
      chapterFlags: 0,
      viewer_flags: 0,
      categories: mangaCategories,
      chapters: [],
      tracking: [],
      history: mangaHistory,
      updateStrategy: 0,
      lastModifiedAt: toLong(0),
      favoriteModifiedAt: toLong(0),
      excludedScanlators: [],
      version: toLong(0),
      notes: '',
      initialized: false,
    };
  });

  // --- Build sources list ---
  const backupSources = [];
  for (const [srcId, srcName] of sourceTracker) {
    // Try to get a clean display name
    let displayName = srcName;
    if (displayName === 'UNKNOWN' || displayName === 'Unknown' || !displayName) {
      // Try reverse lookup
      if (window.findKotatsuSourceName) {
        const resolved = window.findKotatsuSourceName(srcId);
        if (resolved !== 'Unknown') displayName = resolved;
      }
    }
    // Clean up Kotatsu-style names for Mihon display
    // e.g., "MANGA_DEX" -> "MangaDex"
    if (displayName === displayName.toUpperCase() && displayName.includes('_')) {
      displayName = displayName.split('_').map(w => 
        w.charAt(0) + w.slice(1).toLowerCase()
      ).join(' ');
    }

    backupSources.push({
      sourceId: toLong(srcId),
      name: String(displayName || 'Unknown'),
    });
  }

  const payload = {
    backupManga,
    backupCategories,
    backupSources,
  };

  // Verify
  const errMsg = BackupMessage.verify(payload);
  if (errMsg) {
    console.warn('[mihon-build] Proto verification warning:', errMsg);
  }

  // Encode and gzip
  const message = BackupMessage.create(payload);
  const buffer = BackupMessage.encode(message).finish();
  const gzipped = pako.gzip(buffer);

  return new Blob([gzipped], { type: 'application/octet-stream' });
}

// Export
if (typeof window !== 'undefined') {
  window.parseMihonBackup = parseMihonBackup;
  window.createMihonBackup = createMihonBackup;
}
