// ================================================================
// SonicVault Admin — Main Application
// SPA routing, page rendering, state management
// ================================================================

const App = (() => {
  // ---- State ----
  let songs = [];
  let playlists = [];
  let devices = [];
  let currentPage = 'dashboard';
  let currentPlaylistDetail = null;

  // ---- Initialization ----
  async function init() {
    Components.initModalHandlers();
    UploadManager.init();
    setupEventListeners();

    // Try auto-login
    const loggedIn = await AdminAPI.tryAutoLogin();
    if (loggedIn) {
      showApp();
      await loadDashboard();
    } else {
      showLogin();
    }
  }

  function setupEventListeners() {
    // Login form
    document.getElementById('login-form').addEventListener('submit', handleLogin);

    // Navigation
    document.querySelectorAll('.nav-item').forEach(item => {
      item.addEventListener('click', () => {
        const page = item.dataset.page;
        navigateTo(page);
      });
    });

    // Logout
    document.getElementById('logout-btn').addEventListener('click', handleLogout);

    // Songs search
    document.getElementById('songs-search').addEventListener('input', debounce(handleSongsSearch, 300));

    // Song edit form
    document.getElementById('song-edit-form').addEventListener('submit', handleSongEditSubmit);

    // Playlist form
    document.getElementById('playlist-form').addEventListener('submit', handlePlaylistSubmit);

    // Create playlist buttons
    document.getElementById('create-playlist-btn').addEventListener('click', () => openPlaylistModal());
    document.getElementById('create-first-playlist-btn')?.addEventListener('click', () => openPlaylistModal());

    // Artwork file change
    document.getElementById('edit-artwork-file').addEventListener('change', handleArtworkFileChange);
  }

  // ---- Auth ----
  async function handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;
    const errorEl = document.getElementById('login-error');
    const btn = document.getElementById('login-btn');

    errorEl.classList.add('hidden');
    btn.disabled = true;
    btn.querySelector('.btn-text').classList.add('hidden');
    btn.querySelector('.btn-loader').classList.remove('hidden');

    try {
      await AdminAPI.login(email, password);
      showApp();
      await loadDashboard();
    } catch (error) {
      errorEl.textContent = error.message || 'Invalid credentials';
      errorEl.classList.remove('hidden');
    } finally {
      btn.disabled = false;
      btn.querySelector('.btn-text').classList.remove('hidden');
      btn.querySelector('.btn-loader').classList.add('hidden');
    }
  }

  async function handleLogout() {
    Components.confirm('Logout', 'Are you sure you want to log out?', async () => {
      await AdminAPI.logout();
      showLogin();
    }, 'Logout');
  }

  function showLogin() {
    document.getElementById('login-screen').classList.remove('hidden');
    document.getElementById('app').classList.add('hidden');
    document.getElementById('login-email').value = '';
    document.getElementById('login-password').value = '';
  }

  function showApp() {
    document.getElementById('login-screen').classList.add('hidden');
    document.getElementById('app').classList.remove('hidden');
  }

  // ---- Navigation ----
  function navigateTo(page) {
    currentPage = page;

    // Update nav
    document.querySelectorAll('.nav-item').forEach(item => {
      item.classList.toggle('active', item.dataset.page === page);
    });

    // Show page
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    const pageEl = document.getElementById(`page-${page}`);
    if (pageEl) pageEl.classList.add('active');

    // Load page data
    switch (page) {
      case 'dashboard': loadDashboard(); break;
      case 'upload': break; // Upload page is static
      case 'songs': loadSongs(); break;
      case 'playlists': loadPlaylists(); break;
      case 'devices': loadDevices(); break;
    }
  }

  // Make navigateTo global for onclick handlers
  window.navigateTo = navigateTo;

  function refreshCurrentPage() {
    navigateTo(currentPage);
  }

  // ---- Dashboard ----
  async function loadDashboard() {
    try {
      // Load all data in parallel
      const [songsData, playlistsData, devicesData] = await Promise.all([
        AdminAPI.getSongs(),
        AdminAPI.getPlaylists(),
        AdminAPI.getDevices(),
      ]);

      songs = songsData.songs || songsData || [];
      playlists = playlistsData.playlists || playlistsData || [];
      devices = devicesData.devices || devicesData || [];

      // Update stats
      document.getElementById('stat-songs').textContent = songs.length;
      document.getElementById('stat-playlists').textContent = playlists.length;
      document.getElementById('stat-devices').textContent = devices.length;

      // Calculate storage
      const totalSize = songs.reduce((sum, s) => sum + (s.fileSize || 0), 0);
      document.getElementById('stat-storage').textContent = AdminAPI.formatFileSize(totalSize);

      // Recent uploads (last 5)
      const recentList = document.getElementById('recent-uploads-list');
      const recentSongs = [...songs].sort((a, b) =>
        new Date(b.createdAt) - new Date(a.createdAt)
      ).slice(0, 5);

      if (recentSongs.length > 0) {
        recentList.innerHTML = '';
        recentSongs.forEach(song => {
          recentList.appendChild(Components.renderCompactSongRow(song));
        });
      } else {
        recentList.innerHTML = '<p class="empty-text">No songs uploaded yet</p>';
      }

      // Needs review
      const reviewList = document.getElementById('needs-review-list');
      const reviewSongs = songs.filter(s => s.needsReview);

      if (reviewSongs.length > 0) {
        reviewList.innerHTML = '';
        reviewSongs.slice(0, 5).forEach(song => {
          const row = Components.renderCompactSongRow(song);
          row.style.cursor = 'pointer';
          row.addEventListener('click', () => {
            navigateTo('songs');
            setTimeout(() => editSong(song.id), 300);
          });
          reviewList.appendChild(row);
        });
      } else {
        reviewList.innerHTML = '<p class="empty-text">All metadata looks good!</p>';
      }

    } catch (error) {
      Components.showToast('Failed to load dashboard: ' + error.message, 'error');
    }
  }

  // ---- Songs ----
  async function loadSongs() {
    try {
      const data = await AdminAPI.getSongs();
      songs = data.songs || data || [];

      const tbody = document.getElementById('songs-tbody');
      const emptyState = document.getElementById('songs-empty');
      const countEl = document.getElementById('songs-count');

      countEl.textContent = `${songs.length} song${songs.length !== 1 ? 's' : ''} in library`;

      if (songs.length === 0) {
        tbody.innerHTML = '';
        emptyState.classList.remove('hidden');
        document.querySelector('.table-container').style.display = 'none';
        return;
      }

      emptyState.classList.add('hidden');
      document.querySelector('.table-container').style.display = '';

      tbody.innerHTML = '';
      songs.forEach(song => {
        tbody.appendChild(Components.renderSongRow(song));
      });
    } catch (error) {
      Components.showToast('Failed to load songs: ' + error.message, 'error');
    }
  }

  function handleSongsSearch(e) {
    const query = e.target.value.toLowerCase().trim();
    const tbody = document.getElementById('songs-tbody');
    const rows = tbody.querySelectorAll('tr');

    rows.forEach(row => {
      const text = row.textContent.toLowerCase();
      row.style.display = text.includes(query) ? '' : 'none';
    });
  }

  // ---- Song Edit ----
  async function editSong(songId) {
    const song = songs.find(s => s.id === songId);
    if (!song) return;

    document.getElementById('edit-song-id').value = song.id;
    document.getElementById('edit-title').value = song.title || '';
    document.getElementById('edit-artist').value = song.artist || '';
    document.getElementById('edit-album').value = song.album || '';
    document.getElementById('edit-genre').value = song.genre || '';
    document.getElementById('edit-track').value = song.trackNumber || '';

    const artworkPreview = document.getElementById('edit-artwork-preview');
    if (song.artworkUrl) {
      artworkPreview.src = song.artworkUrl;
      artworkPreview.classList.remove('hidden');
    } else {
      artworkPreview.classList.add('hidden');
    }

    Components.openModal('song-edit-modal');
  }

  function handleArtworkFileChange(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      const preview = document.getElementById('edit-artwork-preview');
      preview.src = ev.target.result;
      preview.classList.remove('hidden');
    };
    reader.readAsDataURL(file);
  }

  async function handleSongEditSubmit(e) {
    e.preventDefault();

    const songId = document.getElementById('edit-song-id').value;
    const data = {
      title: document.getElementById('edit-title').value.trim(),
      artist: document.getElementById('edit-artist').value.trim(),
      album: document.getElementById('edit-album').value.trim(),
      genre: document.getElementById('edit-genre').value.trim(),
      trackNumber: parseInt(document.getElementById('edit-track').value) || 0,
    };

    try {
      await AdminAPI.updateSong(songId, data);

      // Upload artwork if changed
      const artworkFile = document.getElementById('edit-artwork-file').files[0];
      if (artworkFile) {
        await AdminAPI.uploadArtwork(songId, artworkFile);
      }

      Components.closeModal('song-edit-modal');
      Components.showToast('Song updated successfully', 'success');
      document.getElementById('edit-artwork-file').value = '';

      // Refresh
      if (currentPage === 'songs') loadSongs();
      else if (currentPage === 'dashboard') loadDashboard();

    } catch (error) {
      Components.showToast('Failed to update song: ' + error.message, 'error');
    }
  }

  function confirmDeleteSong(songId, title) {
    Components.confirm(
      'Delete Song',
      `Are you sure you want to delete "${title}"? This will remove the song from the library and delete the audio file. This action cannot be undone.`,
      async () => {
        try {
          await AdminAPI.deleteSong(songId);
          Components.showToast(`Deleted: ${title}`, 'success');
          if (currentPage === 'songs') loadSongs();
          else if (currentPage === 'dashboard') loadDashboard();
        } catch (error) {
          Components.showToast('Failed to delete song: ' + error.message, 'error');
        }
      }
    );
  }

  // ---- Playlists ----
  async function loadPlaylists() {
    try {
      const data = await AdminAPI.getPlaylists();
      playlists = data.playlists || data || [];

      const grid = document.getElementById('playlists-grid');
      const emptyState = document.getElementById('playlists-empty');
      const countEl = document.getElementById('playlists-count');

      countEl.textContent = `${playlists.length} playlist${playlists.length !== 1 ? 's' : ''}`;

      if (playlists.length === 0) {
        grid.innerHTML = '';
        grid.classList.add('hidden');
        emptyState.classList.remove('hidden');
        return;
      }

      emptyState.classList.add('hidden');
      grid.classList.remove('hidden');
      grid.innerHTML = '';

      playlists.forEach(playlist => {
        grid.appendChild(Components.renderPlaylistCard(playlist));
      });
    } catch (error) {
      Components.showToast('Failed to load playlists: ' + error.message, 'error');
    }
  }

  function openPlaylistModal(playlistId, playlistName) {
    const titleEl = document.getElementById('playlist-modal-title');
    const nameInput = document.getElementById('playlist-name');
    const editId = document.getElementById('playlist-edit-id');
    const submitBtn = document.getElementById('playlist-submit-btn');

    if (playlistId) {
      titleEl.textContent = 'Edit Playlist';
      nameInput.value = playlistName || '';
      editId.value = playlistId;
      submitBtn.textContent = 'Save';
    } else {
      titleEl.textContent = 'Create Playlist';
      nameInput.value = '';
      editId.value = '';
      submitBtn.textContent = 'Create';
    }

    Components.openModal('playlist-modal');
    nameInput.focus();
  }

  function editPlaylist(id, name) {
    openPlaylistModal(id, name);
  }

  async function handlePlaylistSubmit(e) {
    e.preventDefault();

    const name = document.getElementById('playlist-name').value.trim();
    const editId = document.getElementById('playlist-edit-id').value;

    if (!name) return;

    try {
      if (editId) {
        await AdminAPI.updatePlaylist(editId, { name });
        Components.showToast('Playlist updated', 'success');
      } else {
        await AdminAPI.createPlaylist(name);
        Components.showToast('Playlist created', 'success');
      }

      Components.closeModal('playlist-modal');
      loadPlaylists();
    } catch (error) {
      Components.showToast('Failed: ' + error.message, 'error');
    }
  }

  function confirmDeletePlaylist(id, name) {
    Components.confirm(
      'Delete Playlist',
      `Are you sure you want to delete "${name}"? The songs will not be deleted.`,
      async () => {
        try {
          await AdminAPI.deletePlaylist(id);
          Components.showToast(`Deleted playlist: ${name}`, 'success');
          loadPlaylists();
        } catch (error) {
          Components.showToast('Failed: ' + error.message, 'error');
        }
      }
    );
  }

  async function viewPlaylist(playlistId) {
    try {
      const data = await AdminAPI.getPlaylist(playlistId);
      const playlist = data.playlist || data;
      currentPlaylistDetail = playlist;

      document.getElementById('playlist-detail-title').textContent = playlist.name;

      const container = document.getElementById('playlist-detail-songs');
      container.innerHTML = '';

      const playlistSongs = playlist.songs || [];
      if (playlistSongs.length === 0) {
        container.innerHTML = '<p class="empty-text">No songs in this playlist</p>';
      } else {
        playlistSongs.forEach((song, i) => {
          container.appendChild(Components.renderPlaylistSongRow(song, i, playlistId));
        });
      }

      // Add Songs button
      const addBtn = document.getElementById('add-songs-to-playlist-btn');
      addBtn.onclick = () => addSongsToPlaylistPrompt(playlistId);

      Components.openModal('playlist-detail-modal');
    } catch (error) {
      Components.showToast('Failed to load playlist: ' + error.message, 'error');
    }
  }

  async function removeSongFromPlaylist(playlistId, songId) {
    try {
      await AdminAPI.removeSongFromPlaylist(playlistId, songId);
      Components.showToast('Song removed from playlist', 'success');
      viewPlaylist(playlistId); // Refresh
    } catch (error) {
      Components.showToast('Failed: ' + error.message, 'error');
    }
  }

  function addSongsToPlaylistPrompt(playlistId) {
    // Simple approach: show a dropdown/list of all songs not in playlist
    const playlistSongIds = (currentPlaylistDetail?.songs || []).map(s => s.id);
    const availableSongs = songs.filter(s => !playlistSongIds.includes(s.id));

    if (availableSongs.length === 0) {
      Components.showToast('All songs are already in this playlist', 'info');
      return;
    }

    // Create a quick-add interface using the confirm modal
    const container = document.getElementById('playlist-detail-songs');

    // Add a search/select area at the top
    const selectArea = document.createElement('div');
    selectArea.className = 'add-songs-area';
    selectArea.style.cssText = 'padding:12px;background:var(--bg-secondary);border-radius:var(--radius-md);margin-bottom:12px;max-height:200px;overflow-y:auto;';

    availableSongs.forEach(song => {
      const row = document.createElement('div');
      row.style.cssText = 'display:flex;align-items:center;gap:8px;padding:8px;border-radius:6px;cursor:pointer;transition:background 0.2s;';
      row.innerHTML = `
        <span style="flex:1;font-size:13px;">${Components.escapeHtml(song.title)} — <span style="color:var(--text-tertiary)">${Components.escapeHtml(song.artist)}</span></span>
        <button class="btn btn-primary btn-sm" style="padding:4px 10px;font-size:11px;">Add</button>
      `;
      row.querySelector('button').addEventListener('click', async (e) => {
        e.stopPropagation();
        try {
          await AdminAPI.addSongToPlaylist(playlistId, song.id);
          row.remove();
          Components.showToast(`Added "${song.title}" to playlist`, 'success');
          // Refresh the song list in detail
          viewPlaylist(playlistId);
        } catch (error) {
          Components.showToast('Failed: ' + error.message, 'error');
        }
      });
      row.addEventListener('mouseenter', () => row.style.background = 'var(--bg-surface-hover)');
      row.addEventListener('mouseleave', () => row.style.background = '');
      selectArea.appendChild(row);
    });

    // Remove existing add area if any
    const existing = container.querySelector('.add-songs-area');
    if (existing) existing.remove();

    container.insertBefore(selectArea, container.firstChild);
  }

  // ---- Devices ----
  async function loadDevices() {
    try {
      const data = await AdminAPI.getDevices();
      devices = data.devices || data || [];

      const list = document.getElementById('devices-list');
      const emptyState = document.getElementById('devices-empty');

      if (devices.length === 0) {
        list.innerHTML = '';
        list.classList.add('hidden');
        emptyState.classList.remove('hidden');
        return;
      }

      emptyState.classList.add('hidden');
      list.classList.remove('hidden');
      list.innerHTML = '';

      const currentDeviceId = AdminAPI.getStoredDeviceId();
      devices.forEach(device => {
        list.appendChild(Components.renderDeviceCard(device, currentDeviceId));
      });
    } catch (error) {
      Components.showToast('Failed to load devices: ' + error.message, 'error');
    }
  }

  function confirmRevokeDevice(deviceId, deviceName) {
    Components.confirm(
      'Revoke Device',
      `Are you sure you want to revoke "${deviceName}"? This device will be logged out immediately.`,
      async () => {
        try {
          await AdminAPI.revokeDevice(deviceId);
          Components.showToast(`Revoked: ${deviceName}`, 'success');
          loadDevices();
        } catch (error) {
          Components.showToast('Failed: ' + error.message, 'error');
        }
      },
      'Revoke'
    );
  }

  // ---- Utilities ----
  function debounce(fn, delay) {
    let timer;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), delay);
    };
  }

  // ---- Public API ----
  return {
    init,
    navigateTo,
    refreshCurrentPage,
    editSong,
    confirmDeleteSong,
    editPlaylist,
    confirmDeletePlaylist,
    viewPlaylist,
    removeSongFromPlaylist,
    confirmRevokeDevice,
  };
})();

// ---- Boot ----
document.addEventListener('DOMContentLoaded', App.init);
