// src/kotatsu.js - Kotatsu Backup Parser & Builder
// cspell:ignore favourites
// Format: ZIP archive containing JSON files

// Precompute source name transform cache
const _sourceNameCache = new Map();

function toKotatsuSourceName(name) {
  if (!name) return 'UNKNOWN';
  const cached = _sourceNameCache.get(name);
  if (cached) return cached;
  const result = name.toUpperCase().replace(/[^A-Z0-9]/g, '_');
  _sourceNameCache.set(name, result);
  return result;
}

/**
 * Parse a Kotatsu backup file (.bk.zip)
 */
async function parseKotatsuBackup(file) {
  const result = {
    success: false,
    data: { manga: [], categories: [], history: [], bookmarks: [] },
    debug: { files: [], errors: [] }
  };

  try {
    const contents = await (new JSZip()).loadAsync(file);
    const fileKeys = Object.keys(contents.files);
    result.debug.files = fileKeys;

    // Single-pass file detection via direct property access (no iteration needed)
    const tryRead = async (names) => {
      for (let i = 0; i < names.length; i++) {
        const f = contents.files[names[i]];
        if (f && !f.dir) return f.async('string');
      }
      return null;
    };

    // Parallel JSON reads — all 4 files decompress concurrently
    const [favRaw, catRaw, histRaw, bookRaw] = await Promise.all([
      tryRead(['favourites', 'favourites.json', 'manga.json']),
      tryRead(['categories', 'categories.json']),
      tryRead(['history', 'history.json']),
      tryRead(['bookmarks', 'bookmarks.json']),
    ]);

    // Parse all JSON in one batch
    if (favRaw)  { try { result.data.manga     = JSON.parse(favRaw);  } catch(e) { result.debug.errors.push('favorites: ' + e.message); } }
    if (catRaw)  { try { result.data.categories = JSON.parse(catRaw);  } catch(e) { result.debug.errors.push('categories: ' + e.message); } }
    if (histRaw) { try { result.data.history    = JSON.parse(histRaw); } catch(e) { result.debug.errors.push('history: ' + e.message); } }
    if (bookRaw) { try { result.data.bookmarks  = JSON.parse(bookRaw); } catch(e) { result.debug.errors.push('bookmarks: ' + e.message); } }

    result.success = result.data.manga.length > 0;
    if (!result.success) result.debug.errors.push('No manga found');
  } catch (e) {
    result.debug.errors.push('ZIP: ' + e.message);
  }

  return result;
}


/**
 * Create a Kotatsu backup file (.bk.zip) from Mihon parsed data
 */
async function createKotatsuBackup(data) {
  const zip = new JSZip();
  const timestamp = Date.now();

  // --- Build source lookup from Mihon data ---
  const mihonSourceLookup = new Map();
  const sources = data.sources;
  if (sources) {
    for (let i = 0; i < sources.length; i++) {
      mihonSourceLookup.set(String(sources[i].sourceId), sources[i].name);
    }
  }

  // --- Categories: single-pass build + lookup map ---
  const cats = data.categories;
  const catLen = cats.length;
  const kotatsuCategories = new Array(catLen);
  const mihonOrderToKotatsuId = Object.create(null); // prototype-free map

  for (let i = 0; i < catLen; i++) {
    const c = cats[i];
    const catId = i + 1;
    kotatsuCategories[i] = {
      category_id: catId,
      created_at: timestamp,
      sort_key: i,
      title: c.name || ('Category ' + catId),
      order: "NEWEST",
      track: true,
      show_in_lib: true,
    };
    const orderKey = c.order !== undefined ? c.order : i;
    mihonOrderToKotatsuId[orderKey] = catId;
  }

  // --- Category find helper for extra categories (indexed map) ---
  const catByOrder = Object.create(null);
  const catById = Object.create(null);
  for (let i = 0; i < catLen; i++) {
    const c = cats[i];
    catByOrder[c.order] = c;
    catById[c.id] = c;
  }

  // --- Favourites + History: single pass, pre-allocated arrays ---
  const mangaList = data.manga;
  const mangaLen = mangaList.length;
  const kotatsuFavorites = new Array(mangaLen);
  const kotatsuHistory = [];
  const findSource = window.findKotatsuSourceName;

  for (let i = 0; i < mangaLen; i++) {
    const m = mangaList[i];
    const mangaUrl = m.url || '';
    const mangaId = generateStableMangaId(mangaUrl, i);

    // Category — direct map lookup
    let categoryId = 0;
    const mCats = m.categories;
    if (mCats && mCats.length > 0) {
      categoryId = mihonOrderToKotatsuId[mCats[0]] || 0;
    }

    // Source — cached transform
    let sourceName;
    const srcId = String(m.source || '0');
    const localName = mihonSourceLookup.get(srcId);
    if (localName) {
      sourceName = toKotatsuSourceName(localName);
    } else {
      const resolved = findSource ? findSource(srcId) : 'Unknown';
      sourceName = (resolved && resolved !== 'Unknown') ? toKotatsuSourceName(resolved) : 'UNKNOWN';
    }

    // Tags from genres — avoid .map() overhead
    const genres = m.genre;
    const genreLen = genres ? genres.length : 0;
    const tags = new Array(genreLen);
    for (let g = 0; g < genreLen; g++) {
      const genre = genres[g];
      tags[g] = { title: genre, key: genre.toLowerCase().replace(/\s+/g, '_'), source: sourceName };
    }

    // Extra categories as tags
    if (mCats && mCats.length > 1) {
      for (let c = 1; c < mCats.length; c++) {
        const ref = mCats[c];
        const cat = catByOrder[ref] || catById[ref];
        if (cat) {
          tags.push({ title: cat.name, key: 'category:' + cat.name.toLowerCase(), source: 'MIGRATE_CAT' });
        }
      }
    }

    // Status
    const status = window.mapMihonStatusToKotatsu
      ? window.mapMihonStatusToKotatsu(m.status)
      : 'ONGOING';

    const mangaObj = {
      id: mangaId,
      title: m.title || 'Unknown',
      alt_title: '',
      url: mangaUrl,
      public_url: mangaUrl,
      rating: -1.0,
      nsfw: false,
      content_rating: '',
      cover_url: m.thumbnailUrl || '',
      large_cover_url: m.thumbnailUrl || '',
      state: status,
      author: m.author || m.artist || '',
      source: sourceName,
      tags: tags,
    };

    kotatsuFavorites[i] = {
      manga_id: mangaId,
      category_id: categoryId,
      sort_key: 0,
      pinned: false,
      created_at: Number(m.dateAdded) || timestamp,
      manga: mangaObj,
    };

    // History
    const hist = m.history;
    if (hist && hist.length > 0) {
      for (let h = 0; h < hist.length; h++) {
        const he = hist[h];
        const chUrl = he.url || '';
        const lastRead = Number(he.lastRead) || timestamp;
        kotatsuHistory.push({
          manga_id: mangaId,
          created_at: lastRead,
          updated_at: lastRead,
          chapter_id: generateStableMangaId(chUrl, 0),
          page: 0,
          scroll: 0.0,
          percent: 0.0,
          chapters: 0,
          manga: mangaObj,
        });
      }
    }
  }

  // --- Serialize all JSON strings ---
  // Build strings upfront before handing to ZIP (avoids interleaved serialization)
  const indexStr = JSON.stringify([{ app_id: "org.koitharu.kotatsu", app_version: 800, created_at: timestamp }]);
  const favStr = JSON.stringify(kotatsuFavorites);
  const catStr = JSON.stringify(kotatsuCategories);
  const histStr = JSON.stringify(kotatsuHistory);

  zip.file("index", indexStr);
  zip.file("favourites", favStr);
  zip.file("categories", catStr);
  zip.file("history", histStr);
  zip.file("bookmarks", "[]");
  zip.file("sources", "[]");
  zip.file("settings", "[]");

  return zip.generateAsync({ type: "blob", compression: "DEFLATE", compressionOptions: { level: 1 } });
}

/**
 * Generate a stable positive manga ID from a URL string.
 */
function generateStableMangaId(url, fallbackIdx) {
  if (!url || url.length === 0) return fallbackIdx + 1;

  const h1 = murmurhash3_32_gc(url, 0x1234);
  const h2 = murmurhash3_32_gc(url, 0x5678);
  return h1 * 65536 + (h2 >>> 16);
}

if (typeof window !== 'undefined') {
  window.parseKotatsuBackup = parseKotatsuBackup;
  window.createKotatsuBackup = createKotatsuBackup;
}
