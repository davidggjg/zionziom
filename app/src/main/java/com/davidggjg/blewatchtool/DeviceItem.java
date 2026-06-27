package com.davidggjg.blewatchtool;

import android.bluetooth.BluetoothDevice;

public class DeviceItem {
    public final BluetoothDevice device;
    public final String name;
    public final String address;
    public final int rssi;

    public DeviceItem(BluetoothDevice device, String name, String address, int rssi) {
        this.device = device;
        this.name = name;
        this.address = address;
        this.rssi = rssi;
    }
}
