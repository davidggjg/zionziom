package com.davidggjg.blewatchtool;

import android.Manifest;
import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothManager;
import android.bluetooth.le.BluetoothLeScanner;
import android.bluetooth.le.ScanCallback;
import android.bluetooth.le.ScanResult;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.View;
import android.widget.Button;
import android.widget.ProgressBar;
import android.widget.Toast;

import androidx.appcompat.app.AppCompatActivity;
import androidx.core.app.ActivityCompat;
import androidx.recyclerview.widget.LinearLayoutManager;
import androidx.recyclerview.widget.RecyclerView;

import java.util.ArrayList;
import java.util.List;

/**
 * Entry point. Requests the Bluetooth runtime permissions required on the
 * current Android version, then lets the user scan for nearby BLE devices
 * (smartwatches, earbuds, etc.) and tap one to open DeviceActivity.
 *
 * This app only talks to devices the user explicitly selects. It is meant
 * as a developer/diagnostic tool for inspecting your own hardware.
 */
public class ScanActivity extends AppCompatActivity {

    private static final int REQ_PERMISSIONS = 100;
    private static final long SCAN_DURATION_MS = 12000;

    private BluetoothLeScanner scanner;
    private DeviceAdapter adapter;
    private final Handler handler = new Handler(Looper.getMainLooper());
    private boolean scanning = false;

    private final ScanCallback scanCallback = new ScanCallback() {
        @Override
        public void onScanResult(int callbackType, ScanResult result) {
            if (ActivityCompat.checkSelfPermission(ScanActivity.this, neededConnectPermission())
                    != PackageManager.PERMISSION_GRANTED) {
                return;
            }
            String name = result.getDevice().getName();
            DeviceItem item = new DeviceItem(result.getDevice(), name,
                    result.getDevice().getAddress(), result.getRssi());
            runOnUiThread(() -> adapter.upsert(item));
        }

        @Override
        public void onScanFailed(int errorCode) {
            runOnUiThread(() -> Toast.makeText(ScanActivity.this,
                    "Scan failed, error code " + errorCode, Toast.LENGTH_LONG).show());
            stopScan();
        }
    };

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_scan);

        RecyclerView list = findViewById(R.id.deviceList);
        list.setLayoutManager(new LinearLayoutManager(this));
        adapter = new DeviceAdapter(item -> {
            stopScan();
            Intent i = new Intent(this, DeviceActivity.class);
            i.putExtra("address", item.address);
            startActivity(i);
        });
        list.setAdapter(adapter);

        Button scanButton = findViewById(R.id.scanButton);
        scanButton.setOnClickListener(v -> {
            if (hasAllPermissions()) {
                startScan();
            } else {
                requestPermissions();
            }
        });
    }

    private String neededConnectPermission() {
        return Build.VERSION.SDK_INT >= Build.VERSION_CODES.S
                ? Manifest.permission.BLUETOOTH_CONNECT
                : Manifest.permission.BLUETOOTH;
    }

    private List<String> requiredPermissions() {
        List<String> perms = new ArrayList<>();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            perms.add(Manifest.permission.BLUETOOTH_SCAN);
            perms.add(Manifest.permission.BLUETOOTH_CONNECT);
        } else {
            perms.add(Manifest.permission.ACCESS_FINE_LOCATION);
        }
        return perms;
    }

    private boolean hasAllPermissions() {
        for (String p : requiredPermissions()) {
            if (ActivityCompat.checkSelfPermission(this, p) != PackageManager.PERMISSION_GRANTED) {
                return false;
            }
        }
        return true;
    }

    private void requestPermissions() {
        List<String> perms = requiredPermissions();
        ActivityCompat.requestPermissions(this, perms.toArray(new String[0]), REQ_PERMISSIONS);
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, @androidx.annotation.NonNull String[] permissions,
                                            @androidx.annotation.NonNull int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == REQ_PERMISSIONS && hasAllPermissions()) {
            startScan();
        } else if (requestCode == REQ_PERMISSIONS) {
            Toast.makeText(this, "Bluetooth permissions are required to scan", Toast.LENGTH_LONG).show();
        }
    }

    private void startScan() {
        if (scanning) return;
        BluetoothManager bm = getSystemService(BluetoothManager.class);
        BluetoothAdapter adapter1 = bm.getAdapter();
        if (adapter1 == null || !adapter1.isEnabled()) {
            Toast.makeText(this, "Please enable Bluetooth first", Toast.LENGTH_LONG).show();
            return;
        }
        scanner = adapter1.getBluetoothLeScanner();
        if (scanner == null) {
            Toast.makeText(this, "BLE scanner unavailable on this device", Toast.LENGTH_LONG).show();
            return;
        }
        adapter.clear();
        if (ActivityCompat.checkSelfPermission(this, neededConnectPermission())
                != PackageManager.PERMISSION_GRANTED) {
            return;
        }
        scanning = true;
        findViewById(R.id.scanProgress).setVisibility(View.VISIBLE);
        scanner.startScan(scanCallback);
        handler.postDelayed(this::stopScan, SCAN_DURATION_MS);
    }

    private void stopScan() {
        if (!scanning) return;
        scanning = false;
        findViewById(R.id.scanProgress).setVisibility(View.GONE);
        if (scanner != null) {
            try {
                scanner.stopScan(scanCallback);
            } catch (SecurityException ignored) {
            }
        }
    }

    @Override
    protected void onPause() {
        super.onPause();
        stopScan();
    }
}
