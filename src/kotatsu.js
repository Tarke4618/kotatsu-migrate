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

  // Build category lookup: Mihon category reference -> Kotatsu category_id
  // IMPORTANT: Mihon manga.categories array stores the ORDER value, not the ID!
  // We also map by ID as a fallback
  const categoryByOrder = {};  // order -> kotatsu category_id
  const categoryById = {};     // id -> kotatsu category_id
  
  // Current time in seconds for categories (Kotatsu uses seconds, not milliseconds)
  const catNowSeconds = Math.floor(Date.now() / 1000);
  
  const categories = data.categories.map((c, idx) => {
    // Use Mihon's original category ID - Kotatsu may require matching IDs
    const mihonOrder = c.order != null ? Number(c.order) : idx;
    const mihonId = c.id != null ? Number(c.id) : idx + 1;
    
    // Use the original Mihon ID for category_id instead of sequential numbers
    const kotatsuCatId = mihonId;
    
    const cat = {
      category_id: kotatsuCatId,
      created_at: catNowSeconds,
      sort_key: mihonOrder,
      title: c.name || `Category ${idx + 1}`,
      order: mihonOrder,  // Number, not string
      track: true,
      show_in_lib: true,
      deleted_at: 0,
    };
    
    // Map BOTH order and id to kotatsu category_id (which is now mihonId)
    categoryByOrder[mihonOrder] = kotatsuCatId;
    categoryById[mihonId] = kotatsuCatId;
    
    console.log(`[kotatsu] Category: "${c.name}" - order=${mihonOrder}, mihonId=${mihonId} -> Kotatsu ID ${kotatsuCatId}`);
    return cat;
  });
  
  // Ensure at least one category exists (Kotatsu requires categories)
  if (categories.length === 0) {
    categories.push({
      category_id: 1,
      created_at: catNowSeconds,
      sort_key: 0,
      title: 'Default',
      order: 0,  // Number, not string
      track: true,
      show_in_lib: true,
      deleted_at: 0,
    });
    categoryByOrder[0] = 1;
    categoryById[0] = 1;
    console.log('[kotatsu] Created default category since none provided');
  }
  
  console.log('[kotatsu] categoryByOrder lookup:', categoryByOrder);
  console.log('[kotatsu] categoryById lookup:', categoryById);

  // Collect unique sources
  const sourcesSet = new Set();

  // Convert Mihon manga to Kotatsu favourites format
  // All manga in Mihon backup are library entries (favorites)
  // Kotatsu stores one favourite entry per manga-category pair
  // If manga is in multiple categories, create multiple favourite entries
  const favourites = [];
  let sortKeyCounter = 0;
  
  data.manga.forEach((m, mangaIdx) => {
    const sourceName = window.findKotatsuSourceName 
      ? window.findKotatsuSourceName(m.source) 
      : 'UNKNOWN';
    sourcesSet.add(sourceName);
    
    const mangaId = generateMangaId(m.url || '', sourceName);
    
    // Build tags from genre array with proper id and pinned fields
    const tags = (m.genre || []).map(g => ({
      id: generateTagId(String(g), sourceName),
      title: String(g),
      key: String(g).toLowerCase().replace(/\s+/g, '_'),
      source: sourceName,
      pinned: false,
    }));

    // Build manga object (shared across all category entries)
    const mangaObj = {
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
    };

    // Get category references from Mihon manga
    // Mihon stores ORDER values in manga.categories, not category IDs
    const mihonCatRefs = m.categories || [];
    
    if (mangaIdx < 5) {
      console.log(`[kotatsu] Manga "${m.title}": categories array = [${mihonCatRefs.join(', ')}]`);
    }
    
    if (mihonCatRefs.length === 0) {
      // No category - use first available or default to 1
      const defaultCatId = categories.length > 0 ? categories[0].category_id : 1;
      favourites.push({
        manga_id: mangaId,
        category_id: defaultCatId,
        sort_key: sortKeyCounter++,
        pinned: false,
        created_at: m.dateAdded || Date.now(),
        deleted_at: 0,
        manga: mangaObj,
      });
    } else {
      // Create one favourite entry per category
      mihonCatRefs.forEach(catRef => {
        // Convert to number (protobuf returns int64 as strings)
        const catRefNum = Number(catRef);
        const catRefStr = String(catRef);
        
        // Try both number and string key lookups
        let kotatsuCatId = categoryByOrder[catRefNum] || categoryByOrder[catRefStr];
        if (kotatsuCatId == null) {
          kotatsuCatId = categoryById[catRefNum] || categoryById[catRefStr];
        }
        
        if (kotatsuCatId != null) {
          favourites.push({
            manga_id: mangaId,
            category_id: kotatsuCatId,
            sort_key: sortKeyCounter++,
            pinned: false,
            created_at: m.dateAdded || Date.now(),
            deleted_at: 0,
            manga: mangaObj,
          });
          if (mangaIdx < 5) {
            console.log(`[kotatsu]   -> catRef ${catRef} resolved to kotatsu category ${kotatsuCatId}`);
          }
        } else {
          // Category reference not found - use default
          console.warn(`[kotatsu] Unknown category ref: ${catRef} for manga "${m.title}"`);
          const defaultCatId = categories.length > 0 ? categories[0].category_id : 1;
          favourites.push({
            manga_id: mangaId,
            category_id: defaultCatId,
            sort_key: sortKeyCounter++,
            pinned: false,
            created_at: m.dateAdded || Date.now(),
            deleted_at: 0,
            manga: mangaObj,
          });
        }
      });
    }
    
    // Debug first few manga
    if (mangaIdx < 3) {
      console.log(`[kotatsu] Manga "${m.title}": Mihon categories=${JSON.stringify(mihonCatRefs)}`);
    }
  });

  // Convert history - each entry needs a full manga object
  const history = [];
  data.manga.forEach((m, mangaIdx) => {
    if (m.history && m.history.length > 0) {
      const sourceName = window.findKotatsuSourceName 
        ? window.findKotatsuSourceName(m.source) 
        : 'UNKNOWN';
      const mangaId = generateMangaId(m.url || '', sourceName);
      
      // Build tags for manga object
      const tags = (m.genre || []).map(g => ({
        id: generateTagId(String(g), sourceName),
        title: String(g),
        key: String(g).toLowerCase().replace(/\s+/g, '_'),
        source: sourceName,
        pinned: false,
      }));

      // Build manga object for history entries
      const mangaObj = {
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
      };
      
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
          manga: mangaObj,  // Required by Kotatsu
        });
      });
    }
  });

  // Build sources list - must have: source, sort_key, used_at, added_in
  // Using seconds instead of milliseconds to avoid int parsing issues
  const nowSeconds = Math.floor(Date.now() / 1000);
  const sources = Array.from(sourcesSet).map((name, idx) => ({
    source: name,
    sort_key: idx,
    used_at: nowSeconds,
    added_in: nowSeconds,
  }));

  // Debug: Count favourites by category before writing
  const favCatCounts = {};
  favourites.forEach(f => {
    favCatCounts[f.category_id] = (favCatCounts[f.category_id] || 0) + 1;
  });
  console.log(`[kotatsu] Total favourites created: ${favourites.length}`);
  console.log('[kotatsu] Favourites per category_id:', favCatCounts);

  // Add essential Kotatsu backup files
  // Only include files that are needed for restore - empty files may cause errors
  zip.file('favourites', JSON.stringify(favourites));
  zip.file('categories', JSON.stringify(categories));
  zip.file('history', JSON.stringify(history));
  zip.file('bookmarks', JSON.stringify([]));
  zip.file('sources', JSON.stringify(sources));
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
