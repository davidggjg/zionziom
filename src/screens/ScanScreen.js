import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, FlatList, TouchableOpacity,
  StyleSheet, ActivityIndicator, Alert, TextInput,
} from 'react-native';
import { getBleManager, requestBlePermissions } from '../utils/bleManager';
import { KNOWN_SERVICE_UUIDS } from '../utils/bleProtocol';

export default function ScanScreen({ navigation }) {
  const [devices, setDevices] = useState([]);
  const [scanning, setScanning] = useState(false);
  const [checkingConnected, setCheckingConnected] = useState(false);
  const [bleState, setBleState] = useState('Unknown');
  const [manualMac, setManualMac] = useState('');
  const [connectingManual, setConnectingManual] = useState(false);
  const seenIds = useRef(new Set());
  const manager = getBleManager();

  useEffect(() => {
    const sub = manager.onStateChange((state) => {
      setBleState(state);
      if (state === 'PoweredOn') {
        findConnectedWatch();
      }
    }, true);
    return () => sub.remove();
  }, []);

  const findConnectedWatch = async () => {
    const granted = await requestBlePermissions();
    if (!granted) return;

    setCheckingConnected(true);
    try {
      const connected = await manager.connectedDevices(KNOWN_SERVICE_UUIDS);
      if (connected && connected.length > 0) {
        setDevices(connected.map(d => ({
          id: d.id,
          name: d.name || d.localName || '(no name)',
          rssi: d.rssi,
          serviceUUIDs: d.serviceUUIDs || [],
          alreadyConnected: true,
        })));
      }
    } catch (e) {
      console.warn('connectedDevices check failed:', e.message);
    } finally {
      setCheckingConnected(false);
    }
  };

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
          alreadyConnected: false,
        }]);
      }
    });

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

  // Connect directly to a known MAC address, bypassing scan/connectedDevices
  // entirely. This works even if the device is paired-but-idle and not
  // currently advertising over BLE (which is why it doesn't show up in
  // either the scan or the "connected devices" check).
  const connectByMac = async () => {
    const mac = manualMac.trim().toUpperCase();
    if (!mac) {
      Alert.alert('הזן כתובת MAC', 'לדוגמה: AA:BB:CC:DD:EE:FF');
      return;
    }
    const macPattern = /^([0-9A-F]{2}:){5}[0-9A-F]{2}$/;
    if (!macPattern.test(mac)) {
      Alert.alert('פורמט לא תקין', 'כתובת MAC צריכה להיות בפורמט AA:BB:CC:DD:EE:FF');
      return;
    }

    const granted = await requestBlePermissions();
    if (!granted) return;

    setConnectingManual(true);
    try {
      manager.stopDeviceScan();
      setScanning(false);
      navigation.navigate('Device', { deviceId: mac, deviceName: mac });
    } finally {
      setConnectingManual(false);
    }
  };

  const isWatchCandidate = (device) => {
    const name = (device.name || '').toLowerCase();
    return name.includes('lige') || name.includes('watch') || name.includes('band')
      || name.includes('smart') || name.includes('fit') || name.includes('hw')
      || name.includes('gt') || name.includes('dt');
  };

  const renderDevice = ({ item }) => (
    <TouchableOpacity
      style={[
        styles.deviceCard,
        item.alreadyConnected && styles.deviceCardConnected,
        !item.alreadyConnected && isWatchCandidate(item) && styles.deviceCardHighlight,
      ]}
      onPress={() => connectToDevice(item)}
    >
      <View style={styles.deviceRow}>
        <Text style={styles.deviceName}>{item.name}</Text>
        {item.alreadyConnected && <Text style={styles.connectedBadge}>🔗 מחובר כבר</Text>}
        {!item.alreadyConnected && isWatchCandidate(item) && <Text style={styles.watchBadge}>⌚ Watch?</Text>}
      </View>
      <Text style={styles.deviceId}>{item.id}</Text>
      {item.serviceUUIDs.length > 0 && (
        <Text style={styles.deviceUUIDs} numberOfLines={2}>
          UUIDs: {item.serviceUUIDs.join(', ')}
        </Text>
      )}
    </TouchableOpacity>
  );

  const connectedDevices = devices.filter(d => d.alreadyConnected);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>⌚ Watch Reset Tool</Text>
        <Text style={styles.subtitle}>BLE: {bleState}</Text>
      </View>

      <TouchableOpacity style={styles.refreshBtn} onPress={findConnectedWatch}>
        {checkingConnected ? (
          <ActivityIndicator color="#000" size="small" />
        ) : (
          <Text style={styles.refreshBtnText}>🔗 בדוק שעון מחובר</Text>
        )}
      </TouchableOpacity>

      {connectedDevices.length > 0 && (
        <View style={styles.connectedSection}>
          <Text style={styles.sectionLabel}>השעון שלך כבר מחובר:</Text>
          <FlatList
            data={connectedDevices}
            keyExtractor={item => item.id}
            renderItem={renderDevice}
          />
        </View>
      )}

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
          <Text style={styles.scanBtnText}>🔍 חיפוש מכשירים בקרבת מקום</Text>
        )}
      </TouchableOpacity>

      <View style={styles.manualSection}>
        <Text style={styles.sectionLabel}>חיבור ידני לפי כתובת MAC:</Text>
        <Text style={styles.manualHint}>
          ב-Settings ← Bluetooth ← לחץ על גלגל השיניים ⚙️ לצד השם המוזר
          (כמו "chhfegkj") ושם תמצא את כתובת ה-MAC שלו.
        </Text>
        <View style={styles.manualRow}>
          <TextInput
            style={styles.manualInput}
            placeholder="AA:BB:CC:DD:EE:FF"
            placeholderTextColor="#555"
            value={manualMac}
            onChangeText={setManualMac}
            autoCapitalize="characters"
          />
          <TouchableOpacity
            style={styles.manualBtn}
            onPress={connectByMac}
            disabled={connectingManual}
          >
            {connectingManual ? (
              <ActivityIndicator color="#000" size="small" />
            ) : (
              <Text style={styles.manualBtnText}>חבר</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {connectedDevices.length === 0 && devices.length === 0 && !scanning && (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>לא נמצא שעון מחובר.</Text>
          <Text style={styles.emptyHint}>
            פתח את האפליקציה הרשמית של השעון ותחבר אותו, ואז לחץ "בדוק שעון מחובר".
            לחלופין השתמש בחיפוש הכללי.
          </Text>
        </View>
      )}

      <FlatList
        data={devices.filter(d => !d.alreadyConnected)}
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
  refreshBtn: {
    backgroundColor: '#2980b9',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  refreshBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 14 },
  connectedSection: { marginBottom: 12 },
  sectionLabel: { color: '#00ff99', fontSize: 13, marginBottom: 6, fontWeight: 'bold' },
  manualSection: { marginBottom: 16 },
  manualHint: { color: '#666', fontSize: 11, marginBottom: 8, lineHeight: 16 },
  manualRow: { flexDirection: 'row', gap: 8 },
  manualInput: {
    flex: 1,
    backgroundColor: '#1a1a1a',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#2a2a2a',
    color: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    fontFamily: 'monospace',
  },
  manualBtn: {
    backgroundColor: '#00ff99',
    borderRadius: 10,
    paddingHorizontal: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  manualBtnText: { color: '#000', fontWeight: 'bold', fontSize: 14 },
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
  deviceCardConnected: {
    borderColor: '#2980b9',
    backgroundColor: '#0d1722',
  },
  deviceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  deviceName: { fontSize: 16, fontWeight: 'bold', color: '#fff', flex: 1 },
  watchBadge: { fontSize: 12, color: '#00ff99', marginLeft: 8 },
  connectedBadge: { fontSize: 12, color: '#4db8ff', marginLeft: 8 },
  deviceId: { fontSize: 11, color: '#888', marginTop: 4 },
  deviceUUIDs: { fontSize: 10, color: '#555', marginTop: 4 },
  emptyState: { alignItems: 'center', marginTop: 20, marginBottom: 10 },
  emptyText: { color: '#666', fontSize: 16, marginBottom: 6 },
  emptyHint: { color: '#444', fontSize: 12, textAlign: 'center' },
});
