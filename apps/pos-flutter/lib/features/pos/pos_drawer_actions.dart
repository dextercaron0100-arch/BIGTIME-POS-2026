import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/database/app_database.dart';
import '../../core/models/money.dart';
import '../../core/providers/app_providers.dart';
import '../../core/services/back_office_client.dart';
import '../../core/services/sync_service.dart';
import '../app_flow/app_flow_controller.dart';
import '../catalog/catalog_item.dart';
import '../customer_display/customer_display_controls.dart';
import 'hardware_readiness_panel.dart';
import 'items_workspace_screen.dart';
import 'pos_drawer.dart';
import 'shift_panel.dart';
import 'sync_outbox_panel.dart';

const String posAppVersionLabel = 'v1.0.0';
Duration get _surfaceCloseDelay => Platform.isAndroid
    ? const Duration(milliseconds: 40)
    : const Duration(milliseconds: 220);
const String _configuredDashboardWebUrl = String.fromEnvironment(
  'DASHBOARD_WEB_URL',
  defaultValue: '',
);

String _normalizeExternalBaseUrl(String value) {
  final trimmed = value.trim();
  if (trimmed.isEmpty) {
    return trimmed;
  }
  return trimmed.replaceFirst(RegExp(r'/+$'), '');
}

String get _dashboardWebBaseUrl {
  final configured = _normalizeExternalBaseUrl(_configuredDashboardWebUrl);
  if (configured.isNotEmpty) {
    return configured;
  }

  if (Platform.isWindows) {
    return 'http://127.0.0.1:5180';
  }

  return 'http://127.0.0.1:5180';
}

String get _dashboardLoginUrl => '$_dashboardWebBaseUrl/login';

Future<void> handlePosDrawerItemTap(
  BuildContext context,
  WidgetRef ref, {
  required PosNavItem item,
}) async {
  final flow = ref.read(appFlowControllerProvider);
  final terminal = ref.read(terminalInfoProvider);
  final branchId = flow.branchId ?? 'branch-manila';
  final terminalId = flow.terminalId ?? terminal.id;

  switch (item) {
    case PosNavItem.sales:
      ref.read(appFlowControllerProvider.notifier).showSales();
      return;
    case PosNavItem.receipts:
      await showReceiptsPanel(
        context,
        ref,
        branchId: branchId,
        terminalId: terminalId,
        cashierId: flow.cashierId ?? flow.cashierCode,
      );
      return;
    case PosNavItem.shift:
      await showShiftPanel(context);
      return;
    case PosNavItem.items:
      await showItemsPanel(context, branchId: branchId);
      return;
    case PosNavItem.settings:
      await showHardwareReadinessPanel(context);
      return;
    case PosNavItem.backOffice:
      if (Platform.isWindows) {
        await _openDashboardLoginInBrowser(context);
        return;
      }
      await showBackOfficePanel(
        context,
        ref,
        branchId: branchId,
        terminalId: terminalId,
      );
      return;
    case PosNavItem.apps:
      await showCustomerDisplayControls(context);
      return;
    case PosNavItem.support:
      await showSupportPanel(
        context,
        ref,
        branchId: branchId,
        terminalId: terminalId,
      );
      return;
  }
}

Future<void> _openDashboardLoginInBrowser(BuildContext context) async {
  try {
    await _launchExternalUrl(_dashboardLoginUrl);
  } catch (error) {
    if (!context.mounted) {
      return;
    }
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(
          'Could not open dashboard login: ${error.toString().split('\n').first}',
        ),
      ),
    );
  }
}

Future<void> _launchExternalUrl(String url) async {
  if (Platform.isWindows) {
    await Process.start('cmd', ['/c', 'start', '', url], runInShell: true);
    return;
  }
  if (Platform.isMacOS) {
    await Process.start('open', [url]);
    return;
  }
  if (Platform.isLinux) {
    await Process.start('xdg-open', [url]);
    return;
  }
  throw UnsupportedError('External browser launch is not supported.');
}

Future<void> showItemsPanel(BuildContext context, {required String branchId}) {
  return Navigator.of(context).push(
    MaterialPageRoute<void>(
      builder: (context) => ItemsWorkspaceScreen(branchId: branchId),
    ),
  );
}

Future<void> showReceiptsPanel(
  BuildContext context,
  WidgetRef ref, {
  required String branchId,
  required String terminalId,
  String? cashierId,
}) {
  return _showFloatingPage(
    context,
    title: 'Receipts',
    child: _ReceiptsPanel(
      parentContext: context,
      branchId: branchId,
      terminalId: terminalId,
      cashierId: cashierId,
    ),
  );
}

Future<void> showBackOfficePanel(
  BuildContext context,
  WidgetRef ref, {
  required String branchId,
  required String terminalId,
}) {
  return _showDrawerSheet(
    context,
    title: 'Back Office',
    child: _BackOfficePanel(
      parentContext: context,
      branchId: branchId,
      terminalId: terminalId,
    ),
  );
}

Future<void> showSupportPanel(
  BuildContext context,
  WidgetRef ref, {
  required String branchId,
  required String terminalId,
}) {
  return _showDrawerSheet(
    context,
    title: 'Support',
    child: _SupportPanel(
      parentContext: context,
      branchId: branchId,
      terminalId: terminalId,
    ),
  );
}

Future<T?> _showDrawerSheet<T>(
  BuildContext context, {
  required String title,
  required Widget child,
}) {
  return showModalBottomSheet<T>(
    context: context,
    isScrollControlled: true,
    useSafeArea: true,
    backgroundColor: Colors.transparent,
    builder: (sheetContext) {
      return FractionallySizedBox(
        heightFactor: 0.92,
        child: _DrawerSheet(title: title, child: child),
      );
    },
  );
}

Future<T?> _showFloatingPage<T>(
  BuildContext context, {
  required String title,
  required Widget child,
}) {
  final isAndroid = Platform.isAndroid;
  return Navigator.of(context).push<T>(
    PageRouteBuilder<T>(
      opaque: false,
      barrierDismissible: true,
      barrierColor: const Color(0x660B1220),
      transitionDuration: isAndroid
          ? Duration.zero
          : const Duration(milliseconds: 220),
      reverseTransitionDuration: isAndroid
          ? Duration.zero
          : const Duration(milliseconds: 180),
      pageBuilder: (context, animation, secondaryAnimation) {
        return _FloatingPage(title: title, child: child);
      },
      transitionsBuilder: isAndroid
          ? (context, animation, secondaryAnimation, child) => child
          : (context, animation, secondaryAnimation, child) {
              final curved = CurvedAnimation(
                parent: animation,
                curve: Curves.easeOutCubic,
                reverseCurve: Curves.easeInCubic,
              );
              return FadeTransition(
                opacity: curved,
                child: ScaleTransition(
                  scale: Tween<double>(begin: 0.97, end: 1).animate(curved),
                  child: child,
                ),
              );
            },
    ),
  );
}

class _DrawerSheet extends StatelessWidget {
  const _DrawerSheet({required this.title, required this.child});

  final String title;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: const BoxDecoration(
        color: Color(0xFFF7F9FC),
        borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
      ),
      child: Column(
        children: [
          const SizedBox(height: 12),
          Container(
            width: 48,
            height: 5,
            decoration: BoxDecoration(
              color: const Color(0xFFD1DAE6),
              borderRadius: BorderRadius.circular(999),
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 18, 12, 12),
            child: Row(
              children: [
                Text(
                  title,
                  style: const TextStyle(
                    fontSize: 20,
                    fontWeight: FontWeight.w700,
                    color: Color(0xFF14213D),
                  ),
                ),
                const Spacer(),
                IconButton(
                  onPressed: () => Navigator.of(context).pop(),
                  icon: const Icon(Icons.close),
                ),
              ],
            ),
          ),
          const Divider(height: 1),
          Expanded(child: child),
        ],
      ),
    );
  }
}

class _FloatingPage extends StatelessWidget {
  const _FloatingPage({required this.title, required this.child});

  final String title;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: SafeArea(
        minimum: const EdgeInsets.all(12),
        child: LayoutBuilder(
          builder: (context, constraints) {
            final maxWidth = constraints.maxWidth >= 900
                ? 920.0
                : constraints.maxWidth >= 680
                ? constraints.maxWidth * 0.9
                : constraints.maxWidth;
            final maxHeight = constraints.maxHeight >= 780
                ? constraints.maxHeight * 0.94
                : constraints.maxHeight;

            return Center(
              child: ConstrainedBox(
                constraints: BoxConstraints(
                  maxWidth: maxWidth,
                  maxHeight: maxHeight,
                ),
                child: DecoratedBox(
                  decoration: BoxDecoration(
                    color: const Color(0xFFF7F9FC),
                    borderRadius: BorderRadius.circular(30),
                    boxShadow: const [
                      BoxShadow(
                        color: Color(0x24000000),
                        blurRadius: 28,
                        offset: Offset(0, 12),
                      ),
                    ],
                  ),
                  child: ClipRRect(
                    borderRadius: BorderRadius.circular(30),
                    child: Column(
                      children: [
                        Container(
                          height: 6,
                          width: 56,
                          margin: const EdgeInsets.only(top: 12),
                          decoration: BoxDecoration(
                            color: const Color(0xFFD1DAE6),
                            borderRadius: BorderRadius.circular(999),
                          ),
                        ),
                        Padding(
                          padding: const EdgeInsets.fromLTRB(24, 18, 14, 12),
                          child: Row(
                            children: [
                              Text(
                                title,
                                style: const TextStyle(
                                  fontSize: 22,
                                  fontWeight: FontWeight.w700,
                                  color: Color(0xFF14213D),
                                ),
                              ),
                              const Spacer(),
                              IconButton(
                                onPressed: () => Navigator.of(context).pop(),
                                icon: const Icon(Icons.close_rounded),
                                style: IconButton.styleFrom(
                                  backgroundColor: Colors.white,
                                  foregroundColor: const Color(0xFF14213D),
                                  side: const BorderSide(
                                    color: Color(0xFFDCE5F1),
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ),
                        const Divider(height: 1),
                        Expanded(child: child),
                      ],
                    ),
                  ),
                ),
              ),
            );
          },
        ),
      ),
    );
  }
}

class _ReceiptsPanel extends ConsumerStatefulWidget {
  const _ReceiptsPanel({
    required this.parentContext,
    required this.branchId,
    required this.terminalId,
    this.cashierId,
  });

  final BuildContext parentContext;
  final String branchId;
  final String terminalId;
  final String? cashierId;

  @override
  ConsumerState<_ReceiptsPanel> createState() => _ReceiptsPanelState();
}

class _ReceiptsPanelState extends ConsumerState<_ReceiptsPanel> {
  late Future<_ReceiptPanelData> _future;

  @override
  void initState() {
    super.initState();
    _future = _load();
  }

  Future<_ReceiptPanelData> _load() async {
    final syncService = ref.read(syncServiceProvider);
    final database = ref.read(databaseProvider);
    final client = ref.read(backOfficeClientProvider);
    final isOnline = await syncService.isOnline();
    final localEntries = await database.listTransactionQueueEntries(limit: 40);
    final localReceipts = _buildLocalReceiptItems(localEntries, syncService);
    final canUseBackOffice = isOnline && client.hasAccessToken;

    if (!canUseBackOffice) {
      return _ReceiptPanelData(
        items: localReceipts,
        notice: localReceipts.isEmpty
            ? 'No recent receipt history is available offline yet.'
            : 'Showing queued local receipts while back office is unavailable.',
        usingBackOffice: false,
      );
    }

    try {
      final remoteTransactions = await client.fetchTransactions(
        branchId: widget.branchId,
        terminalId: widget.terminalId,
        cashierId: widget.cashierId,
      );
      final remoteReceipts = remoteTransactions
          .map(_ReceiptHistoryItem.fromBackOffice)
          .toList(growable: false);
      final merged = <_ReceiptHistoryItem>[...localReceipts, ...remoteReceipts];

      return _ReceiptPanelData(
        items: _dedupeAndSortReceipts(merged),
        notice: localReceipts.isNotEmpty
            ? 'Queued local receipts are shown first until sync completes.'
            : null,
        usingBackOffice: true,
      );
    } catch (error) {
      return _ReceiptPanelData(
        items: localReceipts,
        notice:
            'Back office receipts could not be loaded. ${error.toString().split('\n').first}',
        usingBackOffice: false,
      );
    }
  }

  List<_ReceiptHistoryItem> _buildLocalReceiptItems(
    List<SyncQueueEntry> entries,
    SyncService syncService,
  ) {
    return entries
        .where((entry) => entry.syncedAt == null)
        .map(
          (entry) => _ReceiptHistoryItem.fromQueueEntry(
            entry,
            branchId: widget.branchId,
            terminalId: widget.terminalId,
            syncService: syncService,
          ),
        )
        .whereType<_ReceiptHistoryItem>()
        .toList(growable: false);
  }

  List<_ReceiptHistoryItem> _dedupeAndSortReceipts(
    List<_ReceiptHistoryItem> items,
  ) {
    final byKey = <String, _ReceiptHistoryItem>{};
    for (final item in items) {
      final key = item.summary.transactionId.isNotEmpty
          ? item.summary.transactionId
          : item.summary.referenceNumber;
      byKey.putIfAbsent(key, () => item);
    }

    final deduped = byKey.values.toList(growable: false);
    deduped.sort(
      (left, right) =>
          right.summary.createdAt.compareTo(left.summary.createdAt),
    );
    return deduped;
  }

  void _openReceipt(_ReceiptHistoryItem item) {
    Navigator.of(context).pop();
    Future<void>.delayed(_surfaceCloseDelay, () {
      if (!widget.parentContext.mounted) {
        return;
      }
      ref.read(appFlowControllerProvider.notifier).showReceipt(item.summary);
    });
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 8, 20, 20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Recent receipts from this terminal, with queued local sales shown when offline.',
            style: TextStyle(color: Color(0xFF5C6F8F)),
          ),
          const SizedBox(height: 16),
          Row(
            children: [
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: () => setState(() => _future = _load()),
                  icon: const Icon(Icons.refresh_rounded),
                  label: const Text('Refresh Receipts'),
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          Expanded(
            child: FutureBuilder<_ReceiptPanelData>(
              future: _future,
              builder: (context, snapshot) {
                if (snapshot.connectionState != ConnectionState.done) {
                  return const Center(child: CircularProgressIndicator());
                }
                if (snapshot.hasError) {
                  return Center(child: Text(snapshot.error.toString()));
                }

                final data = snapshot.data;
                final items = data?.items ?? const <_ReceiptHistoryItem>[];
                final notice = data?.notice;

                if (items.isEmpty) {
                  return Center(
                    child: Text(
                      notice ?? 'No receipts have been recorded yet.',
                      textAlign: TextAlign.center,
                    ),
                  );
                }

                return Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    if ((notice ?? '').isNotEmpty)
                      Container(
                        width: double.infinity,
                        padding: const EdgeInsets.all(14),
                        margin: const EdgeInsets.only(bottom: 12),
                        decoration: BoxDecoration(
                          color: const Color(0xFFEFF5FF),
                          borderRadius: BorderRadius.circular(16),
                          border: Border.all(color: const Color(0xFFCEE0FF)),
                        ),
                        child: Text(
                          notice!,
                          style: const TextStyle(color: Color(0xFF274472)),
                        ),
                      ),
                    Expanded(
                      child: ListView.separated(
                        itemCount: items.length,
                        separatorBuilder: (context, index) =>
                            const SizedBox(height: 10),
                        itemBuilder: (context, index) {
                          final item = items[index];
                          return _ReceiptHistoryCard(
                            item: item,
                            onTap: () => _openReceipt(item),
                          );
                        },
                      ),
                    ),
                  ],
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}

class _ReceiptPanelData {
  const _ReceiptPanelData({
    required this.items,
    required this.usingBackOffice,
    this.notice,
  });

  final List<_ReceiptHistoryItem> items;
  final bool usingBackOffice;
  final String? notice;
}

class _ReceiptHistoryItem {
  const _ReceiptHistoryItem({
    required this.summary,
    required this.statusLabel,
    required this.sourceLabel,
    this.detail,
  });

  final ReceiptSummary summary;
  final String statusLabel;
  final String sourceLabel;
  final String? detail;

  factory _ReceiptHistoryItem.fromBackOffice(
    BackOfficePosTransaction transaction,
  ) {
    return _ReceiptHistoryItem(
      summary: ReceiptSummary(
        transactionId: transaction.id,
        referenceNumber: transaction.refNumber,
        orLabel: 'OR ${transaction.orNumber}',
        orNumber: transaction.orNumber,
        totalMinor: (transaction.total * 100).round(),
        discountMinor: (transaction.discountAmount * 100).round(),
        vatMinor: (transaction.vatAmount * 100).round(),
        changeMinor: (transaction.changeAmount * 100).round(),
        tenderedMinor: ((transaction.total + transaction.changeAmount) * 100)
            .round(),
        paymentMethod: _paymentLabel(transaction.paymentMethod),
        items: const [],
        createdAt: transaction.createdAt,
      ),
      statusLabel: _statusLabel(transaction.status),
      sourceLabel: 'Back Office',
      detail: transaction.terminalName?.trim().isNotEmpty == true
          ? transaction.terminalName
          : null,
    );
  }

  static _ReceiptHistoryItem? fromQueueEntry(
    SyncQueueEntry entry, {
    required String branchId,
    required String terminalId,
    required SyncService syncService,
  }) {
    Map<String, dynamic> payload;
    try {
      payload = jsonDecode(entry.payload) as Map<String, dynamic>;
    } catch (_) {
      return null;
    }

    final payloadBranchId =
        payload['branch_id']?.toString() ?? payload['branchId']?.toString();
    final payloadTerminalId =
        payload['terminal_id']?.toString() ?? payload['terminalId']?.toString();
    if (payloadBranchId != branchId || payloadTerminalId != terminalId) {
      return null;
    }

    final totalMinor =
        (payload['total_minor'] as num?)?.toInt() ??
        _amountMajorToMinor(payload['total']);
    final discountMinor =
        (payload['discount_amount_minor'] as num?)?.toInt() ??
        _amountMajorToMinor(payload['discount_amount']);
    final changeMinor = _queuedChangeMinor(payload, totalMinor);
    final createdAt =
        DateTime.tryParse(payload['created_at']?.toString() ?? '') ??
        entry.localCreatedAt;
    final errorMessage = syncService.outboxErrorMessage(entry.error).trim();
    final nextRetryAt = syncService.outboxNextRetryAt(entry.error);

    return _ReceiptHistoryItem(
      summary: ReceiptSummary(
        transactionId:
            payload['id']?.toString() ??
            payload['transaction_id']?.toString() ??
            entry.recordId,
        referenceNumber:
            payload['reference_number']?.toString() ??
            payload['referenceNumber']?.toString() ??
            entry.recordId,
        orLabel: _queuedOrLabel(payload),
        orNumber: (payload['or_number'] as num?)?.toInt(),
        totalMinor: totalMinor,
        discountMinor: discountMinor,
        vatMinor:
            (payload['vat_minor'] as num?)?.toInt() ??
            ((totalMinor * 12) / 112).round(),
        changeMinor: changeMinor,
        tenderedMinor: totalMinor + changeMinor,
        paymentMethod: _paymentLabel(_queuedPaymentMethod(payload)),
        items: _queuedReceiptItems(payload),
        createdAt: createdAt,
      ),
      statusLabel: errorMessage.isEmpty
          ? 'Pending Sync'
          : nextRetryAt != null && nextRetryAt.isAfter(DateTime.now().toUtc())
          ? 'Retry Pending'
          : 'Sync Failed',
      sourceLabel: 'Local Queue',
      detail: errorMessage.isNotEmpty
          ? errorMessage
          : 'Waiting to sync to back office.',
    );
  }

  static int _queuedChangeMinor(Map<String, dynamic> payload, int totalMinor) {
    final payments = payload['payments'];
    if (payments is List && payments.isNotEmpty) {
      var totalPaidMinor = 0;
      for (final payment in payments) {
        if (payment is! Map<String, dynamic>) {
          continue;
        }
        totalPaidMinor +=
            (payment['amount_minor'] as num?)?.toInt() ??
            (payment['amountMinor'] as num?)?.toInt() ??
            _amountMajorToMinor(payment['amount']);
      }
      final change = totalPaidMinor - totalMinor;
      return change > 0 ? change : 0;
    }
    return 0;
  }

  static int _amountMajorToMinor(Object? value) {
    final major = (value as num?)?.toDouble();
    if (major == null) {
      return 0;
    }
    return (major * 100).round();
  }

  static String _queuedOrLabel(Map<String, dynamic> payload) {
    final label =
        payload['or_label']?.toString() ?? payload['orLabel']?.toString();
    if (label != null && label.trim().isNotEmpty) {
      return label.trim();
    }
    final orNumber = (payload['or_number'] as num?)?.toInt();
    if (orNumber != null) {
      return 'OR $orNumber';
    }
    return 'PROVISIONAL OR';
  }

  static String _queuedPaymentMethod(Map<String, dynamic> payload) {
    final direct =
        payload['payment_method']?.toString() ??
        payload['paymentMethod']?.toString();
    if (direct != null && direct.trim().isNotEmpty) {
      return direct.trim();
    }
    final payments = payload['payments'];
    if (payments is List && payments.isNotEmpty) {
      final first = payments.first;
      if (first is Map<String, dynamic>) {
        return first['method']?.toString() ?? 'CASH';
      }
    }
    return 'CASH';
  }

  static List<ReceiptItemLine> _queuedReceiptItems(
    Map<String, dynamic> payload,
  ) {
    final rawItems = payload['items'];
    if (rawItems is! List) {
      return const [];
    }

    return rawItems
        .whereType<Map<String, dynamic>>()
        .map(
          (item) => ReceiptItemLine(
            name: item['name']?.toString() ?? 'Item',
            sku:
                item['sku']?.toString() ??
                item['item_sku']?.toString() ??
                item['itemSku']?.toString() ??
                '',
            quantity:
                (item['qty'] as num?)?.toInt() ??
                (item['quantity'] as num?)?.toInt() ??
                1,
            unitPriceMinor:
                (item['unit_price_minor'] as num?)?.toInt() ??
                (item['unitPriceMinor'] as num?)?.toInt() ??
                _amountMajorToMinor(item['unit_price'] ?? item['unitPrice']),
          ),
        )
        .toList(growable: false);
  }

  static String _paymentLabel(String method) {
    return switch (method.trim().toUpperCase()) {
      'GCASH' => 'GCash',
      'MAYA' => 'Maya',
      'CARD' => 'Card',
      'SPLIT' => 'Split',
      _ => 'Cash',
    };
  }

  static String _statusLabel(String status) {
    return switch (status.trim().toUpperCase()) {
      'VOID' => 'Voided',
      'REFUNDED' => 'Refunded',
      'RETURNED' => 'Returned',
      _ => 'Completed',
    };
  }
}

class _ReceiptHistoryCard extends StatelessWidget {
  const _ReceiptHistoryCard({required this.item, required this.onTap});

  final _ReceiptHistoryItem item;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final issuedAt = item.summary.createdAt
        .toLocal()
        .toString()
        .split('.')
        .first;
    return Material(
      color: Colors.white,
      borderRadius: BorderRadius.circular(18),
      child: InkWell(
        borderRadius: BorderRadius.circular(18),
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(18),
            border: Border.all(color: const Color(0xFFDCE5F1)),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          item.summary.orLabel,
                          style: const TextStyle(
                            fontSize: 16,
                            fontWeight: FontWeight.w700,
                            color: Color(0xFF14213D),
                          ),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          item.summary.referenceNumber,
                          style: const TextStyle(
                            color: Color(0xFF5C6F8F),
                            fontFamily: 'monospace',
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(width: 12),
                  Text(
                    formatMoney(item.summary.totalMinor),
                    style: const TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w700,
                      color: Color(0xFF14213D),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: [
                  _StatusBadge(
                    label: item.statusLabel,
                    background: const Color(0xFFEFF5FF),
                    foreground: const Color(0xFF2563EB),
                  ),
                  _StatusBadge(
                    label: item.sourceLabel,
                    background: const Color(0xFFF3F4F6),
                    foreground: const Color(0xFF4B5563),
                  ),
                  _StatusBadge(
                    label: item.summary.paymentMethod,
                    background: const Color(0xFFECFDF5),
                    foreground: const Color(0xFF047857),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              Text(
                issuedAt,
                style: const TextStyle(fontSize: 12, color: Color(0xFF8091AB)),
              ),
              if ((item.detail ?? '').isNotEmpty)
                Padding(
                  padding: const EdgeInsets.only(top: 4),
                  child: Text(
                    item.detail!,
                    style: const TextStyle(
                      fontSize: 12,
                      color: Color(0xFF5C6F8F),
                    ),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}

class _BackOfficePanel extends ConsumerStatefulWidget {
  const _BackOfficePanel({
    required this.parentContext,
    required this.branchId,
    required this.terminalId,
  });

  final BuildContext parentContext;
  final String branchId;
  final String terminalId;

  @override
  ConsumerState<_BackOfficePanel> createState() => _BackOfficePanelState();
}

class _BackOfficePanelState extends ConsumerState<_BackOfficePanel> {
  bool _syncing = false;
  String? _lastMessage;

  Future<void> _syncNow() async {
    if (_syncing) {
      return;
    }

    setState(() => _syncing = true);
    try {
      final result = await ref
          .read(syncServiceProvider)
          .runFullSync(
            branchId: widget.branchId,
            terminalId: widget.terminalId,
          );
      if (!mounted) {
        return;
      }
      setState(() => _lastMessage = result.message);
    } finally {
      if (mounted) {
        setState(() => _syncing = false);
      }
    }
  }

  Future<void> _openOutbox() async {
    Navigator.of(context).pop();
    await Future<void>.delayed(_surfaceCloseDelay);
    if (!widget.parentContext.mounted) {
      return;
    }
    await showSyncOutboxPanel(
      widget.parentContext,
      branchId: widget.branchId,
      terminalId: widget.terminalId,
    );
  }

  @override
  Widget build(BuildContext context) {
    final online = ref.watch(onlineStatusProvider).value;
    final pendingCount = ref.watch(pendingSyncCountProvider).value ?? 0;
    final catalogItems =
        ref.watch(catalogItemsProvider).value ?? const <CatalogItemModel>[];
    final branchCatalogCount = catalogItems
        .where((item) => item.branchId == widget.branchId)
        .length;
    final hasSession = ref.read(backOfficeClientProvider).hasAccessToken;
    final recentStream = ref
        .read(syncServiceProvider)
        .watchOutboxRecords(limit: 8);

    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 8, 20, 20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Monitor terminal sync, session state, and the local queue linked to back office.',
            style: TextStyle(color: Color(0xFF5C6F8F)),
          ),
          const SizedBox(height: 16),
          Wrap(
            spacing: 12,
            runSpacing: 12,
            children: [
              _MetricCard(
                label: 'Connection',
                value: online == null
                    ? 'Checking...'
                    : (online ? 'Online' : 'Offline'),
                icon: Icons.cloud_done_outlined,
                accent: online == false
                    ? const Color(0xFFEA580C)
                    : const Color(0xFF16A34A),
              ),
              _MetricCard(
                label: 'Back Office Session',
                value: hasSession ? 'Connected' : 'Login required',
                icon: Icons.account_tree_outlined,
                accent: hasSession
                    ? const Color(0xFF2563EB)
                    : const Color(0xFFDC2626),
              ),
              _MetricCard(
                label: 'Pending Queue',
                value: pendingCount.toString(),
                icon: Icons.pending_actions_outlined,
                accent: pendingCount == 0
                    ? const Color(0xFF16A34A)
                    : const Color(0xFFEA580C),
              ),
              _MetricCard(
                label: 'Catalog Items',
                value: branchCatalogCount.toString(),
                icon: Icons.inventory_2_outlined,
                accent: const Color(0xFF7C3AED),
              ),
            ],
          ),
          const SizedBox(height: 16),
          Row(
            children: [
              Expanded(
                child: FilledButton.icon(
                  onPressed: _syncing ? null : _syncNow,
                  icon: Icon(_syncing ? Icons.sync : Icons.sync_alt_rounded),
                  label: Text(_syncing ? 'Syncing...' : 'Sync Back Office'),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: _openOutbox,
                  icon: const Icon(Icons.list_alt_outlined),
                  label: const Text('Open Queue'),
                ),
              ),
            ],
          ),
          if ((_lastMessage ?? '').isNotEmpty) ...[
            const SizedBox(height: 14),
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: const Color(0xFFDCE5F1)),
              ),
              child: Text(
                _lastMessage!,
                style: const TextStyle(color: Color(0xFF274472)),
              ),
            ),
          ],
          const SizedBox(height: 18),
          const Text(
            'Recent Queue Activity',
            style: TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.w700,
              color: Color(0xFF14213D),
            ),
          ),
          const SizedBox(height: 10),
          Expanded(
            child: StreamBuilder<List<SyncQueueEntry>>(
              stream: recentStream,
              builder: (context, snapshot) {
                if (snapshot.connectionState == ConnectionState.waiting &&
                    !snapshot.hasData) {
                  return const Center(child: CircularProgressIndicator());
                }

                final entries = snapshot.data ?? const <SyncQueueEntry>[];
                if (entries.isEmpty) {
                  return const Center(
                    child: Text('The terminal queue is currently empty.'),
                  );
                }

                final syncService = ref.read(syncServiceProvider);
                return ListView.separated(
                  itemCount: entries.length,
                  separatorBuilder: (context, index) =>
                      const SizedBox(height: 10),
                  itemBuilder: (context, index) {
                    final entry = entries[index];
                    final status = _queueStatus(entry, syncService);
                    return Container(
                      padding: const EdgeInsets.all(14),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(color: const Color(0xFFDCE5F1)),
                      ),
                      child: Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Container(
                            width: 38,
                            height: 38,
                            decoration: BoxDecoration(
                              color: status.background,
                              borderRadius: BorderRadius.circular(12),
                            ),
                            child: Icon(
                              status.icon,
                              size: 20,
                              color: status.foreground,
                            ),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  '${entry.targetTable}  |  ${entry.operation}',
                                  style: const TextStyle(
                                    fontWeight: FontWeight.w700,
                                    color: Color(0xFF14213D),
                                  ),
                                ),
                                const SizedBox(height: 4),
                                Text(
                                  'Record ${entry.recordId}',
                                  style: const TextStyle(
                                    color: Color(0xFF5C6F8F),
                                  ),
                                ),
                                if ((status.detail ?? '').isNotEmpty)
                                  Padding(
                                    padding: const EdgeInsets.only(top: 4),
                                    child: Text(
                                      status.detail!,
                                      style: const TextStyle(
                                        fontSize: 12,
                                        color: Color(0xFF8091AB),
                                      ),
                                    ),
                                  ),
                              ],
                            ),
                          ),
                          const SizedBox(width: 12),
                          _StatusBadge(
                            label: status.label,
                            background: status.background,
                            foreground: status.foreground,
                          ),
                        ],
                      ),
                    );
                  },
                );
              },
            ),
          ),
        ],
      ),
    );
  }

  _QueueStatus _queueStatus(SyncQueueEntry entry, SyncService syncService) {
    if (entry.syncedAt != null) {
      return const _QueueStatus(
        label: 'Synced',
        foreground: Color(0xFF166534),
        background: Color(0xFFDCFCE7),
        icon: Icons.check_circle_outline,
      );
    }

    final errorMessage = syncService.outboxErrorMessage(entry.error);
    final nextRetryAt = syncService.outboxNextRetryAt(entry.error);
    if (errorMessage.trim().isNotEmpty) {
      final waitingRetry =
          nextRetryAt != null && nextRetryAt.isAfter(DateTime.now().toUtc());
      return _QueueStatus(
        label: waitingRetry ? 'Retry Pending' : 'Failed',
        foreground: waitingRetry
            ? const Color(0xFF9A3412)
            : const Color(0xFF991B1B),
        background: waitingRetry
            ? const Color(0xFFFFEDD5)
            : const Color(0xFFFEE2E2),
        icon: waitingRetry ? Icons.schedule : Icons.error_outline,
        detail: waitingRetry
            ? 'Retry scheduled for ${nextRetryAt.toLocal().toString().split('.').first}'
            : errorMessage,
      );
    }

    return const _QueueStatus(
      label: 'Pending',
      foreground: Color(0xFF92400E),
      background: Color(0xFFFEF3C7),
      icon: Icons.pending_outlined,
    );
  }
}

class _SupportPanel extends ConsumerWidget {
  const _SupportPanel({
    required this.parentContext,
    required this.branchId,
    required this.terminalId,
  });

  final BuildContext parentContext;
  final String branchId;
  final String terminalId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final flow = ref.watch(appFlowControllerProvider);
    final terminal = ref.watch(terminalInfoProvider);
    final online = ref.watch(onlineStatusProvider).value;
    final pendingCount = ref.watch(pendingSyncCountProvider).value ?? 0;
    final hasSession = ref.read(backOfficeClientProvider).hasAccessToken;

    Future<void> openBackOffice() async {
      Navigator.of(context).pop();
      await Future<void>.delayed(_surfaceCloseDelay);
      if (!parentContext.mounted) {
        return;
      }
      await showBackOfficePanel(
        parentContext,
        ref,
        branchId: branchId,
        terminalId: terminalId,
      );
    }

    Future<void> openSettings() async {
      Navigator.of(context).pop();
      await Future<void>.delayed(_surfaceCloseDelay);
      if (!parentContext.mounted) {
        return;
      }
      await showHardwareReadinessPanel(parentContext);
    }

    Future<void> openApps() async {
      Navigator.of(context).pop();
      await Future<void>.delayed(_surfaceCloseDelay);
      if (!parentContext.mounted) {
        return;
      }
      await showCustomerDisplayControls(parentContext);
    }

    return SingleChildScrollView(
      padding: const EdgeInsets.fromLTRB(20, 8, 20, 24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Terminal support details and quick actions for cashier-side troubleshooting.',
            style: TextStyle(color: Color(0xFF5C6F8F)),
          ),
          const SizedBox(height: 16),
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(18),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(18),
              border: Border.all(color: const Color(0xFFDCE5F1)),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _SupportLine(
                  label: 'Cashier',
                  value: flow.cashierName ?? flow.cashierCode ?? 'Cashier',
                ),
                _SupportLine(
                  label: 'Branch',
                  value: flow.branchName ?? branchId,
                ),
                _SupportLine(
                  label: 'Terminal',
                  value: flow.terminalName ?? terminal.name,
                ),
                _SupportLine(
                  label: 'Connection',
                  value: online == null
                      ? 'Checking...'
                      : (online ? 'Online' : 'Offline'),
                ),
                _SupportLine(
                  label: 'Back Office',
                  value: hasSession ? 'Connected' : 'Login required',
                ),
                _SupportLine(
                  label: 'Queued Records',
                  value: pendingCount.toString(),
                ),
                const _SupportLine(
                  label: 'App Version',
                  value: posAppVersionLabel,
                ),
              ],
            ),
          ),
          const SizedBox(height: 18),
          const Text(
            'Quick Actions',
            style: TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.w700,
              color: Color(0xFF14213D),
            ),
          ),
          const SizedBox(height: 10),
          _SupportActionTile(
            icon: Icons.account_tree_outlined,
            title: 'Open Back Office',
            subtitle: 'Check sync, queue, and session health.',
            onTap: openBackOffice,
          ),
          const SizedBox(height: 10),
          _SupportActionTile(
            icon: Icons.settings_outlined,
            title: 'Hardware Settings',
            subtitle: 'Review printer, drawer, and device readiness.',
            onTap: openSettings,
          ),
          const SizedBox(height: 10),
          _SupportActionTile(
            icon: Icons.apps_outlined,
            title: 'Customer Display',
            subtitle: 'Open external display controls and media sync.',
            onTap: openApps,
          ),
        ],
      ),
    );
  }
}

class _MetricCard extends StatelessWidget {
  const _MetricCard({
    required this.label,
    required this.value,
    required this.icon,
    required this.accent,
  });

  final String label;
  final String value;
  final IconData icon;
  final Color accent;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 160,
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: const Color(0xFFDCE5F1)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 38,
            height: 38,
            decoration: BoxDecoration(
              color: accent.withAlpha(31),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Icon(icon, color: accent),
          ),
          const SizedBox(height: 12),
          Text(
            value,
            style: const TextStyle(
              fontSize: 18,
              fontWeight: FontWeight.w700,
              color: Color(0xFF14213D),
            ),
          ),
          const SizedBox(height: 4),
          Text(label, style: const TextStyle(color: Color(0xFF5C6F8F))),
        ],
      ),
    );
  }
}

class _StatusBadge extends StatelessWidget {
  const _StatusBadge({
    required this.label,
    required this.background,
    required this.foreground,
  });

  final String label;
  final Color background;
  final Color foreground;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: background,
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        label,
        style: TextStyle(
          color: foreground,
          fontSize: 12,
          fontWeight: FontWeight.w700,
        ),
      ),
    );
  }
}

class _SupportLine extends StatelessWidget {
  const _SupportLine({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Row(
        children: [
          SizedBox(
            width: 108,
            child: Text(
              label,
              style: const TextStyle(
                color: Color(0xFF5C6F8F),
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
          Expanded(
            child: Text(
              value,
              style: const TextStyle(
                color: Color(0xFF14213D),
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _SupportActionTile extends StatelessWidget {
  const _SupportActionTile({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.onTap,
  });

  final IconData icon;
  final String title;
  final String subtitle;
  final Future<void> Function() onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.white,
      borderRadius: BorderRadius.circular(18),
      child: InkWell(
        borderRadius: BorderRadius.circular(18),
        onTap: () => unawaited(onTap()),
        child: Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(18),
            border: Border.all(color: const Color(0xFFDCE5F1)),
          ),
          child: Row(
            children: [
              Container(
                width: 42,
                height: 42,
                decoration: BoxDecoration(
                  color: const Color(0xFFEFF5FF),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Icon(icon, color: const Color(0xFF2563EB)),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title,
                      style: const TextStyle(
                        fontWeight: FontWeight.w700,
                        color: Color(0xFF14213D),
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      subtitle,
                      style: const TextStyle(color: Color(0xFF5C6F8F)),
                    ),
                  ],
                ),
              ),
              const Icon(Icons.chevron_right, color: Color(0xFF8091AB)),
            ],
          ),
        ),
      ),
    );
  }
}

class _QueueStatus {
  const _QueueStatus({
    required this.label,
    required this.foreground,
    required this.background,
    required this.icon,
    this.detail,
  });

  final String label;
  final Color foreground;
  final Color background;
  final IconData icon;
  final String? detail;
}
