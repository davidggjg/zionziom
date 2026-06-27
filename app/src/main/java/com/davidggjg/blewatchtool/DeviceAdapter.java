package com.davidggjg.blewatchtool;

import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.TextView;

import androidx.annotation.NonNull;
import androidx.recyclerview.widget.RecyclerView;

import java.util.ArrayList;
import java.util.List;

public class DeviceAdapter extends RecyclerView.Adapter<DeviceAdapter.VH> {

    public interface OnDeviceClick {
        void onClick(DeviceItem item);
    }

    private final List<DeviceItem> items = new ArrayList<>();
    private final OnDeviceClick listener;

    public DeviceAdapter(OnDeviceClick listener) {
        this.listener = listener;
    }

    public void upsert(DeviceItem item) {
        for (int i = 0; i < items.size(); i++) {
            if (items.get(i).address.equals(item.address)) {
                items.set(i, item);
                notifyItemChanged(i);
                return;
            }
        }
        items.add(item);
        notifyItemInserted(items.size() - 1);
    }

    public void clear() {
        items.clear();
        notifyDataSetChanged();
    }

    @NonNull
    @Override
    public VH onCreateViewHolder(@NonNull ViewGroup parent, int viewType) {
        View v = LayoutInflater.from(parent.getContext()).inflate(R.layout.item_device, parent, false);
        return new VH(v);
    }

    @Override
    public void onBindViewHolder(@NonNull VH holder, int position) {
        DeviceItem item = items.get(position);
        String unnamed = holder.itemView.getContext().getString(R.string.device_unnamed);
        holder.name.setText(item.name == null || item.name.isEmpty() ? unnamed : item.name);
        holder.address.setText(item.address);
        holder.rssi.setText(holder.itemView.getContext().getString(R.string.device_rssi, item.rssi));
        holder.itemView.setOnClickListener(v -> listener.onClick(item));
    }

    @Override
    public int getItemCount() {
        return items.size();
    }

    static class VH extends RecyclerView.ViewHolder {
        TextView name, address, rssi;

        VH(View itemView) {
            super(itemView);
            name = itemView.findViewById(R.id.deviceName);
            address = itemView.findViewById(R.id.deviceAddress);
            rssi = itemView.findViewById(R.id.deviceRssi);
        }
    }
}
