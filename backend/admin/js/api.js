// ================================================================
// SonicVault Admin — API Client
// Handles authentication, token refresh, and all API calls
// ================================================================

const AdminAPI = (() => {
  let accessToken = null;
  let refreshToken = null;
  let deviceId = null;
  const BASE_URL = window.location.origin;

  // ---- Token Management ----
  function setTokens(access, refresh, device) {
    accessToken = access;
    refreshToken = refresh;
    deviceId = device;
    localStorage.setItem('sv_refresh_token', refresh);
    localStorage.setItem('sv_device_id', device);
  }

  function clearTokens() {
    accessToken = null;
    refreshToken = null;
    deviceId = null;
    localStorage.removeItem('sv_refresh_token');
    localStorage.removeItem('sv_device_id');
  }

  function getStoredRefreshToken() {
    return localStorage.getItem('sv_refresh_token');
  }

  function getStoredDeviceId() {
    return localStorage.getItem('sv_device_id');
  }

  function isAuthenticated() {
    return !!accessToken;
  }

  // ---- Core Fetch Wrapper ----
  async function request(endpoint, options = {}) {
    const url = `${BASE_URL}${endpoint}`;
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (accessToken) {
      headers['Authorization'] = `Bearer ${accessToken}`;
    }

    // Remove Content-Type for FormData
    if (options.body instanceof FormData) {
      delete headers['Content-Type'];
    }

    const response = await fetch(url, {
      ...options,
      headers,
    });

    // Handle 401 — try token refresh
    if (response.status === 401 && refreshToken) {
      const refreshed = await tryRefresh();
      if (refreshed) {
        headers['Authorization'] = `Bearer ${accessToken}`;
        const retryResponse = await fetch(url, { ...options, headers });
        if (!retryResponse.ok) {
          const err = await retryResponse.json().catch(() => ({ error: 'Request failed' }));
          throw new Error(err.error || `HTTP ${retryResponse.status}`);
        }
        return retryResponse.json().catch(() => null);
      } else {
        clearTokens();
        window.location.reload();
        throw new Error('Session expired');
      }
    }

    if (!response.ok) {
      const err = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
      throw new Error(err.error || `HTTP ${response.status}`);
    }

    // Handle 204 No Content
    if (response.status === 204) return null;

    return response.json().catch(() => null);
  }

  async function tryRefresh() {
    try {
      const response = await fetch(`${BASE_URL}/api/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken, deviceId }),
      });

      if (!response.ok) return false;

      const data = await response.json();
      accessToken = data.accessToken;
      refreshToken = data.refreshToken;
      localStorage.setItem('sv_refresh_token', data.refreshToken);
      return true;
    } catch {
      return false;
    }
  }

  // ---- Auth ----
  async function login(email, password) {
    const data = await request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email,
        password,
        deviceName: 'Admin Dashboard — ' + getBrowserName(),
      }),
    });
    setTokens(data.accessToken, data.refreshToken, data.deviceId);
    return data;
  }

  async function logout() {
    try {
      await request('/api/auth/logout', {
        method: 'POST',
        body: JSON.stringify({ deviceId }),
      });
    } catch {
      // Ignore errors during logout
    }
    clearTokens();
  }

  async function tryAutoLogin() {
    const storedRefresh = getStoredRefreshToken();
    const storedDevice = getStoredDeviceId();
    if (!storedRefresh || !storedDevice) return false;

    refreshToken = storedRefresh;
    deviceId = storedDevice;
    return await tryRefresh();
  }

  // ---- Songs ----
  async function getSongs(since) {
    const params = since ? `?since=${encodeURIComponent(since)}` : '';
    return request(`/api/songs${params}`);
  }

  async function getSong(id) {
    return request(`/api/songs/${id}`);
  }

  async function getStreamUrl(id) {
    return request(`/api/songs/${id}/stream-url`);
  }

  async function updateSong(id, data) {
    return request(`/api/admin/songs/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async function deleteSong(id) {
    return request(`/api/admin/songs/${id}`, {
      method: 'DELETE',
    });
  }

  async function uploadSong(file, onProgress) {
    return new Promise((resolve, reject) => {
      const formData = new FormData();
      formData.append('file', file);

      const xhr = new XMLHttpRequest();
      xhr.open('POST', `${BASE_URL}/api/admin/songs/upload`);

      if (accessToken) {
        xhr.setRequestHeader('Authorization', `Bearer ${accessToken}`);
      }

      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable && onProgress) {
          onProgress(e.loaded / e.total);
        }
      };

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            resolve(JSON.parse(xhr.responseText));
          } catch {
            resolve(null);
          }
        } else {
          try {
            const err = JSON.parse(xhr.responseText);
            reject(new Error(err.error || `Upload failed: ${xhr.status}`));
          } catch {
            reject(new Error(`Upload failed: ${xhr.status}`));
          }
        }
      };

      xhr.onerror = () => reject(new Error('Upload failed: network error'));
      xhr.send(formData);
    });
  }

  async function uploadArtwork(songId, file) {
    const formData = new FormData();
    formData.append('artwork', file);
    formData.append('songId', songId);
    return request('/api/admin/artwork-upload', {
      method: 'POST',
      body: formData,
    });
  }

  // ---- Playlists ----
  async function getPlaylists() {
    return request('/api/playlists');
  }

  async function getPlaylist(id) {
    return request(`/api/playlists/${id}`);
  }

  async function createPlaylist(name) {
    return request('/api/playlists', {
      method: 'POST',
      body: JSON.stringify({ name }),
    });
  }

  async function updatePlaylist(id, data) {
    return request(`/api/playlists/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async function deletePlaylist(id) {
    return request(`/api/playlists/${id}`, {
      method: 'DELETE',
    });
  }

  async function addSongToPlaylist(playlistId, songId) {
    return request(`/api/playlists/${playlistId}/songs`, {
      method: 'POST',
      body: JSON.stringify({ songId }),
    });
  }

  async function removeSongFromPlaylist(playlistId, songId) {
    return request(`/api/playlists/${playlistId}/songs/${songId}`, {
      method: 'DELETE',
    });
  }

  // ---- Favorites ----
  async function getFavorites() {
    return request('/api/favorites');
  }

  // ---- Devices ----
  async function getDevices() {
    return request('/api/devices');
  }

  async function revokeDevice(id) {
    return request(`/api/devices/${id}`, {
      method: 'DELETE',
    });
  }

  // ---- Sync ----
  async function sync(since) {
    const params = since ? `?since=${encodeURIComponent(since)}` : '';
    return request(`/api/sync${params}`);
  }

  // ---- Admin ----
  async function getStorageStats() {
    return request('/api/admin/storage');
  }

  // ---- Helpers ----
  function getBrowserName() {
    const ua = navigator.userAgent;
    if (ua.includes('Chrome') && !ua.includes('Edg')) return 'Chrome';
    if (ua.includes('Edg')) return 'Edge';
    if (ua.includes('Firefox')) return 'Firefox';
    if (ua.includes('Safari') && !ua.includes('Chrome')) return 'Safari';
    return 'Browser';
  }

  function formatDuration(seconds) {
    if (!seconds || seconds <= 0) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  function formatFileSize(bytes) {
    if (!bytes || bytes <= 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB'];
    let i = 0;
    let size = bytes;
    while (size >= 1024 && i < units.length - 1) {
      size /= 1024;
      i++;
    }
    return `${size.toFixed(i > 0 ? 1 : 0)} ${units[i]}`;
  }

  function formatTimeAgo(dateString) {
    if (!dateString) return 'Unknown';
    const date = new Date(dateString + 'Z');
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  }

  return {
    login,
    logout,
    tryAutoLogin,
    isAuthenticated,
    clearTokens,
    getSongs,
    getSong,
    getStreamUrl,
    updateSong,
    deleteSong,
    uploadSong,
    uploadArtwork,
    getPlaylists,
    getPlaylist,
    createPlaylist,
    updatePlaylist,
    deletePlaylist,
    addSongToPlaylist,
    removeSongFromPlaylist,
    getFavorites,
    getDevices,
    revokeDevice,
    sync,
    getStorageStats,
    formatDuration,
    formatFileSize,
    formatTimeAgo,
    getStoredDeviceId,
  };
})();
