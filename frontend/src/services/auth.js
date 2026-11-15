import { getAuth, signInWithPhoneNumber, RecaptchaVerifier } from 'firebase/auth';
import { firebaseApp, firebaseEnabled } from '../config/firebase';
import api from '../utils/api';

export async function requestOtp(phoneNumber) {
  if (!firebaseEnabled) {
    return { ok: true, mock: true, phoneNumber };
  }

  const auth = getAuth(firebaseApp);
  const appVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
    size: 'invisible',
  });

  const confirmation = await signInWithPhoneNumber(auth, phoneNumber, appVerifier);
  return { ok: true, confirmationResult: confirmation };
}

export async function verifyPhoneAndCreateSession({ phoneNumber, firebaseToken, devCode }) {
  const response = await api.post('/auth/verify', {
    phoneNumber,
    firebaseToken,
    devCode,
  });

  return response.data;
}
