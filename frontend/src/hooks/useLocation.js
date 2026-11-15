import { useEffect } from 'react';
import * as Location from 'expo-location';
import useAppStore from '../store/useAppStore';
import api from '../utils/api';

export function useLocationHeartbeat() {
  const setLocation = useAppStore((state) => state.setLocation);
  const setLocationStatus = useAppStore((state) => state.setLocationStatus);

  useEffect(() => {
    let mounted = true;
    let watcher;

    const publishLocation = async (position) => {
      if (!mounted) return;
      const next = {
        lat: position.coords.latitude,
        lng: position.coords.longitude,
        accuracy: position.coords.accuracy,
      };
      setLocation(next);
      if (useAppStore.getState().locationStatus !== 'ready') {
        setLocationStatus('requesting');
      }

      try {
        await api.put('/users/location', { lat: next.lat, lng: next.lng });
        if (mounted) setLocationStatus('ready');
      } catch (error) {
        if (mounted) setLocationStatus('error');
        console.log('Location update error:', error.message);
      }
    };

    const startWatching = async () => {
      setLocationStatus('requesting');
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (!mounted) return;
        if (status !== 'granted') {
          setLocationStatus('denied');
          return;
        }

        const currentPosition = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        await publishLocation(currentPosition);
        if (!mounted) return;

        watcher = await Location.watchPositionAsync(
          { accuracy: Location.Accuracy.Balanced, timeInterval: 8000, distanceInterval: 10 },
          (position) => { void publishLocation(position); }
        );
      } catch (error) {
        if (mounted) setLocationStatus('error');
        console.log('Location permission error:', error.message);
      }
    };

    void startWatching();
    return () => {
      mounted = false;
      watcher?.remove();
    };
  }, [setLocation, setLocationStatus]);
}
