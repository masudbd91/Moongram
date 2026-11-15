import React, { useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import useAppStore from '../../store/useAppStore';
import { colors } from '../../theme';

const seedMessages = [
  { id: 'm1', senderId: 'partner', text: 'Hey, you are nearby.', sentAt: 'now' },
  { id: 'm2', senderId: 'me', text: 'Yeah! Want to hang for a bit?', sentAt: 'now' },
];

export default function ChatScreen() {
  const { activeChat, setActiveChat } = useAppStore();
  const [messages, setMessages] = useState(seedMessages);
  const [input, setInput] = useState('');
  const partnerName = activeChat?.partnerName || 'Nearby member';

  const sendMessage = () => {
    const value = input.trim();
    if (!value) return;
    setMessages((prev) => [
      ...prev,
      { id: `m-${Date.now()}`, senderId: 'me', text: value, sentAt: new Date().toISOString() },
    ]);
    setInput('');
  };

  return (
    <SafeAreaView style={styles.root}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.header}>
          <View style={styles.partner}>
            <View style={styles.avatar}><Text style={styles.avatarText}>{partnerName[0]?.toUpperCase() || 'M'}</Text></View>
            <View style={styles.partnerCopy}>
              <Text style={styles.name} numberOfLines={1}>{partnerName}</Text>
              <Text style={styles.subtle}>Nearby conversation · 10 min</Text>
            </View>
          </View>
          <Pressable accessibilityRole="button" onPress={() => setActiveChat(null)} style={styles.leaveButton}>
            <Text style={styles.leaveText}>Leave</Text>
          </Pressable>
        </View>

        <FlatList
          data={messages}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          keyboardShouldPersistTaps="handled"
          ListHeaderComponent={<Text style={styles.notice}>A little time together, while you’re close by.</Text>}
          renderItem={({ item }) => (
            <View style={[styles.bubble, item.senderId === 'me' ? styles.mine : styles.theirs]}>
              <Text style={[styles.message, item.senderId === 'me' ? styles.mineMessage : styles.theirMessage]}>{item.text}</Text>
            </View>
          )}
        />

        <View style={styles.inputRow}>
          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder="Write a message..."
            placeholderTextColor={colors.quiet}
            returnKeyType="send"
            onSubmitEditing={sendMessage}
            style={styles.input}
          />
          <Pressable accessibilityRole="button" onPress={sendMessage} disabled={!input.trim()} style={[styles.send, !input.trim() && styles.sendDisabled]}>
            <Text style={styles.sendText}>Send</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  partner: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 11, marginRight: 10 },
  avatar: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 20, backgroundColor: colors.mintSoft },
  avatarText: { color: colors.mintText, fontSize: 16, fontWeight: '800' },
  partnerCopy: { flex: 1 },
  name: { color: colors.text, fontSize: 16, fontWeight: '700' },
  subtle: { color: colors.muted, fontSize: 11, marginTop: 4 },
  leaveButton: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: colors.border },
  leaveText: { color: colors.muted, fontSize: 12, fontWeight: '600' },
  list: { flexGrow: 1, justifyContent: 'flex-end', paddingHorizontal: 16, paddingTop: 22, paddingBottom: 18 },
  notice: { alignSelf: 'center', color: colors.quiet, fontSize: 12, marginBottom: 24 },
  bubble: {
    maxWidth: '80%',
    borderRadius: 13,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 9,
  },
  mine: { alignSelf: 'flex-end', backgroundColor: colors.mint },
  theirs: { alignSelf: 'flex-start', backgroundColor: colors.surfaceRaised, borderBottomLeftRadius: 4 },
  message: { fontSize: 15, lineHeight: 21 },
  mineMessage: { color: colors.background },
  theirMessage: { color: colors.text },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 11,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  input: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: colors.text,
    marginRight: 10,
  },
  send: { minHeight: 43, justifyContent: 'center', backgroundColor: colors.mint, borderRadius: 9, paddingHorizontal: 16 },
  sendDisabled: { opacity: 0.4 },
  sendText: { color: colors.background, fontWeight: '800' },
});
