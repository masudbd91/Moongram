import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  RefreshControl, Alert, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import useAppStore from '../store/useAppStore';
import { getNearbyUsers, sendPing, updateStatus } from '../utils/api';
import { useLocationHeartbeat } from '../hooks/useLocation';
import PingModal from './PingModal';
import ChatScreen from './Chat/ChatScreen';

export default function NearbyFeed() {
  const { user, location, nearbyUsers, setNearbyUsers, incomingPing, activeChat } = useAppStore();
  const [refreshing, setRefreshing] = useState(false);
  const [pingingId, setPingingId] = useState(null); // which user we're pinging
  const [availability, setAvailability] = useState(user?.availability || '1h');

  // Start location heartbeat
  useLocationHeartbeat();

  const fetchNearby = useCallback(async () => {
    if (!location) return;
    try {
      const users = await getNearbyUsers(location.lat, location.lng);
      setNearbyUsers(users);
    } catch {
      /* silent fail — location may still be acquiring */
    }
  }, [location]);

  // Poll nearby users every 10 seconds
  useEffect(() => {
    fetchNearby();
    const interval = setInterval(fetchNearby, 10_000);
    return () => clearInterval(interval);
  }, [fetchNearby]);

  async function handlePing(targetUser) {
    if (pingingId) return;
    setPingingId(targetUser.id);
    try {
      await sendPing(targetUser.id);
      Alert.alert('Ping sent', `Waiting for ${targetUser.firstName} to respond…`);
    } catch (err) {
      const msg = err.response?.data?.error || 'Could not send ping.';
      Alert.alert('Ping failed', msg);
    } finally {
      setTimeout(() => setPingingId(null), 3000);
    }
  }

  async function cycleAvailability() {
    const options = ['5m', '30m', '1h', 'evening', 'all_day'];
    const labels = { '5m': 'Now', '30m': '30 min', '1h': '1 hour', 'evening': 'Evening', 'all_day': 'All day' };
    const idx = options.indexOf(availability);
    const next = options[(idx + 1) % options.length];
    setAvailability(next);
    await updateStatus('available').catch(() => {});
  }

  if (activeChat) return <ChatScreen />;

  return (
    <SafeAreaView style={styles.root}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.wordmark}>Moongram</Text>
        <TouchableOpacity style={styles.availBadge} onPress={cycleAvailability}>
          <View style={styles.dot} />
          <Text style={styles.availText}>{availability}</Text>
        </TouchableOpacity>
      </View>

      {/* Feed */}
      {!location ? (
        <View style={styles.empty}>
          <ActivityIndicator color="#333" />
          <Text style={styles.emptyText}>Acquiring location…</Text>
        </View>
      ) : nearbyUsers.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>No one nearby</Text>
          <Text style={styles.emptyText}>
            People within 100m will appear here when they open the app.
          </Text>
        </View>
      ) : (
        <FlatList
          data={nearbyUsers}
          keyExtractor={(u) => u.id}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={async () => {
                setRefreshing(true);
                await fetchNearby();
                setRefreshing(false);
              }}
              tintColor="#333"
            />
          }
          ListHeaderComponent={
            <Text style={styles.count}>
              {nearbyUsers.length} {nearbyUsers.length === 1 ? 'person' : 'people'} nearby
            </Text>
          }
          renderItem={({ item }) => (
            <UserCard
              user={item}
              isPinging={pingingId === item.id}
              onPing={() => handlePing(item)}
            />
          )}
        />
      )}

      {/* Incoming ping overlay */}
      {incomingPing && <PingModal />}
    </SafeAreaView>
  );
}

function UserCard({ user, isPinging, onPing }) {
  const myTags = useAppStore((s) => s.user?.vibe_tags || []);
  const sharedTags = user.vibeTags.filter((t) => myTags.includes(t));

  return (
    <View style={styles.card}>
      <View style={styles.cardLeft}>
        <Text style={styles.name}>{user.firstName}</Text>
        <View style={styles.tags}>
          {user.vibeTags.map((tag) => (
            <Text key={tag} style={[styles.tag, sharedTags.includes(tag) && styles.tagShared]}>
              {tag}
            </Text>
          ))}
        </View>
        <Text style={styles.meta}>{user.distanceM}m away · {user.availability}</Text>
      </View>
      <TouchableOpacity
        style={[styles.pingBtn, isPinging && styles.pingBtnSent]}
        onPress={onPing}
        disabled={isPinging}
      >
        <Text style={[styles.pingBtnText, isPinging && styles.pingBtnTextSent]}>
          {isPinging ? 'Sent' : 'Ping'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0a0a0a' },
  header: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: '#111',
  },
  wordmark: { fontSize: 22, fontWeight: '700', color: '#fff', letterSpacing: -0.5 },
  availBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#111', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20,
  },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#3ecf8e' },
  availText: { color: '#888', fontSize: 13 },
  list: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 40 },
  count: { fontSize: 11, color: '#444', marginBottom: 12, letterSpacing: 0.5 },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  emptyTitle: { fontSize: 18, color: '#fff', fontWeight: '600', marginBottom: 10, marginTop: 16 },
  emptyText: { fontSize: 14, color: '#444', textAlign: 'center', lineHeight: 20 },
  card: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 18, borderBottomWidth: 1, borderBottomColor: '#111',
  },
  cardLeft: { flex: 1, marginRight: 16 },
  name: { fontSize: 17, fontWeight: '600', color: '#fff', marginBottom: 6 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginBottom: 7 },
  tag: { fontSize: 12, color: '#444', backgroundColor: '#111', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12 },
  tagShared: { color: '#888', backgroundColor: '#1a1a1a' },
  meta: { fontSize: 12, color: '#3a3a3a' },
  pingBtn: {
    borderWidth: 1, borderColor: '#fff',
    paddingHorizontal: 20, paddingVertical: 10, borderRadius: 4,
  },
  pingBtnSent: { borderColor: '#222', backgroundColor: '#111' },
  pingBtnText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  pingBtnTextSent: { color: '#444' },
});
