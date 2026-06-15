import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as DocumentPicker from 'expo-document-picker';
import { adminService } from '../services/adminService';
import { colors } from '../constants/colors';
import { typography } from '../constants/typography';
import type { StorageStats } from '../types';

export default function AdminScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  
  const [stats, setStats] = useState<StorageStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  useEffect(() => {
    fetchStats();
  }, []);

  async function fetchStats() {
    try {
      setIsLoading(true);
      const data = await adminService.getStats();
      setStats(data);
    } catch (error) {
      Alert.alert('Error', 'Failed to fetch admin stats');
    } finally {
      setIsLoading(false);
    }
  }

  async function handleUpload() {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'audio/*',
        copyToCacheDirectory: true,
      });

      if (result.canceled) return;

      const file = result.assets[0];
      
      setIsUploading(true);
      setUploadProgress(0);

      await adminService.uploadSong(
        file.uri,
        file.name,
        file.mimeType || 'audio/mpeg',
        (progress) => setUploadProgress(progress)
      );

      Alert.alert('Success', 'Song uploaded successfully!');
      fetchStats();
    } catch (error: any) {
      Alert.alert('Upload Failed', error.message || 'An unknown error occurred');
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  }

  async function handleSync() {
    try {
      setIsSyncing(true);
      const res = await adminService.syncMetadata();
      Alert.alert('Sync Complete', res.message);
      fetchStats();
    } catch (error: any) {
      Alert.alert('Sync Failed', error.message || 'Failed to sync metadata');
    } finally {
      setIsSyncing(false);
    }
  }

  function formatBytes(bytes: number) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={28} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Admin Dashboard</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {isLoading ? (
          <ActivityIndicator size="large" color={colors.primary} style={styles.loader} />
        ) : stats ? (
          <>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Storage Overview</Text>
              
              <View style={styles.statRow}>
                <Text style={styles.statLabel}>Total Size</Text>
                <Text style={styles.statValue}>{formatBytes(stats.totalSize)}</Text>
              </View>
              
              <View style={styles.statRow}>
                <Text style={styles.statLabel}>Database Size</Text>
                <Text style={styles.statValue}>{formatBytes(stats.dbSize)}</Text>
              </View>

              <View style={styles.divider} />

              <View style={styles.statRow}>
                <Text style={styles.statLabel}>Total Songs</Text>
                <Text style={styles.statValue}>{stats.songs.count}</Text>
              </View>

              <View style={styles.statRow}>
                <Text style={styles.statLabel}>Songs Size</Text>
                <Text style={styles.statValue}>{formatBytes(stats.songs.size)}</Text>
              </View>

              <View style={styles.statRow}>
                <Text style={styles.statLabel}>Total Playlists</Text>
                <Text style={styles.statValue}>{stats.playlists.count}</Text>
              </View>
            </View>

            <View style={styles.actionsContainer}>
              <Text style={styles.sectionTitle}>Actions</Text>
              
              <TouchableOpacity 
                style={[styles.actionButton, isUploading && styles.actionButtonDisabled]} 
                onPress={handleUpload}
                disabled={isUploading}
              >
                {isUploading ? (
                  <View style={styles.progressContainer}>
                    <ActivityIndicator size="small" color={colors.background} />
                    <Text style={styles.actionButtonText}>
                      Uploading {Math.round(uploadProgress * 100)}%
                    </Text>
                  </View>
                ) : (
                  <>
                    <Ionicons name="cloud-upload" size={24} color={colors.background} />
                    <Text style={styles.actionButtonText}>Upload Song</Text>
                  </>
                )}
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.actionButton, styles.secondaryButton, isSyncing && styles.actionButtonDisabled]} 
                onPress={handleSync}
                disabled={isSyncing}
              >
                {isSyncing ? (
                  <ActivityIndicator size="small" color={colors.text} />
                ) : (
                  <>
                    <Ionicons name="sync" size={24} color={colors.text} />
                    <Text style={[styles.actionButtonText, { color: colors.text }]}>Sync Metadata</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceLight,
  },
  backButton: {
    marginRight: 16,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
  },
  content: {
    padding: 20,
  },
  loader: {
    marginTop: 40,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 16,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  statLabel: {
    fontSize: 16,
    color: colors.textSecondary,
  },
  statValue: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  divider: {
    height: 1,
    backgroundColor: colors.surfaceLight,
    marginVertical: 12,
  },
  actionsContainer: {
    gap: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 8,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    padding: 16,
    borderRadius: 12,
    gap: 8,
  },
  secondaryButton: {
    backgroundColor: colors.surfaceLight,
  },
  actionButtonDisabled: {
    opacity: 0.7,
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.background,
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
});
