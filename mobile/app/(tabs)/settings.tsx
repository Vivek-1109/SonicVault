import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert, Switch } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '../../stores/authStore';
import { useDownloadStore } from '../../stores/downloadStore';
import { colors } from '../../constants/colors';
import { formatFileSize } from '../../utils/formatTime';
import { api } from '../../services/api';
import { useRouter } from 'expo-router';

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { logout, biometricsEnabled, setBiometrics, userEmail } = useAuthStore();
  const { getTotalSize, removeAllDownloads, downloads } = useDownloadStore();

  const { data: devices } = useQuery({
    queryKey: ['devices'],
    queryFn: async () => {
      const res = await api.get('/api/devices');
      return res.data.devices || res.data;
    },
    staleTime: 60 * 1000,
  });

  const downloadCount = Object.values(downloads).filter(d => d.status === 'completed').length;

  function handleLogout() {
    Alert.alert('Logout', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: logout,
      },
    ]);
  }

  function handleClearDownloads() {
    Alert.alert(
      'Clear Downloads',
      `Remove ${downloadCount} downloaded songs? Your library won't be affected.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Remove All', style: 'destructive', onPress: removeAllDownloads },
      ]
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.headerTitle}>Settings</Text>

        {/* Account Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>ACCOUNT</Text>
          <View style={styles.card}>
            <View style={styles.row}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>
                  {(userEmail || 'A').charAt(0).toUpperCase()}
                </Text>
              </View>
              <View style={styles.rowInfo}>
                <Text style={styles.rowTitle}>{userEmail || 'Admin'}</Text>
                <Text style={styles.rowSubtitle}>Owner Account</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Security */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>SECURITY</Text>
          <View style={styles.card}>
            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Ionicons name="finger-print" size={20} color={colors.primary} />
                <Text style={styles.settingLabel}>Biometric Unlock</Text>
              </View>
              <Switch
                value={biometricsEnabled}
                onValueChange={setBiometrics}
                trackColor={{ false: colors.surfaceLight, true: colors.primaryMuted }}
                thumbColor={biometricsEnabled ? colors.primary : colors.textTertiary}
              />
            </View>
          </View>
        </View>

        {/* Admin Dashboard */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>ADMINISTRATION</Text>
          <TouchableOpacity
            style={styles.adminCard}
            activeOpacity={0.7}
            onPress={() => router.push('/admin')}
          >
            <View style={styles.adminCardContent}>
              <View style={styles.adminIcon}>
                <Ionicons name="shield-checkmark" size={24} color={colors.primary} />
              </View>
              <View style={styles.adminInfo}>
                <Text style={styles.adminTitle}>Admin Dashboard</Text>
                <Text style={styles.adminSubtitle}>Upload songs, manage library & devices</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.textTertiary} />
          </TouchableOpacity>
        </View>

        {/* Storage */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>STORAGE</Text>
          <View style={styles.card}>
            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Ionicons name="download-outline" size={20} color={colors.textSecondary} />
                <View>
                  <Text style={styles.settingLabel}>Downloaded Songs</Text>
                  <Text style={styles.settingSublabel}>
                    {downloadCount} songs · {formatFileSize(getTotalSize())}
                  </Text>
                </View>
              </View>
              {downloadCount > 0 && (
                <TouchableOpacity onPress={handleClearDownloads}>
                  <Text style={styles.clearText}>Clear</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>

        {/* Devices */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>DEVICES</Text>
          <View style={styles.card}>
            {(devices || []).map((device: any, i: number) => (
              <View
                key={device.id}
                style={[styles.deviceRow, i > 0 && styles.deviceRowBorder]}
              >
                <Ionicons name="phone-portrait-outline" size={18} color={colors.textSecondary} />
                <View style={styles.deviceInfo}>
                  <Text style={styles.deviceName}>{device.deviceName}</Text>
                  <Text style={styles.deviceMeta}>
                    Last seen: {new Date(device.lastSeen + 'Z').toLocaleDateString()}
                  </Text>
                </View>
              </View>
            ))}
            {(!devices || devices.length === 0) && (
              <Text style={styles.emptyDevices}>No devices connected</Text>
            )}
          </View>
        </View>

        {/* About */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>ABOUT</Text>
          <View style={styles.card}>
            <View style={styles.aboutRow}>
              <Text style={styles.aboutLabel}>App Version</Text>
              <Text style={styles.aboutValue}>1.0.0</Text>
            </View>
            <View style={[styles.aboutRow, styles.aboutRowBorder]}>
              <Text style={styles.aboutLabel}>Build</Text>
              <Text style={styles.aboutValue}>SonicVault EAS</Text>
            </View>
          </View>
        </View>

        {/* Logout */}
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} activeOpacity={0.7}>
          <Ionicons name="log-out-outline" size={20} color={colors.error} />
          <Text style={styles.logoutText}>Sign Out</Text>
        </TouchableOpacity>

        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: -0.5,
    paddingTop: 12,
    paddingBottom: 24,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textTertiary,
    letterSpacing: 1,
    marginBottom: 8,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primaryGlow,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.primary,
  },
  rowInfo: {
    gap: 2,
  },
  rowTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
  rowSubtitle: {
    fontSize: 13,
    color: colors.textTertiary,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  settingInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  settingLabel: {
    fontSize: 15,
    fontWeight: '500',
    color: colors.text,
  },
  settingSublabel: {
    fontSize: 12,
    color: colors.textTertiary,
    marginTop: 2,
  },
  clearText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.error,
  },
  deviceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 4,
  },
  deviceRowBorder: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 12,
    marginTop: 8,
  },
  deviceInfo: {
    flex: 1,
    gap: 2,
  },
  deviceName: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.text,
  },
  deviceMeta: {
    fontSize: 12,
    color: colors.textTertiary,
  },
  emptyDevices: {
    fontSize: 13,
    color: colors.textTertiary,
    textAlign: 'center',
    paddingVertical: 8,
  },
  aboutRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  aboutRowBorder: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 12,
    marginTop: 8,
  },
  aboutLabel: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  aboutValue: {
    fontSize: 14,
    color: colors.text,
    fontWeight: '500',
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: 8,
  },
  logoutText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.error,
  },
  adminCard: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  adminCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    flex: 1,
  },
  adminIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primaryGlow,
    justifyContent: 'center',
    alignItems: 'center',
  },
  adminInfo: {
    flex: 1,
    gap: 3,
  },
  adminTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
  adminSubtitle: {
    fontSize: 12,
    color: colors.textTertiary,
  },
});
