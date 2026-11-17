// services/auth.js
import auth from '@react-native-firebase/auth';
import api from '../utils/api';

/**
 * Step 1 — Send real OTP via Firebase (React Native SDK)
 * Returns the confirmation object needed for step 2
 */
export async function requestOtp(phoneNumber) {
  const confirmation = await auth().signInWithPhoneNumber(phoneNumber);
  return confirmation;
}

/**
 * Step 2 — Confirm OTP code, get Firebase token, exchange for app JWT
 */
export async function verifyOtpAndLogin(confirmation, otpCode) {
  // Verify the code with Firebase
  const credential = await confirmation.confirm(otpCode);

  // Get Firebase ID token
  const idToken = await credential.user.getIdToken();

  // Exchange with your backend for your app's JWT
  const response = await api.post('/auth/verify', { idToken });
  return response.data; // { token, user, isNewUser }
}