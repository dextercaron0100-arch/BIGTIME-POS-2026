import 'dart:ffi';
import 'dart:io';

import 'package:ffi/ffi.dart';
import 'package:win32/win32.dart';

class WindowsEscPosPrinter {
  WindowsEscPosPrinter({String? printerName})
    : _configuredPrinterName = printerName?.trim();

  final String? _configuredPrinterName;

  Future<void> printTextReceipt(String payload) async {
    final printerName = _resolvePrinterName();
    final bytes = _buildReceiptBytes(payload);
    _writeRawBytes(
      printerName: printerName,
      bytes: bytes,
      jobName: 'BIGTIME POS Receipt',
    );
  }

  Future<void> pulseDrawer() async {
    if (_isDrawerDisabled()) {
      return;
    }

    final printerName = _resolvePrinterName();
    _writeRawBytes(
      printerName: printerName,
      bytes: const [0x1B, 0x70, 0x00, 0x19, 0xFA],
      jobName: 'BIGTIME POS Drawer Pulse',
    );
  }

  String? probePrinterName() {
    try {
      return _resolvePrinterName();
    } catch (_) {
      return null;
    }
  }

  bool get isDrawerDisabled => _isDrawerDisabled();

  String _resolvePrinterName() {
    final configured = _configuredPrinterName;
    if (configured != null && configured.isNotEmpty) {
      return configured;
    }

    final envName = Platform.environment['POS_WINDOWS_PRINTER_NAME']?.trim();
    if (envName != null && envName.isNotEmpty) {
      return envName;
    }

    final defaultName = _readDefaultPrinterName();
    if (defaultName != null && defaultName.isNotEmpty) {
      return defaultName;
    }

    throw Exception(
      'No Windows printer is configured. Set POS_WINDOWS_PRINTER_NAME or set a default printer.',
    );
  }

  bool _isDrawerDisabled() {
    final value =
        Platform.environment['POS_WINDOWS_DISABLE_CASH_DRAWER']?.trim() ?? '';
    return value == '1' || value.toLowerCase() == 'true';
  }

  String? _readDefaultPrinterName() {
    final length = calloc<Uint32>()..value = 0;
    try {
      GetDefaultPrinter(nullptr, length);
      if (length.value == 0) {
        return null;
      }

      final buffer = calloc<Uint16>(length.value).cast<Utf16>();
      try {
        final ok = GetDefaultPrinter(buffer, length);
        if (ok == 0) {
          return null;
        }
        final name = buffer.toDartString().trim();
        return name.isEmpty ? null : name;
      } finally {
        calloc.free(buffer);
      }
    } finally {
      calloc.free(length);
    }
  }

  List<int> _buildReceiptBytes(String payload) {
    final normalized = payload.replaceAll('\r\n', '\n').replaceAll('\r', '\n');
    final textBytes = normalized.runes
        .map((rune) => rune <= 0xFF ? rune : 0x3F)
        .toList(growable: false);

    return <int>[
      0x1B,
      0x40, // Initialize printer.
      ...textBytes,
      0x0A,
      0x0A,
      0x1D,
      0x56,
      0x41,
      0x10, // Partial cut.
    ];
  }

  void _writeRawBytes({
    required String printerName,
    required List<int> bytes,
    required String jobName,
  }) {
    if (bytes.isEmpty) {
      return;
    }

    final printerNamePtr = printerName.toNativeUtf16();
    final hPrinterPtr = calloc<IntPtr>();
    final docInfo = calloc<DOC_INFO_1>();
    final docNamePtr = jobName.toNativeUtf16();
    final dataTypePtr = 'RAW'.toNativeUtf16();
    final writtenPtr = calloc<Uint32>();
    final dataPtr = calloc<Uint8>(bytes.length);

    var docStarted = false;
    var pageStarted = false;

    try {
      final openOk = OpenPrinter(printerNamePtr, hPrinterPtr, nullptr);
      if (openOk == 0 || hPrinterPtr.value == 0) {
        throw _win32Error('OpenPrinter');
      }

      docInfo.ref
        ..pDocName = docNamePtr
        ..pOutputFile = nullptr
        ..pDatatype = dataTypePtr;

      final startDocId = StartDocPrinter(hPrinterPtr.value, 1, docInfo);
      if (startDocId == 0) {
        throw _win32Error('StartDocPrinter');
      }
      docStarted = true;

      final startPageOk = StartPagePrinter(hPrinterPtr.value);
      if (startPageOk == 0) {
        throw _win32Error('StartPagePrinter');
      }
      pageStarted = true;

      dataPtr.asTypedList(bytes.length).setAll(0, bytes);
      final writeOk = WritePrinter(
        hPrinterPtr.value,
        dataPtr,
        bytes.length,
        writtenPtr,
      );
      if (writeOk == 0) {
        throw _win32Error('WritePrinter');
      }
      if (writtenPtr.value != bytes.length) {
        throw Exception(
          'WritePrinter wrote ${writtenPtr.value} of ${bytes.length} bytes.',
        );
      }

      final endPageOk = EndPagePrinter(hPrinterPtr.value);
      if (endPageOk == 0) {
        throw _win32Error('EndPagePrinter');
      }
      pageStarted = false;

      final endDocOk = EndDocPrinter(hPrinterPtr.value);
      if (endDocOk == 0) {
        throw _win32Error('EndDocPrinter');
      }
      docStarted = false;
    } finally {
      if (pageStarted) {
        EndPagePrinter(hPrinterPtr.value);
      }
      if (docStarted) {
        EndDocPrinter(hPrinterPtr.value);
      }
      if (hPrinterPtr.value != 0) {
        ClosePrinter(hPrinterPtr.value);
      }

      calloc
        ..free(dataPtr)
        ..free(writtenPtr)
        ..free(dataTypePtr)
        ..free(docNamePtr)
        ..free(docInfo)
        ..free(hPrinterPtr)
        ..free(printerNamePtr);
    }
  }

  Exception _win32Error(String operation) {
    final code = GetLastError();
    return Exception('$operation failed (Win32 error $code).');
  }
}
