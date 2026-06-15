// ================================================================
// SonicVault Admin — Reusable UI Components
// Toast notifications, confirm dialogs, table rendering
// ================================================================

const Components = (() => {
  // ---- Toast Notifications ----
  function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    const icons = {
      success: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1DB954" stroke-width="2"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
      error: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#E85D5D" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
      info: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#4A9EFF" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>',
    };

    toast.innerHTML = `
      ${icons[type] || icons.info}
      <span class="toast-message">${escapeHtml(message)}</span>
    `;

    container.appendChild(toast);
    setTimeout(() => toast.remove(), 4000);
  }

  // ---- Confirm Dialog ----
  function confirm(title, message, onConfirm, confirmText = 'Delete') {
    const modal = document.getElementById('confirm-modal');
    document.getElementById('confirm-title').textContent = title;
    document.getElementById('confirm-message').textContent = message;
    
    const okBtn = document.getElementById('confirm-ok');
    okBtn.textContent = confirmText;
    okBtn.className = confirmText.toLowerCase().includes('delete') || confirmText.toLowerCase().includes('revoke')
      ? 'btn btn-danger' : 'btn btn-primary';
    
    // Clone to remove old listeners
    const newOkBtn = okBtn.cloneNode(true);
    okBtn.parentNode.replaceChild(newOkBtn, okBtn);
    
    newOkBtn.addEventListener('click', () => {
      closeModal('confirm-modal');
      onConfirm();
    });

    openModal('confirm-modal');
  }

  // ---- Modal Management ----
  function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.classList.remove('hidden');
      document.body.style.overflow = 'hidden';
    }
  }

  function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.classList.add('hidden');
      document.body.style.overflow = '';
    }
  }

  // ---- Song Table Row ----
  function renderSongRow(song) {
    const tr = document.createElement('tr');
    tr.dataset.songId = song.id;

    const artworkHtml = song.artworkUrl
      ? `<img src="${escapeHtml(song.artworkUrl)}" class="table-artwork" alt="" loading="lazy">`
      : `<div class="table-artwork-placeholder">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
        </div>`;

    const statusHtml = song.needsReview
      ? '<span class="status-badge status-review">Review</span>'
      : '<span class="status-badge status-ok">OK</span>';

    tr.innerHTML = `
      <td>${artworkHtml}</td>
      <td class="song-title-cell">${escapeHtml(song.title)}</td>
      <td>${escapeHtml(song.artist)}</td>
      <td>${escapeHtml(song.album || '')}</td>
      <td>${escapeHtml(song.genre || '')}</td>
      <td>${AdminAPI.formatDuration(song.duration)}</td>
      <td>${statusHtml}</td>
      <td class="col-actions">
        <button class="action-btn edit" title="Edit" onclick="App.editSong('${song.id}')">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        </button>
        <button class="action-btn delete" title="Delete" onclick="App.confirmDeleteSong('${song.id}', '${escapeHtml(song.title).replace(/'/g, "\\'")}')">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
        </button>
      </td>
    `;

    return tr;
  }

  // ---- Compact Song Row (for dashboard) ----
  function renderCompactSongRow(song) {
    const div = document.createElement('div');
    div.className = 'compact-song-row';

    const artworkHtml = song.artworkUrl
      ? `<img src="${escapeHtml(song.artworkUrl)}" class="compact-song-artwork" alt="" loading="lazy">`
      : `<div class="compact-song-artwork" style="display:flex;align-items:center;justify-content:center;">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color:var(--text-muted)"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
        </div>`;

    div.innerHTML = `
      ${artworkHtml}
      <div class="compact-song-info">
        <div class="compact-song-title">${escapeHtml(song.title)}</div>
        <div class="compact-song-artist">${escapeHtml(song.artist)}</div>
      </div>
    `;

    return div;
  }

  // ---- Playlist Card ----
  function renderPlaylistCard(playlist) {
    const div = document.createElement('div');
    div.className = 'playlist-card';
    div.dataset.playlistId = playlist.id;

    const artworkHtml = playlist.artworkUrl
      ? `<img src="${escapeHtml(playlist.artworkUrl)}" alt="">`
      : `<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>`;

    div.innerHTML = `
      <div class="playlist-card-artwork">${artworkHtml}</div>
      <div class="playlist-card-name">${escapeHtml(playlist.name)}</div>
      <div class="playlist-card-count">${playlist.songCount || 0} songs</div>
      <div class="playlist-card-actions">
        <button class="action-btn" title="Edit" onclick="event.stopPropagation(); App.editPlaylist('${playlist.id}', '${escapeHtml(playlist.name).replace(/'/g, "\\'")}')">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        </button>
        <button class="action-btn delete" title="Delete" onclick="event.stopPropagation(); App.confirmDeletePlaylist('${playlist.id}', '${escapeHtml(playlist.name).replace(/'/g, "\\'")}')">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
        </button>
      </div>
    `;

    div.addEventListener('click', () => App.viewPlaylist(playlist.id));

    return div;
  }

  // ---- Device Card ----
  function renderDeviceCard(device, currentDeviceId) {
    const div = document.createElement('div');
    div.className = 'device-card' + (device.id === currentDeviceId ? ' current' : '');

    const isCurrent = device.id === currentDeviceId;

    div.innerHTML = `
      <div class="device-icon">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="5" y="2" width="14" height="20" rx="2" ry="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg>
      </div>
      <div class="device-info">
        <div class="device-name">
          ${escapeHtml(device.deviceName)}
          ${isCurrent ? '<span class="current-badge">● This Device</span>' : ''}
        </div>
        <div class="device-meta">
          Last seen: ${AdminAPI.formatTimeAgo(device.lastSeen)} · Added: ${AdminAPI.formatTimeAgo(device.createdAt)}
        </div>
      </div>
      ${!isCurrent ? `
        <button class="btn btn-ghost btn-sm" onclick="App.confirmRevokeDevice('${device.id}', '${escapeHtml(device.deviceName).replace(/'/g, "\\'")}')">
          Revoke
        </button>
      ` : ''}
    `;

    return div;
  }

  // ---- Upload Item ----
  function renderUploadItem(file, index) {
    const div = document.createElement('div');
    div.className = 'upload-item';
    div.id = `upload-item-${index}`;

    div.innerHTML = `
      <div class="upload-item-icon pending">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
      </div>
      <div class="upload-item-info">
        <div class="upload-item-name">${escapeHtml(file.name)}</div>
        <div class="upload-item-status">Queued · ${AdminAPI.formatFileSize(file.size)}</div>
        <div class="upload-progress-bar">
          <div class="upload-progress-fill" id="upload-progress-${index}"></div>
        </div>
      </div>
      <div class="upload-item-action">
        <button class="action-btn" title="Cancel" onclick="UploadManager.cancelUpload(${index})">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
    `;

    return div;
  }

  function updateUploadItem(index, status, progress, message) {
    const item = document.getElementById(`upload-item-${index}`);
    if (!item) return;

    const icon = item.querySelector('.upload-item-icon');
    const statusEl = item.querySelector('.upload-item-status');
    const progressBar = document.getElementById(`upload-progress-${index}`);

    icon.className = `upload-item-icon ${status}`;
    item.className = `upload-item ${status}`;

    if (status === 'uploading') {
      icon.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>';
    } else if (status === 'completed') {
      icon.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>';
    } else if (status === 'error') {
      icon.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>';
    }

    if (message) statusEl.textContent = message;
    if (progressBar && progress !== undefined) {
      progressBar.style.width = `${Math.round(progress * 100)}%`;
    }
  }

  // ---- Playlist Detail Song Row ----
  function renderPlaylistSongRow(song, index, playlistId) {
    const div = document.createElement('div');
    div.className = 'playlist-song-row';

    div.innerHTML = `
      <span class="playlist-song-num">${index + 1}</span>
      <span class="playlist-song-title">${escapeHtml(song.title)}</span>
      <span class="playlist-song-artist">${escapeHtml(song.artist)}</span>
      <button class="action-btn delete playlist-song-remove" title="Remove" onclick="App.removeSongFromPlaylist('${playlistId}', '${song.id}')">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    `;

    return div;
  }

  // ---- Utility ----
  function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // ---- Global Modal Close Handlers ----
  function initModalHandlers() {
    // Close button handlers
    document.querySelectorAll('.modal-close, [data-modal]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const modalId = e.currentTarget.dataset.modal || e.currentTarget.closest('.modal')?.id;
        if (modalId) closeModal(modalId);
      });
    });

    // Click overlay to close
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
      overlay.addEventListener('click', () => {
        const modal = overlay.closest('.modal');
        if (modal) closeModal(modal.id);
      });
    });

    // Escape key to close
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        document.querySelectorAll('.modal:not(.hidden)').forEach(modal => {
          closeModal(modal.id);
        });
      }
    });
  }

  return {
    showToast,
    confirm,
    openModal,
    closeModal,
    renderSongRow,
    renderCompactSongRow,
    renderPlaylistCard,
    renderDeviceCard,
    renderUploadItem,
    updateUploadItem,
    renderPlaylistSongRow,
    initModalHandlers,
    escapeHtml,
  };
})();
