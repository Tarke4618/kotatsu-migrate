// src/mihon.js - Mihon/Tachiyomi Backup Parser & Builder
// Format: GZipped Protobuf binary (.tachibk)

let _cachedBackupMsg = null;
let _cachedLong = null;
let _longZero = null;
let _longCache = new Map();
const _LONG_CACHE_MAX = 1024;

function getBackupMessage() {
  if (_cachedBackupMsg) return _cachedBackupMsg;
  if (typeof protobuf === 'undefined' || typeof window.MIHON_PROTO_SCHEMA === 'undefined') {
    throw new Error('Dependencies missing: protobuf.js or schema');
  }
  const root = protobuf.parse(window.MIHON_PROTO_SCHEMA).root;
  _cachedBackupMsg = root.lookupType('Backup');
  _cachedLong = protobuf.util.Long;
  if (_cachedLong) _longZero = _cachedLong.fromNumber(0, true);
  return _cachedBackupMsg;
}

// Ultra-fast Long factory with bounded cache
function toLong(val) {
  if (!val || val === 0 || val === '0') return _longZero || 0;
  if (!_cachedLong) return Number(val) || 0;

  // Cache hit for repeated values (timestamps, source IDs reused across manga)
  const cached = _longCache.get(val);
  if (cached) return cached;

  let result;
  if (typeof val === 'string') {
    try { result = _cachedLong.fromString(val, true); } catch(e) { return _longZero || 0; }
  } else {
    result = _cachedLong.fromNumber(Number(val) || 0, true);
  }

  if (_longCache.size >= _LONG_CACHE_MAX) _longCache.clear();
  _longCache.set(val, result);
  return result;
}

/**
 * Parse a Mihon backup file (.tachibk)
 */
async function parseMihonBackup(file) {
  const result = {
    success: false,
    data: { manga: [], categories: [], sources: [] },
    debug: { isGzip: false, protoSize: 0, errors: [] }
  };

  try {
    let bytes = new Uint8Array(await file.arrayBuffer());

    // Handle gzip (and double-gzip)
    let attempts = 0;
    while (bytes[0] === 0x1f && bytes[1] === 0x8b && attempts < 3) {
      result.debug.isGzip = true;
      bytes = pako.ungzip(bytes);
      attempts++;
    }
    result.debug.protoSize = bytes.length;

    const BackupMessage = getBackupMessage();
    const decoded = BackupMessage.decode(bytes);
    const backup = BackupMessage.toObject(decoded, { longs: String, enums: String, defaults: true });

    // Extract manga — direct for-loop, avoid .map() allocation overhead
    const rawManga = backup.backupManga;
    const mangaLen = rawManga ? rawManga.length : 0;
    const outManga = new Array(mangaLen);

    for (let i = 0; i < mangaLen; i++) {
      const m = rawManga[i];

      // Chapters — direct loop
      const rawCh = m.chapters;
      const chLen = rawCh ? rawCh.length : 0;
      const chapters = new Array(chLen);
      for (let j = 0; j < chLen; j++) {
        const ch = rawCh[j];
        chapters[j] = {
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
        };
      }

      // History — direct loop
      const rawHist = m.history;
      const hLen = rawHist ? rawHist.length : 0;
      const history = new Array(hLen);
      for (let j = 0; j < hLen; j++) {
        const h = rawHist[j];
        history[j] = { url: h.url, lastRead: h.lastRead, readDuration: h.readDuration || '0' };
      }

      outManga[i] = {
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
        chapters: chapters,
        history: history,
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
      };
    }
    result.data.manga = outManga;

    // Categories
    const rawCats = backup.backupCategories;
    const catLen = rawCats ? rawCats.length : 0;
    const outCats = new Array(catLen);
    for (let i = 0; i < catLen; i++) {
      const c = rawCats[i];
      outCats[i] = { name: c.name, order: c.order || 0, id: c.id || 0, flags: c.flags || 0 };
    }
    result.data.categories = outCats;

    // Sources
    const rawSrc = backup.backupSources;
    const srcLen = rawSrc ? rawSrc.length : 0;
    const outSrc = new Array(srcLen);
    for (let i = 0; i < srcLen; i++) {
      outSrc[i] = { name: rawSrc[i].name || '', sourceId: rawSrc[i].sourceId };
    }
    result.data.sources = outSrc;

    result.success = mangaLen > 0;
  } catch (e) {
    result.debug.errors.push('Parse failed: ' + e.message);
  }

  return result;
}

/**
 * Create a Mihon backup file from Kotatsu parsed data
 */
async function createMihonBackup(data) {
  const BackupMessage = getBackupMessage();

  // --- Categories ---
  const cats = data.categories;
  const catLen = cats.length;
  const backupCategories = new Array(catLen);
  const kotatsuIdToMihonOrder = Object.create(null);

  for (let i = 0; i < catLen; i++) {
    const c = cats[i];
    backupCategories[i] = {
      name: String(c.title || c.name || ('Category ' + (i + 1))),
      order: toLong(i),
      id: toLong(i + 1),
      flags: _longZero || 0,
    };
    kotatsuIdToMihonOrder[c.category_id || c.id || (i + 1)] = i;
  }

  // --- History lookup: prototype-free object for O(1) ---
  const historyByMangaId = Object.create(null);
  const histArr = data.history;
  if (histArr) {
    for (let i = 0; i < histArr.length; i++) {
      const h = histArr[i];
      const mId = h.manga_id;
      if (!historyByMangaId[mId]) historyByMangaId[mId] = [];
      historyByMangaId[mId].push({
        url: String(h.url || h.chapter_url || ''),
        lastRead: toLong(h.updated_at || h.created_at || Date.now()),
        readDuration: _longZero || 0,
      });
    }
  }

  // --- Manga ---
  const mangaList = data.manga;
  const mangaLen = mangaList.length;
  const backupManga = new Array(mangaLen);
  const sourceTracker = new Map();
  const findId = window.findMihonSourceId;
  const mapStatus = window.mapKotatsuStatusToMihon;
  const emptyArr = []; // Shared frozen empty array ref

  for (let i = 0; i < mangaLen; i++) {
    const rawManga = mangaList[i];
    const m = rawManga.manga || rawManga;
    const mangaId = m.id || rawManga.manga_id || rawManga.id || (i + 1);

    // Source
    const sourceName = m.source || '';
    const sourceId = findId ? findId(sourceName) : '0';
    if (!sourceTracker.has(sourceId)) sourceTracker.set(sourceId, sourceName);

    // Category
    const mangaCategories = [];
    const catId = rawManga.category_id;
    if (catId !== undefined && catId !== 0 && kotatsuIdToMihonOrder[catId] !== undefined) {
      mangaCategories.push(toLong(kotatsuIdToMihonOrder[catId]));
    }

    // Genres
    let genres;
    if (Array.isArray(m.genre)) {
      genres = m.genre;
    } else if (Array.isArray(m.tags)) {
      const tagLen = m.tags.length;
      genres = new Array(tagLen);
      for (let t = 0; t < tagLen; t++) {
        const tag = m.tags[t];
        genres[t] = tag.title || tag.name || String(tag);
      }
    } else {
      genres = emptyArr;
    }

    // Thumbnail — try multiple field names without chaining
    const thumb = m.cover_url || m.coverUrl || m.large_cover_url || m.thumbnail_url || m.thumbnailUrl || '';

    backupManga[i] = {
      source: toLong(sourceId),
      url: String(m.url || m.public_url || ''),
      title: String(m.title || m.name || 'Unknown'),
      artist: String(m.artist || ''),
      author: String(m.author || ''),
      description: String(m.description || ''),
      genre: genres,
      status: mapStatus ? mapStatus(m.state || m.status) : 0,
      thumbnailUrl: String(thumb),
      dateAdded: toLong(rawManga.created_at || m.dateAdded || Date.now()),
      viewer: 0,
      favorite: true,
      chapterFlags: 0,
      viewer_flags: 0,
      categories: mangaCategories,
      chapters: emptyArr,
      tracking: emptyArr,
      history: historyByMangaId[mangaId] || emptyArr,
      updateStrategy: 0,
      lastModifiedAt: _longZero || 0,
      favoriteModifiedAt: _longZero || 0,
      excludedScanlators: emptyArr,
      version: _longZero || 0,
      notes: '',
      initialized: false,
    };
  }

  // --- Sources ---
  const backupSources = new Array(sourceTracker.size);
  let si = 0;
  const findName = window.findKotatsuSourceName;
  for (const [srcId, srcName] of sourceTracker) {
    let displayName = srcName;
    if (!displayName || displayName === 'UNKNOWN' || displayName === 'Unknown') {
      if (findName) {
        const resolved = findName(srcId);
        if (resolved !== 'Unknown') displayName = resolved;
      }
    }
    // Clean UPPER_CASE names
    if (displayName === displayName.toUpperCase() && displayName.indexOf('_') !== -1) {
      const parts = displayName.split('_');
      for (let p = 0; p < parts.length; p++) {
        parts[p] = parts[p].charAt(0) + parts[p].slice(1).toLowerCase();
      }
      displayName = parts.join(' ');
    }
    backupSources[si++] = { sourceId: toLong(srcId), name: String(displayName || 'Unknown') };
  }

  // --- Encode + gzip ---
  // Skip verify() in production — it's O(N) and we control the schema
  const message = BackupMessage.create({ backupManga, backupCategories, backupSources });
  const buffer = BackupMessage.encode(message).finish();
  const gzipped = pako.gzip(buffer, { level: 1 }); // Fast compression

  return new Blob([gzipped], { type: 'application/octet-stream' });
}

if (typeof window !== 'undefined') {
  window.parseMihonBackup = parseMihonBackup;
  window.createMihonBackup = createMihonBackup;
}
