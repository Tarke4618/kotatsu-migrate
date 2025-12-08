// app.js - Main Application Logic
// Kotatsu to Mihon Converter

document.addEventListener('DOMContentLoaded', () => {
  // ===== DOM Elements =====
  const zoneKotatsu = document.getElementById('zone-kotatsu');
  const inputKotatsu = document.getElementById('input-kotatsu');
  
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

  // Toggle UI elements
  const toggleBtn = document.getElementById('toggle-ui');
  const mainUI = document.getElementById('main-ui');

  // ===== State =====
  let parsedData = null;
  let convertedBlob = null;
  let debugData = {};
  let uiVisible = true;

  // ===== Toggle UI Handler =====
  toggleBtn.addEventListener('click', () => {
    uiVisible = !uiVisible;
    mainUI.classList.toggle('hidden', !uiVisible);
    toggleBtn.classList.toggle('active', !uiVisible);
  });


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

  // ===== Drop Zone Handler =====
  function setupDropZone(zone, input) {
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
        await handleFile(file);
      }
    });

    // File input handler
    input.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (file) {
        await handleFile(file);
      }
    });
  }

  setupDropZone(zoneKotatsu, inputKotatsu);

  // ===== File Processing =====
  async function handleFile(file) {
    hideStats();
    hideActions();
    debugData = {};
    parsedData = null;
    convertedBlob = null;

    const isMihon = file.name.endsWith('.tachibk') || file.name.endsWith('.proto.gz');
    const targetFormat = isMihon ? 'Kotatsu' : 'Mihon';
    
    setStatus('⏳', `Parsing ${isMihon ? 'Mihon' : 'Kotatsu'} backup...`);
    
    try {
      let parseResult;
      
      if (isMihon) {
        parseResult = await window.parseMihonBackup(file);
      } else {
        parseResult = await window.parseKotatsuBackup(file);
      }
      
      debugData.parseResult = parseResult;

      if (!parseResult.success) {
        throw new Error(parseResult.debug.errors.join('; ') || 'Parse failed');
      }

      parsedData = parseResult.data;

      // Count stats
      const mangaCount = parsedData.manga?.length || 0;
      const categoryCount = parsedData.categories?.length || 0;
      const historyCount = parsedData.history?.length || 0;

      setStatus('✅', `Parsed ${mangaCount} manga`, 'success');
      showStats(mangaCount, categoryCount, historyCount);

      // Convert
      setStatus('⏳', `Converting to ${targetFormat} format...`);
      
      if (isMihon) {
        // Convert TO Kotatsu
        convertedBlob = await window.createKotatsuBackup(parsedData);
        debugData.outputExtension = 'bk.zip';
      } else {
        // Convert TO Mihon
        convertedBlob = await window.createMihonBackup(parsedData);
        debugData.outputExtension = 'tachibk';
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

    const ext = debugData.outputExtension || 'backup';
    const prefix = ext === 'tachibk' ? 'kotatsu_to_mihon' : 'mihon_to_kotatsu';
    const filename = `${prefix}_${Date.now()}.${ext}`;
    
    const url = URL.createObjectURL(convertedBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  });

  // ===== Debug Modal =====
  btnDebug.addEventListener('click', () => {
    debugContent.textContent = JSON.stringify(debugData, null, 2);
    modalDebug.style.display = 'flex';
  });

  btnCloseModal.addEventListener('click', () => {
    modalDebug.style.display = 'none';
  });

  modalDebug.addEventListener('click', (e) => {
    if (e.target === modalDebug) {
      modalDebug.style.display = 'none';
    }
  });
});
