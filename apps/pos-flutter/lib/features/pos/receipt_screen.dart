import 'dart:async';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import 'package:uuid/uuid.dart';

import '../../core/models/money.dart';
import '../../core/providers/app_providers.dart';
import '../../core/services/back_office_client.dart';
import '../app_flow/app_flow_controller.dart';
import 'pos_drawer.dart';
import 'pos_drawer_actions.dart';

class _P {
  // Light theme
  static const accent = Color(0xFF3B6EF6);
  static const accentGlow = Color(0x2E3B6EF6);
  static const success = Color(0xFF17B36B);
  static const successBg = Color(0x1417B36B);
  static const successBorder = Color(0x2E17B36B);
  static const textPrimary = Color(0xFF14213D);
  static const textSecondary = Color(0xFF4A5D80);
  static const textMuted = Color(0xFF8A9BBF);
  static const border = Color(0xFFE2E8F4);
  static const borderBright = Color(0xFFCCD6EC);
  static const cardBg = Color(0xFFF8FAFD);
  static const pageBg = Color(0xFFF0F4FA);
  static const topBarBg = Color(0xFFFFFFFF);
  // Android dark theme
  static const androidBgStart = Color(0xFF0B0F13);
  static const androidBgEnd = Color(0xFF141A22);
  static const androidHeader = Color(0xFF20252C);
  static const androidPanel = Color(0xFF141920);
  static const androidPanelSoft = Color(0xFF1B2129);
  // ignore: unused_field
  static const androidPanelElevated = Color(0xFF20262F);
  static const androidBorder = Color(0x26FFFFFF);
  // ignore: unused_field
  static const androidDivider = Color(0x14FFFFFF);
  static const androidTextPrimary = Color(0xFFF8FAFC);
  static const androidTextSecondary = Color(0xFFD7DEE8);
  static const androidTextMuted = Color(0xFF94A3B8);
  static const androidAccent = Color(0xFF16A34A);
  static const androidAccentGlow = Color(0x3316A34A);
  static const androidSuccess = Color(0xFF34D399);
  static const androidSuccessBg = Color(0x1A34D399);
  static const androidSuccessBorder = Color(0x3334D399);
}

class ReceiptScreen extends ConsumerStatefulWidget {
  const ReceiptScreen({super.key});

  @override
  ConsumerState<ReceiptScreen> createState() => _ReceiptScreenState();
}

class _ReceiptScreenState extends ConsumerState<ReceiptScreen> {
  final GlobalKey<ScaffoldState> _scaffoldKey = GlobalKey<ScaffoldState>();
  bool _printing = false;
  bool _emailing = false;
  int _reprintCount = 0;
  String? _lastAutoPrintTransactionId;
  BackOfficeBirSettings? _birSettings;
  String? _birSettingsBranchId;
  Future<void>? _birSettingsLoadTask;

  // ── Dynamic theme helpers (mirrors payment screen) ──
  bool get _isAndroid => Platform.isAndroid;
  Color get _textPrimaryColor =>
      _isAndroid ? _P.androidTextPrimary : _P.textPrimary;
  Color get _textSecondaryColor =>
      _isAndroid ? _P.androidTextSecondary : _P.textSecondary;
  Color get _textMutedColor => _isAndroid ? _P.androidTextMuted : _P.textMuted;
  // ignore: unused_element
  Color get _accentColor => _isAndroid ? _P.androidAccent : _P.accent;
  // ignore: unused_element
  Color get _accentGlowColor =>
      _isAndroid ? _P.androidAccentGlow : _P.accentGlow;
  Color get _successColor => _isAndroid ? _P.androidSuccess : _P.success;
  Color get _successBgColor => _isAndroid ? _P.androidSuccessBg : _P.successBg;
  Color get _successBorderColor =>
      _isAndroid ? _P.androidSuccessBorder : _P.successBorder;
  Color get _panelColor => _isAndroid ? _P.androidPanel : Colors.white;
  Color get _cardColor => _isAndroid ? _P.androidPanelSoft : _P.cardBg;
  Color get _borderColor => _isAndroid ? _P.androidBorder : _P.border;
  Color get _topBarColor => _isAndroid ? _P.androidHeader : _P.topBarBg;
  List<BoxShadow>? get _surfaceShadow => _isAndroid
      ? null
      : const [
          BoxShadow(
            color: Color(0x123B6EF6),
            blurRadius: 24,
            offset: Offset(0, 2),
          ),
          BoxShadow(
            color: Color(0x0D000000),
            blurRadius: 4,
            offset: Offset(0, 1),
          ),
        ];
  BoxDecoration get _pageDecoration => BoxDecoration(
    color: _isAndroid ? null : _P.pageBg,
    gradient: _isAndroid
        ? const LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            colors: [_P.androidBgStart, _P.androidBgEnd],
          )
        : null,
  );

  String _invoiceLabel(ReceiptSummary receipt) => birNormalizeInvoiceLabel(
    receipt.orLabel,
    fallbackNumber: receipt.orNumber,
  );

  String _formatCustomerLabel(ReceiptSummary receipt) {
    final customerName = receipt.customerName?.trim() ?? '';
    if (customerName.isEmpty) {
      return 'Walk-in Customer';
    }
    return customerName;
  }

  _InvoiceTaxBreakdown _buildInvoiceTaxBreakdown(ReceiptSummary receipt) {
    if (receipt.items.isEmpty) {
      final vatableSalesMinor = (receipt.totalMinor - receipt.vatMinor).clamp(
        0,
        receipt.totalMinor,
      );
      return _InvoiceTaxBreakdown(
        vatableSalesMinor: vatableSalesMinor,
        vatExemptSalesMinor: 0,
        zeroRatedSalesMinor: 0,
      );
    }

    final rawTotals = receipt.items
        .map((item) => item.lineTotalMinor)
        .toList(growable: false);
    final subtotalMinor = rawTotals.fold<int>(0, (sum, value) => sum + value);
    if (subtotalMinor <= 0) {
      return const _InvoiceTaxBreakdown(
        vatableSalesMinor: 0,
        vatExemptSalesMinor: 0,
        zeroRatedSalesMinor: 0,
      );
    }

    final discountedTotals = <int>[];
    var remainingDiscountMinor = receipt.discountMinor.clamp(0, subtotalMinor);
    for (var index = 0; index < rawTotals.length; index++) {
      final rawTotal = rawTotals[index];
      final isLastLine = index == rawTotals.length - 1;
      final allocatedDiscountMinor = isLastLine
          ? remainingDiscountMinor
          : ((receipt.discountMinor * rawTotal) / subtotalMinor)
                .round()
                .clamp(0, remainingDiscountMinor)
                .toInt();
      discountedTotals.add(
        (rawTotal - allocatedDiscountMinor).clamp(0, rawTotal),
      );
      remainingDiscountMinor = (remainingDiscountMinor - allocatedDiscountMinor)
          .clamp(0, subtotalMinor);
    }

    var vatableGrossMinor = 0;
    var vatExemptSalesMinor = 0;
    var zeroRatedSalesMinor = 0;
    for (var index = 0; index < receipt.items.length; index++) {
      final item = receipt.items[index];
      final discountedTotalMinor = discountedTotals[index];
      switch ((item.vatType ?? 'VATABLE').trim().toUpperCase()) {
        case 'VAT_EXEMPT':
          vatExemptSalesMinor += discountedTotalMinor;
          break;
        case 'ZERO_RATED':
          zeroRatedSalesMinor += discountedTotalMinor;
          break;
        default:
          vatableGrossMinor += discountedTotalMinor;
          break;
      }
    }

    final vatableSalesMinor = (vatableGrossMinor - receipt.vatMinor).clamp(
      0,
      vatableGrossMinor,
    );
    return _InvoiceTaxBreakdown(
      vatableSalesMinor: vatableSalesMinor,
      vatExemptSalesMinor: vatExemptSalesMinor,
      zeroRatedSalesMinor: zeroRatedSalesMinor,
    );
  }

  void _notify(String message) {
    if (!mounted) {
      return;
    }
    ScaffoldMessenger.of(
      context,
    ).showSnackBar(SnackBar(content: Text(message)));
  }

  void _scheduleAutoPrint({
    required ReceiptSummary receipt,
    required AppFlowState flow,
  }) {
    if (!receipt.autoPrintPending ||
        _lastAutoPrintTransactionId == receipt.transactionId) {
      return;
    }

    _lastAutoPrintTransactionId = receipt.transactionId;
    WidgetsBinding.instance.addPostFrameCallback((_) async {
      if (!mounted) {
        return;
      }

      ref
          .read(appFlowControllerProvider.notifier)
          .markReceiptAutoPrintHandled(receipt.transactionId);
      await _printReceipt(
        receipt: receipt,
        flow: flow,
        eventType: 'PRINT',
        copyLabel: 'ORIGINAL',
        notifyOnSuccess: false,
        fetchBirSettings: false,
      );
    });
  }

  Future<void> _printReceipt({
    required ReceiptSummary receipt,
    required AppFlowState flow,
    required String eventType,
    required String copyLabel,
    String? reason,
    bool notifyOnSuccess = true,
    bool fetchBirSettings = true,
  }) async {
    if (_printing) {
      return;
    }

    setState(() => _printing = true);
    try {
      final birSettings = await _resolveBirSettings(
        flow,
        fetchRemote: fetchBirSettings,
      );
      final payload = _buildPrintableReceipt(
        receipt: receipt,
        flow: flow,
        birSettings: birSettings,
        copyLabel: copyLabel,
        reason: reason,
      );
      await ref.read(hardwareAdapterProvider).printReceipt(payload);
      await _queueReceiptEvent(
        receipt: receipt,
        flow: flow,
        eventType: eventType,
        copyLabel: copyLabel,
        reason: reason,
      );
      if (eventType == 'REPRINT' && mounted) {
        setState(() => _reprintCount = _reprintCount + 1);
      }
      if (notifyOnSuccess) {
        _notify(
          eventType == 'REPRINT'
              ? 'Sales invoice reprinted successfully.'
              : 'Sales invoice sent to printer.',
        );
      }
    } catch (error) {
      _notify(error.toString().split('\n').first);
    } finally {
      if (mounted) {
        setState(() => _printing = false);
      }
    }
  }

  Future<void> _emailReceipt({
    required ReceiptSummary receipt,
    required AppFlowState flow,
  }) async {
    if (_emailing) {
      return;
    }

    setState(() => _emailing = true);
    try {
      if (!Platform.isWindows) {
        throw Exception(
          'Email handoff is available on Windows terminals only.',
        );
      }

      final birSettings = await _resolveBirSettings(flow);
      final body = _buildPrintableReceipt(
        receipt: receipt,
        flow: flow,
        birSettings: birSettings,
        copyLabel: 'EMAIL COPY',
      );
      final subject = Uri.encodeComponent(
        'Sales Invoice ${_invoiceLabel(receipt)}',
      );
      final encodedBody = Uri.encodeComponent(body);
      final mailtoUri = 'mailto:?subject=$subject&body=$encodedBody';
      final result = await Process.run('cmd', [
        '/c',
        'start',
        '',
        mailtoUri,
      ], runInShell: true);
      if (result.exitCode != 0) {
        throw Exception('Unable to open default email client.');
      }

      await _queueReceiptEvent(
        receipt: receipt,
        flow: flow,
        eventType: 'EMAIL',
        copyLabel: 'EMAIL COPY',
      );
      _notify('Email draft opened with invoice details.');
    } catch (error) {
      _notify(error.toString().split('\n').first);
    } finally {
      if (mounted) {
        setState(() => _emailing = false);
      }
    }
  }

  void _primeBirSettings(AppFlowState flow) {
    if (_birSettingsLoadTask != null) {
      return;
    }

    final branchId = flow.branchId?.trim() ?? '';
    if (branchId.isEmpty) {
      return;
    }
    if (_birSettingsBranchId == branchId && _birSettings != null) {
      return;
    }

    _birSettingsLoadTask = _resolveBirSettings(flow).then((_) {});
    _birSettingsLoadTask!.whenComplete(() {
      _birSettingsLoadTask = null;
    });
  }

  Future<BackOfficeBirSettings?> _resolveBirSettings(
    AppFlowState flow, {
    bool fetchRemote = true,
  }) async {
    final branchId = flow.branchId?.trim() ?? '';
    if (branchId.isEmpty) {
      return null;
    }

    final client = ref.read(backOfficeClientProvider);
    final cached = client.cachedBirSettings(branchId: branchId);
    if (cached != null &&
        (_birSettingsBranchId != branchId ||
            !identical(cached, _birSettings))) {
      _birSettingsBranchId = branchId;
      _birSettings = cached;
      if (mounted) {
        setState(() {});
      }
    }

    if (!fetchRemote || !client.hasAccessToken) {
      return _birSettings;
    }

    try {
      final fetched = await client.fetchBirSettings(branchId: branchId);
      _birSettingsBranchId = branchId;
      _birSettings = fetched;
      if (mounted) {
        setState(() {});
      }
      return fetched;
    } catch (_) {
      return _birSettings;
    }
  }

  Future<void> _queueReceiptEvent({
    required ReceiptSummary receipt,
    required AppFlowState flow,
    required String eventType,
    required String copyLabel,
    String? reason,
  }) async {
    final terminal = ref.read(terminalInfoProvider);
    final branchId = flow.branchId ?? 'branch-manila';
    final terminalId = flow.terminalId ?? terminal.id;

    await ref
        .read(databaseProvider)
        .enqueueTransaction(
          tableName: 'receipt_events',
          recordId: const Uuid().v4(),
          operation: 'INSERT',
          payload: {
            'branch_id': branchId,
            'terminal_id': terminalId,
            'cashier_id': flow.cashierId ?? flow.cashierCode,
            'transaction_id': receipt.transactionId,
            'or_number': receipt.orNumber,
            'reference_number': receipt.referenceNumber,
            'event_type': eventType,
            'copy_label': copyLabel,
            'reason': reason,
            'occurred_at': DateTime.now().toUtc().toIso8601String(),
          },
        );

    unawaited(
      ref
          .read(syncServiceProvider)
          .flushPending(branchId: branchId, terminalId: terminalId),
    );
  }

  static const int _receiptWidth = 32;
  static const String _receiptDivider = '--------------------------------';

  String _receiptMoney(int minor) {
    return (minor / 100).toStringAsFixed(2);
  }

  String _centerReceiptText(String text, {int width = _receiptWidth}) {
    final trimmed = text.trim();
    if (trimmed.isEmpty || trimmed.length >= width) {
      return trimmed;
    }

    final leftPadding = ((width - trimmed.length) / 2).floor();
    return '${' ' * leftPadding}$trimmed';
  }

  String _receiptPair(String label, String value, {int width = _receiptWidth}) {
    final normalizedLabel = label.trimRight();
    final normalizedValue = value.trimLeft();
    final spacing = width - normalizedLabel.length - normalizedValue.length;
    if (spacing >= 1) {
      return '$normalizedLabel${' ' * spacing}$normalizedValue';
    }

    final truncatedWidth = (width - normalizedValue.length - 1).clamp(1, width);
    final safeLabel = normalizedLabel.length > truncatedWidth
        ? normalizedLabel.substring(0, truncatedWidth)
        : normalizedLabel;
    final safeSpacing = (width - safeLabel.length - normalizedValue.length)
        .clamp(1, width)
        .toInt();
    return '$safeLabel${' ' * safeSpacing}$normalizedValue';
  }

  List<String> _wrapReceiptText(String text, {int width = _receiptWidth}) {
    final normalized = text.trim().replaceAll(RegExp(r'\s+'), ' ');
    if (normalized.isEmpty) {
      return const [''];
    }

    final words = normalized.split(' ');
    final lines = <String>[];
    var current = '';
    for (final word in words) {
      final candidate = current.isEmpty ? word : '$current $word';
      if (candidate.length <= width) {
        current = candidate;
        continue;
      }

      if (current.isNotEmpty) {
        lines.add(current);
      }

      if (word.length <= width) {
        current = word;
        continue;
      }

      var remainder = word;
      while (remainder.length > width) {
        lines.add(remainder.substring(0, width));
        remainder = remainder.substring(width);
      }
      current = remainder;
    }

    if (current.isNotEmpty) {
      lines.add(current);
    }
    return lines;
  }

  List<String> _receiptTextEntryLines(String label, String value) {
    final normalizedValue = value.trim();
    if (normalizedValue.isEmpty) {
      return const [];
    }

    final wrappedValue = _wrapReceiptText(normalizedValue);
    if (wrappedValue.isEmpty) {
      return const [];
    }

    final lines = <String>[_receiptPair(label, wrappedValue.first)];
    for (final line in wrappedValue.skip(1)) {
      lines.add(line);
    }
    return lines;
  }

  List<String> _buildReceiptHeaderLines({
    required AppFlowState flow,
    required BackOfficeBirSettings? birSettings,
  }) {
    final showBirHeader = birSettings?.birEnabled ?? false;
    final branchName = (flow.branchName ?? 'MAIN BRANCH').trim();
    final storeName =
        showBirHeader && birSettings?.storeName.trim().isNotEmpty == true
        ? birSettings!.storeName.trim()
        : branchName;
    final lines = <String>[
      _centerReceiptText('BIGTIME POS'),
      ..._wrapReceiptText(storeName.toUpperCase()).map(_centerReceiptText),
    ];

    if (!showBirHeader) {
      return lines;
    }

    final proprietorName = birSettings?.proprietorName.trim() ?? '';
    if (proprietorName.isNotEmpty) {
      lines.addAll(
        _wrapReceiptText(
          '$proprietorName - PROPRIETOR',
        ).map(_centerReceiptText),
      );
    }

    final vatTin = birSettings?.vatTin.trim() ?? '';
    if (vatTin.isNotEmpty) {
      lines.addAll(_receiptTextEntryLines('VAT REG TIN', vatTin));
    }

    final permitNumber = birSettings?.permitNumber.trim() ?? '';
    if (permitNumber.isNotEmpty) {
      lines.addAll(_receiptTextEntryLines('AC/PN', permitNumber));
    }

    final machineIdentificationNumber =
        birSettings?.machineIdentificationNumber.trim() ?? '';
    if (machineIdentificationNumber.isNotEmpty) {
      lines.addAll(_receiptTextEntryLines('MIN', machineIdentificationNumber));
    }

    final serialNumber = birSettings?.serialNumber.trim() ?? '';
    if (serialNumber.isNotEmpty) {
      lines.addAll(_receiptTextEntryLines('SN', serialNumber));
    }

    final addressLines = birSettings?.businessAddressLines ?? const <String>[];
    for (final line in addressLines) {
      lines.addAll(
        _wrapReceiptText(line.toUpperCase()).map(_centerReceiptText),
      );
    }

    return lines;
  }

  List<String> _buildReceiptFooterLines(BackOfficeBirSettings? birSettings) {
    final lines = <String>[
      _centerReceiptText('THIS SERVES AS YOUR'),
      _centerReceiptText('SALES INVOICE'),
      _centerReceiptText('THANK YOU. COME AGAIN.'),
      _receiptPair('SOFTWARE', 'BIGTIME POS $posAppVersionLabel'),
    ];

    if (!(birSettings?.birEnabled ?? false)) {
      return lines;
    }

    final permitDateIssued = birSettings?.permitDateIssued.trim() ?? '';
    if (permitDateIssued.isNotEmpty) {
      lines.addAll(
        _receiptTextEntryLines('PERMIT DATE ISSUED', permitDateIssued),
      );
    }

    final authorityToPrintNumber =
        birSettings?.authorityToPrintNumber.trim() ?? '';
    if (authorityToPrintNumber.isNotEmpty) {
      lines.addAll(_receiptTextEntryLines('ATP NO', authorityToPrintNumber));
    }

    final authorityToPrintDateIssued =
        birSettings?.authorityToPrintDateIssued.trim() ?? '';
    if (authorityToPrintDateIssued.isNotEmpty) {
      lines.addAll(
        _receiptTextEntryLines('ATP DATE ISSUED', authorityToPrintDateIssued),
      );
    }

    final approvedSerialRange = birSettings?.approvedSerialRange.trim() ?? '';
    if (approvedSerialRange.isNotEmpty) {
      lines.addAll(
        _receiptTextEntryLines('APPROVED SERIES', approvedSerialRange),
      );
    }

    lines.addAll([
      _centerReceiptText(
        'This document is an acknowledgment of the Authority to Print.',
      ),
      _centerReceiptText(
        'Valid for five (5) years from the date of issuance.',
      ),
    ]);

    final configuredLines = birSettings?.footerLines ?? const <String>[];
    if (configuredLines.isNotEmpty) {
      lines.addAll(
        configuredLines.expand(
          (line) => _wrapReceiptText(line).map(_centerReceiptText),
        ),
      );
    }
    return lines;
  }

  String _buildPrintableReceipt({
    required ReceiptSummary receipt,
    required AppFlowState flow,
    required BackOfficeBirSettings? birSettings,
    required String copyLabel,
    String? reason,
  }) {
    final issueDate = DateFormat(
      'MM/dd/yyyy HH:mm',
    ).format(receipt.createdAt.toLocal());
    final itemCount = receipt.items.fold<int>(
      0,
      (total, item) => total + item.quantity,
    );
    final subtotalMinor = receipt.totalMinor + receipt.discountMinor;
    final invoiceTaxBreakdown = _buildInvoiceTaxBreakdown(receipt);
    final headerLines = _buildReceiptHeaderLines(
      flow: flow,
      birSettings: birSettings,
    );
    final footerLines = _buildReceiptFooterLines(birSettings);
    final invoiceLabel = _invoiceLabel(receipt);
    final lines = <String>[
      ...headerLines,
      _centerReceiptText('SALES INVOICE'),
      if (copyLabel.trim().toUpperCase() != 'ORIGINAL')
        _centerReceiptText(copyLabel.trim().toUpperCase()),
      _receiptDivider,
      _receiptPair('INVOICE NO', invoiceLabel),
      _receiptPair('REF', receipt.referenceNumber),
      _receiptPair('DATE ISSUED', issueDate),
      ..._receiptTextEntryLines('CUSTOMER', _formatCustomerLabel(receipt)),
      if ((receipt.customerTin ?? '').trim().isNotEmpty)
        ..._receiptTextEntryLines('CUSTOMER TIN', receipt.customerTin!.trim()),
      if ((receipt.customerAddress ?? '').trim().isNotEmpty)
        ..._receiptTextEntryLines(
          'CUSTOMER ADDRESS',
          receipt.customerAddress!.trim(),
        ),
      if ((receipt.customerBusinessStyle ?? '').trim().isNotEmpty)
        ..._receiptTextEntryLines(
          'BUSINESS STYLE',
          receipt.customerBusinessStyle!.trim(),
        ),
      _receiptPair('TERM', flow.terminalName ?? flow.terminalId ?? '--'),
      _receiptPair('CASHIER', flow.cashierName ?? flow.cashierCode ?? '--'),
      _receiptDivider,
    ];

    for (final item in receipt.items) {
      lines.addAll(
        _wrapReceiptText(item.name.toUpperCase()).map((line) => ' $line'),
      );
      if (item.sku.trim().isNotEmpty) {
        lines.add('  SKU ${item.sku}');
      }
      if ((item.unit ?? '').trim().isNotEmpty) {
        lines.add('  UNIT ${(item.unit ?? '').trim().toUpperCase()}');
      }
      lines.add(
        _receiptPair(
          ' ${item.quantity} x ${_receiptMoney(item.unitPriceMinor)}',
          _receiptMoney(item.lineTotalMinor),
        ),
      );
    }

    lines
      ..add(_receiptDivider)
      ..add(_receiptPair('ITEMS', '$itemCount'))
      ..add(_receiptPair('SUBTOTAL', _receiptMoney(subtotalMinor)));
    if (receipt.discountMinor > 0) {
      final discountLineLabel =
          receipt.discountLabel?.toUpperCase() ?? 'DISCOUNT';
      lines.add(
        _receiptPair(
          discountLineLabel,
          '-${_receiptMoney(receipt.discountMinor)}',
        ),
      );
      final isGovtDiscount =
          discountLineLabel == 'SC DISCOUNT' ||
          discountLineLabel == 'PWD DISCOUNT';
      if (isGovtDiscount) {
        final idNoValue = receipt.scPwdIdNumber?.isNotEmpty == true
            ? receipt.scPwdIdNumber!
            : '______________________';
        lines
          ..add(_receiptDivider)
          ..add(_receiptPair('ID NO.', idNoValue));
        final tinValue = receipt.scPwdTin?.isNotEmpty == true
            ? receipt.scPwdTin!
            : '______________________';
        lines
          ..add(_receiptPair('TIN', tinValue))
          ..add(_receiptPair('SIGNATURE', '______________________'))
          ..add(_receiptPair('PRINTED NAME', '______________________'))
          ..add(_receiptDivider);
      }
    }
    lines.add(
      _receiptPair(
        'VATABLE SALES',
        _receiptMoney(invoiceTaxBreakdown.vatableSalesMinor),
      ),
    );
    if (invoiceTaxBreakdown.vatExemptSalesMinor > 0) {
      lines.add(
        _receiptPair(
          'VAT EXEMPT SALES',
          _receiptMoney(invoiceTaxBreakdown.vatExemptSalesMinor),
        ),
      );
    }
    if (invoiceTaxBreakdown.zeroRatedSalesMinor > 0) {
      lines.add(
        _receiptPair(
          'ZERO-RATED SALES',
          _receiptMoney(invoiceTaxBreakdown.zeroRatedSalesMinor),
        ),
      );
    }
    if (invoiceTaxBreakdown.vatExemptSalesMinor > 0 &&
        invoiceTaxBreakdown.vatableSalesMinor == 0 &&
        invoiceTaxBreakdown.zeroRatedSalesMinor == 0 &&
        receipt.vatMinor == 0) {
      lines.add(_centerReceiptText('EXEMPT'));
    }
    lines
      ..add(_receiptPair('VAT 12%', _receiptMoney(receipt.vatMinor)))
      ..add(_receiptPair('TOTAL', _receiptMoney(receipt.totalMinor)))
      ..add(
        _receiptPair(
          receipt.paymentMethod.toUpperCase(),
          _receiptMoney(receipt.tenderedMinor),
        ),
      )
      ..add(_receiptPair('CHANGE', _receiptMoney(receipt.changeMinor)));

    if (reason != null && reason.trim().isNotEmpty) {
      lines
        ..add(_receiptDivider)
        ..addAll(
          _wrapReceiptText(
            'REASON: ${reason.trim().toUpperCase()}',
          ).map((line) => ' $line'),
        );
    }

    lines
      ..add(_receiptDivider)
      ..addAll(footerLines);
    return lines.join('\n');
  }

  Future<String?> _promptReprintReason() async {
    final controller = TextEditingController();
    final reason = await showDialog<String>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        scrollable: true,
        title: const Text('Reprint Reason'),
        content: TextField(
          controller: controller,
          maxLength: 120,
          autofocus: true,
          decoration: const InputDecoration(
            hintText: 'Enter reason for reprint',
            border: OutlineInputBorder(),
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(dialogContext).pop(),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () =>
                Navigator.of(dialogContext).pop(controller.text.trim()),
            child: const Text('Continue'),
          ),
        ],
      ),
    );
    controller.dispose();
    if (reason == null || reason.trim().isEmpty) {
      return null;
    }
    return reason.trim();
  }

  Widget _buildPanelFrame({
    required Widget child,
    EdgeInsetsGeometry padding = const EdgeInsets.all(28),
  }) {
    return Container(
      padding: padding,
      decoration: BoxDecoration(
        color: _panelColor,
        border: Border.all(color: _borderColor),
        borderRadius: BorderRadius.circular(20),
        boxShadow: _surfaceShadow,
      ),
      child: child,
    );
  }

  Widget _buildReceiptMetaPanel({
    required ReceiptSummary receipt,
    required AppFlowState flow,
    required bool busy,
    required String bannerDate,
    required String issuedLabel,
  }) {
    return _buildPanelFrame(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 13),
            decoration: BoxDecoration(
              color: _successBgColor,
              border: Border.all(color: _successBorderColor),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Row(
              children: [
                Container(
                  width: 34,
                  height: 34,
                  decoration: BoxDecoration(
                    color: _successColor,
                    shape: BoxShape.circle,
                    boxShadow: [
                      BoxShadow(
                        color: Color(0x4D17B36B),
                        blurRadius: 10,
                        offset: Offset(0, 3),
                      ),
                    ],
                  ),
                  child: const Icon(Icons.check, color: Colors.white, size: 16),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Payment successful',
                        style: TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.w600,
                          color: _successColor,
                          height: 1.3,
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        'Transaction recorded | $bannerDate',
                        style: TextStyle(fontSize: 12, color: _textMutedColor),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 24),
          Text(
            'Invoice details',
            style: TextStyle(
              fontSize: 18,
              fontWeight: FontWeight.w600,
              color: _textPrimaryColor,
              letterSpacing: -0.2,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            receipt.referenceNumber,
            style: TextStyle(
              fontSize: 12.5,
              color: _textMutedColor,
              fontFamily: 'monospace',
              letterSpacing: 0.4,
            ),
          ),
          const SizedBox(height: 18),
          Container(
            decoration: BoxDecoration(
              color: _cardColor,
              border: Border.all(color: _borderColor),
              borderRadius: BorderRadius.circular(14),
            ),
            clipBehavior: Clip.antiAlias,
            child: Column(
              children: [
                _DetailRow(
                  icon: Icons.description_outlined,
                  label: 'Invoice Number',
                  valueWidget: Text(
                    _invoiceLabel(receipt),
                    style: TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w500,
                      color: _textPrimaryColor,
                      fontFamily: 'monospace',
                      letterSpacing: 0.2,
                    ),
                  ),
                ),
                Divider(height: 1, color: _borderColor),
                _DetailRow(
                  icon: Icons.account_balance_wallet_outlined,
                  label: 'Payment',
                  valueWidget: _PaymentBadge(method: receipt.paymentMethod),
                ),
                if (receipt.discountMinor > 0) ...[
                  Divider(height: 1, color: _borderColor),
                  _DetailRow(
                    icon: Icons.local_offer_outlined,
                    label: 'Discount',
                    valueWidget: Text(
                      '- ${formatMoney(receipt.discountMinor)}',
                      style: TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w500,
                        color: _successColor,
                        fontFamily: 'monospace',
                        letterSpacing: 0.2,
                      ),
                    ),
                  ),
                ],
                Divider(height: 1, color: _borderColor),
                _DetailRow(
                  icon: Icons.layers_outlined,
                  label: 'VAT (12%)',
                  labelSuffix: _VatBadge(),
                  valueWidget: Text(
                    formatMoney(receipt.vatMinor),
                    style: TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w500,
                      color: _textPrimaryColor,
                      fontFamily: 'monospace',
                      letterSpacing: 0.2,
                    ),
                  ),
                ),
                Divider(height: 1, color: _borderColor),
                Container(
                  color: _isAndroid
                      ? const Color(0x0AFFFFFF)
                      : const Color(0x083B6EF6),
                  padding: const EdgeInsets.symmetric(
                    horizontal: 18,
                    vertical: 14,
                  ),
                  child: Row(
                    children: [
                      Text(
                        'Total',
                        style: TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.w600,
                          color: _textPrimaryColor,
                        ),
                      ),
                      const Spacer(),
                      Text(
                        formatMoney(receipt.totalMinor),
                        style: TextStyle(
                          fontSize: 20,
                          fontWeight: FontWeight.w600,
                          color: _textPrimaryColor,
                          fontFamily: 'monospace',
                        ),
                      ),
                    ],
                  ),
                ),
                Divider(height: 1, color: _borderColor),
                Padding(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 18,
                    vertical: 12,
                  ),
                  child: Row(
                    children: [
                      Icon(Icons.trending_up, size: 13, color: _successColor),
                      const SizedBox(width: 7),
                      Text(
                        'Change',
                        style: TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.w500,
                          color: _successColor,
                        ),
                      ),
                      const Spacer(),
                      Text(
                        formatMoney(receipt.changeMinor),
                        style: TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.w600,
                          color: _successColor,
                          fontFamily: 'monospace',
                          letterSpacing: 0.2,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 24),
          Row(
            children: [
              Expanded(
                child: _ActionButton(
                  icon: Icons.print_outlined,
                  label: _printing ? 'Printing...' : 'Print',
                  primary: true,
                  onTap: busy
                      ? null
                      : () => _printReceipt(
                          receipt: receipt,
                          flow: flow,
                          eventType: 'PRINT',
                          copyLabel: 'ORIGINAL',
                        ),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: _ActionButton(
                  icon: Icons.download_outlined,
                  label: 'Reprint',
                  onTap: busy
                      ? null
                      : () async {
                          final reason = await _promptReprintReason();
                          if (reason == null || !mounted) return;
                          await _printReceipt(
                            receipt: receipt,
                            flow: flow,
                            eventType: 'REPRINT',
                            copyLabel: 'REPRINT #${_reprintCount + 1}',
                            reason: reason,
                          );
                        },
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: _ActionButton(
                  icon: Icons.email_outlined,
                  label: _emailing ? 'Opening...' : 'Email',
                  onTap: busy
                      ? null
                      : () => _emailReceipt(receipt: receipt, flow: flow),
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          _NewTransactionButton(
            onTap: busy
                ? null
                : () => ref
                      .read(appFlowControllerProvider.notifier)
                      .backToSelling(),
          ),
          const SizedBox(height: 20),
          Center(
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(Icons.schedule, size: 11, color: _textMutedColor),
                const SizedBox(width: 5),
                Text(
                  issuedLabel,
                  style: TextStyle(
                    fontSize: 11,
                    color: _textMutedColor,
                    fontFamily: 'monospace',
                    letterSpacing: 0.4,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildReceiptPreviewPanel({required String receiptPreviewText}) {
    return _buildPanelFrame(
      child: LayoutBuilder(
        builder: (context, constraints) {
          final paperWidth = constraints.maxWidth >= 430
              ? 398.0
              : constraints.maxWidth;

          return Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                'Thermal invoice preview',
                style: TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.w600,
                  color: _textPrimaryColor,
                  letterSpacing: -0.2,
                ),
              ),
              const SizedBox(height: 6),
              Text(
                'Convenience-store style layout for printing and reprints.',
                style: TextStyle(fontSize: 12.5, color: _textMutedColor),
              ),
              const SizedBox(height: 20),
              Center(
                child: ConstrainedBox(
                  constraints: BoxConstraints(maxWidth: paperWidth),
                  child: Container(
                    width: double.infinity,
                    padding: const EdgeInsets.fromLTRB(24, 22, 24, 26),
                    decoration: BoxDecoration(
                      color: _isAndroid
                          ? const Color(0xFF1A1F26)
                          : const Color(0xFFFFFCF4),
                      borderRadius: BorderRadius.circular(18),
                      border: Border.all(
                        color: _isAndroid
                            ? const Color(0x33FFFFFF)
                            : const Color(0xFFE5DDD0),
                      ),
                      boxShadow: _isAndroid
                          ? null
                          : const [
                              BoxShadow(
                                color: Color(0x12000000),
                                blurRadius: 18,
                                offset: Offset(0, 8),
                              ),
                            ],
                    ),
                    child: Text(
                      receiptPreviewText,
                      style: TextStyle(
                        color: _isAndroid
                            ? const Color(0xFFCDD5E0)
                            : const Color(0xFF2D2A26),
                        fontSize: 12.4,
                        height: 1.42,
                        fontFamily: 'monospace',
                        letterSpacing: 0.15,
                      ),
                    ),
                  ),
                ),
              ),
            ],
          );
        },
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final flow = ref.watch(appFlowControllerProvider);
    final terminal = ref.watch(terminalInfoProvider);
    final receipt = flow.lastReceipt;
    if (receipt == null) {
      return const Scaffold(
        body: Center(child: Text('No sales invoice available.')),
      );
    }

    _primeBirSettings(flow);
    _scheduleAutoPrint(receipt: receipt, flow: flow);

    final busy = _printing || _emailing;
    final now = receipt.createdAt.toLocal();
    final dateFmt = DateFormat("d MMM yyyy · HH:mm:ss");
    final bannerDate = DateFormat("MMMM d, yyyy 'at' h:mm a").format(now);
    final terminalLabel = flow.terminalName ?? flow.terminalId ?? 'Terminal 01';
    final birSettings = _birSettingsBranchId == (flow.branchId?.trim() ?? '')
        ? _birSettings
        : null;
    final receiptPreviewText = _buildPrintableReceipt(
      receipt: receipt,
      flow: flow,
      birSettings: birSettings,
      copyLabel: 'ORIGINAL',
    );

    return DecoratedBox(
      decoration: _pageDecoration,
      child: Scaffold(
        key: _scaffoldKey,
        backgroundColor: Colors.transparent,
        resizeToAvoidBottomInset: false,
        drawer: PosDrawer(
          userName: flow.cashierName ?? 'Cashier',
          posName: flow.terminalName ?? terminal.name,
          storeName: flow.branchName ?? 'Main Store',
          appVersion: posAppVersionLabel,
          activeItem: PosNavItem.receipts,
          onItemTap: (item) {
            if (!mounted) {
              return;
            }
            unawaited(handlePosDrawerItemTap(context, ref, item: item));
          },
        ),
        appBar: PreferredSize(
          preferredSize: const Size.fromHeight(52),
          child: Container(
            height: 52 + MediaQuery.of(context).padding.top,
            padding: EdgeInsets.only(top: MediaQuery.of(context).padding.top),
            decoration: BoxDecoration(
              color: _topBarColor,
              border: Border(bottom: BorderSide(color: _borderColor)),
              boxShadow: _isAndroid
                  ? null
                  : const [
                      BoxShadow(
                        color: Color(0x0A000000),
                        blurRadius: 4,
                        offset: Offset(0, 1),
                      ),
                    ],
            ),
            child: Row(
              children: [
                const SizedBox(width: 16),
                _TopBarButton(
                  icon: Icons.chevron_left,
                  onTap: () => ref
                      .read(appFlowControllerProvider.notifier)
                      .backToSelling(),
                ),
                const SizedBox(width: 14),
                Text(
                  'Sales Invoice',
                  style: TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w500,
                    color: _textSecondaryColor,
                    letterSpacing: 0.3,
                  ),
                ),
                const Spacer(),
                _TopBarButton(
                  icon: Icons.menu_rounded,
                  onTap: () => _scaffoldKey.currentState?.openDrawer(),
                ),
                const SizedBox(width: 10),
                Text(
                  'BIGSTOP POS',
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w600,
                    letterSpacing: 1.4,
                    color: _textMutedColor,
                  ),
                ),
                const SizedBox(width: 20),
              ],
            ),
          ),
        ),
        body: LayoutBuilder(
          builder: (context, constraints) {
            final wideLayout = constraints.maxWidth >= 980;
            if (wideLayout) {
              final issuedLabel =
                  'Issued ${dateFmt.format(now)} | $terminalLabel';
              return Align(
                alignment: Alignment.topCenter,
                child: SingleChildScrollView(
                  padding: const EdgeInsets.symmetric(
                    vertical: 24,
                    horizontal: 20,
                  ),
                  child: ConstrainedBox(
                    constraints: const BoxConstraints(maxWidth: 1260),
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Expanded(
                          child: _buildReceiptMetaPanel(
                            receipt: receipt,
                            flow: flow,
                            busy: busy,
                            bannerDate: bannerDate,
                            issuedLabel: issuedLabel,
                          ),
                        ),
                        const SizedBox(width: 24),
                        Expanded(
                          child: _buildReceiptPreviewPanel(
                            receiptPreviewText: receiptPreviewText,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              );
            }

            return Center(
              child: SingleChildScrollView(
                padding: const EdgeInsets.symmetric(
                  vertical: 32,
                  horizontal: 24,
                ),
                child: Container(
                  width: 540,
                  padding: const EdgeInsets.all(36),
                  decoration: BoxDecoration(
                    color: _panelColor,
                    border: Border.all(color: _borderColor),
                    borderRadius: BorderRadius.circular(20),
                    boxShadow: _surfaceShadow,
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      // ── Success banner ──
                      Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 16,
                          vertical: 13,
                        ),
                        decoration: BoxDecoration(
                          color: _successBgColor,
                          border: Border.all(color: _successBorderColor),
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: Row(
                          children: [
                            Container(
                              width: 34,
                              height: 34,
                              decoration: BoxDecoration(
                                color: _successColor,
                                shape: BoxShape.circle,
                                boxShadow: Platform.isAndroid
                                    ? null
                                    : [
                                        BoxShadow(
                                          color: Color(0x4D17B36B),
                                          blurRadius: 10,
                                          offset: Offset(0, 3),
                                        ),
                                      ],
                              ),
                              child: const Icon(
                                Icons.check,
                                color: Colors.white,
                                size: 16,
                              ),
                            ),
                            const SizedBox(width: 12),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    'Payment successful',
                                    style: TextStyle(
                                      fontSize: 14,
                                      fontWeight: FontWeight.w600,
                                      color: _successColor,
                                      height: 1.3,
                                    ),
                                  ),
                                  const SizedBox(height: 2),
                                  Text(
                                    'Transaction recorded · $bannerDate',
                                    style: TextStyle(
                                      fontSize: 12,
                                      color: _textMutedColor,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ],
                        ),
                      ),

                      const SizedBox(height: 28),

                      Text(
                        'Thermal invoice preview',
                        style: TextStyle(
                          fontSize: 18,
                          fontWeight: FontWeight.w600,
                          color: _textPrimaryColor,
                          letterSpacing: -0.2,
                        ),
                      ),
                      const SizedBox(height: 6),
                      Text(
                        'Convenience-store style layout for printing and reprints.',
                        style: TextStyle(
                          fontSize: 12.5,
                          color: _textMutedColor,
                        ),
                      ),
                      const SizedBox(height: 20),
                      Center(
                        child: Container(
                          width: 370,
                          padding: const EdgeInsets.fromLTRB(24, 22, 24, 26),
                          decoration: BoxDecoration(
                            color: _isAndroid
                                ? const Color(0xFF1A1F26)
                                : const Color(0xFFFFFCF4),
                            borderRadius: BorderRadius.circular(18),
                            border: Border.all(
                              color: _isAndroid
                                  ? const Color(0x26FFFFFF)
                                  : const Color(0xFFE5DDD0),
                            ),
                            boxShadow: Platform.isAndroid
                                ? null
                                : const [
                                    BoxShadow(
                                      color: Color(0x12000000),
                                      blurRadius: 18,
                                      offset: Offset(0, 8),
                                    ),
                                  ],
                          ),
                          child: Text(
                            receiptPreviewText,
                            style: TextStyle(
                              color: _isAndroid
                                  ? const Color(0xFFECF0F4)
                                  : const Color(0xFF2D2A26),
                              fontSize: 12.4,
                              height: 1.42,
                              fontFamily: 'monospace',
                              letterSpacing: 0.15,
                            ),
                          ),
                        ),
                      ),

                      const SizedBox(height: 24),

                      // ── Details table ──
                      Container(
                        decoration: BoxDecoration(
                          color: _cardColor,
                          border: Border.all(color: _borderColor),
                          borderRadius: BorderRadius.circular(14),
                        ),
                        clipBehavior: Clip.antiAlias,
                        child: Column(
                          children: [
                            _DetailRow(
                              icon: Icons.description_outlined,
                              label: 'Invoice Number',
                              valueWidget: Text(
                                _invoiceLabel(receipt),
                                style: TextStyle(
                                  fontSize: 13,
                                  fontWeight: FontWeight.w500,
                                  color: _textPrimaryColor,
                                  fontFamily: 'monospace',
                                  letterSpacing: 0.2,
                                ),
                              ),
                            ),
                            Divider(height: 1, color: _borderColor),
                            _DetailRow(
                              icon: Icons.account_balance_wallet_outlined,
                              label: 'Payment',
                              valueWidget: _PaymentBadge(
                                method: receipt.paymentMethod,
                              ),
                            ),
                            if (receipt.discountMinor > 0) ...[
                              Divider(height: 1, color: _borderColor),
                              _DetailRow(
                                icon: Icons.local_offer_outlined,
                                label: 'Discount',
                                valueWidget: Text(
                                  '- ${formatMoney(receipt.discountMinor)}',
                                  style: TextStyle(
                                    fontSize: 13,
                                    fontWeight: FontWeight.w500,
                                    color: _successColor,
                                    fontFamily: 'monospace',
                                    letterSpacing: 0.2,
                                  ),
                                ),
                              ),
                            ],
                            Divider(height: 1, color: _borderColor),
                            _DetailRow(
                              icon: Icons.layers_outlined,
                              label: 'VAT (12%)',
                              labelSuffix: _VatBadge(),
                              valueWidget: Text(
                                formatMoney(receipt.vatMinor),
                                style: TextStyle(
                                  fontSize: 13,
                                  fontWeight: FontWeight.w500,
                                  color: _textPrimaryColor,
                                  fontFamily: 'monospace',
                                  letterSpacing: 0.2,
                                ),
                              ),
                            ),
                            Divider(height: 1, color: _borderColor),
                            // Total row
                            Container(
                              color: const Color(0x083B6EF6),
                              padding: const EdgeInsets.symmetric(
                                horizontal: 18,
                                vertical: 14,
                              ),
                              child: Row(
                                children: [
                                  Text(
                                    'Total',
                                    style: TextStyle(
                                      fontSize: 14,
                                      fontWeight: FontWeight.w600,
                                      color: _textPrimaryColor,
                                    ),
                                  ),
                                  const Spacer(),
                                  Text(
                                    formatMoney(receipt.totalMinor),
                                    style: TextStyle(
                                      fontSize: 20,
                                      fontWeight: FontWeight.w600,
                                      color: _textPrimaryColor,
                                      fontFamily: 'monospace',
                                    ),
                                  ),
                                ],
                              ),
                            ),
                            Divider(height: 1, color: _borderColor),
                            // Change row
                            Padding(
                              padding: const EdgeInsets.symmetric(
                                horizontal: 18,
                                vertical: 12,
                              ),
                              child: Row(
                                children: [
                                  Icon(
                                    Icons.trending_up,
                                    size: 13,
                                    color: _successColor,
                                  ),
                                  const SizedBox(width: 7),
                                  Text(
                                    'Change',
                                    style: TextStyle(
                                      fontSize: 13,
                                      fontWeight: FontWeight.w500,
                                      color: _successColor,
                                    ),
                                  ),
                                  const Spacer(),
                                  Text(
                                    formatMoney(receipt.changeMinor),
                                    style: TextStyle(
                                      fontSize: 13,
                                      fontWeight: FontWeight.w600,
                                      color: _successColor,
                                      fontFamily: 'monospace',
                                      letterSpacing: 0.2,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ],
                        ),
                      ),

                      const SizedBox(height: 24),

                      // ── Action buttons (3-col grid) ──
                      Row(
                        children: [
                          Expanded(
                            child: _ActionButton(
                              icon: Icons.print_outlined,
                              label: _printing ? 'Printing…' : 'Print',
                              primary: true,
                              onTap: busy
                                  ? null
                                  : () => _printReceipt(
                                      receipt: receipt,
                                      flow: flow,
                                      eventType: 'PRINT',
                                      copyLabel: 'ORIGINAL',
                                    ),
                            ),
                          ),
                          const SizedBox(width: 10),
                          Expanded(
                            child: _ActionButton(
                              icon: Icons.download_outlined,
                              label: 'Reprint',
                              onTap: busy
                                  ? null
                                  : () async {
                                      final reason =
                                          await _promptReprintReason();
                                      if (reason == null || !mounted) return;
                                      await _printReceipt(
                                        receipt: receipt,
                                        flow: flow,
                                        eventType: 'REPRINT',
                                        copyLabel:
                                            'REPRINT #${_reprintCount + 1}',
                                        reason: reason,
                                      );
                                    },
                            ),
                          ),
                          const SizedBox(width: 10),
                          Expanded(
                            child: _ActionButton(
                              icon: Icons.email_outlined,
                              label: _emailing ? 'Opening…' : 'Email',
                              onTap: busy
                                  ? null
                                  : () => _emailReceipt(
                                      receipt: receipt,
                                      flow: flow,
                                    ),
                            ),
                          ),
                        ],
                      ),

                      const SizedBox(height: 14),

                      // ── New transaction ──
                      _NewTransactionButton(
                        onTap: busy
                            ? null
                            : () => ref
                                  .read(appFlowControllerProvider.notifier)
                                  .backToSelling(),
                      ),

                      const SizedBox(height: 20),

                      // ── Timestamp ──
                      Center(
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Icon(
                              Icons.schedule,
                              size: 11,
                              color: _textMutedColor,
                            ),
                            const SizedBox(width: 5),
                            Text(
                              'Issued ${dateFmt.format(now)} · $terminalLabel',
                              style: TextStyle(
                                fontSize: 11,
                                color: _textMutedColor,
                                fontFamily: 'monospace',
                                letterSpacing: 0.5,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            );
          },
        ),
      ),
    ); // DecoratedBox
  }
}

class _InvoiceTaxBreakdown {
  const _InvoiceTaxBreakdown({
    required this.vatableSalesMinor,
    required this.vatExemptSalesMinor,
    required this.zeroRatedSalesMinor,
  });

  final int vatableSalesMinor;
  final int vatExemptSalesMinor;
  final int zeroRatedSalesMinor;
}

// ─────────────────────────────────────────────
// Helper widgets
// ─────────────────────────────────────────────

class _TopBarButton extends StatelessWidget {
  const _TopBarButton({required this.icon, required this.onTap});
  final IconData icon;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final isAndroid = Platform.isAndroid;
    return Material(
      color: isAndroid ? _P.androidHeader : _P.pageBg,
      borderRadius: BorderRadius.circular(8),
      child: InkWell(
        borderRadius: BorderRadius.circular(8),
        onTap: onTap,
        child: Container(
          width: 32,
          height: 32,
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(8),
            border: Border.all(color: isAndroid ? _P.androidBorder : _P.border),
          ),
          child: Icon(
            icon,
            size: 16,
            color: isAndroid ? _P.androidTextSecondary : _P.textSecondary,
          ),
        ),
      ),
    );
  }
}

class _DetailRow extends StatelessWidget {
  const _DetailRow({
    required this.icon,
    required this.label,
    required this.valueWidget,
    this.labelSuffix,
  });
  final IconData icon;
  final String label;
  final Widget valueWidget;
  final Widget? labelSuffix;

  @override
  Widget build(BuildContext context) {
    final isAndroid = Platform.isAndroid;
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 12),
      child: Row(
        children: [
          Icon(
            icon,
            size: 13,
            color: isAndroid ? _P.androidTextMuted : _P.textMuted,
          ),
          const SizedBox(width: 7),
          Text(
            label,
            style: TextStyle(
              fontSize: 13,
              color: isAndroid ? _P.androidTextSecondary : _P.textSecondary,
            ),
          ),
          if (labelSuffix != null) ...[const SizedBox(width: 4), labelSuffix!],
          const Spacer(),
          valueWidget,
        ],
      ),
    );
  }
}

class _PaymentBadge extends StatelessWidget {
  const _PaymentBadge({required this.method});
  final String method;

  @override
  Widget build(BuildContext context) {
    final isAndroid = Platform.isAndroid;
    final accentColor = isAndroid ? _P.androidAccent : _P.accent;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 3),
      decoration: BoxDecoration(
        color: isAndroid ? const Color(0x1A16A34A) : const Color(0x123B6EF6),
        border: Border.all(
          color: isAndroid ? const Color(0x3316A34A) : const Color(0x263B6EF6),
        ),
        borderRadius: BorderRadius.circular(20),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(
            Icons.account_balance_wallet_outlined,
            size: 12,
            color: accentColor,
          ),
          const SizedBox(width: 5),
          Text(
            method,
            style: TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w500,
              color: accentColor,
            ),
          ),
        ],
      ),
    );
  }
}

class _VatBadge extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
      decoration: BoxDecoration(
        color: const Color(0x143B6EF6),
        border: Border.all(color: const Color(0x263B6EF6)),
        borderRadius: BorderRadius.circular(5),
      ),
      child: const Text(
        'INCL.',
        style: TextStyle(
          fontSize: 10,
          fontWeight: FontWeight.w600,
          letterSpacing: 0.7,
          color: Color(0xFF5580D8),
        ),
      ),
    );
  }
}

class _ActionButton extends StatelessWidget {
  const _ActionButton({
    required this.icon,
    required this.label,
    this.primary = false,
    this.onTap,
  });
  final IconData icon;
  final String label;
  final bool primary;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final disabled = onTap == null;
    final isAndroid = Platform.isAndroid;
    final accentColor = isAndroid ? _P.androidAccent : _P.accent;
    final cardBgColor = isAndroid ? _P.androidPanelSoft : _P.cardBg;
    final borderColor = isAndroid ? _P.androidBorder : _P.border;
    final textMutedColor = isAndroid ? _P.androidTextMuted : _P.textMuted;
    final textSecondaryColor = isAndroid
        ? _P.androidTextSecondary
        : _P.textSecondary;
    final accentGlow = isAndroid ? _P.androidAccentGlow : _P.accentGlow;
    return Material(
      color: primary ? accentColor : cardBgColor,
      borderRadius: BorderRadius.circular(12),
      child: InkWell(
        borderRadius: BorderRadius.circular(12),
        onTap: disabled ? null : onTap,
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 10),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: primary ? accentColor : borderColor),
            boxShadow: primary
                ? [
                    BoxShadow(
                      color: accentGlow,
                      blurRadius: 14,
                      offset: const Offset(0, 4),
                    ),
                  ]
                : null,
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(
                icon,
                size: 15,
                color: disabled
                    ? textMutedColor
                    : primary
                    ? Colors.white
                    : textSecondaryColor,
              ),
              const SizedBox(width: 7),
              Text(
                label,
                style: TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w500,
                  color: disabled
                      ? textMutedColor
                      : primary
                      ? Colors.white
                      : textSecondaryColor,
                  letterSpacing: 0.1,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _NewTransactionButton extends StatelessWidget {
  const _NewTransactionButton({this.onTap});
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final isAndroid = Platform.isAndroid;
    final borderBrightColor = isAndroid ? _P.androidBorder : _P.borderBright;
    final textMutedColor = isAndroid ? _P.androidTextMuted : _P.textMuted;
    return Material(
      color: Colors.transparent,
      child: InkWell(
        borderRadius: BorderRadius.circular(12),
        onTap: onTap,
        child: Container(
          width: double.infinity,
          padding: const EdgeInsets.symmetric(vertical: 14),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(12),
            border: Border.all(
              color: borderBrightColor,
              style: BorderStyle.solid,
            ),
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(
                Icons.shopping_cart_outlined,
                size: 16,
                color: textMutedColor,
              ),
              const SizedBox(width: 8),
              Text(
                'New transaction',
                style: TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.w600,
                  color: textMutedColor,
                  letterSpacing: 0.1,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
