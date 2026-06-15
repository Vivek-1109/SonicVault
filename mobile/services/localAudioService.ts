import * as DocumentPicker from 'expo-document-picker';
import * as MediaLibrary from 'expo-media-library/legacy';
import type { LocalAudioAsset } from '../types';

export interface LocalAudioScanResult {
  assets: LocalAudioAsset[];
  available: boolean;
  message?: string;
}

export function inferAudioMimeType(filename: string, fallback = 'audio/mpeg'): string {
  const ext = filename.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'aac':
      return 'audio/aac';
    case 'flac':
      return 'audio/flac';
    case 'm4a':
      return 'audio/x-m4a';
    case 'mp4':
      return 'audio/mp4';
    case 'ogg':
      return 'audio/ogg';
    case 'wav':
      return 'audio/wav';
    case 'webm':
      return 'audio/webm';
    case 'mp3':
      return 'audio/mpeg';
    default:
      return fallback;
  }
}

export async function scanLocalAudio(): Promise<LocalAudioScanResult> {
  try {
    const isAvailable = await MediaLibrary.isAvailableAsync();
    if (!isAvailable) {
      return {
        assets: [],
        available: false,
        message: 'Device media library is not available. Pick audio files instead.',
      };
    }

    let permission = await MediaLibrary.getPermissionsAsync(false, ['audio']);
    if (!permission.granted) {
      permission = await MediaLibrary.requestPermissionsAsync(false, ['audio']);
    }

    if (!permission.granted) {
      return {
        assets: [],
        available: false,
        message: 'Media permission was not granted. Pick audio files instead.',
      };
    }

    const page = await MediaLibrary.getAssetsAsync({
      first: 500,
      mediaType: MediaLibrary.MediaType.audio,
      sortBy: [[MediaLibrary.SortBy.modificationTime, false]],
    });

    return {
      assets: page.assets.map((asset) => ({
        id: asset.id,
        uri: asset.uri,
        filename: asset.filename,
        duration: asset.duration,
        albumId: asset.albumId,
        mimeType: inferAudioMimeType(asset.filename),
      })),
      available: true,
    };
  } catch (error: any) {
    return {
      assets: [],
      available: false,
      message: error?.message || 'Could not read local audio. Pick audio files instead.',
    };
  }
}

export async function pickLocalAudioFiles(): Promise<LocalAudioAsset[]> {
  const result = await DocumentPicker.getDocumentAsync({
    type: 'audio/*',
    copyToCacheDirectory: true,
    multiple: true,
  });

  if (result.canceled) return [];

  return result.assets.map((asset) => ({
    id: `${asset.uri}:${asset.name}`,
    uri: asset.uri,
    filename: asset.name,
    mimeType: asset.mimeType || inferAudioMimeType(asset.name),
    size: asset.size,
  }));
}

export async function resolveLocalAudioUploadUri(asset: LocalAudioAsset): Promise<string> {
  if (asset.uri.startsWith('file://') || asset.id.includes(':')) {
    return asset.uri;
  }

  try {
    const info = await MediaLibrary.getAssetInfoAsync(asset.id, {
      shouldDownloadFromNetwork: true,
    });
    return info.localUri || info.uri || asset.uri;
  } catch {
    return asset.uri;
  }
}
