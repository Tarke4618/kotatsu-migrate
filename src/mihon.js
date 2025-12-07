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

    // Check if gzipped (magic bytes: 1f 8b)
    if (bytes[0] === 0x1f && bytes[1] === 0x8b) {
      result.debug.isGzip = true;
      bytes = pako.ungzip(bytes);
    }
    result.debug.protoSize = bytes.length;

    // Parse with protobuf.js
    if (typeof protobuf === 'undefined' || typeof window.MIHON_PROTO_SCHEMA === 'undefined') {
      throw new Error('Dependencies missing: protobuf.js or schema');
    }

    const root = protobuf.parse(window.MIHON_PROTO_SCHEMA).root;
    const BackupMessage = root.lookupType('Backup');
    const decoded = BackupMessage.decode(bytes);
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
      dateAdded: m.dateAdded || 0,
      favorite: m.favorite !== false,
      categories: m.categories || [],
      chapters: (m.chapters || []).map(ch => ({
        url: ch.url,
        name: ch.name,
        read: ch.read || false,
        bookmark: ch.bookmark || false,
        lastPageRead: ch.lastPageRead || 0,
        chapterNumber: ch.chapterNumber || 0,
      })),
      history: (m.history || []).map(h => ({
        url: h.url,
        lastRead: h.lastRead,
        readDuration: h.readDuration || 0,
      })),
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
 * Create a Mihon backup file from normalized data
 * @param {Object} data - Normalized backup data (from Kotatsu parser)
 * @returns {Promise<Blob>} The .tachibk file as a Blob
 */
async function createMihonBackup(data) {
  if (typeof protobuf === 'undefined' || typeof window.MIHON_PROTO_SCHEMA === 'undefined') {
    throw new Error('Dependencies missing');
  }

  const root = protobuf.parse(window.MIHON_PROTO_SCHEMA).root;
  const BackupMessage = root.lookupType('Backup');

  // Build category lookup for ID -> order mapping
  const categoryLookup = {};
  const backupCategories = data.categories.map((c, idx) => {
    // Kotatsu categories have 'id' and 'title' fields
    const catId = c.id || c.category_id || idx + 1;
    const catName = c.title || c.name || `Category ${idx + 1}`;
    categoryLookup[catId] = idx; // Map Kotatsu ID to Mihon order/index
    return {
      name: String(catName),
      order: Number(idx),
      id: Number(idx), // Mihon uses order as id reference
      flags: 0,
    };
  });
  
  // DEBUG: Log category lookup
  console.log('[mihon] Category lookup table:', categoryLookup);
  console.log('[mihon] Backup categories:', backupCategories);

  // Build history lookup (manga_id -> history entries)
  const historyLookup = {};
  if (data.history && Array.isArray(data.history)) {
    data.history.forEach(h => {
      const mangaId = h.manga_id;
      if (!historyLookup[mangaId]) historyLookup[mangaId] = [];
      historyLookup[mangaId].push({
        url: String(h.url || h.chapter_url || ''),
        lastRead: Number(h.updated_at || h.created_at || Date.now()),
        readDuration: 0,
      });
    });
  }

  // Build manga list
  const backupManga = data.manga.map((rawManga, idx) => {
    // Kotatsu favorites often have manga data nested under 'manga' key
    const m = rawManga.manga || rawManga;
    const mangaId = m.id || rawManga.id || idx + 1;
    
    // Debug: log first manga structure
    if (idx === 0) {
      console.log('[mihon] Raw Kotatsu manga structure:', rawManga);
      console.log('[mihon] Extracted manga object:', m);
    }
    
    // Get categories for this manga
    // Kotatsu stores category_id at the WRAPPER level (rawManga), not inside manga
    const mangaCategories = [];
    const catId = rawManga.category_id;
    
    if (idx < 3) {
      console.log(`[mihon] Manga ${idx} (${m.title}): category_id=${catId}, lookup result=${categoryLookup[catId]}`);
    }
    
    if (catId !== undefined && categoryLookup[catId] !== undefined) {
      // Mihon categories field expects the ORDER/INDEX, not the original ID
      mangaCategories.push(Number(categoryLookup[catId]));
    }

    // Get history for this manga
    const mangaHistory = historyLookup[mangaId] || [];

    // Sanitize URL (strip domain for relative path)
    let cleanUrl = String(m.url || m.public_url || '');
    try {
      if (cleanUrl.startsWith('http')) {
        const u = new URL(cleanUrl);
        cleanUrl = u.pathname + u.search;
      }
    } catch (e) { /* keep original */ }

    // Get source ID (must be numeric for int64)
    let sourceId = '0';
    const sourceName = m.source || '';
    if (window.findMihonSourceId) {
      sourceId = window.findMihonSourceId(sourceName);
    }
    
    // Convert source to proper Long value for protobuf
    // protobuf.js accepts strings for int64, but they must be valid numbers
    const sourceAsLong = protobuf.util.Long 
      ? protobuf.util.Long.fromString(sourceId || '0', true)
      : parseInt(sourceId) || 0;

    return {
      source: sourceAsLong,
      url: cleanUrl,
      title: String(m.title || m.name || 'Unknown'),
      artist: String(m.artist || m.author || ''),
      author: String(m.author || ''),
      description: String(m.description || ''),
      genre: Array.isArray(m.genre) ? m.genre.map(String) : 
             Array.isArray(m.tags) ? m.tags.map(t => t.title || t.name || String(t)) : [],
      status: mapKotatsuStatusToMihon(m.state || m.status),
      thumbnailUrl: String(m.cover_url || m.coverUrl || m.large_cover_url || m.thumbnail_url || ''),
      dateAdded: protobuf.util.Long 
        ? protobuf.util.Long.fromNumber(Number(rawManga.created_at || m.dateAdded || Date.now()), true)
        : Number(rawManga.created_at || m.dateAdded || Date.now()),
      favorite: true, // CRITICAL: Must be true for library import
      categories: mangaCategories.map(c => protobuf.util.Long ? protobuf.util.Long.fromNumber(c, true) : c),
      chapters: [], // Kotatsu doesn't export chapter lists
      history: mangaHistory,
    };
  });

  // Build sources list
  const sourceIds = new Set();
  backupManga.forEach(m => {
    const srcId = m.source.toString ? m.source.toString() : String(m.source);
    sourceIds.add(srcId);
  });
  const backupSources = Array.from(sourceIds).map(id => ({
    sourceId: protobuf.util.Long ? protobuf.util.Long.fromString(id, true) : parseInt(id) || 0,
    name: window.findKotatsuSourceName ? window.findKotatsuSourceName(id) : 'Unknown',
  }));

  const payload = {
    backupManga,
    backupCategories,
    backupSources,
  };

  // DEBUG: Store payload for inspection
  window.lastMihonPayload = payload;
  console.log('[mihon] Payload preview:', {
    mangaCount: backupManga.length,
    categoryCount: backupCategories.length,
    firstManga: backupManga[0],
  });

  // Verify (non-blocking)
  const errMsg = BackupMessage.verify(payload);
  if (errMsg) {
    console.warn('[mihon] Proto verification warning:', errMsg);
    window.lastMihonVerifyError = errMsg;
  }

  // Encode and compress
  const message = BackupMessage.create(payload);
  const buffer = BackupMessage.encode(message).finish();
  console.log('[mihon] Encoded buffer size:', buffer.length);
  const gzipped = pako.gzip(buffer);

  return new Blob([gzipped], { type: 'application/octet-stream' });
}

function mapKotatsuStatusToMihon(status) {
  // Kotatsu: ONGOING, FINISHED, ABANDONED, PAUSED, UPCOMING
  // Mihon: 0=Unknown, 1=Ongoing, 2=Completed, 3=Licensed, 4=Publishing, 5=Cancelled, 6=Hiatus
  if (!status) return 0;
  const s = String(status).toUpperCase();
  if (s.includes('ONGOING')) return 1;
  if (s.includes('FINISHED') || s.includes('COMPLETED')) return 2;
  if (s.includes('ABANDONED') || s.includes('CANCELLED')) return 5;
  if (s.includes('PAUSED') || s.includes('HIATUS')) return 6;
  return 0;
}

// Export
if (typeof window !== 'undefined') {
  window.parseMihonBackup = parseMihonBackup;
  window.createMihonBackup = createMihonBackup;
}
