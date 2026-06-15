// ================================================================
// SonicVault Admin — Upload Manager
// Handles file upload queue, drag-drop, and progress tracking
// ================================================================

const UploadManager = (() => {
  let uploadQueue = [];
  let isUploading = false;
  let currentUploadIndex = -1;
  let cancelledIndexes = new Set();

  function init() {
    const dropzone = document.getElementById('upload-dropzone');
    const fileInput = document.getElementById('upload-file-input');
    const clearBtn = document.getElementById('clear-queue-btn');

    if (!dropzone || !fileInput) return;

    // Click to select files
    dropzone.addEventListener('click', () => {
      fileInput.click();
    });

    // Drag and drop handlers
    dropzone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropzone.classList.add('drag-over');
    });

    dropzone.addEventListener('dragleave', () => {
      dropzone.classList.remove('drag-over');
    });

    dropzone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropzone.classList.remove('drag-over');
      const files = Array.from(e.dataTransfer.files).filter(f =>
        f.type === 'audio/mpeg' || f.name.toLowerCase().endsWith('.mp3')
      );
      if (files.length > 0) {
        addToQueue(files);
      } else {
        Components.showToast('Only MP3 files are supported', 'error');
      }
    });

    // File input handler
    fileInput.addEventListener('change', (e) => {
      const files = Array.from(e.target.files);
      if (files.length > 0) {
        addToQueue(files);
      }
      fileInput.value = ''; // Reset for re-selection
    });

    // Clear queue
    if (clearBtn) {
      clearBtn.addEventListener('click', clearQueue);
    }
  }

  function addToQueue(files) {
    const queueContainer = document.getElementById('upload-queue');
    const itemsContainer = document.getElementById('upload-items');

    queueContainer.classList.remove('hidden');

    files.forEach(file => {
      const index = uploadQueue.length;
      uploadQueue.push({
        file,
        status: 'pending',
        progress: 0,
      });

      const item = Components.renderUploadItem(file, index);
      itemsContainer.appendChild(item);
    });

    // Start processing if not already
    if (!isUploading) {
      processQueue();
    }
  }

  async function processQueue() {
    isUploading = true;

    for (let i = 0; i < uploadQueue.length; i++) {
      if (cancelledIndexes.has(i)) continue;
      if (uploadQueue[i].status !== 'pending') continue;

      currentUploadIndex = i;
      uploadQueue[i].status = 'uploading';

      Components.updateUploadItem(i, 'uploading', 0, 'Uploading...');

      try {
        const result = await AdminAPI.uploadSong(uploadQueue[i].file, (progress) => {
          uploadQueue[i].progress = progress;
          const pct = Math.round(progress * 100);
          Components.updateUploadItem(i, 'uploading', progress, `Uploading... ${pct}%`);
        });

        if (cancelledIndexes.has(i)) continue;

        uploadQueue[i].status = 'completed';
        const title = result?.song?.title || uploadQueue[i].file.name;
        Components.updateUploadItem(i, 'completed', 1, `✓ ${title}`);
        Components.showToast(`Uploaded: ${title}`, 'success');

      } catch (error) {
        if (cancelledIndexes.has(i)) continue;
        uploadQueue[i].status = 'error';
        Components.updateUploadItem(i, 'error', 0, `✗ ${error.message}`);
        Components.showToast(`Failed: ${uploadQueue[i].file.name} — ${error.message}`, 'error');
      }
    }

    isUploading = false;
    currentUploadIndex = -1;

    // Refresh songs list after all uploads
    const completedCount = uploadQueue.filter(u => u.status === 'completed').length;
    if (completedCount > 0) {
      // Trigger dashboard refresh
      if (typeof App !== 'undefined' && App.refreshCurrentPage) {
        App.refreshCurrentPage();
      }
    }
  }

  function cancelUpload(index) {
    cancelledIndexes.add(index);
    uploadQueue[index].status = 'cancelled';
    const item = document.getElementById(`upload-item-${index}`);
    if (item) item.remove();

    // Check if queue is empty
    const remaining = uploadQueue.filter((u, i) =>
      !cancelledIndexes.has(i) && (u.status === 'pending' || u.status === 'uploading')
    );
    if (remaining.length === 0) {
      const queueContainer = document.getElementById('upload-queue');
      const items = document.getElementById('upload-items');
      if (items.children.length === 0) {
        queueContainer.classList.add('hidden');
      }
    }
  }

  function clearQueue() {
    // Only clear completed/error items
    uploadQueue.forEach((item, i) => {
      if (item.status === 'completed' || item.status === 'error' || item.status === 'cancelled') {
        cancelledIndexes.add(i);
        const el = document.getElementById(`upload-item-${i}`);
        if (el) el.remove();
      }
    });

    const items = document.getElementById('upload-items');
    if (items.children.length === 0) {
      document.getElementById('upload-queue').classList.add('hidden');
      uploadQueue = [];
      cancelledIndexes.clear();
    }
  }

  function getStats() {
    return {
      total: uploadQueue.length,
      completed: uploadQueue.filter(u => u.status === 'completed').length,
      pending: uploadQueue.filter(u => u.status === 'pending').length,
      uploading: uploadQueue.filter(u => u.status === 'uploading').length,
      error: uploadQueue.filter(u => u.status === 'error').length,
    };
  }

  return {
    init,
    cancelUpload,
    clearQueue,
    getStats,
  };
})();
