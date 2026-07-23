import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../core/database/app_database.dart';
import '../../core/models/money.dart';
import '../../core/providers/app_providers.dart';
import '../../core/services/back_office_client.dart';
import '../app_flow/app_flow_controller.dart';
import 'cart_controller.dart';

class _ShiftCloseInput {
  const _ShiftCloseInput({
    required this.closingCashMinor,
    required this.managerApprovalCode,
  });

  final int closingCashMinor;
  final String managerApprovalCode;
}

class ShiftOverview {
  const ShiftOverview({
    required this.shiftId,
    required this.shiftNumber,
    required this.openedAt,
    required this.cashierName,
    required this.openingCashMinor,
    required this.cashPaymentsMinor,
    required this.cashRefundsMinor,
    required this.paidInMinor,
    required this.paidOutMinor,
    required this.expectedCashMinor,
    required this.grossSalesMinor,
    required this.refundsMinor,
    required this.discountMinor,
    required this.netSalesMinor,
    required this.transactionCount,
    required this.firstOrNumber,
    required this.lastOrNumber,
    required this.paymentTotalsMinor,
    required this.cashSalesMinor,
    required this.recentMovements,
    required this.totalMovements,
    required this.usingBackOffice,
    this.notice,
  });

  final String shiftId;
  final int shiftNumber;
  final DateTime? openedAt;
  final String cashierName;
  final int openingCashMinor;
  final int cashPaymentsMinor;
  final int cashRefundsMinor;
  final int paidInMinor;
  final int paidOutMinor;
  final int expectedCashMinor;
  final int grossSalesMinor;
  final int refundsMinor;
  final int discountMinor;
  final int netSalesMinor;
  final int transactionCount;
  final int? firstOrNumber;
  final int? lastOrNumber;
  final Map<String, int> paymentTotalsMinor;
  final int cashSalesMinor;
  final List<ShiftCashMovementRecord> recentMovements;
  final int totalMovements;
  final bool usingBackOffice;
  final String? notice;
}

class _ShiftTransactionSummary {
  const _ShiftTransactionSummary({
    required this.grossSalesMinor,
    required this.refundsMinor,
    required this.discountMinor,
    required this.netSalesMinor,
    required this.transactionCount,
    required this.firstOrNumber,
    required this.lastOrNumber,
    required this.paymentTotalsMinor,
    required this.cashSalesMinor,
    required this.cashRefundsMinor,
  });

  final int grossSalesMinor;
  final int refundsMinor;
  final int discountMinor;
  final int netSalesMinor;
  final int transactionCount;
  final int? firstOrNumber;
  final int? lastOrNumber;
  final Map<String, int> paymentTotalsMinor;
  final int cashSalesMinor;
  final int cashRefundsMinor;

  bool get hasActivity =>
      grossSalesMinor > 0 ||
      refundsMinor > 0 ||
      discountMinor > 0 ||
      netSalesMinor > 0 ||
      transactionCount > 0 ||
      cashSalesMinor > 0 ||
      cashRefundsMinor > 0;

  _ShiftTransactionSummary merge(_ShiftTransactionSummary other) {
    return _ShiftTransactionSummary(
      grossSalesMinor: grossSalesMinor + other.grossSalesMinor,
      refundsMinor: refundsMinor + other.refundsMinor,
      discountMinor: discountMinor + other.discountMinor,
      netSalesMinor: netSalesMinor + other.netSalesMinor,
      transactionCount: transactionCount + other.transactionCount,
      firstOrNumber: _minOrNumber(firstOrNumber, other.firstOrNumber),
      lastOrNumber: _maxOrNumber(lastOrNumber, other.lastOrNumber),
      paymentTotalsMinor: _mergePaymentTotals(
        paymentTotalsMinor,
        other.paymentTotalsMinor,
      ),
      cashSalesMinor: cashSalesMinor + other.cashSalesMinor,
      cashRefundsMinor: cashRefundsMinor + other.cashRefundsMinor,
    );
  }
}

Future<ShiftOverview> loadShiftOverview(
  WidgetRef ref, {
  required String shiftId,
  required String branchId,
  required String terminalId,
  String? cashierId,
  required String cashierName,
  required int fallbackOpeningCashMinor,
}) async {
  final database = ref.read(databaseProvider);
  final syncService = ref.read(syncServiceProvider);
  final backOfficeClient = ref.read(backOfficeClientProvider);

  final shiftSessionFuture = database.findShiftSessionById(shiftId: shiftId);
  final shiftOrdinalFuture = database.resolveShiftSessionOrdinal(
    shiftId: shiftId,
  );
  final cashMovementsFuture = database.listShiftCashMovements(shiftId: shiftId);
  final queuedEntriesFuture = database.listShiftTransactionQueueEntries();

  final shiftSession = await shiftSessionFuture;
  final shiftNumber = await shiftOrdinalFuture;
  final cashMovements = await cashMovementsFuture;
  final queuedEntries = await queuedEntriesFuture;

  final paidInMinor = cashMovements
      .where((movement) => movement.type == ShiftCashMovementType.paidIn)
      .fold<int>(0, (total, movement) => total + movement.amountMinor);
  final paidOutMinor = cashMovements
      .where((movement) => movement.type == ShiftCashMovementType.paidOut)
      .fold<int>(0, (total, movement) => total + movement.amountMinor);

  _ShiftTransactionSummary transactionSummary;
  String? notice;
  var usingBackOffice = false;

  final online = await syncService.isOnline();
  if (online && backOfficeClient.hasAccessToken) {
    try {
      final remoteTransactions = await backOfficeClient.fetchTransactions(
        branchId: branchId,
        terminalId: terminalId,
        cashierId: cashierId,
        shiftId: shiftId,
      );
      final remoteSummary = _summarizeBackOfficeTransactions(
        remoteTransactions,
      );
      final pendingSummary = _summarizeQueuedTransactions(
        queuedEntries.where((entry) => entry.syncedAt == null).toList(),
        shiftId: shiftId,
      );
      transactionSummary = remoteSummary.merge(pendingSummary);
      usingBackOffice = true;
      if (pendingSummary.hasActivity) {
        notice = 'Queued local sales are included until sync completes.';
      }
    } catch (error) {
      transactionSummary = _summarizeQueuedTransactions(
        queuedEntries,
        shiftId: shiftId,
      );
      notice =
          'Back office shift totals could not be loaded. Showing local records only.';
    }
  } else {
    transactionSummary = _summarizeQueuedTransactions(
      queuedEntries,
      shiftId: shiftId,
    );
    notice = backOfficeClient.hasAccessToken
        ? 'Showing local shift totals while the terminal is offline.'
        : 'Showing local shift totals until the back office session is restored.';
  }

  final openingCashMinor =
      shiftSession?.openingCashMinor ?? fallbackOpeningCashMinor;
  final expectedCashMinor =
      openingCashMinor +
      transactionSummary.cashSalesMinor +
      paidInMinor -
      paidOutMinor -
      transactionSummary.cashRefundsMinor;

  return ShiftOverview(
    shiftId: shiftId,
    shiftNumber: shiftNumber <= 0 ? 1 : shiftNumber,
    openedAt: shiftSession?.openedAt.toLocal(),
    cashierName: shiftSession?.cashierName.trim().isNotEmpty == true
        ? shiftSession!.cashierName
        : cashierName,
    openingCashMinor: openingCashMinor,
    cashPaymentsMinor: transactionSummary.cashSalesMinor,
    cashRefundsMinor: transactionSummary.cashRefundsMinor,
    paidInMinor: paidInMinor,
    paidOutMinor: paidOutMinor,
    expectedCashMinor: expectedCashMinor,
    grossSalesMinor: transactionSummary.grossSalesMinor,
    refundsMinor: transactionSummary.refundsMinor,
    discountMinor: transactionSummary.discountMinor,
    netSalesMinor: transactionSummary.netSalesMinor,
    transactionCount: transactionSummary.transactionCount,
    firstOrNumber: transactionSummary.firstOrNumber,
    lastOrNumber: transactionSummary.lastOrNumber,
    paymentTotalsMinor: transactionSummary.paymentTotalsMinor,
    cashSalesMinor: transactionSummary.cashSalesMinor,
    recentMovements: cashMovements.take(6).toList(growable: false),
    totalMovements: cashMovements.length,
    usingBackOffice: usingBackOffice,
    notice: notice,
  );
}

Future<void> endCurrentShift(BuildContext context, WidgetRef ref) async {
  final cart = ref.read(cartControllerProvider);
  if (cart.itemCount > 0) {
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text('Clear the current cart before ending the shift.'),
      ),
    );
    return;
  }

  final flow = ref.read(appFlowControllerProvider);
  final backOfficeClient = ref.read(backOfficeClientProvider);
  final shiftId = flow.shiftId;
  if (shiftId == null) {
    ScaffoldMessenger.of(
      context,
    ).showSnackBar(const SnackBar(content: Text('No active shift was found.')));
    return;
  }

  final terminal = ref.read(terminalInfoProvider);
  final terminalId = flow.terminalId ?? terminal.id;
  final branchId = flow.branchId ?? 'branch-manila';
  final overview = await loadShiftOverview(
    ref,
    shiftId: shiftId,
    branchId: branchId,
    terminalId: terminalId,
    cashierId: flow.cashierId ?? flow.cashierCode,
    cashierName: flow.cashierName ?? 'Cashier',
    fallbackOpeningCashMinor: flow.openingCashMinor ?? 0,
  );
  if (!context.mounted) {
    return;
  }
  final reconciliation = await _promptShiftCloseInput(
    context,
    cashierName: flow.cashierName ?? 'Cashier',
    branchName: flow.branchName ?? 'Main branch',
    expectedCashMinor: overview.expectedCashMinor,
    openingCashMinor: overview.openingCashMinor,
    cashSalesMinor: overview.cashSalesMinor,
    cashRefundsMinor: overview.cashRefundsMinor,
    paidInMinor: overview.paidInMinor,
    paidOutMinor: overview.paidOutMinor,
    notice: overview.notice,
  );
  if (reconciliation == null || !context.mounted) {
    return;
  }

  final varianceMinor =
      reconciliation.closingCashMinor - overview.expectedCashMinor;
  const managerApprovalThresholdMinor = 500 * 100;
  if (varianceMinor.abs() > managerApprovalThresholdMinor &&
      reconciliation.managerApprovalCode.isEmpty) {
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text(
          'Manager approval code is required when cash variance is over PHP 500.00.',
        ),
      ),
    );
    return;
  }

  final closedAt = await ref
      .read(databaseProvider)
      .closeShiftSession(shiftId: shiftId);
  await ref
      .read(databaseProvider)
      .enqueueTransaction(
        tableName: 'shift_sessions',
        recordId: shiftId,
        operation: 'UPDATE',
        payload: {
          'id': shiftId,
          'branch_id': flow.branchId,
          'terminal_id': terminalId,
          'terminal_name': flow.terminalName ?? terminal.name,
          'cashier_id': flow.cashierId,
          'cashier_name': flow.cashierName,
          'closed_at': closedAt.toUtc().toIso8601String(),
          'opening_cash_minor': overview.openingCashMinor,
          'cash_sales_minor': overview.cashSalesMinor,
          'cash_refunds_minor': overview.cashRefundsMinor,
          'paid_in_minor': overview.paidInMinor,
          'paid_out_minor': overview.paidOutMinor,
          'expected_cash_minor': overview.expectedCashMinor,
          'closing_cash_minor': reconciliation.closingCashMinor,
          'variance_minor': varianceMinor,
          'manager_approved': reconciliation.managerApprovalCode.isNotEmpty,
          'manager_approval_code': reconciliation.managerApprovalCode.isEmpty
              ? null
              : 'provided',
          'is_active': false,
        },
      );

  var birSettings = backOfficeClient.cachedBirSettings(branchId: branchId);
  if (backOfficeClient.hasAccessToken) {
    try {
      birSettings = await backOfficeClient.fetchBirSettings(branchId: branchId);
    } catch (_) {
      // Printing should continue with the last cached settings or fallback text.
    }
  }

  try {
    await ref
        .read(hardwareAdapterProvider)
        .printReceipt(
          _buildShiftCloseSlip(
            branchName: flow.branchName ?? 'Main branch',
            cashierName: overview.cashierName,
            openedAt: overview.openedAt,
            closedAt: closedAt.toLocal(),
            transactionCount: overview.transactionCount,
            firstOrNumber: overview.firstOrNumber,
            lastOrNumber: overview.lastOrNumber,
            paymentTotalsMinor: overview.paymentTotalsMinor,
            openingCashMinor: overview.openingCashMinor,
            refundsMinor: overview.refundsMinor,
            paidInMinor: overview.paidInMinor,
            paidOutMinor: overview.paidOutMinor,
            closingCashMinor: reconciliation.closingCashMinor,
            birSettings: birSettings,
          ),
        );
  } catch (_) {
    // Shift close should continue even if printer is unavailable.
  }

  final syncResult = await ref
      .read(syncServiceProvider)
      .flushPending(branchId: branchId, terminalId: terminalId);

  if (!context.mounted) {
    return;
  }

  final messenger = ScaffoldMessenger.of(context);
  final currentSessionId = backOfficeClient.currentSessionId;
  if (currentSessionId != null && currentSessionId.trim().isNotEmpty) {
    try {
      await backOfficeClient.signOutSession(currentSessionId);
    } catch (_) {
      // Local logout should still continue if the remote revoke fails.
    }
  }
  backOfficeClient.clearSession();
  ref.read(appFlowControllerProvider.notifier).logout();
  messenger.showSnackBar(
    SnackBar(content: Text('Shift closed. ${syncResult.message}')),
  );
}

Future<_ShiftCloseInput?> _promptShiftCloseInput(
  BuildContext context, {
  required String cashierName,
  required String branchName,
  required int expectedCashMinor,
  required int openingCashMinor,
  required int cashSalesMinor,
  required int cashRefundsMinor,
  required int paidInMinor,
  required int paidOutMinor,
  String? notice,
}) async {
  final closingCashController = TextEditingController(
    text: (expectedCashMinor / 100).toStringAsFixed(2),
  );
  final managerCodeController = TextEditingController();

  final result = await showDialog<_ShiftCloseInput>(
    context: context,
    builder: (dialogContext) {
      return AlertDialog(
        scrollable: true,
        title: const Text('End Shift Reconciliation'),
        content: SizedBox(
          width: 420,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('Cashier: $cashierName'),
              Text('Branch: $branchName'),
              const SizedBox(height: 10),
              Text('Opening Cash: ${formatMoney(openingCashMinor)}'),
              Text('Cash Sales: ${formatMoney(cashSalesMinor)}'),
              if (cashRefundsMinor > 0)
                Text('Cash Refunds: - ${formatMoney(cashRefundsMinor)}'),
              if (paidInMinor > 0) Text('Paid In: ${formatMoney(paidInMinor)}'),
              if (paidOutMinor > 0)
                Text('Paid Out: - ${formatMoney(paidOutMinor)}'),
              Text(
                'Expected Cash: ${formatMoney(expectedCashMinor)}',
                style: const TextStyle(fontWeight: FontWeight.w600),
              ),
              if ((notice ?? '').isNotEmpty) ...[
                const SizedBox(height: 10),
                Text(
                  notice!,
                  style: const TextStyle(
                    fontSize: 12,
                    color: Color(0xFF5C6F8F),
                  ),
                ),
              ],
              const SizedBox(height: 12),
              TextField(
                controller: closingCashController,
                keyboardType: const TextInputType.numberWithOptions(
                  decimal: true,
                ),
                decoration: const InputDecoration(
                  labelText: 'Blind cash count',
                  prefixText: 'PHP ',
                  border: OutlineInputBorder(),
                ),
              ),
              const SizedBox(height: 10),
              TextField(
                controller: managerCodeController,
                decoration: const InputDecoration(
                  labelText:
                      'Manager approval code (required for large variance)',
                  border: OutlineInputBorder(),
                ),
              ),
            ],
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(dialogContext).pop(),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () {
              final closingCashMinor = moneyFromText(
                closingCashController.text,
              );
              Navigator.of(dialogContext).pop(
                _ShiftCloseInput(
                  closingCashMinor: closingCashMinor,
                  managerApprovalCode: managerCodeController.text.trim(),
                ),
              );
            },
            child: const Text('End Shift'),
          ),
        ],
      );
    },
  );

  closingCashController.dispose();
  managerCodeController.dispose();
  return result;
}

String _buildShiftCloseSlip({
  required String branchName,
  required String cashierName,
  required DateTime? openedAt,
  required DateTime closedAt,
  required int transactionCount,
  required int? firstOrNumber,
  required int? lastOrNumber,
  required Map<String, int> paymentTotalsMinor,
  required int openingCashMinor,
  required int refundsMinor,
  required int paidInMinor,
  required int paidOutMinor,
  required int closingCashMinor,
  BackOfficeBirSettings? birSettings,
}) {
  final bucketTotals = _buildPrintedPaymentBuckets(paymentTotalsMinor);
  final headerLines = _buildShiftReceiptHeaderLines(
    branchName: branchName,
    birSettings: birSettings,
  );
  final footerLines = _buildShiftReceiptFooterLines(birSettings);
  final lines = <String>[
    _centerShiftReceiptText('X Reading Report'),
    '',
    ...headerLines,
    '',
    ..._shiftReceiptTextEntryLines(
      'Start Shift:',
      _formatShiftReceiptDateTime(openedAt),
    ),
    ..._shiftReceiptTextEntryLines(
      'End Shift:',
      _formatShiftReceiptDateTime(closedAt),
    ),
    ..._shiftReceiptTextEntryLines('Cashier:', cashierName),
    ..._shiftReceiptTextEntryLines('Total Transaction:', '$transactionCount'),
    ..._shiftReceiptTextEntryLines(
      'First Transaction:',
      firstOrNumber?.toString() ?? '--',
    ),
    ..._shiftReceiptTextEntryLines(
      'Last Transaction:',
      lastOrNumber?.toString() ?? '--',
    ),
    '',
    _shiftReceiptDivider,
    _shiftReceiptPair('Opening Amount:', _shiftReceiptMoney(openingCashMinor)),
    _shiftReceiptPair('Actual Amount:', _shiftReceiptMoney(closingCashMinor)),
    _shiftReceiptDivider,
    _shiftReceiptPair(
      'Cash Payments:',
      _shiftReceiptMoney(bucketTotals.cashMinor),
    ),
    _shiftReceiptPair(
      'Mobile Payments:',
      _shiftReceiptMoney(bucketTotals.mobileMinor),
    ),
    _shiftReceiptPair(
      'Cheque Payments:',
      _shiftReceiptMoney(bucketTotals.chequeMinor),
    ),
    _shiftReceiptPair(
      'Credit Payments:',
      _shiftReceiptMoney(bucketTotals.creditMinor),
    ),
    _shiftReceiptPair('iCore PH:', _shiftReceiptMoney(bucketTotals.icoreMinor)),
    _shiftReceiptPair('Total Refunds:', _shiftReceiptMoney(refundsMinor)),
    _shiftReceiptDivider,
    _shiftReceiptPair('Paid In:', _shiftReceiptMoney(paidInMinor)),
    _shiftReceiptPair('Paid Out:', _shiftReceiptMoney(paidOutMinor)),
    _shiftReceiptDivider,
    if (footerLines.isNotEmpty) ...['', ...footerLines],
  ];
  return lines.join('\n');
}

List<String> _buildShiftReceiptHeaderLines({
  required String branchName,
  BackOfficeBirSettings? birSettings,
}) {
  final storeName = birSettings?.storeName.trim().isNotEmpty == true
      ? birSettings!.storeName.trim()
      : branchName.trim();
  final lines = <String>[
    ..._wrapShiftReceiptText(storeName).map(_centerShiftReceiptText),
  ];

  final showBirHeader = birSettings?.birEnabled ?? false;
  if (!showBirHeader) {
    return lines;
  }

  final proprietorName = birSettings?.proprietorName.trim() ?? '';
  if (proprietorName.isNotEmpty) {
    lines.addAll(
      _wrapShiftReceiptText(
        '$proprietorName - Proprietor',
      ).map(_centerShiftReceiptText),
    );
  }

  final vatTin = birSettings?.vatTin.trim() ?? '';
  if (vatTin.isNotEmpty) {
    lines.addAll(_shiftReceiptTextEntryLines('VAT REG TIN:', vatTin));
  }

  final permitNumber = birSettings?.permitNumber.trim() ?? '';
  if (permitNumber.isNotEmpty) {
    lines.addAll(_shiftReceiptTextEntryLines('PN:', permitNumber));
  }

  final machineIdentificationNumber =
      birSettings?.machineIdentificationNumber.trim() ?? '';
  if (machineIdentificationNumber.isNotEmpty) {
    lines.addAll(
      _shiftReceiptTextEntryLines('MIN:', machineIdentificationNumber),
    );
  }

  final serialNumber = birSettings?.serialNumber.trim() ?? '';
  if (serialNumber.isNotEmpty) {
    lines.addAll(_shiftReceiptTextEntryLines('SN:', serialNumber));
  }

  final addressLines = birSettings?.businessAddressLines ?? const <String>[];
  for (final line in addressLines) {
    lines.addAll(_wrapShiftReceiptText(line).map(_centerShiftReceiptText));
  }

  return lines;
}

List<String> _buildShiftReceiptFooterLines(BackOfficeBirSettings? birSettings) {
  final configuredLines = birSettings?.footerLines ?? const <String>[];
  if (configuredLines.isEmpty) {
    return [_centerShiftReceiptText('BIGTIME POS')];
  }

  return configuredLines
      .expand(
        (line) => _wrapShiftReceiptText(line).map(_centerShiftReceiptText),
      )
      .toList(growable: false);
}

_ShiftTransactionSummary _summarizeQueuedTransactions(
  List<SyncQueueEntry> entries, {
  required String shiftId,
}) {
  var grossSalesMinor = 0;
  var refundsMinor = 0;
  var discountMinor = 0;
  var netSalesMinor = 0;
  var transactionCount = 0;
  int? firstOrNumber;
  int? lastOrNumber;
  final paymentTotalsMinor = <String, int>{};
  var cashSalesMinor = 0;
  var cashRefundsMinor = 0;

  for (final entry in entries) {
    if (entry.operation.toUpperCase() != 'INSERT') {
      continue;
    }

    Map<String, dynamic> payload;
    try {
      payload = jsonDecode(entry.payload) as Map<String, dynamic>;
    } catch (_) {
      continue;
    }

    final payloadShiftId =
        payload['shift_id']?.toString() ?? payload['shiftId']?.toString();
    if (payloadShiftId == null || payloadShiftId != shiftId) {
      continue;
    }

    final status = (payload['status']?.toString() ?? 'COMPLETED')
        .trim()
        .toUpperCase();
    final type = (payload['type']?.toString() ?? 'SALE').trim().toUpperCase();
    final signedTotalMinor = _readMinorAmount(
      minorValue: payload['total_minor'],
      majorValue: payload['total'],
    );
    final totalMinor = signedTotalMinor.abs();
    final discountAmountMinor = _readMinorAmount(
      minorValue: payload['discount_amount_minor'],
      majorValue: payload['discount_amount'],
    ).abs();
    final lineItemsSubtotalMinor = _sumQueuedLineItemsMinor(payload['items']);
    final subtotalMinor = lineItemsSubtotalMinor > 0
        ? lineItemsSubtotalMinor
        : totalMinor + discountAmountMinor;
    final orNumber = _readOptionalInt(
      payload['or_number'] ?? payload['orNumber'],
    );
    final paymentTotals = _extractQueuedPaymentTotals(payload);
    final cashAmountMinor = paymentTotals['CASH'] ?? 0;
    final isRefund =
        type == 'REFUND' ||
        type == 'RETURN' ||
        status == 'RETURNED' ||
        status == 'REFUNDED' ||
        signedTotalMinor < 0;

    if (status == 'VOID') {
      continue;
    }

    if (isRefund) {
      refundsMinor += totalMinor;
      cashRefundsMinor += cashAmountMinor;
      continue;
    }

    grossSalesMinor += subtotalMinor;
    discountMinor += discountAmountMinor;
    netSalesMinor += totalMinor;
    transactionCount += 1;
    firstOrNumber = _minOrNumber(firstOrNumber, orNumber);
    lastOrNumber = _maxOrNumber(lastOrNumber, orNumber);
    _addPaymentTotals(paymentTotalsMinor, paymentTotals);
    cashSalesMinor += cashAmountMinor;
  }

  return _ShiftTransactionSummary(
    grossSalesMinor: grossSalesMinor,
    refundsMinor: refundsMinor,
    discountMinor: discountMinor,
    netSalesMinor: netSalesMinor > refundsMinor
        ? netSalesMinor - refundsMinor
        : 0,
    transactionCount: transactionCount,
    firstOrNumber: firstOrNumber,
    lastOrNumber: lastOrNumber,
    paymentTotalsMinor: paymentTotalsMinor,
    cashSalesMinor: cashSalesMinor,
    cashRefundsMinor: cashRefundsMinor,
  );
}

_ShiftTransactionSummary _summarizeBackOfficeTransactions(
  List<BackOfficePosTransaction> transactions,
) {
  var grossSalesMinor = 0;
  var refundsMinor = 0;
  var discountMinor = 0;
  var netSalesMinor = 0;
  var transactionCount = 0;
  int? firstOrNumber;
  int? lastOrNumber;
  final paymentTotalsMinor = <String, int>{};
  var cashSalesMinor = 0;
  var cashRefundsMinor = 0;

  for (final transaction in transactions) {
    final status = transaction.status.trim().toUpperCase();
    final type = transaction.type.trim().toUpperCase();
    final totalMinor = _toMinorUnits(transaction.total);
    final subtotalMinor = _toMinorUnits(transaction.subtotal);
    final discountAmountMinor = _toMinorUnits(transaction.discountAmount);
    final paymentTotals = _extractBackOfficePaymentTotals(transaction);
    final cashAmountMinor = paymentTotals['CASH'] ?? 0;
    final isRefund =
        type == 'REFUND' || type == 'RETURN' || status == 'RETURNED';

    if (status == 'VOID') {
      continue;
    }

    if (isRefund) {
      refundsMinor += totalMinor.abs();
      cashRefundsMinor += cashAmountMinor;
      continue;
    }

    grossSalesMinor += subtotalMinor > 0 ? subtotalMinor : totalMinor.abs();
    discountMinor += discountAmountMinor.abs();
    netSalesMinor += totalMinor.abs();
    transactionCount += 1;
    firstOrNumber = _minOrNumber(firstOrNumber, transaction.orNumber);
    lastOrNumber = _maxOrNumber(lastOrNumber, transaction.orNumber);
    _addPaymentTotals(paymentTotalsMinor, paymentTotals);
    cashSalesMinor += cashAmountMinor;
  }

  return _ShiftTransactionSummary(
    grossSalesMinor: grossSalesMinor,
    refundsMinor: refundsMinor,
    discountMinor: discountMinor,
    netSalesMinor: netSalesMinor > refundsMinor
        ? netSalesMinor - refundsMinor
        : 0,
    transactionCount: transactionCount,
    firstOrNumber: firstOrNumber,
    lastOrNumber: lastOrNumber,
    paymentTotalsMinor: paymentTotalsMinor,
    cashSalesMinor: cashSalesMinor,
    cashRefundsMinor: cashRefundsMinor,
  );
}

Map<String, int> _extractQueuedPaymentTotals(Map<String, dynamic> payload) {
  final totals = <String, int>{};
  final payloadPayments = payload['payments'];
  if (payloadPayments is List) {
    for (final rawPayment in payloadPayments) {
      if (rawPayment is! Map<String, dynamic>) {
        continue;
      }

      final method = _normalizePaymentMethodCode(
        rawPayment['method']?.toString() ??
            rawPayment['payment_method']?.toString() ??
            rawPayment['paymentMethod']?.toString(),
      );
      final amountMinor = _readMinorAmount(
        minorValue: rawPayment['amount_minor'] ?? rawPayment['amountMinor'],
        majorValue: rawPayment['amount'],
      ).abs();
      if (amountMinor <= 0) {
        continue;
      }
      totals[method] = (totals[method] ?? 0) + amountMinor;
    }
    return totals;
  }

  final fallbackMethod = _normalizePaymentMethodCode(
    payload['payment_method']?.toString() ??
        payload['paymentMethod']?.toString(),
  );
  final fallbackAmount = _readMinorAmount(
    minorValue: payload['total_minor'],
    majorValue: payload['total'],
  ).abs();
  if (fallbackAmount > 0) {
    totals[fallbackMethod] = fallbackAmount;
  }
  return totals;
}

Map<String, int> _extractBackOfficePaymentTotals(
  BackOfficePosTransaction transaction,
) {
  final totals = <String, int>{};
  if (transaction.payments.isNotEmpty) {
    for (final payment in transaction.payments) {
      final method = _normalizePaymentMethodCode(payment.method);
      final amountMinor = _toMinorUnits(payment.amount.abs());
      if (amountMinor <= 0) {
        continue;
      }
      totals[method] = (totals[method] ?? 0) + amountMinor;
    }
    return totals;
  }

  final fallbackAmount = _toMinorUnits(transaction.total.abs());
  if (fallbackAmount > 0) {
    totals[_normalizePaymentMethodCode(transaction.paymentMethod)] =
        fallbackAmount;
  }
  return totals;
}

int _sumQueuedLineItemsMinor(Object? payloadItems) {
  if (payloadItems is! List) {
    return 0;
  }

  var subtotalMinor = 0;
  for (final rawItem in payloadItems) {
    if (rawItem is! Map<String, dynamic>) {
      continue;
    }

    final quantity =
        (rawItem['qty'] as num?)?.toDouble() ??
        (rawItem['quantity'] as num?)?.toDouble() ??
        1;
    final unitPriceMinor = _readMinorAmount(
      minorValue: rawItem['unit_price_minor'] ?? rawItem['unitPriceMinor'],
      majorValue: rawItem['unit_price'] ?? rawItem['unitPrice'],
    );
    subtotalMinor += (quantity * unitPriceMinor).round();
  }

  return subtotalMinor;
}

int _readMinorAmount({Object? minorValue, Object? majorValue}) {
  if (minorValue is num) {
    return minorValue.toInt();
  }
  if (majorValue is num) {
    return (majorValue.toDouble() * 100).round();
  }
  return 0;
}

int _toMinorUnits(double amount) {
  return (amount * 100).round();
}

int? _readOptionalInt(Object? value) {
  if (value is int) {
    return value;
  }
  if (value is num) {
    return value.toInt();
  }
  if (value is String) {
    return int.tryParse(value.trim());
  }
  return null;
}

int? _minOrNumber(int? left, int? right) {
  if (left == null) {
    return right;
  }
  if (right == null) {
    return left;
  }
  return left < right ? left : right;
}

int? _maxOrNumber(int? left, int? right) {
  if (left == null) {
    return right;
  }
  if (right == null) {
    return left;
  }
  return left > right ? left : right;
}

void _addPaymentTotals(Map<String, int> target, Map<String, int> source) {
  for (final entry in source.entries) {
    target[entry.key] = (target[entry.key] ?? 0) + entry.value;
  }
}

Map<String, int> _mergePaymentTotals(
  Map<String, int> left,
  Map<String, int> right,
) {
  final merged = <String, int>{...left};
  _addPaymentTotals(merged, right);
  return merged;
}

String _normalizePaymentMethodCode(String? value) {
  final normalized = value?.trim().toUpperCase() ?? '';
  if (normalized.isEmpty) {
    return 'CASH';
  }
  return normalized;
}

const int _shiftReceiptWidth = 32;
const String _shiftReceiptDivider = '--------------------------------';
final NumberFormat _shiftReceiptAmountFormatter = NumberFormat(
  '#,##0.00',
  'en_PH',
);
final DateFormat _shiftReceiptDateFormatter = DateFormat('yyyy-MM-dd hh:mm a');

String _shiftReceiptMoney(int minor) {
  return _shiftReceiptAmountFormatter.format(minor / 100);
}

String _centerShiftReceiptText(String text, {int width = _shiftReceiptWidth}) {
  final trimmed = text.trim();
  if (trimmed.isEmpty || trimmed.length >= width) {
    return trimmed;
  }

  final leftPadding = ((width - trimmed.length) / 2).floor();
  return '${' ' * leftPadding}$trimmed';
}

List<String> _shiftReceiptTextEntryLines(
  String label,
  String value, {
  int width = _shiftReceiptWidth,
}) {
  final trimmedValue = value.trim();
  if (trimmedValue.isEmpty) {
    return [label.trimRight()];
  }

  return _wrapShiftReceiptText(
    '${label.trimRight()} $trimmedValue',
    width: width,
  );
}

String _shiftReceiptPair(
  String label,
  String value, {
  int width = _shiftReceiptWidth,
}) {
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

List<String> _wrapShiftReceiptText(
  String text, {
  int width = _shiftReceiptWidth,
}) {
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

String _formatShiftReceiptDateTime(DateTime? value) {
  if (value == null) {
    return '--';
  }
  return _shiftReceiptDateFormatter.format(value.toLocal());
}

class _PrintedPaymentBuckets {
  const _PrintedPaymentBuckets({
    required this.cashMinor,
    required this.mobileMinor,
    required this.chequeMinor,
    required this.creditMinor,
    required this.icoreMinor,
  });

  final int cashMinor;
  final int mobileMinor;
  final int chequeMinor;
  final int creditMinor;
  final int icoreMinor;
}

_PrintedPaymentBuckets _buildPrintedPaymentBuckets(Map<String, int> payments) {
  var cashMinor = 0;
  var mobileMinor = 0;
  var chequeMinor = 0;
  var creditMinor = 0;
  var icoreMinor = 0;

  for (final entry in payments.entries) {
    final method = _normalizePaymentMethodCode(entry.key);
    if (method == 'CASH') {
      cashMinor += entry.value;
      continue;
    }
    if (method == 'GCASH' || method == 'MAYA') {
      mobileMinor += entry.value;
      continue;
    }
    if (method == 'CHEQUE' || method == 'CHECK') {
      chequeMinor += entry.value;
      continue;
    }
    if (method == 'CARD' || method == 'CREDIT') {
      creditMinor += entry.value;
      continue;
    }
    if (method == 'ICORE' || method == 'ICOREPH' || method == 'ICORE_PH') {
      icoreMinor += entry.value;
    }
  }

  return _PrintedPaymentBuckets(
    cashMinor: cashMinor,
    mobileMinor: mobileMinor,
    chequeMinor: chequeMinor,
    creditMinor: creditMinor,
    icoreMinor: icoreMinor,
  );
}
