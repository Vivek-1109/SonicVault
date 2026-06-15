import FlexSearch from 'flexsearch';
import type { Song, Album, Artist, Playlist } from '../types';

export interface SearchResults {
  songs: Song[];
  albums: Album[];
  artists: Artist[];
  playlists: Playlist[];
}

class SearchService {
  private songIndex: any;
  private albumIndex: any;
  private artistIndex: any;
  private playlistIndex: any;

  private songsMap: Map<string, Song> = new Map();
  private albumsMap: Map<string, Album> = new Map();
  private artistsMap: Map<string, Artist> = new Map();
  private playlistsMap: Map<string, Playlist> = new Map();

  private isReady = false;

  constructor() {
    this.songIndex = new FlexSearch.Document({
      document: {
        id: 'id',
        index: ['title', 'artist', 'album', 'genre'],
      },
      tokenize: 'forward',
      cache: true,
    });

    this.albumIndex = new FlexSearch.Document({
      document: {
        id: 'id', // Using compound id for albums
        index: ['name', 'artist'],
      },
      tokenize: 'forward',
      cache: true,
    });

    this.artistIndex = new FlexSearch.Document({
      document: {
        id: 'name', // Using name as ID for artists
        index: ['name'],
      },
      tokenize: 'forward',
      cache: true,
    });

    this.playlistIndex = new FlexSearch.Document({
      document: {
        id: 'id',
        index: ['name', 'description'],
      },
      tokenize: 'forward',
      cache: true,
    });
  }

  public indexData(songs: Song[], playlists: Playlist[]) {
    // Clear maps
    this.songsMap.clear();
    this.albumsMap.clear();
    this.artistsMap.clear();
    this.playlistsMap.clear();

    const artistsTemp = new Map<string, Artist>();
    const albumsTemp = new Map<string, Album>();

    // Index Songs & Build Aggregations
    songs.forEach((song) => {
      this.songsMap.set(song.id, song);
      this.songIndex.add(song);

      // Artist extraction
      if (song.artist) {
        if (!artistsTemp.has(song.artist)) {
          artistsTemp.set(song.artist, { name: song.artist, songCount: 0, albumCount: 0 });
        }
        artistsTemp.get(song.artist)!.songCount++;
      }

      // Album extraction
      if (song.album) {
        const albumKey = `${song.album}-${song.artist}`;
        if (!albumsTemp.has(albumKey)) {
          albumsTemp.set(albumKey, {
            id: albumKey,
            name: song.album,
            artist: song.artist,
            year: null,
            coverArtR2Key: song.artworkUrl ? '' : null, // Not exactly r2Key but serves as indicator
            songCount: 0,
            totalDuration: 0,
          });
        }
        const a = albumsTemp.get(albumKey)!;
        a.songCount++;
        a.totalDuration += song.duration;
      }
    });

    // Index Albums
    albumsTemp.forEach((album) => {
      this.albumsMap.set(album.id, album);
      this.albumIndex.add(album);
      
      // Update artist album counts
      if (album.artist && artistsTemp.has(album.artist)) {
        artistsTemp.get(album.artist)!.albumCount++;
      }
    });

    // Index Artists
    artistsTemp.forEach((artist) => {
      this.artistsMap.set(artist.name, artist);
      this.artistIndex.add(artist);
    });

    // Index Playlists
    playlists.forEach((playlist) => {
      this.playlistsMap.set(playlist.id, playlist);
      this.playlistIndex.add(playlist);
    });

    this.isReady = true;
  }

  public search(query: string, limit = 10): SearchResults {
    if (!this.isReady || !query.trim()) {
      return { songs: [], albums: [], artists: [], playlists: [] };
    }

    const q = query.trim();

    // Search Songs
    const songRes = this.songIndex.search(q, limit);
    const songIds = new Set<string>();
    songRes.forEach((res: any) => {
      res.result.forEach((id: any) => songIds.add(id as string));
    });
    const songs = Array.from(songIds).map((id) => this.songsMap.get(id)!).filter(Boolean);

    // Search Albums
    const albumRes = this.albumIndex.search(q, limit);
    const albumIds = new Set<string>();
    albumRes.forEach((res: any) => {
      res.result.forEach((id: any) => albumIds.add(id as string));
    });
    const albums = Array.from(albumIds).map((id) => this.albumsMap.get(id)!).filter(Boolean);

    // Search Artists
    const artistRes = this.artistIndex.search(q, limit);
    const artistIds = new Set<string>();
    artistRes.forEach((res: any) => {
      res.result.forEach((id: any) => artistIds.add(id as string));
    });
    const artists = Array.from(artistIds).map((id) => this.artistsMap.get(id)!).filter(Boolean);

    // Search Playlists
    const playlistRes = this.playlistIndex.search(q, limit);
    const playlistIds = new Set<string>();
    playlistRes.forEach((res: any) => {
      res.result.forEach((id: any) => playlistIds.add(id as string));
    });
    const playlists = Array.from(playlistIds).map((id) => this.playlistsMap.get(id)!).filter(Boolean);

    return {
      songs,
      albums,
      artists,
      playlists,
    };
  }
}

export const searchService = new SearchService();
