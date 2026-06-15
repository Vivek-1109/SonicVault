import { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { usePlayerStore } from '../../stores/playerStore';
import { colors } from '../../constants/colors';
import { formatDuration } from '../../utils/formatTime';
import { getImageUrl } from '../../utils/getImageUrl';
import { api } from '../../services/api';
import { searchService, SearchResults } from '../../services/searchService';
import type { Song, Album, Artist, Playlist } from '../../types';

export default function SearchScreen() {
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResults>({ songs: [], albums: [], artists: [], playlists: [] });
  const { playSong } = usePlayerStore();

  const { data: syncData } = useQuery({
    queryKey: ['sync'],
    queryFn: async () => {
      const res = await api.get('/api/sync');
      return res.data;
    },
    staleTime: 5 * 60 * 1000,
  });

  const allSongs: Song[] = syncData?.songs || [];
  const allPlaylists: Playlist[] = syncData?.playlists || [];

  // Index data when syncData changes
  useEffect(() => {
    if (syncData) {
      searchService.indexData(allSongs, allPlaylists);
    }
  }, [syncData]);

  // Perform search
  useEffect(() => {
    if (query.trim().length > 0) {
      setResults(searchService.search(query, 20));
    } else {
      setResults({ songs: [], albums: [], artists: [], playlists: [] });
    }
  }, [query]);

  const filteredSongs = results.songs;

  const handlePlay = useCallback((song: Song) => {
    const list = filteredSongs.length > 0 ? filteredSongs : allSongs;
    playSong(song, list);
  }, [filteredSongs, allSongs, playSong]);

  function renderSongItem({ item }: { item: Song }) {
    return (
      <TouchableOpacity
        style={styles.songRow}
        onPress={() => handlePlay(item)}
        activeOpacity={0.6}
      >
        <View style={styles.songArtwork}>
          {item.artworkUrl ? (
            <Image
              source={{ uri: getImageUrl(item.artworkUrl, item.id) || undefined }}
              style={styles.songImage}
              contentFit="cover"
            />
          ) : (
            <View style={styles.songPlaceholder}>
              <Text style={styles.songPlaceholderText}>♫</Text>
            </View>
          )}
        </View>
        <View style={styles.songInfo}>
          <Text style={styles.songTitle} numberOfLines={1}>{item.title}</Text>
          <Text style={styles.songArtist} numberOfLines={1}>
            {item.artist}{item.album ? ` · ${item.album}` : ''}
          </Text>
        </View>
        <Text style={styles.songDuration}>{formatDuration(item.duration)}</Text>
      </TouchableOpacity>
    );
  }

  // Browse by genre
  const genreMap = new Map<string, number>();
  allSongs.forEach(s => {
    const genre = s.genre || 'Unknown';
    genreMap.set(genre, (genreMap.get(genre) || 0) + 1);
  });
  const genres = Array.from(genreMap.entries()).sort((a, b) => b[1] - a[1]);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Search</Text>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={18} color={colors.textTertiary} />
        <TextInput
          style={styles.searchInput}
          placeholder="Songs, artists, albums..."
          placeholderTextColor={colors.textTertiary}
          value={query}
          onChangeText={setQuery}
          autoCapitalize="none"
          autoCorrect={false}
          clearButtonMode="while-editing"
        />
        {query.length > 0 && (
          <TouchableOpacity onPress={() => setQuery('')}>
            <Ionicons name="close-circle" size={18} color={colors.textTertiary} />
          </TouchableOpacity>
        )}
      </View>

      {/* Results or Browse */}
      {query.trim().length > 0 ? (
        <FlatList
          data={filteredSongs}
          keyExtractor={(item) => item.id}
          renderItem={renderSongItem}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>No results for "{query}"</Text>
            </View>
          }
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <View>
              {results.artists.length > 0 && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Artists</Text>
                  {results.artists.slice(0, 3).map(artist => (
                    <Text key={artist.name} style={styles.resultItem}>{artist.name}</Text>
                  ))}
                </View>
              )}
              {results.albums.length > 0 && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Albums</Text>
                  {results.albums.slice(0, 3).map(album => (
                    <Text key={album.name} style={styles.resultItem}>{album.name}</Text>
                  ))}
                </View>
              )}
              <Text style={styles.resultCount}>
                {filteredSongs.length} song{filteredSongs.length !== 1 ? 's' : ''}
              </Text>
            </View>
          }
        />
      ) : (
        <FlatList
          data={genres}
          keyExtractor={([genre]) => genre}
          contentContainerStyle={styles.genreList}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <Text style={styles.browseTitle}>Browse by Genre</Text>
          }
          renderItem={({ item: [genre, count] }) => (
            <TouchableOpacity
              style={styles.genreCard}
              activeOpacity={0.7}
              onPress={() => setQuery(genre)}
            >
              <Text style={styles.genreName}>{genre}</Text>
              <Text style={styles.genreCount}>{count} songs</Text>
            </TouchableOpacity>
          )}
          ListFooterComponent={<View style={{ height: 100 }} />}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: -0.5,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    marginHorizontal: 20,
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: 12,
    gap: 10,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: colors.text,
  },
  resultCount: {
    fontSize: 13,
    color: colors.textTertiary,
    marginBottom: 8,
    fontWeight: '500',
    marginTop: 12,
  },
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 8,
  },
  resultItem: {
    fontSize: 16,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 100,
  },
  songRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    gap: 12,
  },
  songArtwork: {
    width: 48,
    height: 48,
    borderRadius: 6,
    overflow: 'hidden',
  },
  songImage: {
    width: '100%',
    height: '100%',
  },
  songPlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  songPlaceholderText: {
    fontSize: 16,
    color: colors.textTertiary,
  },
  songInfo: {
    flex: 1,
    gap: 2,
  },
  songTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
  songArtist: {
    fontSize: 13,
    color: colors.textTertiary,
  },
  songDuration: {
    fontSize: 13,
    color: colors.textTertiary,
    fontVariant: ['tabular-nums'],
  },
  emptyState: {
    paddingVertical: 60,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 15,
    color: colors.textTertiary,
  },
  browseTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 14,
    letterSpacing: -0.3,
  },
  genreList: {
    paddingHorizontal: 20,
    paddingBottom: 100,
  },
  genreCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 18,
    marginBottom: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  genreName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  genreCount: {
    fontSize: 13,
    color: colors.textTertiary,
  },
});
