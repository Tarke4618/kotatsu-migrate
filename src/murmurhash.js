/**
 * Kotatsu 64-Bit Hashing and ID Generation Utilities
 */

const LONG_HASH_SEED = 1125899906842597n;

/**
 * Kotlin-compatible String.longHashCode() implementation using BigInt
 * @param {string} str 
 * @returns {bigint} Signed 64-bit integer as BigInt
 */
function longHashCode(str) {
  let h = LONG_HASH_SEED;
  const len = str.length;
  for (let i = 0; i < len; i++) {
    h = (31n * h + BigInt(str.charCodeAt(i))) & 0xffffffffffffffffn;
  }
  // Convert unsigned 64-bit to signed 64-bit BigInt
  if (h >= 0x8000000000000000n) {
    h = h - 0x10000000000000000n;
  }
  return h;
}

/**
 * Generate Kotatsu UID from source and URL string (BigInt version)
 * @param {string} sourceName 
 * @param {string} urlStr 
 * @returns {bigint} Signed 64-bit integer
 */
function generateUidStr(sourceName, urlStr) {
  let h = LONG_HASH_SEED;
  for (let i = 0; i < sourceName.length; i++) {
    h = (31n * h + BigInt(sourceName.charCodeAt(i))) & 0xffffffffffffffffn;
  }
  for (let i = 0; i < urlStr.length; i++) {
    h = (31n * h + BigInt(urlStr.charCodeAt(i))) & 0xffffffffffffffffn;
  }
  if (h >= 0x8000000000000000n) {
    h = h - 0x10000000000000000n;
  }
  return h;
}

/**
 * Generate Kotatsu UID from source and a Long ID value (BigInt version)
 * @param {string} sourceName 
 * @param {bigint|number} valLong 
 * @returns {bigint} Signed 64-bit integer
 */
function generateUidLong(sourceName, valLong) {
  let h = LONG_HASH_SEED;
  for (let i = 0; i < sourceName.length; i++) {
    h = (31n * h + BigInt(sourceName.charCodeAt(i))) & 0xffffffffffffffffn;
  }
  const bigVal = BigInt(valLong) & 0xffffffffffffffffn;
  h = (31n * h + bigVal) & 0xffffffffffffffffn;
  if (h >= 0x8000000000000000n) {
    h = h - 0x10000000000000000n;
  }
  return h;
}

/**
 * Extract the canonical slug for a Kotatsu source name and Mihon URL
 * @param {string} sourceName 
 * @param {string} url 
 * @returns {string} The URL or slug to be hashed
 */
function getKotatsuSlug(sourceName, url) {
  if (!url) return "";
  
  const normSource = String(sourceName).toUpperCase();
  
  if (normSource === "COMIX" || normSource === "COMICK_FUN") {
    // Strip "/title/" or "/comic/" or leading slashes
    return url.replace(/^\/?(title|comic)\//, "").replace(/\/$/, "");
  }
  
  if (normSource === "MANGADEX") {
    // Strip "/manga/" or leading slashes
    return url.replace(/^\/?manga\//, "").replace(/\/$/, "");
  }
  
  if (normSource === "LOCAL") {
    // Decode percent encoding and strip file:// scheme to get absolute path
    let decoded = url;
    try {
      decoded = decodeURIComponent(url);
    } catch (e) {
      console.warn("URI decode failed for LOCAL url:", url);
    }
    return decoded.replace(/^file:\/\/\/?/, "/").replace(/\/$/, "");
  }
  
  // Standard sources: return relative URL with leading slash if not present
  if (url.startsWith("http")) {
    try {
      const u = new URL(url);
      return u.pathname + u.search;
    } catch (e) {
      return url;
    }
  }
  return url.startsWith("/") ? url : "/" + url;
}

/**
 * Generate a stable manga ID for Kotatsu from source and URL
 * @param {string} sourceName 
 * @param {string} url 
 * @returns {string} Stable signed 64-bit ID as a string to prevent precision loss in JS
 */
function generateKotatsuMangaId(sourceName, url) {
  const normSource = String(sourceName).toUpperCase();
  const slug = getKotatsuSlug(sourceName, url);
  
  let val;
  if (normSource === "LOCAL") {
    val = longHashCode(slug);
  } else {
    val = generateUidStr(normSource, slug);
  }
  return val.toString();
}

/**
 * Legacy Murmur3 functions kept for backwards compatibility or dynamic ID fallback
 */
function murmurhash3_32_gc(key, seed) {
  var remainder = key.length & 3;
  var bytes = key.length - remainder;
  var h1 = seed | 0;
  var k1;
  var i = 0;

  while (i < bytes) {
    k1 =
      (key.charCodeAt(i) & 0xff) |
      ((key.charCodeAt(i + 1) & 0xff) << 8) |
      ((key.charCodeAt(i + 2) & 0xff) << 16) |
      ((key.charCodeAt(i + 3) & 0xff) << 24);
    i += 4;

    k1 = Math.imul(k1, 0xcc9e2d51);
    k1 = ((k1 & 0x1ffff) << 15) | (k1 >>> 17);
    k1 = Math.imul(k1, 0x1b873593);

    h1 ^= k1;
    h1 = ((h1 & 0x7ffff) << 13) | (h1 >>> 19);
    h1 = (Math.imul(h1, 5) + 0xe6546b64) | 0;
  }

  k1 = 0;

  switch (remainder) {
    case 3: k1 ^= (key.charCodeAt(i + 2) & 0xff) << 16;
    case 2: k1 ^= (key.charCodeAt(i + 1) & 0xff) << 8;
    case 1: k1 ^= (key.charCodeAt(i) & 0xff);
      k1 = Math.imul(k1, 0xcc9e2d51);
      k1 = ((k1 & 0x1ffff) << 15) | (k1 >>> 17);
      k1 = Math.imul(k1, 0x1b873593);
      h1 ^= k1;
  }

  h1 ^= key.length;
  h1 ^= h1 >>> 16;
  h1 = Math.imul(h1, 0x85ebca6b);
  h1 ^= h1 >>> 13;
  h1 = Math.imul(h1, 0xc2b2ae35);
  h1 ^= h1 >>> 16;

  return h1 >>> 0;
}

function generateSourceId(name, lang) {
  const key = name.toLowerCase() + ' ' + (lang || 'en');
  var hash = 0;
  for (var i = 0; i < key.length; i++) {
    hash = (Math.imul(31, hash) + key.charCodeAt(i)) | 0;
  }
  return String(hash);
}

if (typeof window !== 'undefined') {
  window.longHashCode = longHashCode;
  window.generateUidStr = generateUidStr;
  window.generateUidLong = generateUidLong;
  window.getKotatsuSlug = getKotatsuSlug;
  window.generateKotatsuMangaId = generateKotatsuMangaId;
  window.generateSourceId = generateSourceId;
  window.murmurhash3_32_gc = murmurhash3_32_gc;
}
