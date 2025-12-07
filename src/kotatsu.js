// src/kotatsu.js - Kotatsu Backup Parser & Builder
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

    // Find and parse JSON files (recursive search)
    const jsonFiles = {
      favourites: null,
      categories: null,
      history: null,
      bookmarks: null,
    };

    for (const path of Object.keys(contents.files)) {
      const entry = contents.files[path];
      if (entry.dir) continue;

      const name = path.split('/').pop().toLowerCase();
      
      if (name === 'favourites.json' || name === 'favourites' || name === 'manga.json') {
        jsonFiles.favourites = await entry.async('string');
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

    // Parse favourites (manga list)
    if (jsonFiles.favourites) {
      try {
        const data = JSON.parse(jsonFiles.favourites);
        result.data.manga = Array.isArray(data) ? data : [];
      } catch (e) {
        result.debug.errors.push(`Failed to parse favourites: ${e.message}`);
      }
    }

    // Parse categories
    if (jsonFiles.categories) {
      try {
        const data = JSON.parse(jsonFiles.categories);
        result.data.categories = Array.isArray(data) ? data : [];
      } catch (e) {
        result.debug.errors.push(`Failed to parse categories: ${e.message}`);
      }
    }

    // Parse history
    if (jsonFiles.history) {
      try {
        const data = JSON.parse(jsonFiles.history);
        result.data.history = Array.isArray(data) ? data : [];
      } catch (e) {
        result.debug.errors.push(`Failed to parse history: ${e.message}`);
      }
    }

    // Parse bookmarks
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
 * Create a Kotatsu backup file from normalized data
 * @param {Object} data - Normalized backup data
 * @returns {Promise<Blob>} The .bk.zip file as a Blob
 */
async function createKotatsuBackup(data) {
  const zip = new JSZip();

  // Generate consistent manga ID using hash (matches Kotatsu's approach)
  // Uses a 64-bit-like hash similar to Kotlin's hashCode
  function generateMangaId(url, source) {
    const str = `${source}:${url}`;
    let h = 0n;
    for (let i = 0; i < str.length; i++) {
      h = BigInt.asIntN(64, 31n * h + BigInt(str.charCodeAt(i)));
    }
    return h.toString();
  }

  // Generate tag ID from title and source
  function generateTagId(title, source) {
    const str = `${source}:${title}`;
    let h = 0n;
    for (let i = 0; i < str.length; i++) {
      h = BigInt.asIntN(64, 31n * h + BigInt(str.charCodeAt(i)));
    }
    return h.toString();
  }

  // Build category lookup (order/index -> category object)
  const categoryLookup = {};
  const categories = data.categories.map((c, idx) => {
    const cat = {
      category_id: c.id || idx + 1,
      created_at: Date.now(),
      sort_key: c.order || idx,
      title: c.name || `Category ${idx + 1}`,
      order: c.order != null ? String(c.order) : null,
      track: true,
      show_in_lib: true,
      deleted_at: 0,
    };
    categoryLookup[idx] = cat.category_id; // Mihon uses index as category reference
    return cat;
  });

  // Collect unique sources
  const sourcesSet = new Set();

  // Convert Mihon manga to Kotatsu favourites format
  // Kotatsu expects: { manga_id, category_id, sort_key, pinned, created_at, manga: {...} }
  const favourites = data.manga.map((m, idx) => {
    const sourceName = window.findKotatsuSourceName 
      ? window.findKotatsuSourceName(m.source) 
      : 'UNKNOWN';
    sourcesSet.add(sourceName);
    
    const mangaId = generateMangaId(m.url || '', sourceName);
    
    // Get category_id from Mihon's category index
    const mihonCatIdx = m.categories?.[0];
    const categoryId = (mihonCatIdx != null && categoryLookup[mihonCatIdx]) 
      ? categoryLookup[mihonCatIdx] 
      : (categories[0]?.category_id || 1);

    // Build tags from genre array with proper id and pinned fields
    const tags = (m.genre || []).map(g => ({
      id: generateTagId(String(g), sourceName),
      title: String(g),
      key: String(g).toLowerCase().replace(/\s+/g, '_'),
      source: sourceName,
      pinned: false,
    }));

    return {
      manga_id: mangaId,
      category_id: categoryId,
      sort_key: idx,
      pinned: false,
      created_at: m.dateAdded || Date.now(),
      deleted_at: 0,
      manga: {
        id: mangaId,
        title: m.title || 'Unknown',
        alt_title: '',
        url: m.url || '',
        public_url: m.url || '',
        rating: -1.0,
        nsfw: false,
        content_rating: 'SAFE',
        cover_url: m.thumbnailUrl || '',
        large_cover_url: null,
        state: mapMihonStatusToKotatsu(m.status),
        author: m.author || '',
        source: sourceName,
        tags: tags,
      },
    };
  });

  // Convert history
  const history = [];
  data.manga.forEach((m, mangaIdx) => {
    if (m.history && m.history.length > 0) {
      const sourceName = window.findKotatsuSourceName 
        ? window.findKotatsuSourceName(m.source) 
        : 'UNKNOWN';
      const mangaId = generateMangaId(m.url || '', sourceName);
      
      m.history.forEach(h => {
        history.push({
          manga_id: mangaId,
          created_at: h.lastRead || Date.now(),
          updated_at: h.lastRead || Date.now(),
          chapter_id: 0,
          page: h.lastPageRead || 0,
          scroll: 0,
          percent: 0,
          chapters: 0,
          deleted_at: 0,
        });
      });
    }
  });

  // Build sources list
  const sources = Array.from(sourcesSet).map(name => ({
    source: name,
    enabled: true,
    sort_key: 0,
    added_in: Date.now(),
  }));

  // Add all Kotatsu backup files
  zip.file('favourites', JSON.stringify(favourites));
  zip.file('categories', JSON.stringify(categories));
  zip.file('history', JSON.stringify(history));
  zip.file('bookmarks', JSON.stringify([]));
  zip.file('sources', JSON.stringify(sources));
  zip.file('settings', JSON.stringify([]));
  zip.file('statistics', JSON.stringify([]));
  zip.file('scrobbling', JSON.stringify([]));
  zip.file('saved_filters', JSON.stringify([]));
  zip.file('reader_grid', JSON.stringify([]));
  zip.file('index', JSON.stringify({
    app_id: 'org.koitharu.kotatsu',
    app_version: 700,
    created_at: Date.now(),
  }));

  return await zip.generateAsync({ type: 'blob' });
}

function mapMihonStatusToKotatsu(status) {
  // Mihon: 0=Unknown, 1=Ongoing, 2=Completed, 3=Licensed, 4=Publishing, 5=Cancelled, 6=Hiatus
  // Kotatsu: ONGOING, FINISHED, ABANDONED, PAUSED, UPCOMING
  switch (status) {
    case 1: return 'ONGOING';
    case 2: return 'FINISHED';
    case 5: return 'ABANDONED';
    case 6: return 'PAUSED';
    default: return 'ONGOING';
  }
}

// Export
if (typeof window !== 'undefined') {
  window.parseKotatsuBackup = parseKotatsuBackup;
  window.createKotatsuBackup = createKotatsuBackup;
}
