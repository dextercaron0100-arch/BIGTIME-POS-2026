import 'package:flutter/services.dart';

import '../hardware_adapter.dart';

class AndroidHardwareAdapter implements HardwareAdapter {
  static const MethodChannel _channel = MethodChannel('com.apex.pos/hardware');

  @override
  Future<void> openCashDrawer() async {
    await _channel.invokeMethod<void>('openCashDrawer');
  }

  @override
  Future<void> printReceipt(String payload) async {
    await _channel.invokeMethod<void>('printReceipt', {'payload': payload});
  }

  @override
  Future<HardwareHealthStatus> checkHealth() async {
    final response =
        await _channel.invokeMapMethod<String, Object?>('checkHealth') ??
        const <String, Object?>{};

    final printerReady = response['printerReady'] == true;
    final cashDrawerReady = response['cashDrawerReady'] == true;
    final printerName = (response['printerName'] as String?)?.trim();
    final note = (response['note'] as String?)?.trim();

    return HardwareHealthStatus(
      printerReady: printerReady,
      scannerReady: true,
      cashDrawerReady: cashDrawerReady,
      checkedAt: DateTime.now(),
      printerName: printerName == null || printerName.isEmpty
          ? null
          : printerName,
      note: note == null || note.isEmpty ? null : note,
    );
  }

  @override
  Future<void> reconnect() async {
    await _channel.invokeMethod<void>('probeHardware');
  }
}
