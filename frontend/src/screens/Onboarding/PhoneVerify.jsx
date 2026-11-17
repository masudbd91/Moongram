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
import { verifyPhone } from '../../utils/api';
import { colors } from '../../theme';

export default function PhoneVerify() {
  const { setAuthToken, setUser, setOnboarded } = useAppStore();
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState('phone'); // 'phone' | 'otp'
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // ── Step 1: Demo mode — skip Firebase, go straight to OTP ─────────
  // In production, replace this with real Firebase phone auth.
  // Backend accepts devCode '123456' for demo login.
  async function handleSendOTP() {
    setErrorMessage('');
    const cleaned = phone.trim();
    if (!cleaned.startsWith('+') || cleaned.length < 8) {
      setErrorMessage('Enter your number with country code. Example: +82 10 1234 5678');
      return;
    }
    setLoading(true);
    try {
      // Demo: pretend we sent an OTP, move to code entry
      await new Promise((r) => setTimeout(r, 800));
      setStep('otp');
    } catch (err) {
      setErrorMessage('Could not send code. Try again.');
      console.error('OTP send error:', err);
    } finally {
      setLoading(false);
    }
  }

  // ── Step 2: Verify demo code + exchange for app JWT ──────────────
  async function handleVerifyOTP() {
    setErrorMessage('');
    if (otp.length !== 6) {
      setErrorMessage('Enter the 6-digit code.');
      return;
    }
    if (otp !== '123456') {
      setErrorMessage('Wrong code. Use 123456 for demo.');
      return;
    }
    setLoading(true);
    try {
      // Send demo code to backend → get your app's JWT back
      const result = await verifyPhone(null, '123456', cleanedPhone());

      setAuthToken(result.token);
      setUser(result.user);
      setOnboarded(!result.isNewUser);
    } catch (err) {
      setErrorMessage('Login failed. Make sure the backend is running.');
      console.error('OTP verify error:', err);
    } finally {
      setLoading(false);
    }
  }

  function cleanedPhone() {
    return phone.trim() || '+15550000000';
  }

  return (
    <SafeAreaView style={styles.root}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          {/* Brand */}
          <View style={styles.brandRow}>
            <View style={styles.brandMark}>
              <Text style={styles.brandMarkText}>M</Text>
            </View>
            <Text style={styles.brandName}>Moongram</Text>
          </View>

          {/* Intro text — changes based on step */}
          <View style={styles.intro}>
            <Text style={styles.eyebrow}>GOOD THINGS HAPPEN NEARBY</Text>
            {step === 'phone' ? (
              <>
                <Text style={styles.title}>Start with your number.</Text>
                <Text style={styles.subtitle}>
                  A small hello can turn into a real-world connection.
                </Text>
              </>
            ) : (
              <>
                <Text style={styles.title}>Check your messages.</Text>
                <Text style={styles.subtitle}>
                  We sent a 6-digit code to {phone}
                </Text>
              </>
            )}
          </View>

          {/* Form */}
          <View style={styles.form}>
            {step === 'phone' ? (
              <>
                <Text style={styles.label}>Phone number</Text>
                <TextInput
                  value={phone}
                  onChangeText={setPhone}
                  placeholder="+82 10 0000 0000"
                  placeholderTextColor={colors.quiet}
                  keyboardType="phone-pad"
                  autoComplete="tel"
                  autoFocus
                  style={styles.input}
                />
                <Pressable
                  accessibilityRole="button"
                  disabled={loading}
                  onPress={handleSendOTP}
                  style={[styles.continueButton, loading && styles.buttonDisabled]}
                >
                  {loading
                    ? <ActivityIndicator color={colors.background} />
                    : <Text style={styles.continueText}>Send code</Text>
                  }
                </Pressable>
              </>
            ) : (
              <>
                <Text style={styles.label}>Verification code</Text>
                <TextInput
                  value={otp}
                  onChangeText={setOtp}
                  placeholder="123456"
                  placeholderTextColor={colors.quiet}
                  keyboardType="number-pad"
                  maxLength={6}
                  autoFocus
                  style={[styles.input, styles.otpInput]}
                />
                <Pressable
                  accessibilityRole="button"
                  disabled={loading || otp.length !== 6}
                  onPress={handleVerifyOTP}
                  style={[
                    styles.continueButton,
                    (loading || otp.length !== 6) && styles.buttonDisabled,
                  ]}
                >
                  {loading
                    ? <ActivityIndicator color={colors.background} />
                    : <Text style={styles.continueText}>Verify & continue</Text>
                  }
                </Pressable>

                {/* Back link */}
                <Pressable onPress={() => { setStep('phone'); setOtp(''); setErrorMessage(''); }}>
                  <Text style={styles.backLink}>Use a different number</Text>
                </Pressable>
              </>
            )}

            {errorMessage ? (
              <Text style={styles.error}>{errorMessage}</Text>
            ) : null}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 26,
    paddingVertical: 30,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 54,
  },
  brandMark: {
    width: 34, height: 34,
    alignItems: 'center', justifyContent: 'center',
    borderRadius: 11, backgroundColor: colors.mint,
  },
  brandMarkText: { color: colors.background, fontSize: 19, fontWeight: '900' },
  brandName: { color: colors.text, fontSize: 17, fontWeight: '700' },
  intro: { marginBottom: 34 },
  eyebrow: { color: colors.mint, fontSize: 10, fontWeight: '800', marginBottom: 12 },
  title: {
    color: colors.text, fontSize: 31,
    fontWeight: '800', lineHeight: 37, marginBottom: 12,
  },
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
  otpInput: {
    letterSpacing: 10,
    fontSize: 22,
    textAlign: 'center',
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
  backLink: {
    color: colors.quiet,
    fontSize: 13,
    textAlign: 'center',
    marginTop: 18,
  },
  error: { color: colors.coral, fontSize: 13, marginTop: 12 },
});