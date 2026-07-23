class HardwareHealthStatus {
  const HardwareHealthStatus({
    required this.printerReady,
    required this.scannerReady,
    required this.cashDrawerReady,
    required this.checkedAt,
    this.printerName,
    this.note,
  });

  final bool printerReady;
  final bool scannerReady;
  final bool cashDrawerReady;
  final DateTime checkedAt;
  final String? printerName;
  final String? note;
}

abstract class HardwareAdapter {
  Future<void> printReceipt(String payload);
  Future<void> openCashDrawer();
  Future<HardwareHealthStatus> checkHealth();
  Future<void> reconnect();
}
