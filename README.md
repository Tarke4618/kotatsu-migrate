# MangaMigrate

**Seamless backup conversion between Kotatsu and Mihon/Tachiyomi**

A web-based tool for converting manga library backups between Kotatsu (`.bk.zip`) and Mihon/Tachiyomi (`.tachibk`) formats.

## Features

- **Bidirectional Conversion**: Kotatsu ↔ Mihon
- **Auto-Detection**: Simply drop your file, and the tool detects the format
- **Preserves Data**: Manga, categories, favorites, and reading history
- **Comprehensive Source Mapping**: **3300+** sources supported (MangaDex, Bato, Webtoons, etc.)
- **Dynamic ID Generation**: Unknown/Kotatsu-only sources are automatically handled with deterministic ID generation
- **Smart Category Handling**:
  - Mihon → Kotatsu: Primary category maps to folder, extra categories become **Tags** (e.g., `Category: Fantasy`)
- **No Installation**: Works entirely in your browser
- **Privacy First**: All processing happens locally - no data uploaded

## Usage

1. **Open the tool**: open `index.html` locally
2. **Drop your backup**: Drag and drop your `.bk.zip` or `.tachibk` file
3. **Download result**: Click "Download" when conversion completes
4. **Import**: Load the converted backup in your target app

## Supported Data

| Data Type          | Kotatsu → Mihon | Mihon → Kotatsu |
| ------------------ | :-------------: | :-------------: |
| Manga Library      |       ✅        |       ✅        |
| Categories         |       ✅        |       ✅        |
| Favorites          |       ✅        |       ✅        |
| Reading History    |       ✅        |       ✅        |
| Chapters           |   ⚠️ Partial    |   ⚠️ Partial    |
| Tracking (MAL, AL) |       ❌        |       ❌        |
| Settings           |       ❌        |       ❌        |

## Supported Sources

The tool is powered by a massive database of **3300+ unique manga sources** derived from the official extension repositories.

- **Major Aggregators**: MangaDex, MangaPlus, Webtoons, Bato.to, MangaNato, MangaKakalot, Comick
- **Regional**: Extensive support for Chinese, Korean, Japanese, Spanish, Portuguese, French, Russian, Indonesian, Vietnamese, Turkish, Arabic, and Thai sources.
- **Adult**: Full support for major hentai sources.

**Fallback**: If a source is not in the database (e.g., a custom Kotatsu parser), the tool **dynamically generates a valid ID** compatible with Mihon's architecture, ensuring no data is ever lost.

## Technical Details

### File Formats

- **Kotatsu**: ZIP archive containing JSON files (`favourites.json`, `categories.json`, `history.json`)
- **Mihon**: GZipped Protocol Buffer binary (`.tachibk`)

### Project Structure

```
kotatsu-migrate/
├── index.html       # Main UI
├── style.css        # Styling
├── app.js           # Application logic
└── src/
    ├── schema.js    # Mihon Protobuf schema
    ├── sources.js   # 3300+ Source ID mappings
    ├── murmurhash.js# MurmurHash3 implementation for dynamic IDs
    ├── mapping.js   # Bidirectional status code mapping
    ├── kotatsu.js   # Kotatsu parser/builder
    └── mihon.js     # Mihon parser/builder
```

## Known Limitations

- Chapter read progress is preserved but chapter URLs may not match if sources use different URL schemes.
- Kotatsu only supports one category per manga. When converting from Mihon (multi-category), the first category is used as the folder, and others are added as Tags.

## License

MIT License - Free to use and modify.

---

**Built for manga readers**
