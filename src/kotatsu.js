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

// Export for use in app.js
window.parseKotatsuBackup = parseKotatsuBackup;
