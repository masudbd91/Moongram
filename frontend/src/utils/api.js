// utils/api.js
import axios from 'axios';
import useAppStore from '../store/useAppStore';

const api = axios.create({
  baseURL: process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3001/api',
  timeout: 15000,
});

// Auto-attach JWT token to every request
api.interceptors.request.use((config) => {
  const token = useAppStore.getState().authToken;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ── Auth ──────────────────────────────────────────────────────
export const verifyPhone = (idToken, devCode, phoneNumber) =>
  api.post('/auth/verify', { idToken, devCode, phoneNumber }).then((r) => r.data);

export const getVibeTags = () =>
  api.get('/auth/vibe-tags').then((r) => r.data.tags);

// ── Users ─────────────────────────────────────────────────────
export const updateProfile = (data) =>
  api.put('/users/profile', data).then((r) => r.data);

export const updateFCMToken = (fcmToken) =>
  api.put('/users/fcm-token', { fcmToken }).then((r) => r.data);

export async function getNearbyUsers(lat, lng, radius = 100) {
  const { data } = await api.get('/users/nearby', {
    params: { lat, lng, radius },
  });
  return data.users || [];
}

export async function updateStatus(status) {
  const { data } = await api.put('/users/status', { status });
  return data;
}

// ── Pings ─────────────────────────────────────────────────────
export async function sendPing(targetUserId) {
  const { data } = await api.post('/pings', { targetUserId });
  return data;
}

export const respondToPing = (pingId, accepted) =>
  api.post(`/pings/${pingId}/respond`, { accepted }).then((r) => r.data);

// ── Feed ──────────────────────────────────────────────────────
export async function getNearbyStatuses(lat, lng, radius = 100) {
  const { data } = await api.get('/feed', { params: { lat, lng, radius } });
  return data.statuses || [];
}

export async function createStatusUpdate(text) {
  const { data } = await api.post('/feed', { text });
  return data.status;
}

export async function deleteStatusUpdate(statusId) {
  const { data } = await api.delete(`/feed/${statusId}`);
  return data;
}

// ── Safety ────────────────────────────────────────────────────
export const blockUser = (targetUserId) =>
  api.post('/safety/block', { targetUserId }).then((r) => r.data);

export const reportUser = (targetUserId, reason, sessionId) =>
  api.post('/safety/report', { targetUserId, reason, sessionId }).then((r) => r.data);

export default api;