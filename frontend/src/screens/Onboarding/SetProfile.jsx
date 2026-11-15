import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import api from '../../utils/api';
import useAppStore from '../../store/useAppStore';
import { colors } from '../../theme';

const VIBE_OPTIONS = ['coffee', 'music', 'reading', 'running', 'night', 'travel', 'city', 'outdoors'];
const AVAILABILITY_OPTIONS = ['5m', '30m', '1h', 'evening', 'all_day'];

export default function SetProfile({ isEditing = false, onSaved }) {
  const { user, setUser, setOnboarded } = useAppStore();
  const [name, setName] = useState(user?.firstName || '');
  const [vibeTags, setVibeTags] = useState(user?.vibeTags || ['coffee', 'music']);
  const [availability, setAvailability] = useState(user?.availability || '1h');
  const [saving, setSaving] = useState(false);

  const handleContinue = async () => {
    const firstName = name.trim();
    if (!firstName) {
      Alert.alert('Add your name', 'Enter a name to continue.');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        firstName,
        vibeTags,
        availability,
      };

      const { data } = await api.put('/users/profile', payload);
      const nextUser = {
        ...user,
        ...data.profile,
      };
      setUser(nextUser);
      setOnboarded(true);
      onSaved?.();
    } catch (error) {
      Alert.alert('Profile update failed', error?.response?.data?.error || 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.root} keyboardShouldPersistTaps="handled">
      <View style={styles.content}>
        <Text style={styles.eyebrow}>{isEditing ? 'MY PROFILE' : 'YOUR PROFILE'}</Text>
        <Text style={styles.title}>{isEditing ? 'Your profile' : 'A little about you'}</Text>
        <Text style={styles.subtitle}>Choose what nearby people will see.</Text>

        <Text style={styles.label}>Name</Text>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="What should we call you?"
          placeholderTextColor="#777777"
          autoCapitalize="words"
          maxLength={32}
          returnKeyType="done"
          style={styles.input}
        />

        <View style={styles.sectionHeader}>
          <Text style={styles.label}>Your vibe</Text>
          <Text style={styles.counter}>{vibeTags.length}/3</Text>
        </View>
        <View style={styles.options}>
          {VIBE_OPTIONS.map((tag) => {
            const selected = vibeTags.includes(tag);
            const disabled = !selected && vibeTags.length >= 3;
            return (
              <Pressable
                key={tag}
                accessibilityRole="button"
                accessibilityState={{ selected, disabled }}
                onPress={() => setVibeTags((current) => (
                  current.includes(tag)
                    ? current.filter((value) => value !== tag)
                    : current.length < 3 ? [...current, tag] : current
                ))}
                style={[styles.option, selected && styles.optionSelected, disabled && styles.optionDisabled]}
              >
                <Text style={[styles.optionText, selected && styles.optionTextSelected]}>{tag}</Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={[styles.label, styles.availabilityLabel]}>Available for</Text>
        <View style={styles.options}>
          {AVAILABILITY_OPTIONS.map((duration) => {
            const selected = availability === duration;
            return (
              <Pressable
                key={duration}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                onPress={() => setAvailability(duration)}
                style={[styles.option, selected && styles.optionSelected]}
              >
                <Text style={[styles.optionText, selected && styles.optionTextSelected]}>{duration}</Text>
              </Pressable>
            );
          })}
        </View>

        <Pressable
          accessibilityRole="button"
          disabled={saving}
          onPress={handleContinue}
          style={[styles.continueButton, saving && styles.continueButtonDisabled]}
        >
          {saving ? <ActivityIndicator color="#090909" /> : <Text style={styles.continueText}>{isEditing ? 'Save changes' : 'Save profile & continue'}</Text>}
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 24, paddingVertical: 36, backgroundColor: colors.background },
  content: { width: '100%', maxWidth: 520, alignSelf: 'center' },
  eyebrow: { color: colors.mint, fontSize: 11, fontWeight: '700', marginBottom: 10 },
  title: { color: colors.text, fontSize: 28, fontWeight: '700', marginBottom: 8 },
  subtitle: { color: colors.muted, fontSize: 14, marginBottom: 28 },
  label: { color: '#e5e5e5', fontSize: 14, fontWeight: '600', marginBottom: 10 },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: 8,
    padding: 14,
    color: colors.text,
    marginBottom: 24,
    fontSize: 16,
  },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  counter: { color: colors.quiet, fontSize: 12, marginBottom: 10 },
  options: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  option: {
    minHeight: 40,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    backgroundColor: colors.surface,
    paddingHorizontal: 14,
  },
  optionSelected: { borderColor: colors.mint, backgroundColor: colors.mintSoft },
  optionDisabled: { opacity: 0.4 },
  optionText: { color: colors.muted, fontSize: 13 },
  optionTextSelected: { color: colors.mintText, fontWeight: '600' },
  availabilityLabel: { marginTop: 26 },
  continueButton: {
    minHeight: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 34,
    borderRadius: 8,
    backgroundColor: colors.mint,
  },
  continueButtonDisabled: { opacity: 0.65 },
  continueText: { color: colors.background, fontSize: 15, fontWeight: '700' },
});
