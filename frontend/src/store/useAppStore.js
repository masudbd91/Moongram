import { create } from 'zustand';

const defaultUser = {
  id: 'demo-user',
  firstName: 'Demo',
  vibeTags: ['coffee', 'music'],
  availability: '1h',
};

const useAppStore = create((set) => ({
  user: defaultUser,
  authToken: null,
  isOnboarded: false,
  location: null,
  locationStatus: 'requesting',
  nearbyUsers: [],
  incomingPing: null,
  activeChat: null,
  socketConnected: false,
  setUser: (user) => set({ user }),
  setAuthToken: (authToken) => set({ authToken }),
  setOnboarded: (isOnboarded) => set({ isOnboarded }),
  setLocation: (location) => set({ location }),
  setLocationStatus: (locationStatus) => set({ locationStatus }),
  setNearbyUsers: (nearbyUsers) => set({ nearbyUsers }),
  setIncomingPing: (incomingPing) => set({ incomingPing }),
  setActiveChat: (activeChat) => set({ activeChat }),
  setSocketConnected: (socketConnected) => set({ socketConnected }),
  resetAuth: () => set({ user: defaultUser, authToken: null, isOnboarded: false }),
}));

export default useAppStore;
