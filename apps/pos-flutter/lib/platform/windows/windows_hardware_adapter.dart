import '../hardware_adapter.dart';
import 'windows_escpos_printer.dart';

class WindowsHardwareAdapter implements HardwareAdapter {
  WindowsHardwareAdapter({WindowsEscPosPrinter? printer})
    : _printer = printer ?? WindowsEscPosPrinter();

  final WindowsEscPosPrinter _printer;

  @override
  Future<void> openCashDrawer() async {
    await _printer.pulseDrawer();
  }

  @override
  Future<void> printReceipt(String payload) async {
    await _printer.printTextReceipt(payload);
  }

  @override
  Future<HardwareHealthStatus> checkHealth() async {
    final printerName = _printer.probePrinterName();
    final drawerDisabled = _printer.isDrawerDisabled;
    return HardwareHealthStatus(
      printerReady: printerName != null && printerName.trim().isNotEmpty,
      scannerReady: true,
      cashDrawerReady: drawerDisabled
          ? true
          : printerName != null && printerName.trim().isNotEmpty,
      checkedAt: DateTime.now(),
      printerName: printerName,
      note: drawerDisabled
          ? 'Cash drawer pulse is disabled via POS_WINDOWS_DISABLE_CASH_DRAWER.'
          : null,
    );
  }

  @override
  Future<void> reconnect() async {
    await checkHealth();
  }
}
