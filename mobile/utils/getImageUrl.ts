import { config } from '../constants/config';

export function getImageUrl(url?: string | null, songId?: string): string | null {
  if (!url) return null;
  
  // If it's already a full URL (legacy pre-signed URLs or external), return as is
  if (url.startsWith('http')) {
    return url;
  }
  
  // If we have a song ID, we can use the dedicated public endpoint
  if (songId) {
    return `${config.API_BASE_URL}/api/songs/${songId}/artwork`;
  }

  // If the backend returned a relative URL, prepend the base URL
  if (url.startsWith('/')) {
    return `${config.API_BASE_URL}${url}`;
  }
  
  // If it's just the R2 key, use the public endpoint (requires song ID, but fallback to general artwork route if we make one)
  return `${config.API_BASE_URL}/api/songs/artwork?key=${encodeURIComponent(url)}`;
}
