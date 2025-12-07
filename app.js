// app.js - Main Application Logic
// Wires UI components to conversion engine

document.addEventListener('DOMContentLoaded', () => {
  // ===== DOM Elements =====
  const zoneKotatsu = document.getElementById('zone-kotatsu');
  const zoneMihon = document.getElementById('zone-mihon');
  const inputKotatsu = document.getElementById('input-kotatsu');
  const inputMihon = document.getElementById('input-mihon');
  
  const btnKotatsuToMihon = document.getElementById('btn-kotatsu-to-mihon');
  const btnMihonToKotatsu = document.getElementById('btn-mihon-to-kotatsu');
  
  const statusIcon = document.getElementById('status-icon');
  const statusText = document.getElementById('status-text');
  const statsPanel = document.getElementById('stats');
  const statManga = document.getElementById('stat-manga');
  const statCategories = document.getElementById('stat-categories');
  const statHistory = document.getElementById('stat-history');
  
  const actionsPanel = document.getElementById('actions');
  const btnDownload = document.getElementById('btn-download');
  const btnDebug = document.getElementById('btn-debug');
  
  const modalDebug = document.getElementById('modal-debug');
  const debugContent = document.getElementById('debug-content');
  const btnCloseModal = document.getElementById('btn-close-modal');

  // ===== State =====
  let currentDirection = 'kotatsu-to-mihon'; // or 'mihon-to-kotatsu'
  let parsedData = null;
  let convertedBlob = null;
  let debugData = {};

  // ===== Direction Toggle =====
  function setDirection(dir) {
    currentDirection = dir;
    btnKotatsuToMihon.classList.toggle('active', dir === 'kotatsu-to-mihon');
    btnMihonToKotatsu.classList.toggle('active', dir === 'mihon-to-kotatsu');
    
    // Update zone highlights
    zoneKotatsu.classList.toggle('active', dir === 'kotatsu-to-mihon');
    zoneMihon.classList.toggle('active', dir === 'mihon-to-kotatsu');
  }

  btnKotatsuToMihon.addEventListener('click', () => setDirection('kotatsu-to-mihon'));
  btnMihonToKotatsu.addEventListener('click', () => setDirection('mihon-to-kotatsu'));

  // Initialize
  setDirection('kotatsu-to-mihon');

  // ===== Status Updates =====
  function setStatus(icon, text, type = 'default') {
    statusIcon.textContent = icon;
    statusText.textContent = text;
    
    // Color coding
    statusText.style.color = type === 'success' ? 'var(--accent-success)' : 
                             type === 'error' ? 'var(--accent-error)' : 
                             'inherit';
  }

  function showStats(manga, categories, history) {
    statManga.textContent = manga;
    statCategories.textContent = categories;
    statHistory.textContent = history;
    statsPanel.style.display = 'grid';
  }

  function hideStats() {
    statsPanel.style.display = 'none';
  }

  function showActions() {
    actionsPanel.style.display = 'flex';
  }

  function hideActions() {
    actionsPanel.style.display = 'none';
  }

  // ===== Drop Zone Handlers =====
  function setupDropZone(zone, input, format) {
    // Click to browse
    zone.addEventListener('click', () => input.click());

    // Drag effects
    zone.addEventListener('dragover', (e) => {
      e.preventDefault();
      zone.classList.add('active');
    });

    zone.addEventListener('dragleave', () => {
      zone.classList.remove('active');
    });

    // Drop handler
    zone.addEventListener('drop', async (e) => {
      e.preventDefault();
      zone.classList.remove('active');
      
      const file = e.dataTransfer.files[0];
      if (file) {
        await handleFile(file, format);
      }
    });

    // File input handler
    input.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (file) {
        await handleFile(file, format);
      }
    });
  }

  setupDropZone(zoneKotatsu, inputKotatsu, 'kotatsu');
  setupDropZone(zoneMihon, inputMihon, 'mihon');

  // ===== File Processing =====
  async function handleFile(file, format) {
    setStatus('⏳', `Parsing ${format} backup...`);
    hideStats();
    hideActions();
    debugData = {};

    try {
      // Validate format matches expected
      if (format === 'kotatsu' && currentDirection !== 'kotatsu-to-mihon') {
        setDirection('kotatsu-to-mihon');
      } else if (format === 'mihon' && currentDirection !== 'mihon-to-kotatsu') {
        setDirection('mihon-to-kotatsu');
      }

      // Parse based on format
      let parseResult;
      if (format === 'kotatsu') {
        parseResult = await window.parseKotatsuBackup(file);
      } else {
        parseResult = await window.parseMihonBackup(file);
      }

      debugData.parseResult = parseResult;

      if (!parseResult.success) {
        throw new Error(parseResult.debug.errors.join('; ') || 'Parse failed');
      }

      parsedData = parseResult.data;

      // Count stats
      const mangaCount = parsedData.manga?.length || 0;
      const categoryCount = parsedData.categories?.length || 0;
      const historyCount = format === 'kotatsu' ? 
        (parsedData.history?.length || 0) :
        parsedData.manga?.reduce((sum, m) => sum + (m.history?.length || 0), 0) || 0;

      setStatus('✅', `Parsed ${mangaCount} manga`, 'success');
      showStats(mangaCount, categoryCount, historyCount);

      // Convert
      setStatus('⏳', 'Converting...');
      
      if (format === 'kotatsu') {
        // Kotatsu → Mihon
        convertedBlob = await window.createMihonBackup(parsedData);
      } else {
        // Mihon → Kotatsu
        convertedBlob = await window.createKotatsuBackup(parsedData);
      }

      debugData.convertedSize = convertedBlob.size;

      setStatus('✅', 'Conversion complete! Ready to download.', 'success');
      showActions();

    } catch (err) {
      console.error('Conversion error:', err);
      debugData.error = err.message;
      debugData.stack = err.stack;
      setStatus('❌', `Error: ${err.message}`, 'error');
    }
  }

  // ===== Download Handler =====
  btnDownload.addEventListener('click', () => {
    if (!convertedBlob) return;

    const filename = currentDirection === 'kotatsu-to-mihon' 
      ? `kotatsu_to_mihon_${Date.now()}.tachibk`
      : `mihon_to_kotatsu_${Date.now()}.bk.zip`;

    const url = URL.createObjectURL(convertedBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    setStatus('📥', 'Downloaded! Import in your app.', 'success');
  });

  // ===== Debug Modal =====
  btnDebug.addEventListener('click', () => {
    debugContent.textContent = JSON.stringify(debugData, null, 2);
    modalDebug.classList.add('open');
  });

  btnCloseModal.addEventListener('click', () => {
    modalDebug.classList.remove('open');
  });

  document.querySelector('.modal-backdrop')?.addEventListener('click', () => {
    modalDebug.classList.remove('open');
  });

  // Escape key closes modal
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      modalDebug.classList.remove('open');
    }
  });
});
