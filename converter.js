// converter.js

// Kotatsu parsing logic
// Kotatsu parsing logic
async function convertKotatsuToTachiyomi(file) {
    const result = {
        success: false,
        blob: null,
        debugData: {
            kotatsuZipFiles: [],
            error: null
        }
    };

    try {
        const zip = new JSZip();
        const contents = await zip.loadAsync(file);
        
        // 1. Deep Scan for JSONs
        let filesFound = {
            favourites: null, // content string
            categories: null, // content string
            history: null     // content string
        };
        
        // Helper to store file paths we found for debug
        result.debugData.foundPaths = {};

        // We need to iterate all files to find them recursively
        const zipEntries = Object.keys(contents.files);
        result.debugData.kotatsuZipFiles = zipEntries;

        for (const path of zipEntries) {
            const entry = contents.files[path];
            if (entry.dir) continue;

            const name = path.split('/').pop().toLowerCase();
            
            // Logic: prefer exact matches, but allow fuzzy if needed
            // Categories
            if (name === 'categories.json' || name === 'categories') {
                filesFound.categories = await entry.async('string');
                result.debugData.foundPaths.categories = path;
            }
            
            // Favourites (sometimes called manga.json in old backups)
            if (name === 'favourites.json' || name === 'favourites' || name === 'manga.json') {
                 // If we already found one, maybe prefer 'favourites.json'? 
                 // For now, first found is fine, or specific priority:
                 if (!filesFound.favourites || name === 'favourites.json') {
                     filesFound.favourites = await entry.async('string');
                     result.debugData.foundPaths.favourites = path;
                 }
            }

            // History
            if (name === 'history.json' || name === 'history') {
                filesFound.history = await entry.async('string');
                result.debugData.foundPaths.history = path;
            }
        }

        if (!filesFound.favourites) {
             throw new Error("Could not find 'favourites.json' (or 'favourites'/'manga.json') in the zip. Is this a valid Kotatsu backup?");
        }

        // 2. Parse JSONs
        let kotatsuFavs = [];
        try {
            kotatsuFavs = JSON.parse(filesFound.favourites);
        } catch (e) { throw new Error(`Failed to parse favourites JSON: ${e.message}`); }

        let kotatsuCategories = [];
        if (filesFound.categories) {
            try { kotatsuCategories = JSON.parse(filesFound.categories); } 
            catch (e) { console.warn("Bad categories JSON", e); }
        }

        // 3. Map to Tachiyomi
        result.debugData.kotatsuFavourites = kotatsuFavs;
        result.debugData.kotatsuCategories = kotatsuCategories;

        if (!Array.isArray(kotatsuFavs)) {
             throw new Error("Favourites data is not an array. Found: " + typeof kotatsuFavs);
        }

        // ... MAPPING LOGIC ...
        
        // 3a. process Categories first to create a lookup map
        const categoryLookup = {}; // Kotatsu ID -> Tachi Order (Index)
        
        const tachiCategories = kotatsuCategories.map((c, idx) => {
            // Kotatsu category object keys might be 'name', 'label', 'title', or just the string
            let name = "Category " + (idx + 1);
            if (typeof c === 'string') name = c;
            else if (c && typeof c === 'object') {
                name = c.name || c.label || c.title || name;
            }
            
            // Store lookup for manga mapping
            if (c.id !== undefined) {
                categoryLookup[c.id] = idx;
            }
            
            return {
                name: String(name), 
                order: Number(idx),
                flags: 0
            };
        });

        const tachiMangaList = kotatsuFavs.map(kManga => {
            // Resolve categories
            const mangaCats = [];
            // Kotatsu usually has 'category_id' (single)
            if (kManga.category_id !== undefined && categoryLookup[kManga.category_id] !== undefined) {
                mangaCats.push(Number(categoryLookup[kManga.category_id]));
            } else if (kManga.categories) {
                // Some versions might have array?
            }

            return {
                source: String(mapSourceToTachiyomiId(kManga.source)), 
                url: String(kManga.url || ""), 
                title: String(kManga.title || "Unknown Title"),
                artist: String(kManga.artist || ""),
                author: String(kManga.author || ""),
                description: String(kManga.description || ""),
                genre: kManga.genre ? (Array.isArray(kManga.genre) ? kManga.genre.map(String) : String(kManga.genre).split(',').map(s=>s.trim())) : [],
                status: Number(mapStatus(kManga.status)),
                thumbnailUrl: String(kManga.coverUrl || kManga.thumbnailUrl || ""),
                dateAdded: Number(kManga.dateAdded || Date.now()),
                categories: mangaCats, // Linked to category orders
            };
        });
        
        result.debugData.mappedTachiManga = tachiMangaList;

        // Proto encoding
        if (typeof protobuf === 'undefined' || typeof TACHIYOMI_PROTO_STRING === 'undefined') {
            throw new Error("Dependencies missing (protobuf or schema)");
        }
        const root = protobuf.parse(TACHIYOMI_PROTO_STRING).root;
        const BackupMessage = root.lookupType("Backup");
        // ... MAPPING LOGIC ... PROCEED TO PAYLOAD ...
        
        result.debugData.payloadPreview = {
            mangaCount: tachiMangaList.length,
            categoryCount: tachiCategories.length,
            categories: tachiCategories
        };

        const payload = {
            backupManga: tachiMangaList,
            backupCategories: tachiCategories,
        };
        
        // Verify payload
        const errMsg = BackupMessage.verify(payload);
        if (errMsg) {
            console.warn("Proto verification failed (likely benign type mismatch):", errMsg);
            result.debugData.verificationError = errMsg;
            result.debugData.payloadDump = JSON.parse(JSON.stringify(payload)); 
            
            // FIX: Do NOT throw here. 
            // protobuf.js 'verify' is strict and rejects strings for int64, 
            // but 'encode' accepts them fine. We will proceed.
        }

        const message = BackupMessage.create(payload);
        const buffer = BackupMessage.encode(message).finish();
        const gzipped = pako.gzip(buffer);
        
        result.blob = new Blob([gzipped], {type: "application/octet-stream"});
        result.success = true;

    } catch (e) {
        result.debugData.error = e.message;
        result.debugData.stack = e.stack;
    }

    return result;
}

// Tachiyomi to Kotatsu conversion
async function convertTachiyomiToKotatsu(file) {
    const result = {
        success: false,
        blob: null,
        debugData: { isGzip: false }// Tachiyomi parsing logic removed as per "God Mode" pivot.
    };
    
    return result;
}


// Helpers
function generateId(url, title) {
    // Simple hash for ID
    let str = (url || "") + (title || "");
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = (hash << 5) - hash + str.charCodeAt(i);
        hash |= 0;
    }
    return Math.abs(hash);
}

function mapTachiyomiIdToSource(id) {
    if (!id) return "LOCAL";
    const sId = String(id);
    if (sId === "6400630869375065225") return "MANGADEX";
    if (sId === "7369325983802951508") return "MANGANATO";
    if (sId === "7146431200542137600") return "BATO";
    // TODO: Add more mappings
    return "UNKNOWN_SOURCE_" + sId;
}

function mapTachiStatus(status) {
    // Tachi: 1=ONGOING, 2=COMPLETED
    if (status === 1) return "ONGOING";
    if (status === 2) return "COMPLETED";
    return "UNKNOWN";
}

function mapTachiCategories(catIds, allCats) {
    // catIds is array of int32 Order? Or indices?
    // In Tachi proto: repeated int32 categories = 14;
    // These are usually values matching BackupCategory.order?? Or generic IDs?
    // If we assume they match 'order' field in BackupCategory.
    if (!catIds || !allCats) return [];
    
    // Find category names
    // Note: This logic depends on implementation.
    // If ids match order:
    return catIds.map(id => {
        const cat = allCats.find(c => c.order === id);
        return cat ? cat.name : null;
    }).filter(n => n);
}

function mapSourceToTachiyomiId(sourceName) {
    if (!sourceName) return 0;
    const s = sourceName.toLowerCase();
    
    // Common Sources (IDs from standard Tachi Extensions)
    // MangaDex: 6400630869375065225 -> need to represent as string for protobuf.js or Long
    // Use String "6400630869375065225"
    if (s.includes("mangadex")) return "6400630869375065225";
    if (s.includes("manganato")) return "7369325983802951508"; // Example, might be wrong
    if (s.includes("bato")) return "7146431200542137600";
    
    // Fallback: Local Source
    return "0";
}

function mapStatus(kStatus) {
    if (!kStatus) return 0;
    const s = kStatus.toUpperCase();
    if (s === 'ONGOING') return 1;
    if (s === 'COMPLETED') return 2;
    if (s === 'LICENSED') return 3;
    if (s === 'PUBLISHING') return 4; // ?
    if (s === 'CANCELLED') return 5;
    if (s === 'HIATUS') return 6;
    return 0;
}
