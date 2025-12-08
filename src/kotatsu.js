// src/kotatsu.js - Kotatsu Backup Parser
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

    // Find and parse JSON files (recursive search)
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

    // Parse favorites (manga list)
    if (jsonFiles.favorites) {
      try {
        const data = JSON.parse(jsonFiles.favorites);
        result.data.manga = Array.isArray(data) ? data : [];
      } catch (e) {
        result.debug.errors.push(`Failed to parse favorites: ${e.message}`);
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
 * Create a Kotatsu backup file (.bk.zip) from normalized data
 * @param {Object} data - Normalized backup data (from Mihon parser)
 * @returns {Promise<Blob>} The .bk.zip file as a Blob
 */
async function createKotatsuBackup(data) {
  const zip = new JSZip();
  const timestamp = Date.now();

  // 1. Categories
  // Map normalized categories to Kotatsu format
  const kotatsuCategories = data.categories.map((c, idx) => ({
    category_id: idx + 1, // Generate 1-based IDs
    title: c.name,
    order: "NEWEST", // Default sort order
    show_in_lib: true,
    track: true,
    created_at: timestamp,
    sort_key: c.order || idx
  }));

  // Create a lookup for category name -> id to help manga mapping
  const categoryNameMap = {};
  kotatsuCategories.forEach(c => {
    categoryNameMap[c.title] = c.category_id;
  });

  // 2. Manga (Favorites)
  // Map normalized manga to Kotatsu format
  const kotatsuFavorites = [];
  const kotatsuHistory = [];

  data.manga.forEach((m, idx) => {
    // Determine category ID & Extra Tags
    // Mihon allows multiple categories, Kotatsu allows one.
    // Strategy: 
    // 1. Pick the first valid category as the main Kotatsu "folder" (category_id).
    // 2. Add any SUBSEQUENT categories as tags to preserve data.
    let categoryId = 0; 
    let extraTags = [];

    if (m.categories && m.categories.length > 0) {
      m.categories.forEach((catIdOrOrder, idx) => {
        // Find category by ID (protobuf) or Order (fallback)
        const cat = data.categories.find(c => c.id === catIdOrOrder || c.order === catIdOrOrder);
        
        if (cat) {
          if (idx === 0) {
            // First category becomes the main folder
            categoryId = categoryNameMap[cat.name] || 0;
          } else {
            // Subsequent categories become tags
            extraTags.push({
              title: cat.name, // Use simple name like "Reading" or "Fantasy"
              key: `category:${cat.name.toLowerCase()}`, // Unique key
              source: "MIGRATE_CAT"
            });
          }
        }
      });
    }

    // Resolve Source Name
    // m.source is the ID (Int64). We need the Name.
    const sourceName = window.findKotatsuSourceName ? window.findKotatsuSourceName(m.source) : "Unknown";
    const status = window.mapMihonStatusToKotatsu ? window.mapMihonStatusToKotatsu(m.status) : "ONGOING";

    // Merge existing tags with our new extra-category tags
    const existingTags = (m.genre || []).map(g => ({ title: g, key: g, source: sourceName }));
    const finalTags = [...existingTags, ...extraTags];

    const mangaObj = {
      manga_id: m.id || ((idx + 1) * -1), // Generate a temp ID if missing
      category_id: categoryId,
      sort_key: 0,
      pinned: false,
      created_at: m.dateAdded || timestamp,
      manga: {
        id: m.id || ((idx + 1) * -1),
        title: m.title,
        url: m.url,
        public_url: m.url, // Best guess
        cover_url: m.thumbnailUrl,
        state: status,
        author: m.author,
        source: sourceName,
        tags: finalTags
      }
    };
    kotatsuFavorites.push(mangaObj);

    // 3. History
    if (m.history && m.history.length > 0) {
      m.history.forEach(h => {
        kotatsuHistory.push({
          manga_id: mangaObj.manga_id,
          created_at: h.lastRead || timestamp,
          updated_at: h.lastRead || timestamp,
          // Mihon history doesn't strictly have chapter IDs, often uses URL.
          // Kotatsu needs a unique identifying way.
          // We'll leave chapter_id as valid-looking integer hash of url
          chapter_id: stringHash(h.url), 
          scroll: 0,
          percent: 0,
          page: 0
        });
      });
    }
  });

  // Add files to ZIP
  zip.file("categories.json", JSON.stringify(kotatsuCategories));
  zip.file("favourites.json", JSON.stringify(kotatsuFavorites));
  zip.file("history.json", JSON.stringify(kotatsuHistory));
  
  // Add empty/default files for completeness
  zip.file("bookmarks.json", "[]");
  zip.file("settings.json", "{}");
  zip.file("index", '{"version":1}'); 

  // Generate blob
  return await zip.generateAsync({ type: "blob" });
}

// Helper: Simple string hash for IDs
function stringHash(str) {
  let hash = 0;
  if (str.length === 0) return hash;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return hash;
}

// Export for use in app.js
if (typeof window !== 'undefined') {
  window.parseKotatsuBackup = parseKotatsuBackup;
  window.createKotatsuBackup = createKotatsuBackup;
}
