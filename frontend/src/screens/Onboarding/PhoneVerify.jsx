import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import useAppStore from '../../store/useAppStore';
import { verifyPhoneAndCreateSession } from '../../services/auth';
import { colors } from '../../theme';

export default function PhoneVerify() {
  const { setAuthToken, setUser, setOnboarded } = useAppStore();
  const [phone, setPhone] = useState('+15551234567');
  const [otp, setOtp] = useState('123456');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleVerify = async () => {
    setErrorMessage('');
    setLoading(true);
    try {
      const result = await verifyPhoneAndCreateSession({ phoneNumber: phone, devCode: otp });
      setAuthToken(result.token);
      setUser({
        ...result.user,
        firstName: result.user?.firstName || 'Demo',
        vibeTags: result.user?.vibeTags || ['coffee', 'music'],
        availability: result.user?.availability || '1h',
      });
      setOnboarded(false);
    } catch (error) {
      const message = error?.response?.data?.error || 'Check your connection and try again.';
      setErrorMessage(message);
      Alert.alert('Could not continue', message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.root}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.brandRow}>
            <View style={styles.brandMark}><Text style={styles.brandMarkText}>M</Text></View>
            <Text style={styles.brandName}>Moongram</Text>
          </View>

          <View style={styles.intro}>
            <Text style={styles.eyebrow}>GOOD THINGS HAPPEN NEARBY</Text>
            <Text style={styles.title}>Start with your number.</Text>
            <Text style={styles.subtitle}>A small hello can turn into a real-world connection.</Text>
          </View>

          <View style={styles.form}>
            <Text style={styles.label}>Phone number</Text>
            <TextInput
              value={phone}
              onChangeText={setPhone}
              placeholder="+1 555 123 4567"
              placeholderTextColor={colors.quiet}
              keyboardType="phone-pad"
              autoComplete="tel"
              style={styles.input}
            />

            <Text style={styles.label}>Demo verification code</Text>
            <TextInput
              value={otp}
              onChangeText={setOtp}
              placeholder="6-digit code"
              placeholderTextColor={colors.quiet}
              keyboardType="number-pad"
              maxLength={6}
              style={styles.input}
            />

            <Pressable
              accessibilityRole="button"
              disabled={loading}
              onPress={handleVerify}
              style={[styles.continueButton, loading && styles.buttonDisabled]}
            >
              {loading ? <ActivityIndicator color={colors.background} /> : <Text style={styles.continueText}>Verify & continue</Text>}
            </Pressable>

            {errorMessage ? <Text style={styles.error}>{errorMessage}</Text> : null}
            <View style={styles.demoNote}>
              <View style={styles.demoDot} />
              <Text style={styles.demoText}>Demo mode · use code 123456 · no SMS is sent</Text>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  content: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 26, paddingVertical: 30 },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 54 },
  brandMark: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center', borderRadius: 11, backgroundColor: colors.mint },
  brandMarkText: { color: colors.background, fontSize: 19, fontWeight: '900' },
  brandName: { color: colors.text, fontSize: 17, fontWeight: '700' },
  intro: { marginBottom: 34 },
  eyebrow: { color: colors.mint, fontSize: 10, fontWeight: '800', marginBottom: 12 },
  title: { color: colors.text, fontSize: 31, fontWeight: '800', lineHeight: 37, marginBottom: 12 },
  subtitle: { color: colors.muted, fontSize: 15, lineHeight: 22, maxWidth: 330 },
  form: { width: '100%', maxWidth: 480, alignSelf: 'center' },
  label: { color: colors.text, fontSize: 13, fontWeight: '600', marginBottom: 8 },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: 10,
    paddingHorizontal: 15,
    paddingVertical: 15,
    color: colors.text,
    marginBottom: 21,
    fontSize: 16,
  },
  continueButton: {
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.mint,
    borderRadius: 10,
    marginTop: 4,
  },
  buttonDisabled: { opacity: 0.65 },
  continueText: { color: colors.background, fontSize: 15, fontWeight: '800' },
  demoNote: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 19 },
  demoDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.coral },
  demoText: { color: colors.quiet, fontSize: 11, flexShrink: 1 },
  error: { color: colors.coral, fontSize: 13, marginTop: 12 },
});
