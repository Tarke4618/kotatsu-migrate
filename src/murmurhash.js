/**
 * MurmurHash3 (32-bit) — optimized with Math.imul and hash cache
 */

const _hashCache = new Map();
const _CACHE_MAX = 4096;

function murmurhash3_32_gc(key, seed) {
  // Check cache for repeated hashes (same URL hashed multiple times)
  const cacheKey = seed + '|' + key;
  const cached = _hashCache.get(cacheKey);
  if (cached !== undefined) return cached;

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
    // falls through
    case 2: k1 ^= (key.charCodeAt(i + 1) & 0xff) << 8;
    // falls through
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

  const result = h1 >>> 0;

  // Evict oldest if cache is full
  if (_hashCache.size >= _CACHE_MAX) _hashCache.clear();
  _hashCache.set(cacheKey, result);

  return result;
}

/**
 * Generates a deterministic ID for a source name/lang combo.
 */
function generateSourceId(name, lang) {
  const key = name.toLowerCase() + ' ' + (lang || 'en');
  var hash = 0;
  for (var i = 0; i < key.length; i++) {
    hash = (Math.imul(31, hash) + key.charCodeAt(i)) | 0;
  }
  return String(hash);
}

if (typeof window !== 'undefined') {
  window.generateSourceId = generateSourceId;
}
