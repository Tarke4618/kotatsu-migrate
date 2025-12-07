document.addEventListener('DOMContentLoaded', () => {
    // UI Elements
    const dropKotatsu = document.getElementById('drop-kotatsu');
    const dropTachiyomi = document.getElementById('drop-tachiyomi');
    const fileKotatsu = document.getElementById('file-kotatsu');
    const fileTachiyomi = document.getElementById('file-tachiyomi');
    const statusKotatsu = document.getElementById('status-kotatsu');
    const statusTachiyomi = document.getElementById('status-tachiyomi');

    // Helper: Handle Drag & Drop
    function setupDragDrop(dropZone, fileInput, callback) {
        dropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropZone.classList.add('drag-over');
        });

        dropZone.addEventListener('dragleave', () => {
            dropZone.classList.remove('drag-over');
        });

        dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropZone.classList.remove('drag-over');
            if (e.dataTransfer.files.length) {
                callback(e.dataTransfer.files[0]);
            }
        });

        dropZone.addEventListener('click', () => {
            fileInput.click();
        });

        fileInput.addEventListener('change', (e) => {
            if (e.target.files.length) {
                callback(e.target.files[0]);
            }
        });
    }

    // Process Kotatsu File
    setupDragDrop(dropKotatsu, fileKotatsu, async (file) => {
        setStatus(statusKotatsu, 'Processing Kotatsu backup...', 'info');
        try {
            const result = await convertKotatsuToTachiyomi(file);
            setStatus(statusKotatsu, 'Conversion successful!', 'success');
            createDownloadLink(statusKotatsu, result.blob, 'backup.tachibk');
            createDebugLink(statusKotatsu, result.debugData);
        } catch (err) {
            console.error(err);
            setStatus(statusKotatsu, 'Error: ' + err.message, 'error');
        }
    });

    // Process Tachiyomi File
    setupDragDrop(dropTachiyomi, fileTachiyomi, async (file) => {
        setStatus(statusTachiyomi, 'Processing Tachiyomi backup...', 'info');
        try {
            const result = await convertTachiyomiToKotatsu(file);
            setStatus(statusTachiyomi, 'Conversion successful!', 'success'); // Note: Kotatsu usually uses generic names in zip
            createDownloadLink(statusTachiyomi, result.blob, 'kotatsu_backup.zip');
            createDebugLink(statusTachiyomi, result.debugData);
        } catch (err) {
            console.error(err);
            setStatus(statusTachiyomi, 'Error: ' + err.message, 'error');
        }
    });

    function setStatus(element, text, type) {
        element.innerHTML = `<span class="${type}-msg">${text}</span>`;
        if (type === 'info') {
             element.innerHTML += '<div class="spinner"></div>';
        }
    }

    function createDownloadLink(container, blob, filename) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.textContent = 'Download Converted File';
        a.className = 'btn-download';
        
        container.appendChild(document.createElement('br'));
        container.appendChild(a);
    }

    function createDebugLink(container, data) {
        const btn = document.createElement('button');
        btn.textContent = 'View Raw Data';
        btn.className = 'btn-download'; // Reuse style or add new one
        btn.style.marginTop = '10px';
        btn.style.background = 'linear-gradient(90deg, #64748b, #475569)';
        btn.onclick = () => showModal(data);
        
        container.appendChild(document.createElement('br'));
        container.appendChild(btn);
    }

    // Modal Logic
    const modal = document.getElementById('debug-modal');
    const closeBtn = document.getElementsByClassName('close-modal')[0];
    const content = document.getElementById('debug-content');

    function showModal(data) {
        content.textContent = JSON.stringify(data, null, 2);
        modal.style.display = 'block';
    }

    closeBtn.onclick = () => modal.style.display = 'none';

    window.onclick = (event) => {
        if (event.target === modal) {
            modal.style.display = 'none';
        }
    };
});
