import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Linking,
  Modal,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MapView, { Circle, Marker } from 'react-native-maps';
import useAppStore from '../store/useAppStore';
import {
  createStatusUpdate,
  deleteStatusUpdate,
  getNearbyStatuses,
  getNearbyUsers,
  sendPing,
} from '../utils/api';
import { useLocationHeartbeat } from '../hooks/useLocation';
import PingModal from './PingModal';
import ChatScreen from './Chat/ChatScreen';
import SetProfile from './Onboarding/SetProfile';
import { colors } from '../theme';

function formatAge(timestamp) {
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(timestamp).getTime()) / 60000));
  if (!Number.isFinite(minutes) || minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return 'today';
}

export default function NearbyFeed() {
  const {
    user,
    location,
    locationStatus,
    nearbyUsers,
    setNearbyUsers,
    incomingPing,
    activeChat,
  } = useAppStore();
  const [statusUpdates, setStatusUpdates] = useState([]);
  const [draft, setDraft] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [posting, setPosting] = useState(false);
  const [pingingId, setPingingId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [radius, setRadius] = useState(100);
  const [viewMode, setViewMode] = useState('feed');
  const [selectedMapUser, setSelectedMapUser] = useState(null);
  const locationReady = locationStatus === 'ready';

  useLocationHeartbeat();

  const fetchNearby = useCallback(async () => {
    if (!location || !locationReady) return;
    const [usersResult, statusesResult] = await Promise.allSettled([
      getNearbyUsers(location.lat, location.lng, radius),
      getNearbyStatuses(location.lat, location.lng, radius),
    ]);
    if (usersResult.status === 'fulfilled') setNearbyUsers(usersResult.value);
    else console.log('Nearby people error:', usersResult.reason?.message);
    if (statusesResult.status === 'fulfilled') setStatusUpdates(statusesResult.value);
    else console.log('Nearby statuses error:', statusesResult.reason?.message);
  }, [location, locationReady, radius, setNearbyUsers]);

  useEffect(() => {
    fetchNearby();
    const id = setInterval(fetchNearby, 15000);
    return () => clearInterval(id);
  }, [fetchNearby]);

  const handlePing = async (targetUser) => {
    if (!targetUser || pingingId) return;
    setPingingId(targetUser.id);

    try {
      await sendPing(targetUser.id);
      Alert.alert('Ping sent', `Waiting for ${targetUser.firstName} to respond...`);
    } catch (error) {
      Alert.alert('Ping failed', error?.response?.data?.error || 'Could not send ping.');
    } finally {
      setTimeout(() => setPingingId(null), 2000);
    }
  };

  const handlePost = async () => {
    const text = draft.trim();
    if (!text || posting) return;

    setPosting(true);
    try {
      const status = await createStatusUpdate(text);
      setStatusUpdates((current) => [status, ...current.filter((item) => item.id !== status.id)]);
      setDraft('');
    } catch (error) {
      Alert.alert('Could not post update', error?.response?.data?.error || 'Check your connection and try again.');
    } finally {
      setPosting(false);
    }
  };

  const handleDeleteStatus = (status) => {
    Alert.alert('Delete this update?', 'It will disappear from the nearby feed.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setDeletingId(status.id);
          try {
            await deleteStatusUpdate(status.id);
            setStatusUpdates((current) => current.filter((item) => item.id !== status.id));
          } catch (error) {
            Alert.alert('Could not delete update', error?.response?.data?.error || 'Check your connection and try again.');
          } finally {
            setDeletingId(null);
          }
        },
      },
    ]);
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await fetchNearby();
    } finally {
      setRefreshing(false);
    }
  };

  if (activeChat) return <ChatScreen />;

  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.header}>
        <View>
          <Text style={styles.wordmark}>Moongram</Text>
          <View style={styles.liveLabel}>
            <View style={[styles.liveDot, !locationReady && styles.liveDotWaiting]} />
            <Text style={styles.liveText}>{locationReady ? `NEARBY NOW · ${radius}M` : 'CONNECTING TO NEARBY'}</Text>
          </View>
        </View>
        <Pressable style={styles.profileButton} onPress={() => setProfileOpen(true)}>
          <View style={styles.avatarSmall}>
            <Text style={styles.avatarInitial}>{user?.firstName?.[0]?.toUpperCase() || 'Y'}</Text>
          </View>
          <Text style={styles.profileButtonText}>My profile</Text>
        </Pressable>
      </View>

      <View style={styles.feedControls}>
        <View style={styles.viewSwitch}>
          {[
            { id: 'feed', label: 'Updates' },
            { id: 'map', label: 'Map' },
          ].map((view) => {
            const selected = viewMode === view.id;
            return (
              <Pressable
                key={view.id}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                onPress={() => {
                  setSelectedMapUser(null);
                  setViewMode(view.id);
                }}
                style={[styles.viewTab, selected && styles.viewTabSelected]}
              >
                <Text style={[styles.viewTabText, selected && styles.viewTabTextSelected]}>{view.label}</Text>
              </Pressable>
            );
          })}
        </View>
        {viewMode === 'map' && (
          <View style={styles.radiusRow}>
            <Text style={styles.radiusLabel}>RADIUS</Text>
            <View style={styles.radiusControl}>
              {[100, 250, 500].map((distance) => {
                const selected = radius === distance;
                return (
                  <Pressable
                    key={distance}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    onPress={() => setRadius(distance)}
                    style={[styles.radiusOption, selected && styles.radiusOptionSelected]}
                  >
                    <Text style={[styles.radiusOptionText, selected && styles.radiusOptionTextSelected]}>{distance}m</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        )}
      </View>

      {viewMode === 'map' ? (
        <View style={styles.mapContainer}>
          {locationReady && location ? (
            <MapView
              style={styles.map}
              initialRegion={{
                latitude: location.lat,
                longitude: location.lng,
                latitudeDelta: radius >= 500 ? 0.012 : 0.006,
                longitudeDelta: radius >= 500 ? 0.012 : 0.006,
              }}
              showsUserLocation
              showsMyLocationButton
              onPress={() => setSelectedMapUser(null)}
            >
              <Circle
                center={{ latitude: location.lat, longitude: location.lng }}
                radius={radius}
                strokeColor="rgba(49,83,43,0.42)"
                fillColor="rgba(183,233,107,0.14)"
              />
              {nearbyUsers
                .filter((person) => Number.isFinite(person.mapLatitude) && Number.isFinite(person.mapLongitude))
                .map((person) => (
                  <Marker
                    key={person.id}
                    coordinate={{ latitude: person.mapLatitude, longitude: person.mapLongitude }}
                    title={person.firstName}
                    description="Approximate nearby presence"
                    onPress={() => setSelectedMapUser(person)}
                    tracksViewChanges={false}
                  >
                    <View style={[styles.mapMarker, selectedMapUser?.id === person.id && styles.mapMarkerSelected]}>
                      <Text style={styles.mapMarkerText}>{person.firstName?.[0]?.toUpperCase() || 'M'}</Text>
                    </View>
                  </Marker>
                ))}
            </MapView>
          ) : (
            <View style={styles.mapLoading}>
              <ActivityIndicator color={colors.mintText} />
              <Text style={styles.mapLoadingTitle}>Connecting to your nearby circle</Text>
              <Text style={styles.mapLoadingText}>Allow location and make sure Moongram can reach your computer.</Text>
            </View>
          )}

          <View pointerEvents="none" style={styles.mapPrivacyNote}>
            <View style={styles.privacyDot} />
            <Text style={styles.mapPrivacyText}>Approximate presence · pins shift every 15 min</Text>
          </View>

          {locationReady && nearbyUsers.length === 0 && (
            <View pointerEvents="none" style={styles.mapEmptyNote}>
              <Text style={styles.mapEmptyTitle}>Your circle is quiet right now</Text>
              <Text style={styles.mapEmptyText}>Nearby people appear when they open Moongram.</Text>
            </View>
          )}

          {selectedMapUser && (
            <View style={styles.mapPersonCard}>
              <View style={styles.mapPersonAvatar}>
                <Text style={styles.mapPersonInitial}>{selectedMapUser.firstName?.[0]?.toUpperCase() || 'M'}</Text>
              </View>
              <View style={styles.mapPersonCopy}>
                <Text style={styles.mapPersonName}>{selectedMapUser.firstName}</Text>
                <Text style={styles.mapPersonTags} numberOfLines={1}>
                  {(selectedMapUser.vibeTags || []).join(' · ') || 'Open to meeting'}
                </Text>
              </View>
              <Pressable
                style={[styles.pingButton, pingingId === selectedMapUser.id && styles.pingButtonDisabled]}
                onPress={() => handlePing(selectedMapUser)}
                disabled={pingingId === selectedMapUser.id}
              >
                <Text style={styles.pingButtonText}>{pingingId === selectedMapUser.id ? 'Sent' : 'Ping'}</Text>
              </Pressable>
            </View>
          )}
        </View>
      ) : (
        <FlatList
          data={statusUpdates}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.feedList}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.mintText} />
          }
          ListHeaderComponent={(
            <>
              {!locationReady && (
                <View style={styles.locationBanner}>
                  {locationStatus === 'denied' ? (
                    <>
                      <Text style={styles.locationTitle}>Turn on location for nearby posts</Text>
                      <Text style={styles.locationDescription}>Your feed stays here. Allow location to discover people and updates around you.</Text>
                      <Pressable style={styles.settingsButton} onPress={() => Linking.openSettings()}>
                        <Text style={styles.settingsButtonText}>Open settings</Text>
                      </Pressable>
                    </>
                  ) : locationStatus === 'error' ? (
                    <>
                      <Text style={styles.locationTitle}>Location isn’t reaching Moongram</Text>
                      <Text style={styles.locationDescription}>Check that the backend is running and this phone can reach your computer, then wait for the next location update.</Text>
                    </>
                  ) : (
                    <View style={styles.locationLoading}>
                      <ActivityIndicator color={colors.mint} size="small" />
                      <Text style={styles.locationDescription}>{location ? 'Connecting your location to Moongram...' : 'Finding your location to show nearby activity...'}</Text>
                    </View>
                  )}
                </View>
              )}

              <View style={styles.composer}>
                <View style={styles.composerByline}>
                  <View style={styles.avatarSmall}>
                    <Text style={styles.avatarInitial}>{user?.firstName?.[0]?.toUpperCase() || 'M'}</Text>
                  </View>
                  <Text style={styles.composerBylineText}>A note for your nearby circle</Text>
                </View>
                <Text style={styles.sectionTitle}>What’s happening nearby?</Text>
                <TextInput
                  value={draft}
                  onChangeText={setDraft}
                  placeholder="Share a thought, plan, or local tip..."
                  placeholderTextColor={colors.quiet}
                  multiline
                  maxLength={280}
                  editable={!posting}
                  style={styles.composerInput}
                />
                <View style={styles.composerFooter}>
                  <Text style={styles.characterCount}>{draft.length}/280</Text>
                  <Pressable
                    accessibilityRole="button"
                    disabled={!draft.trim() || posting || !locationReady}
                    onPress={handlePost}
                    style={[styles.postButton, (!draft.trim() || posting || !locationReady) && styles.postButtonDisabled]}
                  >
                    {posting ? <ActivityIndicator color={colors.background} /> : <Text style={styles.postButtonText}>Post update</Text>}
                  </Pressable>
                </View>
              </View>

              <View style={styles.sectionHeading}>
                <Text style={styles.sectionTitle}>People nearby</Text>
                <Text style={styles.sectionMeta}>{nearbyUsers.length} active</Text>
              </View>
              {nearbyUsers.length > 0 ? (
                <FlatList
                  horizontal
                  data={nearbyUsers}
                  keyExtractor={(item) => item.id}
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.peopleList}
                  renderItem={({ item }) => (
                    <View style={styles.person}>
                      <View style={styles.personTop}>
                        <View style={styles.avatar}>
                          <Text style={styles.avatarInitial}>{item.firstName?.[0]?.toUpperCase() || '?'}</Text>
                        </View>
                        <View style={styles.personInfo}>
                          <Text style={styles.personName} numberOfLines={1}>{item.firstName}</Text>
                          <Text style={styles.personMeta}>{Math.round(item.distanceM || 0)}m · {item.availability || '1h'}</Text>
                        </View>
                      </View>
                      <Text style={styles.personTags} numberOfLines={1}>{(item.vibeTags || []).join(' · ')}</Text>
                      <Pressable
                        style={[styles.pingButton, pingingId === item.id && styles.pingButtonDisabled]}
                        onPress={() => handlePing(item)}
                        disabled={pingingId === item.id}
                      >
                        <Text style={styles.pingButtonText}>{pingingId === item.id ? 'Sent' : 'Ping'}</Text>
                      </Pressable>
                    </View>
                  )}
                />
              ) : (
                <View style={styles.peopleEmpty}>
                  <Text style={styles.peopleEmptyCount}>0</Text>
                  <View style={styles.peopleEmptyCopy}>
                    <Text style={styles.peopleEmptyTitle}>A quiet patch, for now.</Text>
                    <Text style={styles.peopleEmptyText}>Try a wider radius, or leave a note for the next person who passes by.</Text>
                  </View>
                </View>
              )}

              <View style={styles.sectionHeading}>
                <Text style={styles.sectionTitle}>Nearby updates</Text>
                <Text style={styles.sectionMeta}>{radius}m</Text>
              </View>
            </>
          )}
          ListEmptyComponent={(
            <Text style={styles.feedEmpty}>
              {locationReady ? 'No updates nearby yet. Post the first one.' : 'Nearby updates will appear once your location is connected.'}
            </Text>
          )}
          renderItem={({ item }) => (
            <View style={styles.statusItem}>
              <View style={styles.statusAuthor}>
                <View style={styles.avatarSmall}>
                  <Text style={styles.avatarInitial}>{item.firstName?.[0]?.toUpperCase() || '?'}</Text>
                </View>
                <View style={styles.statusAuthorInfo}>
                  <Text style={styles.statusName}>{item.firstName || 'Nearby member'}</Text>
                  <Text style={styles.statusMeta}>
                    {item.distanceM === 0 ? 'You' : `${Math.round(item.distanceM || 0)}m away`}
                    {' · '}{formatAge(item.createdAt || item.created_at)}
                  </Text>
                </View>
                {String(item.userId || item.user_id) === String(user?.id || user?.userId) && (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Delete this update"
                    disabled={deletingId === item.id}
                    onPress={() => handleDeleteStatus(item)}
                    style={styles.deleteButton}
                  >
                    {deletingId === item.id
                      ? <ActivityIndicator size="small" color={colors.coral} />
                      : <Text style={styles.deleteText}>Delete</Text>}
                  </Pressable>
                )}
              </View>
              <Text style={styles.statusText}>{item.text}</Text>
              {!!item.vibeTags?.length && (
                <Text style={styles.statusTags}>{item.vibeTags.join(' · ')}</Text>
              )}
            </View>
          )}
        />
      )}

      {incomingPing && <PingModal />}

      <Modal visible={profileOpen} animationType="slide" onRequestClose={() => setProfileOpen(false)}>
        <SafeAreaView style={styles.profileModal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>My profile</Text>
            <Pressable accessibilityRole="button" onPress={() => setProfileOpen(false)}>
              <Text style={styles.closeText}>Done</Text>
            </Pressable>
          </View>
          <SetProfile isEditing onSaved={() => setProfileOpen(false)} />
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 13,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  wordmark: { color: colors.text, fontSize: 23, fontWeight: '800' },
  liveLabel: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#4C9C58' },
  liveDotWaiting: { backgroundColor: colors.coral },
  liveText: { color: colors.muted, fontSize: 9, fontWeight: '800' },
  profileButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    backgroundColor: colors.background,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  profileButtonText: { color: colors.text, fontSize: 13, fontWeight: '600' },
  avatarSmall: {
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 15,
    backgroundColor: colors.mintSoft,
  },
  avatar: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
    backgroundColor: colors.mintSoft,
  },
  avatarInitial: { color: colors.mintText, fontSize: 14, fontWeight: '700' },
  feedControls: {
    paddingHorizontal: 16,
    paddingTop: 11,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  viewSwitch: { flexDirection: 'row', padding: 3, borderRadius: 9, backgroundColor: '#E8EEE7' },
  viewTab: { flex: 1, minHeight: 36, alignItems: 'center', justifyContent: 'center', borderRadius: 7 },
  viewTabSelected: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  viewTabText: { color: colors.muted, fontSize: 13, fontWeight: '600' },
  viewTabTextSelected: { color: colors.text, fontWeight: '800' },
  radiusRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 },
  radiusLabel: { color: colors.quiet, fontSize: 10, fontWeight: '800' },
  radiusControl: { flexDirection: 'row', padding: 3, borderRadius: 9, backgroundColor: '#E3EAE2' },
  radiusOption: { minWidth: 58, minHeight: 32, justifyContent: 'center', alignItems: 'center', borderRadius: 7 },
  radiusOptionSelected: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  radiusOptionText: { color: colors.muted, fontSize: 11, fontWeight: '600' },
  radiusOptionTextSelected: { color: colors.text, fontWeight: '800' },
  mapContainer: { flex: 1, minHeight: 300, backgroundColor: '#E7ECE6' },
  map: { ...StyleSheet.absoluteFillObject },
  mapLoading: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 36 },
  mapLoadingTitle: { color: colors.text, fontSize: 16, fontWeight: '700', textAlign: 'center', marginTop: 15 },
  mapLoadingText: { color: colors.muted, fontSize: 13, lineHeight: 19, textAlign: 'center', marginTop: 7 },
  mapPrivacyNote: {
    position: 'absolute',
    top: 12,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  privacyDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.mintText },
  mapPrivacyText: { color: colors.muted, fontSize: 10, fontWeight: '700' },
  mapEmptyNote: {
    position: 'absolute',
    top: '42%',
    alignSelf: 'center',
    maxWidth: '82%',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  mapEmptyTitle: { color: colors.text, fontSize: 14, fontWeight: '800', textAlign: 'center' },
  mapEmptyText: { color: colors.muted, fontSize: 12, textAlign: 'center', marginTop: 5 },
  mapMarker: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 21,
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.mintText,
    elevation: 3,
  },
  mapMarkerSelected: { backgroundColor: colors.mint, transform: [{ scale: 1.12 }] },
  mapMarkerText: { color: colors.text, fontSize: 15, fontWeight: '800' },
  mapPersonCard: {
    position: 'absolute',
    left: 14,
    right: 14,
    bottom: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    padding: 13,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    backgroundColor: colors.surface,
    elevation: 4,
  },
  mapPersonAvatar: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center', borderRadius: 19, backgroundColor: colors.mintSoft },
  mapPersonInitial: { color: colors.mintText, fontWeight: '800' },
  mapPersonCopy: { flex: 1 },
  mapPersonName: { color: colors.text, fontSize: 14, fontWeight: '800' },
  mapPersonTags: { color: colors.muted, fontSize: 11, marginTop: 3 },
  feedList: { paddingHorizontal: 16, paddingBottom: 34 },
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  emptyTitle: { color: colors.text, fontSize: 18, fontWeight: '600', marginBottom: 8, textAlign: 'center' },
  emptyText: { color: colors.muted, textAlign: 'center', lineHeight: 20, marginTop: 12 },
  locationBanner: {
    marginTop: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 11,
    backgroundColor: '#E8F0E7',
  },
  locationTitle: { color: colors.text, fontSize: 13, fontWeight: '700' },
  locationDescription: { flex: 1, color: colors.muted, fontSize: 12, lineHeight: 18 },
  locationLoading: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  settingsButton: { alignSelf: 'flex-start', marginTop: 12, paddingVertical: 9, paddingHorizontal: 13, backgroundColor: colors.mint, borderRadius: 8 },
  settingsButtonText: { color: colors.background, fontWeight: '700', fontSize: 12 },
  composer: {
    marginTop: 18,
    marginBottom: 3,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    backgroundColor: colors.surface,
  },
  composerByline: { flexDirection: 'row', alignItems: 'center', gap: 9, marginBottom: 16 },
  composerBylineText: { color: colors.muted, fontSize: 12, fontWeight: '600' },
  sectionTitle: { color: colors.text, fontSize: 17, fontWeight: '700' },
  composerInput: {
    minHeight: 82,
    maxHeight: 150,
    marginTop: 12,
    padding: 13,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 9,
    backgroundColor: colors.background,
    color: colors.text,
    fontSize: 15,
    textAlignVertical: 'top',
  },
  composerFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 },
  characterCount: { color: colors.quiet, fontSize: 12 },
  postButton: { minHeight: 40, justifyContent: 'center', paddingHorizontal: 16, borderRadius: 9, backgroundColor: colors.mint },
  postButtonDisabled: { opacity: 0.5 },
  postButtonText: { color: colors.background, fontSize: 13, fontWeight: '700' },
  sectionHeading: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingTop: 22,
    paddingBottom: 10,
  },
  sectionMeta: { color: colors.muted, fontSize: 12, fontWeight: '600' },
  peopleList: { gap: 10, paddingBottom: 3 },
  person: {
    width: 224,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 11,
    backgroundColor: colors.surface,
  },
  personTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  personInfo: { flex: 1 },
  personName: { color: colors.text, fontSize: 14, fontWeight: '700' },
  personMeta: { color: colors.muted, fontSize: 11, marginTop: 3 },
  personTags: { color: colors.muted, fontSize: 11, marginTop: 12, marginBottom: 13 },
  peopleEmpty: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 15,
    borderRadius: 11,
    backgroundColor: '#E8F0E7',
    marginBottom: 4,
  },
  peopleEmptyCount: { color: '#91B77B', fontSize: 42, fontWeight: '800' },
  peopleEmptyCopy: { flex: 1 },
  peopleEmptyTitle: { color: colors.text, fontSize: 14, fontWeight: '700', marginBottom: 4 },
  peopleEmptyText: { color: colors.muted, fontSize: 12, lineHeight: 17 },
  statusItem: { padding: 16, borderWidth: 1, borderColor: colors.border, borderRadius: 11, backgroundColor: colors.surface, marginBottom: 10 },
  statusAuthor: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  statusAuthorInfo: { flex: 1 },
  statusName: { color: colors.text, fontSize: 14, fontWeight: '700' },
  statusMeta: { color: colors.quiet, fontSize: 11, marginTop: 3 },
  deleteButton: { minWidth: 48, minHeight: 36, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 },
  deleteText: { color: colors.coral, fontSize: 12, fontWeight: '700' },
  statusText: { color: colors.text, fontSize: 16, lineHeight: 23, marginTop: 13 },
  statusTags: { color: '#4D7540', fontSize: 11, marginTop: 11, fontWeight: '600' },
  feedEmpty: { color: colors.muted, fontSize: 13, paddingVertical: 18 },
  profileModal: { flex: 1, backgroundColor: colors.background },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalTitle: { color: colors.text, fontSize: 17, fontWeight: '700' },
  closeText: { color: colors.mint, fontSize: 14, fontWeight: '600' },
  pingButton: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 36,
    borderWidth: 1,
    borderColor: colors.mint,
    borderRadius: 8,
    paddingHorizontal: 14,
  },
  pingButtonDisabled: { borderColor: '#333333', backgroundColor: '#111111' },
  pingButtonText: { color: colors.mintText, fontSize: 13, fontWeight: '600' },
});
