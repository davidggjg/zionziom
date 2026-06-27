package com.davidggjg.blewatchtool;

import android.Manifest;
import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothDevice;
import android.bluetooth.BluetoothGatt;
import android.bluetooth.BluetoothGattCallback;
import android.bluetooth.BluetoothGattCharacteristic;
import android.bluetooth.BluetoothGattDescriptor;
import android.bluetooth.BluetoothGattService;
import android.bluetooth.BluetoothManager;
import android.bluetooth.BluetoothProfile;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.text.format.DateFormat;
import android.widget.Button;
import android.widget.EditText;
import android.widget.TextView;
import android.widget.Toast;

import androidx.appcompat.app.AppCompatActivity;
import androidx.core.app.ActivityCompat;

import java.util.Date;
import java.util.List;
import java.util.Locale;
import java.util.UUID;

/**
 * Connects to a single BLE device chosen on the scan screen, discovers all
 * GATT services/characteristics, and lets you:
 *  - view the full discovered profile (UUIDs + properties)
 *  - write arbitrary raw hex bytes to a chosen characteristic
 *  - subscribe to notifications and watch incoming bytes in a log
 *
 * This is a generic GATT explorer - it does not assume any vendor-specific
 * protocol. You provide the UUIDs and byte payloads yourself (e.g. ones you
 * captured via an HCI snoop log or by decompiling the vendor's companion app).
 */
public class DeviceActivity extends AppCompatActivity {

    // Standard 16-bit base UUID suffix used to expand short UUIDs if ever needed.
    private static final UUID CCCD_UUID =
            UUID.fromString("00002902-0000-1000-8000-00805f9b34fb");

    private BluetoothGatt gatt;
    private TextView connStatus, servicesText, notifyLogText;
    private final Handler mainHandler = new Handler(Looper.getMainLooper());
    private final StringBuilder notifyLog = new StringBuilder();

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_device);

        connStatus = findViewById(R.id.connStatus);
        servicesText = findViewById(R.id.servicesText);
        notifyLogText = findViewById(R.id.notifyLogText);

        EditText serviceUuidInput = findViewById(R.id.serviceUuidInput);
        EditText writeCharUuidInput = findViewById(R.id.writeCharUuidInput);
        EditText hexInput = findViewById(R.id.hexInput);

        Button sendButton = findViewById(R.id.sendButton);
        Button subscribeButton = findViewById(R.id.subscribeButton);

        sendButton.setOnClickListener(v -> {
            try {
                UUID svc = UUID.fromString(normalizeUuid(serviceUuidInput.getText().toString()));
                UUID chr = UUID.fromString(normalizeUuid(writeCharUuidInput.getText().toString()));
                byte[] bytes = hexStringToBytes(hexInput.getText().toString());
                writeBytes(svc, chr, bytes);
            } catch (Exception e) {
                Toast.makeText(this, "Invalid UUID or hex input: " + e.getMessage(), Toast.LENGTH_LONG).show();
            }
        });

        subscribeButton.setOnClickListener(v -> {
            try {
                UUID svc = UUID.fromString(normalizeUuid(serviceUuidInput.getText().toString()));
                subscribeToAllNotify(svc);
            } catch (Exception e) {
                Toast.makeText(this, "Invalid service UUID: " + e.getMessage(), Toast.LENGTH_LONG).show();
            }
        });

        String address = getIntent().getStringExtra("address");
        if (address == null) {
            finish();
            return;
        }
        connectTo(address);
    }

    /** Allows entering either a full 36-char UUID or a short 4-char hex (expanded to the BLE base UUID). */
    private String normalizeUuid(String input) {
        String trimmed = input.trim();
        if (trimmed.length() == 4) {
            return "0000" + trimmed.toLowerCase(Locale.US) + "-0000-1000-8000-00805f9b34fb";
        }
        return trimmed;
    }

    private byte[] hexStringToBytes(String hex) {
        String clean = hex.replaceAll("[^0-9A-Fa-f]", "");
        if (clean.length() % 2 != 0) throw new IllegalArgumentException("odd number of hex digits");
        byte[] out = new byte[clean.length() / 2];
        for (int i = 0; i < out.length; i++) {
            out[i] = (byte) Integer.parseInt(clean.substring(i * 2, i * 2 + 2), 16);
        }
        return out;
    }

    private String bytesToHex(byte[] bytes) {
        StringBuilder sb = new StringBuilder();
        for (byte b : bytes) sb.append(String.format("%02X ", b));
        return sb.toString().trim();
    }

    private boolean hasConnectPermission() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            return ActivityCompat.checkSelfPermission(this, Manifest.permission.BLUETOOTH_CONNECT)
                    == PackageManager.PERMISSION_GRANTED;
        }
        return true;
    }

    private void connectTo(String address) {
        if (!hasConnectPermission()) {
            Toast.makeText(this, "Missing BLUETOOTH_CONNECT permission", Toast.LENGTH_LONG).show();
            finish();
            return;
        }
        BluetoothManager bm = getSystemService(BluetoothManager.class);
        BluetoothAdapter adapter = bm.getAdapter();
        BluetoothDevice device = adapter.getRemoteDevice(address);
        connStatus.setText("Connecting to " + address + " ...");
        gatt = device.connectGatt(this, false, gattCallback, BluetoothDevice.TRANSPORT_LE);
    }

    private final BluetoothGattCallback gattCallback = new BluetoothGattCallback() {
        @Override
        public void onConnectionStateChange(BluetoothGatt g, int status, int newState) {
            if (!hasConnectPermission()) return;
            if (newState == BluetoothProfile.STATE_CONNECTED) {
                mainHandler.post(() -> connStatus.setText("Connected. Discovering services..."));
                g.discoverServices();
            } else if (newState == BluetoothProfile.STATE_DISCONNECTED) {
                mainHandler.post(() -> connStatus.setText("Disconnected (status " + status + ")"));
            }
        }

        @Override
        public void onServicesDiscovered(BluetoothGatt g, int status) {
            if (status != BluetoothGatt.GATT_SUCCESS) {
                mainHandler.post(() -> connStatus.setText("Service discovery failed: " + status));
                return;
            }
            StringBuilder sb = new StringBuilder();
            List<BluetoothGattService> services = g.getServices();
            for (BluetoothGattService service : services) {
                sb.append("Service: ").append(service.getUuid()).append("\n");
                for (BluetoothGattCharacteristic c : service.getCharacteristics()) {
                    sb.append("   Char: ").append(c.getUuid())
                            .append("  props=").append(describeProperties(c.getProperties()))
                            .append("\n");
                }
            }
            mainHandler.post(() -> {
                connStatus.setText("Connected. " + services.size() + " services discovered.");
                servicesText.setText(sb.toString());
            });
        }

        @Override
        public void onCharacteristicChanged(BluetoothGatt g, BluetoothGattCharacteristic characteristic, byte[] value) {
            logNotify(characteristic.getUuid().toString(), value);
        }

        @Override
        public void onCharacteristicWrite(BluetoothGatt g, BluetoothGattCharacteristic characteristic, int status) {
            mainHandler.post(() -> Toast.makeText(DeviceActivity.this,
                    "Write to " + characteristic.getUuid() + " -> status " + status,
                    Toast.LENGTH_SHORT).show());
        }
    };

    private String describeProperties(int props) {
        StringBuilder sb = new StringBuilder();
        if ((props & BluetoothGattCharacteristic.PROPERTY_READ) != 0) sb.append("READ ");
        if ((props & BluetoothGattCharacteristic.PROPERTY_WRITE) != 0) sb.append("WRITE ");
        if ((props & BluetoothGattCharacteristic.PROPERTY_WRITE_NO_RESPONSE) != 0) sb.append("WRITE_NR ");
        if ((props & BluetoothGattCharacteristic.PROPERTY_NOTIFY) != 0) sb.append("NOTIFY ");
        if ((props & BluetoothGattCharacteristic.PROPERTY_INDICATE) != 0) sb.append("INDICATE ");
        return sb.toString().trim();
    }

    private void logNotify(String uuid, byte[] value) {
        String time = DateFormat.format("HH:mm:ss", new Date()).toString();
        notifyLog.insert(0, "[" + time + "] " + uuid + " -> " + bytesToHex(value) + "\n");
        mainHandler.post(() -> notifyLogText.setText(notifyLog.toString()));
    }

    private void writeBytes(UUID serviceUuid, UUID charUuid, byte[] bytes) {
        if (gatt == null || !hasConnectPermission()) return;
        BluetoothGattService service = gatt.getService(serviceUuid);
        if (service == null) {
            Toast.makeText(this, "Service not found on this device", Toast.LENGTH_LONG).show();
            return;
        }
        BluetoothGattCharacteristic characteristic = service.getCharacteristic(charUuid);
        if (characteristic == null) {
            Toast.makeText(this, "Characteristic not found on this service", Toast.LENGTH_LONG).show();
            return;
        }
        int writeType = (characteristic.getProperties() & BluetoothGattCharacteristic.PROPERTY_WRITE) != 0
                ? BluetoothGattCharacteristic.WRITE_TYPE_DEFAULT
                : BluetoothGattCharacteristic.WRITE_TYPE_NO_RESPONSE;

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            gatt.writeCharacteristic(characteristic, bytes, writeType);
        } else {
            characteristic.setWriteType(writeType);
            characteristic.setValue(bytes);
            gatt.writeCharacteristic(characteristic);
        }
        Toast.makeText(this, "Sent " + bytesToHex(bytes), Toast.LENGTH_SHORT).show();
    }

    private void subscribeToAllNotify(UUID serviceUuid) {
        if (gatt == null || !hasConnectPermission()) return;
        BluetoothGattService service = gatt.getService(serviceUuid);
        if (service == null) {
            Toast.makeText(this, "Service not found", Toast.LENGTH_LONG).show();
            return;
        }
        int count = 0;
        for (BluetoothGattCharacteristic c : service.getCharacteristics()) {
            boolean notify = (c.getProperties() & BluetoothGattCharacteristic.PROPERTY_NOTIFY) != 0;
            boolean indicate = (c.getProperties() & BluetoothGattCharacteristic.PROPERTY_INDICATE) != 0;
            if (!notify && !indicate) continue;
            gatt.setCharacteristicNotification(c, true);
            BluetoothGattDescriptor descriptor = c.getDescriptor(CCCD_UUID);
            if (descriptor != null) {
                byte[] value = notify
                        ? BluetoothGattDescriptor.ENABLE_NOTIFICATION_VALUE
                        : BluetoothGattDescriptor.ENABLE_INDICATION_VALUE;
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                    gatt.writeDescriptor(descriptor, value);
                } else {
                    descriptor.setValue(value);
                    gatt.writeDescriptor(descriptor);
                }
            }
            count++;
        }
        Toast.makeText(this, "Subscribed to " + count + " characteristic(s)", Toast.LENGTH_SHORT).show();
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        if (gatt != null && hasConnectPermission()) {
            try {
                gatt.close();
            } catch (SecurityException ignored) {
            }
        }
    }
}
