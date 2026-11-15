import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import useAppStore from '../store/useAppStore';
import { colors } from '../theme';

export default function PingModal() {
  const { incomingPing, setIncomingPing, setActiveChat } = useAppStore();

  const onAccept = () => {
    setActiveChat({ sessionId: 'session-demo-1', partnerId: incomingPing.senderId, partnerName: incomingPing.senderName });
    setIncomingPing(null);
  };

  const onDecline = () => {
    setIncomingPing(null);
  };

  return (
    <View style={styles.overlay}>
      <View style={styles.card}>
        <View style={styles.signal}>
          <View style={styles.signalDot} />
          <Text style={styles.eyebrow}>A NEW HELLO</Text>
        </View>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{incomingPing?.senderName?.[0]?.toUpperCase() || 'M'}</Text>
        </View>
        <Text style={styles.name}>{incomingPing?.senderName || 'Someone'} is nearby</Text>
        <Text style={styles.description}>They’d like to start a short conversation with you.</Text>
        <Text style={styles.tags}>{incomingPing?.senderTags?.join('  ·  ') || 'coffee  ·  music'}</Text>
        <View style={styles.actions}>
          <Pressable style={styles.decline} onPress={onDecline}>
            <Text style={styles.declineText}>Ignore</Text>
          </Pressable>
          <Pressable style={styles.accept} onPress={onAccept}>
            <Text style={styles.acceptText}>Accept</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    inset: 0,
    backgroundColor: 'rgba(3,8,9,0.78)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: colors.surfaceRaised,
    borderRadius: 14,
    padding: 24,
    borderWidth: 1,
    borderColor: colors.border,
  },
  signal: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 22 },
  signalDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.coral },
  eyebrow: { color: colors.muted, fontSize: 10, fontWeight: '800' },
  avatar: { width: 56, height: 56, alignItems: 'center', justifyContent: 'center', borderRadius: 28, backgroundColor: colors.mintSoft, marginBottom: 16 },
  avatarText: { color: colors.mintText, fontSize: 22, fontWeight: '800' },
  name: { color: colors.text, fontSize: 22, fontWeight: '800', marginBottom: 7 },
  description: { color: colors.muted, fontSize: 14, lineHeight: 20 },
  tags: { color: colors.mint, fontSize: 12, marginTop: 15, marginBottom: 24 },
  actions: { flexDirection: 'row', gap: 10 },
  accept: { flex: 1, alignItems: 'center', backgroundColor: colors.mint, borderRadius: 9, paddingVertical: 13 },
  acceptText: { color: colors.background, textAlign: 'center', fontWeight: '800' },
  decline: { flex: 1, alignItems: 'center', backgroundColor: colors.surface, borderRadius: 9, paddingVertical: 13, borderWidth: 1, borderColor: colors.border },
  declineText: { color: colors.text, textAlign: 'center', fontWeight: '600' },
});
