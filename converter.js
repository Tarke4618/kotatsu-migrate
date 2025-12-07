// converter.js

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
        result.debugData.kotatsuZipFiles = Object.keys(contents.files);

        // Helper to find file by fuzzy name
        const findFile = (namePart) => {
            const filenames = Object.keys(contents.files);
            return filenames.find(n => n.toLowerCase().includes(namePart.toLowerCase()));
        };

        // 1. Categories
        let kotatsuCategories = [];
        const catFile = findFile('categories.json');
        if (catFile) {
            try {
                const str = await contents.files[catFile].async('string');
                kotatsuCategories = JSON.parse(str);
            } catch (e) { console.warn("Failed to parse categories", e); }
        }

        // 2. Favourites
        let kotatsuFavs = [];
        const favFile = findFile('favourites.json') || findFile('favorites.json') || findFile('manga.json');
        if (favFile) {
            try {
                const str = await contents.files[favFile].async('string');
                kotatsuFavs = JSON.parse(str);
            } catch (e) {
                console.warn("Failed to parse favourites", e);
                result.debugData.parseError = e.message;
            }
        }

        result.debugData.kotatsuFavourites = kotatsuFavs;
        result.debugData.kotatsuCategories = kotatsuCategories;

        if (kotatsuFavs.length === 0) {
            throw new Error("No favourites found in zip. Files: " + result.debugData.kotatsuZipFiles.join(', '));
        }

        // ... MAPPING LOGIC ...
        const tachiCategories = kotatsuCategories.map((c, idx) => ({
            name: c.name || c,
            order: idx,
            flags: 0
        }));

        const tachiMangaList = kotatsuFavs.map(kManga => {
            return {
                source: mapSourceToTachiyomiId(kManga.source),
                url: kManga.url || "",
                title: kManga.title || "Unknown",
                artist: kManga.artist || "",
                author: kManga.author || "",
                description: kManga.description || "",
                genre: kManga.genre ? (Array.isArray(kManga.genre) ? kManga.genre : kManga.genre.split(',').map(s=>s.trim())) : [],
                status: mapStatus(kManga.status),
                thumbnailUrl: kManga.coverUrl || kManga.thumbnailUrl || "",
                dateAdded: kManga.dateAdded || Date.now(),
                categories: [], // Simplified for stability
            };
        });
        
        result.debugData.mappedTachiManga = tachiMangaList;

        // Proto encoding
        if (typeof protobuf === 'undefined' || typeof TACHIYOMI_PROTO_STRING === 'undefined') {
            throw new Error("Dependencies missing");
        }
        const root = protobuf.parse(TACHIYOMI_PROTO_STRING).root;
        const BackupMessage = root.lookupType("Backup");
        const payload = {
            backupManga: tachiMangaList,
            backupCategories: tachiCategories,
        };
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
        debugData: { isGzip: false }
    };

    if (typeof protobuf === 'undefined' || typeof TACHIYOMI_PROTO_STRING === 'undefined') {
        result.debugData.error = "Dependencies missing";
        return result;
    }

    try {
        const arrayBuffer = await file.arrayBuffer();
        const uint8Array = new Uint8Array(arrayBuffer);
        const isGzip = uint8Array.length > 2 && uint8Array[0] === 0x1f && uint8Array[1] === 0x8b;
        result.debugData.isGzip = isGzip;

        let protoData = uint8Array;
        if (isGzip) {
            try {
                protoData = pako.ungzip(uint8Array);
            } catch(e) {
                console.warn("Gzip failed, trying raw", e);
            }
        }
        
        result.debugData.protoSize = protoData.length;
        result.debugData.protoHexStart = Array.from(protoData.slice(0, 50)).map(b => b.toString(16).padStart(2,'0')).join(' ');

        const root = protobuf.parse(TACHIYOMI_PROTO_STRING).root;
        const BackupMessage = root.lookupType("Backup");
        
        // Decode
        const message = BackupMessage.decode(protoData);
        // If we get here, decode worked
        const backup = BackupMessage.toObject(message, {
            longs: String, 
            enums: String,
            bytes: String,
            defaults: true,
            arrays: true
        });

        result.debugData.tachiBackupKeys = Object.keys(backup);

        // Map
        const categories = (backup.backupCategories || []).map(c => ({
            name: c.name,
            order: c.order
        }));

        const favourites = (backup.backupManga || []).map(m => {
             return {
                id: generateId(m.url, m.title),
                title: m.title,
                author: m.author,
                artist: m.artist,
                description: m.description,
                url: m.url,
                coverUrl: m.thumbnailUrl,
                source: mapTachiyomiIdToSource(m.source),
                status: mapTachiStatus(m.status),
                genre: (m.genre || []).join(', '),
                dateAdded: Number(m.dateAdded),
                categories: mapTachiCategories(m.categories, categories)
            };
        });

        result.debugData.mappedDebug = favourites.slice(0, 3);

        const zip = new JSZip();
        zip.file("categories.json", JSON.stringify(categories, null, 2));
        zip.file("favourites.json", JSON.stringify(favourites, null, 2));
        
        result.blob = await zip.generateAsync({type: "blob"});
        result.success = true;

    } catch(e) {
        result.debugData.error = e.message;
        result.debugData.stack = e.stack;
    }
    
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
