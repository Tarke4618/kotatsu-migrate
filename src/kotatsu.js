// src/kotatsu.js - Kotatsu Backup Parser & Builder
// cspell:ignore favourites
// Format: ZIP archive containing JSON files

/**
 * Parse a Kotatsu backup file (.bk.zip)
 * @param {File} file - The uploaded .bk.zip file
 * @returns {Promise<Object>} Normalized backup data
 */
async function parseKotatsuBackup(file) {
  const result = {
    success: false,
    data: {
      manga: [],
      categories: [],
      history: [],
      bookmarks: [],
    },
    debug: {
      files: [],
      errors: [],
    }
  };

  try {
    const zip = new JSZip();
    const contents = await zip.loadAsync(file);
    result.debug.files = Object.keys(contents.files);

    const jsonFiles = {
      favorites: null,
      categories: null,
      history: null,
      bookmarks: null,
    };

    for (const path of Object.keys(contents.files)) {
      const entry = contents.files[path];
      if (entry.dir) continue;
      const name = path.split('/').pop().toLowerCase();
      
      if (name === 'favourites.json' || name === 'favourites' || name === 'manga.json') {
        jsonFiles.favorites = await entry.async('string');
      }
      if (name === 'categories.json' || name === 'categories') {
        jsonFiles.categories = await entry.async('string');
      }
      if (name === 'history.json' || name === 'history') {
        jsonFiles.history = await entry.async('string');
      }
      if (name === 'bookmarks.json' || name === 'bookmarks') {
        jsonFiles.bookmarks = await entry.async('string');
      }
    }

    if (jsonFiles.favorites) {
      try {
        const data = JSON.parse(jsonFiles.favorites);
        result.data.manga = Array.isArray(data) ? data : [];
      } catch (e) {
        result.debug.errors.push(`Failed to parse favorites: ${e.message}`);
      }
    }

    if (jsonFiles.categories) {
      try {
        const data = JSON.parse(jsonFiles.categories);
        result.data.categories = Array.isArray(data) ? data : [];
      } catch (e) {
        result.debug.errors.push(`Failed to parse categories: ${e.message}`);
      }
    }

    if (jsonFiles.history) {
      try {
        const data = JSON.parse(jsonFiles.history);
        result.data.history = Array.isArray(data) ? data : [];
      } catch (e) {
        result.debug.errors.push(`Failed to parse history: ${e.message}`);
      }
    }

    if (jsonFiles.bookmarks) {
      try {
        const data = JSON.parse(jsonFiles.bookmarks);
        result.data.bookmarks = Array.isArray(data) ? data : [];
      } catch (e) {
        result.debug.errors.push(`Failed to parse bookmarks: ${e.message}`);
      }
    }

    result.success = result.data.manga.length > 0;
    if (!result.success) {
      result.debug.errors.push('No manga found in backup');
    }

  } catch (e) {
    result.debug.errors.push(`ZIP parsing failed: ${e.message}`);
  }

  return result;
}


/**
 * Create a Kotatsu backup file (.bk.zip) from Mihon parsed data
 * Produces a valid backup that Kotatsu can actually import.
 * @param {Object} data - Parsed Mihon data (from parseMihonBackup)
 * @returns {Promise<Blob>} The .bk.zip file as a Blob
 */
async function createKotatsuBackup(data) {
  const zip = new JSZip();
  const timestamp = Date.now();

  // --- Build source lookup from Mihon data ---
  // data.sources contains {name, sourceId} from the Mihon backup
  const mihonSourceLookup = {};
  if (data.sources && Array.isArray(data.sources)) {
    data.sources.forEach(s => {
      mihonSourceLookup[String(s.sourceId)] = s.name;
    });
  }

  // --- 1. Categories ---
  // Map Mihon categories to Kotatsu format
  // Real Kotatsu categories use category_id as an integer key
  const kotatsuCategories = data.categories.map((c, idx) => ({
    category_id: idx + 1,
    created_at: timestamp,
    sort_key: idx,
    title: c.name || `Category ${idx + 1}`,
    order: "NEWEST",
    track: true,
    show_in_lib: true,
  }));

  // Mihon categories[i] has order/id — we map order/index to our new category_id
  // Mihon stores category references in manga.categories as indices (order values)
  const mihonOrderToKotatsuId = {};
  data.categories.forEach((c, idx) => {
    // Mihon uses the order as the reference key in manga.categories
    const orderKey = c.order !== undefined ? c.order : idx;
    mihonOrderToKotatsuId[String(orderKey)] = idx + 1; // Our 1-based category_id
  });

  // --- 2. Favourites (Manga) ---
  const kotatsuFavorites = [];
  const kotatsuHistory = [];

  data.manga.forEach((m, idx) => {
    // Generate a stable manga ID from the URL (like Kotatsu does internally)
    const mangaUrl = m.url || '';
    const mangaId = generateStableMangaId(mangaUrl, idx);

    // Resolve category
    let categoryId = 0;
    if (m.categories && m.categories.length > 0) {
      const firstCatRef = String(m.categories[0]);
      categoryId = mihonOrderToKotatsuId[firstCatRef] || 0;
    }

    // Resolve source name from Mihon source ID
    let sourceName = 'UNKNOWN';
    const srcId = String(m.source || '0');
    // First try the Mihon backup's own source list
    if (mihonSourceLookup[srcId]) {
      sourceName = mihonSourceLookup[srcId].toUpperCase().replace(/[^A-Z0-9]/g, '_');
    } else {
      // Fall back to our global reverse map
      const resolved = window.findKotatsuSourceName ? window.findKotatsuSourceName(srcId) : 'Unknown';
      if (resolved && resolved !== 'Unknown') {
        sourceName = resolved.toUpperCase().replace(/[^A-Z0-9]/g, '_');
      }
    }

    // Build tags from genres
    const tags = (m.genre || []).map(g => ({
      title: g,
      key: g.toLowerCase().replace(/\s+/g, '_'),
      source: sourceName,
    }));

    // Add extra categories as tags (Mihon allows multiple, Kotatsu only one)
    if (m.categories && m.categories.length > 1) {
      m.categories.slice(1).forEach(catRef => {
        const cat = data.categories.find(c => 
          String(c.order) === String(catRef) || String(c.id) === String(catRef)
        );
        if (cat) {
          tags.push({
            title: cat.name,
            key: `category:${cat.name.toLowerCase()}`,
            source: 'MIGRATE_CAT',
          });
        }
      });
    }

    // Map status
    const status = window.mapMihonStatusToKotatsu 
      ? window.mapMihonStatusToKotatsu(m.status) 
      : 'ONGOING';

    // Build the full URL - Kotatsu needs full URL for public_url
    let publicUrl = m.url || '';
    // Try to reconstruct full URL from source if it's a relative path
    // For now, keep as-is since we don't know the base domain

    const mangaObj = {
      manga_id: mangaId,
      category_id: categoryId,
      sort_key: 0,
      pinned: false,
      created_at: Number(m.dateAdded) || timestamp,
      manga: {
        id: mangaId,
        title: m.title || 'Unknown',
        alt_title: '',
        url: m.url || '',
        public_url: publicUrl,
        rating: -1.0,
        nsfw: false,
        content_rating: '',
        cover_url: m.thumbnailUrl || '',
        large_cover_url: m.thumbnailUrl || '',
        state: status,
        author: m.author || m.artist || '',
        source: sourceName,
        tags: tags,
      }
    };
    kotatsuFavorites.push(mangaObj);

    // --- 3. History ---
    if (m.history && m.history.length > 0) {
      m.history.forEach(h => {
        const chapterUrl = h.url || '';
        kotatsuHistory.push({
          manga_id: mangaId,
          created_at: Number(h.lastRead) || timestamp,
          updated_at: Number(h.lastRead) || timestamp,
          chapter_id: generateStableMangaId(chapterUrl, 0),
          page: 0,
          scroll: 0.0,
          percent: 0.0,
          chapters: 0,
          manga: mangaObj.manga,
        });
      });
    }
  });

  // --- Write ZIP files ---
  // Index - MUST match real Kotatsu format: array with app metadata
  const indexData = [{
    app_id: "org.koitharu.kotatsu",
    app_version: 800,
    created_at: timestamp,
  }];
  zip.file("index", JSON.stringify(indexData));

  zip.file("favourites", JSON.stringify(kotatsuFavorites));
  zip.file("categories", JSON.stringify(kotatsuCategories));
  zip.file("history", JSON.stringify(kotatsuHistory));
  
  // Required empty files that Kotatsu expects
  zip.file("bookmarks", "[]");
  zip.file("sources", "[]");
  zip.file("settings", "[]");

  return await zip.generateAsync({ type: "blob" });
}

/**
 * Generate a stable positive manga ID from a URL string.
 * Produces a deterministic large positive integer.
 */
function generateStableMangaId(url, fallbackIdx) {
  if (!url || url.length === 0) return fallbackIdx + 1;
  
  // Use murmurhash if available
  if (typeof murmurhash3_32_gc === 'function') {
    const h1 = murmurhash3_32_gc(url, 0x1234) >>> 0; // unsigned
    const h2 = murmurhash3_32_gc(url, 0x5678) >>> 0; // unsigned
    // Combine two unsigned 32-bit hashes into a large positive number
    // Stay within JS safe integer range (2^53)
    return h1 * 65536 + (h2 >>> 16);
  }
  
  // Fallback: simple positive hash
  let hash = 0;
  for (let i = 0; i < url.length; i++) {
    const char = url.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash) || (fallbackIdx + 1);
}

// Export for use in app.js
if (typeof window !== 'undefined') {
  window.parseKotatsuBackup = parseKotatsuBackup;
  window.createKotatsuBackup = createKotatsuBackup;
}
