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

  // Convert Mihon manga to Kotatsu format
  const favourites = data.manga.map((m, idx) => ({
    id: m.id || idx + 1,
    title: m.title || 'Unknown',
    alt_title: null,
    url: m.url || '',
    public_url: m.url || '',
    rating: -1,
    is_nsfw: false,
    cover_url: m.thumbnailUrl || '',
    large_cover_url: m.thumbnailUrl || '',
    state: mapMihonStatusToKotatsu(m.status),
    author: m.author || '',
    source: window.findKotatsuSourceName ? window.findKotatsuSourceName(m.source) : 'UNKNOWN',
    category_id: m.categories?.[0] ?? 0,
  }));

  // Convert categories
  const categories = data.categories.map((c, idx) => ({
    id: c.id || idx + 1,
    title: c.name || `Category ${idx + 1}`,
    order: c.order || idx,
    created_at: Date.now(),
  }));

  // Convert history
  const history = [];
  data.manga.forEach((m, mangaIdx) => {
    if (m.history && m.history.length > 0) {
      m.history.forEach(h => {
        history.push({
          manga_id: m.id || mangaIdx + 1,
          created_at: h.lastRead || Date.now(),
          updated_at: h.lastRead || Date.now(),
          chapters: 1,
          page: 0,
          scroll: 0,
          percent: 0,
        });
      });
    }
  });

  // Add files to ZIP
  zip.file('favourites.json', JSON.stringify(favourites, null, 2));
  zip.file('categories.json', JSON.stringify(categories, null, 2));
  zip.file('history.json', JSON.stringify(history, null, 2));
  zip.file('bookmarks.json', JSON.stringify([], null, 2));
  zip.file('index', JSON.stringify({
    app_id: 'org.koitharu.kotatsu',
    app_version: 600,
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
