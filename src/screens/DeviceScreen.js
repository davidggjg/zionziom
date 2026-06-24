import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, ActivityIndicator, Alert,
} from 'react-native';
import { getBleManager } from '../utils/bleManager';
import {
  RESET_COMMANDS, WRITE_CHAR_UUIDS, NOTIFY_CHAR_UUIDS,
  buildTimeSyncPacket, bytesToHex,
} from '../utils/bleProtocol';
import { encode as btoa } from 'base-64';

export default function DeviceScreen({ route }) {
  const { deviceId, deviceName } = route.params;
  const [status, setStatus] = useState('Connecting...');
  const [connected, setConnected] = useState(false);
  const [services, setServices] = useState([]);
  const [log, setLog] = useState([]);
  const [busy, setBusy] = useState(false);
  const [writeChar, setWriteChar] = useState(null);
  const [notifyChar, setNotifyChar] = useState(null);
  const deviceRef = useRef(null);
  const manager = getBleManager();

  const addLog = (msg, type = 'info') => {
    const time = new Date().toLocaleTimeString();
    setLog(prev => [{ time, msg, type, id: Date.now() + Math.random() }, ...prev].slice(0, 100));
  };

  useEffect(() => {
    connectDevice();
    return () => {
      if (deviceRef.current) {
        deviceRef.current.cancelConnection().catch(() => {});
      }
    };
  }, []);

  const connectDevice = async () => {
    try {
      addLog(`Connecting to ${deviceName}...`, 'info');
      const device = await manager.connectToDevice(deviceId, { timeout: 10000 });
      deviceRef.current = device;
      addLog('Connected! Discovering services...', 'success');

      device.onDisconnected(() => {
        setConnected(false);
        setStatus('Disconnected');
        addLog('Device disconnected.', 'warn');
      });

      await device.discoverAllServicesAndCharacteristics();
      const svcs = await device.services();
      setConnected(true);
      setStatus(`Connected — ${svcs.length} services found`);
      addLog(`Found ${svcs.length} services`, 'success');

      const svcData = [];
      let foundWriteChar = null;
      let foundNotifyChar = null;

      for (const svc of svcs) {
        const chars = await svc.characteristics();
        const charList = chars.map(c => ({
          uuid: c.uuid,
          isWritable: c.isWritableWithResponse || c.isWritableWithoutResponse,
          isNotifiable: c.isNotifiable || c.isIndicatable,
          isReadable: c.isReadable,
          props: [
            c.isReadable && 'READ',
            c.isWritableWithResponse && 'WRITE',
            c.isWritableWithoutResponse && 'WRITE_NO_RSP',
            c.isNotifiable && 'NOTIFY',
            c.isIndicatable && 'INDICATE',
          ].filter(Boolean).join(' | '),
        }));

        svcData.push({ uuid: svc.uuid, chars: charList });
        addLog(`Service: ${svc.uuid.substring(0, 8)}... (${chars.length} chars)`, 'info');

        // Find best write characteristic
        for (const c of chars) {
          const u = c.uuid.toUpperCase();
          if (!foundWriteChar && (c.isWritableWithResponse || c.isWritableWithoutResponse)) {
            if (WRITE_CHAR_UUIDS.some(w => u.includes(w.replace(/-/g, '').substring(0, 8).toUpperCase()))) {
              foundWriteChar = c;
              addLog(`✅ Write char found: ${u.substring(0, 8)}...`, 'success');
            }
          }
          if (!foundNotifyChar && (c.isNotifiable || c.isIndicatable)) {
            if (NOTIFY_CHAR_UUIDS.some(n => u.includes(n.replace(/-/g, '').substring(0, 8).toUpperCase()))) {
              foundNotifyChar = c;
              addLog(`✅ Notify char found: ${u.substring(0, 8)}...`, 'success');
            }
          }
        }
      }

      // Fallback: pick any writable/notifiable char
      if (!foundWriteChar) {
        for (const svc of svcData) {
          const wc = svc.chars.find(c => c.isWritable);
          if (wc) {
            foundWriteChar = { uuid: wc.uuid };
            addLog(`⚠️ Fallback write char: ${wc.uuid.substring(0, 8)}...`, 'warn');
            break;
          }
        }
      }

      setServices(svcData);
      setWriteChar(foundWriteChar);
      setNotifyChar(foundNotifyChar);

      // Subscribe to notifications
      if (foundNotifyChar && device) {
        try {
          device.monitorCharacteristicForService(
            foundNotifyChar.serviceUUID || '',
            foundNotifyChar.uuid,
            (err, char) => {
              if (char?.value) {
                addLog(`📥 RX: ${char.value}`, 'rx');
              }
            }
          );
        } catch (e) {
          addLog('Could not subscribe to notifications', 'warn');
        }
      }

    } catch (err) {
      addLog(`Connection failed: ${err.message}`, 'error');
      setStatus('Connection failed');
    }
  };

  const sendBytes = async (bytes, charOverride) => {
    const device = deviceRef.current;
    if (!device || !connected) {
      addLog('Not connected!', 'error');
      return false;
    }

    const targetChar = charOverride || writeChar;
    if (!targetChar) {
      addLog('No writable characteristic found', 'error');
      return false;
    }

    try {
      // Convert Uint8Array to base64
      const b64 = btoa(String.fromCharCode(...bytes));
      addLog(`📤 TX → ${bytesToHex(bytes)}`, 'tx');

      const svcs = await device.services();
      for (const svc of svcs) {
        const chars = await svc.characteristics();
        for (const c of chars) {
          if (c.uuid.toUpperCase() === targetChar.uuid?.toUpperCase() ||
              c.uuid === targetChar.uuid) {
            if (c.isWritableWithResponse) {
              await c.writeWithResponse(b64);
            } else if (c.isWritableWithoutResponse) {
              await c.writeWithoutResponse(b64);
            }
            addLog('✅ Sent successfully', 'success');
            return true;
          }
        }
      }
      addLog('Characteristic not found on device', 'error');
      return false;
    } catch (err) {
      addLog(`TX Error: ${err.message}`, 'error');
      return false;
    }
  };

  const tryResetAll = async () => {
    if (!connected) { Alert.alert('Not connected'); return; }
    Alert.alert(
      '⚠️ Factory Reset',
      'This will send multiple reset command packets to the watch. The watch may restart or reset to factory settings. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Send Reset', style: 'destructive', onPress: async () => {
            setBusy(true);
            addLog('--- Starting reset sequence ---', 'warn');
            for (const cmd of RESET_COMMANDS) {
              addLog(`Trying: ${cmd.name}`, 'info');
              await sendBytes(cmd.bytes);
              await new Promise(r => setTimeout(r, 800));
            }
            addLog('--- Reset sequence complete ---', 'warn');
            setBusy(false);
          }
        }
      ]
    );
  };

  const syncTime = async () => {
    setBusy(true);
    const pkt = buildTimeSyncPacket();
    addLog('Sending time sync...', 'info');
    await sendBytes(pkt);
    setBusy(false);
  };

  const disconnect = () => {
    if (deviceRef.current) {
      deviceRef.current.cancelConnection();
    }
  };

  const logColor = (type) => {
    switch (type) {
      case 'success': return '#00ff99';
      case 'error': return '#ff4444';
      case 'warn': return '#ffaa00';
      case 'tx': return '#44aaff';
      case 'rx': return '#ff44ff';
      default: return '#888';
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
      {/* Status */}
      <View style={[styles.statusBar, connected ? styles.statusConnected : styles.statusDisconnected]}>
        <Text style={styles.statusText}>
          {connected ? '🟢' : '🔴'} {status}
        </Text>
      </View>

      {/* Action Buttons */}
      <View style={styles.buttonRow}>
        <TouchableOpacity
          style={[styles.btn, styles.btnDanger, busy && styles.btnDisabled]}
          onPress={tryResetAll}
          disabled={busy || !connected}
        >
          {busy ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.btnText}>🔄 Factory Reset</Text>}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.btn, styles.btnInfo, busy && styles.btnDisabled]}
          onPress={syncTime}
          disabled={busy || !connected}
        >
          <Text style={styles.btnText}>🕐 Sync Time</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={[styles.btn, styles.btnGray]} onPress={disconnect}>
        <Text style={styles.btnText}>Disconnect</Text>
      </TouchableOpacity>

      {/* GATT Map */}
      {services.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📡 GATT Profile Map</Text>
          {services.map((svc, i) => (
            <View key={i} style={styles.svcCard}>
              <Text style={styles.svcUUID}>Service: {svc.uuid}</Text>
              {svc.chars.map((c, j) => (
                <View key={j} style={styles.charRow}>
                  <Text style={styles.charUUID}>{c.uuid}</Text>
                  <Text style={styles.charProps}>{c.props}</Text>
                </View>
              ))}
            </View>
          ))}
        </View>
      )}

      {/* Log */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>📋 Log</Text>
        {log.map(entry => (
          <View key={entry.id} style={styles.logRow}>
            <Text style={styles.logTime}>{entry.time}</Text>
            <Text style={[styles.logMsg, { color: logColor(entry.type) }]}>{entry.msg}</Text>
          </View>
        ))}
        {log.length === 0 && <Text style={styles.emptyLog}>No log entries yet.</Text>}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a', padding: 12 },
  statusBar: { padding: 12, borderRadius: 10, marginBottom: 14, alignItems: 'center' },
  statusConnected: { backgroundColor: '#0d1f15', borderWidth: 1, borderColor: '#00ff99' },
  statusDisconnected: { backgroundColor: '#1f0d0d', borderWidth: 1, borderColor: '#ff4444' },
  statusText: { color: '#fff', fontWeight: 'bold', fontSize: 14 },
  buttonRow: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  btn: {
    flex: 1, paddingVertical: 14, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
  },
  btnDanger: { backgroundColor: '#c0392b' },
  btnInfo: { backgroundColor: '#2980b9' },
  btnGray: { backgroundColor: '#2a2a2a', marginBottom: 14 },
  btnDisabled: { opacity: 0.5 },
  btnText: { color: '#fff', fontWeight: 'bold', fontSize: 14 },
  section: { marginTop: 14 },
  sectionTitle: { color: '#00ff99', fontWeight: 'bold', fontSize: 15, marginBottom: 8 },
  svcCard: {
    backgroundColor: '#141414', borderRadius: 8, padding: 10, marginBottom: 8,
    borderWidth: 1, borderColor: '#2a2a2a',
  },
  svcUUID: { color: '#aaa', fontSize: 11, marginBottom: 6, fontFamily: 'monospace' },
  charRow: { marginLeft: 8, marginBottom: 4 },
  charUUID: { color: '#fff', fontSize: 10, fontFamily: 'monospace' },
  charProps: { color: '#00aaff', fontSize: 9 },
  logRow: { flexDirection: 'row', marginBottom: 3 },
  logTime: { color: '#444', fontSize: 10, width: 70, fontFamily: 'monospace' },
  logMsg: { fontSize: 11, flex: 1, fontFamily: 'monospace' },
  emptyLog: { color: '#444', fontSize: 12 },
});
