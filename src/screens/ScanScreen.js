import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, FlatList, TouchableOpacity,
  StyleSheet, ActivityIndicator, Alert, Platform,
} from 'react-native';
import { getBleManager, requestBlePermissions } from '../utils/bleManager';
import { KNOWN_SERVICE_UUIDS } from '../utils/bleProtocol';

export default function ScanScreen({ navigation }) {
  const [devices, setDevices] = useState([]);
  const [scanning, setScanning] = useState(false);
  const [bleState, setBleState] = useState('Unknown');
  const seenIds = useRef(new Set());
  const manager = getBleManager();

  useEffect(() => {
    const sub = manager.onStateChange((state) => {
      setBleState(state);
    }, true);
    return () => sub.remove();
  }, []);

  const startScan = async () => {
    const granted = await requestBlePermissions();
    if (!granted) {
      Alert.alert('Permission denied', 'Bluetooth permissions are required to scan.');
      return;
    }

    if (bleState !== 'PoweredOn') {
      Alert.alert('Bluetooth Off', 'Please enable Bluetooth and try again.');
      return;
    }

    setDevices([]);
    seenIds.current.clear();
    setScanning(true);

    manager.startDeviceScan(null, { allowDuplicates: false }, (error, device) => {
      if (error) {
        console.warn('Scan error:', error);
        setScanning(false);
        return;
      }
      if (device && !seenIds.current.has(device.id)) {
        seenIds.current.add(device.id);
        setDevices(prev => [...prev, {
          id: device.id,
          name: device.name || device.localName || '(no name)',
          rssi: device.rssi,
          serviceUUIDs: device.serviceUUIDs || [],
        }]);
      }
    });

    // Auto-stop after 10 seconds
    setTimeout(() => {
      manager.stopDeviceScan();
      setScanning(false);
    }, 10000);
  };

  const stopScan = () => {
    manager.stopDeviceScan();
    setScanning(false);
  };

  const connectToDevice = (device) => {
    manager.stopDeviceScan();
    setScanning(false);
    navigation.navigate('Device', { deviceId: device.id, deviceName: device.name });
  };

  const isWatchCandidate = (device) => {
    const name = (device.name || '').toLowerCase();
    return name.includes('lige') || name.includes('watch') || name.includes('band')
      || name.includes('smart') || name.includes('fit') || name.includes('hw')
      || name.includes('gt') || name.includes('dt');
  };

  const renderDevice = ({ item }) => (
    <TouchableOpacity
      style={[styles.deviceCard, isWatchCandidate(item) && styles.deviceCardHighlight]}
      onPress={() => connectToDevice(item)}
    >
      <View style={styles.deviceRow}>
        <Text style={styles.deviceName}>{item.name}</Text>
        {isWatchCandidate(item) && <Text style={styles.watchBadge}>⌚ Watch?</Text>}
      </View>
      <Text style={styles.deviceId}>{item.id}</Text>
      <Text style={styles.deviceRssi}>RSSI: {item.rssi} dBm</Text>
      {item.serviceUUIDs.length > 0 && (
        <Text style={styles.deviceUUIDs} numberOfLines={2}>
          UUIDs: {item.serviceUUIDs.join(', ')}
        </Text>
      )}
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>⌚ Watch Reset Tool</Text>
        <Text style={styles.subtitle}>BLE: {bleState}</Text>
      </View>

      <TouchableOpacity
        style={[styles.scanBtn, scanning && styles.scanBtnActive]}
        onPress={scanning ? stopScan : startScan}
      >
        {scanning ? (
          <View style={styles.scanBtnInner}>
            <ActivityIndicator color="#000" size="small" />
            <Text style={styles.scanBtnText}> Stop Scan</Text>
          </View>
        ) : (
          <Text style={styles.scanBtnText}>🔍 Scan for Devices</Text>
        )}
      </TouchableOpacity>

      {devices.length === 0 && !scanning && (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>No devices found.</Text>
          <Text style={styles.emptyHint}>Press scan to discover BLE devices nearby.</Text>
        </View>
      )}

      <FlatList
        data={devices}
        keyExtractor={item => item.id}
        renderItem={renderDevice}
        contentContainerStyle={{ paddingBottom: 20 }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a', padding: 16 },
  header: { marginBottom: 16 },
  title: { fontSize: 22, fontWeight: 'bold', color: '#00ff99', textAlign: 'center' },
  subtitle: { fontSize: 12, color: '#666', textAlign: 'center', marginTop: 4 },
  scanBtn: {
    backgroundColor: '#00ff99',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 16,
  },
  scanBtnActive: { backgroundColor: '#ff6b35' },
  scanBtnInner: { flexDirection: 'row', alignItems: 'center' },
  scanBtnText: { color: '#000', fontWeight: 'bold', fontSize: 16 },
  deviceCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 10,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  deviceCardHighlight: {
    borderColor: '#00ff99',
    backgroundColor: '#0d1f15',
  },
  deviceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  deviceName: { fontSize: 16, fontWeight: 'bold', color: '#fff', flex: 1 },
  watchBadge: { fontSize: 12, color: '#00ff99', marginLeft: 8 },
  deviceId: { fontSize: 11, color: '#888', marginTop: 4 },
  deviceRssi: { fontSize: 12, color: '#aaa', marginTop: 2 },
  deviceUUIDs: { fontSize: 10, color: '#555', marginTop: 4 },
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', marginTop: 60 },
  emptyText: { color: '#666', fontSize: 18, marginBottom: 8 },
  emptyHint: { color: '#444', fontSize: 13, textAlign: 'center' },
});
