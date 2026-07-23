import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/database/app_database.dart';
import '../../core/models/money.dart';
import '../../core/providers/app_providers.dart';
import '../app_flow/app_flow_controller.dart';
import 'shift_close_flow.dart';

const Color _shiftAccent = Color(0xFF67A53D);
const Color _shiftBorder = Color(0xFFD7E6CF);
const Color _shiftSurface = Color(0xFFF7F9FC);
const Color _shiftText = Color(0xFF1D2A3A);
const Color _shiftMuted = Color(0xFF66768D);
const Duration _shiftSurfaceCloseDelay = Duration(milliseconds: 220);

Future<void> showShiftPanel(BuildContext context) {
  return showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    useSafeArea: true,
    backgroundColor: Colors.transparent,
    builder: (_) {
      return FractionallySizedBox(
        heightFactor: 0.94,
        child: _ShiftPanel(parentContext: context),
      );
    },
  );
}

class _ShiftPanel extends ConsumerStatefulWidget {
  const _ShiftPanel({required this.parentContext});

  final BuildContext parentContext;

  @override
  ConsumerState<_ShiftPanel> createState() => _ShiftPanelState();
}

class _ShiftPanelState extends ConsumerState<_ShiftPanel> {
  late Future<ShiftOverview?> _future;

  @override
  void initState() {
    super.initState();
    _future = _load();
  }

  Future<ShiftOverview?> _load() async {
    final flow = ref.read(appFlowControllerProvider);
    final shiftId = flow.shiftId;
    if (shiftId == null) {
      return null;
    }

    final terminal = ref.read(terminalInfoProvider);
    return loadShiftOverview(
      ref,
      shiftId: shiftId,
      branchId: flow.branchId ?? 'branch-manila',
      terminalId: flow.terminalId ?? terminal.id,
      cashierId: flow.cashierId ?? flow.cashierCode,
      cashierName: flow.cashierName ?? 'Cashier',
      fallbackOpeningCashMinor: flow.openingCashMinor ?? 0,
    );
  }

  Future<void> _refresh() async {
    setState(() => _future = _load());
  }

  Future<void> _recordCashMovement(ShiftOverview overview) async {
    final flow = ref.read(appFlowControllerProvider);
    final terminal = ref.read(terminalInfoProvider);
    final request = await _showCashManagementDialog(context);
    if (request == null) {
      return;
    }

    await ref
        .read(databaseProvider)
        .addShiftCashMovement(
          shiftId: overview.shiftId,
          branchId: flow.branchId ?? 'branch-manila',
          terminalId: flow.terminalId ?? terminal.id,
          terminalName: flow.terminalName ?? terminal.name,
          cashierId: flow.cashierId ?? flow.cashierCode,
          cashierName: flow.cashierName,
          type: request.type,
          amountMinor: request.amountMinor,
          note: request.note,
        );

    final syncResult = await ref
        .read(syncServiceProvider)
        .flushPending(
          branchId: flow.branchId ?? 'branch-manila',
          terminalId: flow.terminalId ?? terminal.id,
        );
    if (!mounted || !widget.parentContext.mounted) {
      return;
    }

    ScaffoldMessenger.of(widget.parentContext).showSnackBar(
      SnackBar(content: Text('Cash management saved. ${syncResult.message}')),
    );
    await _refresh();
  }

  Future<void> _closeShift() async {
    Navigator.of(context).pop();
    await Future<void>.delayed(_shiftSurfaceCloseDelay);
    if (!mounted || !widget.parentContext.mounted) {
      return;
    }
    await endCurrentShift(widget.parentContext, ref);
  }

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: const BoxDecoration(
        color: _shiftSurface,
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
                const Text(
                  'Shift',
                  style: TextStyle(
                    fontSize: 20,
                    fontWeight: FontWeight.w700,
                    color: _shiftText,
                  ),
                ),
                const Spacer(),
                IconButton(
                  onPressed: _refresh,
                  icon: const Icon(Icons.refresh_rounded),
                ),
                IconButton(
                  onPressed: () => Navigator.of(context).pop(),
                  icon: const Icon(Icons.close),
                ),
              ],
            ),
          ),
          const Divider(height: 1),
          Expanded(
            child: FutureBuilder<ShiftOverview?>(
              future: _future,
              builder: (context, snapshot) {
                if (snapshot.connectionState != ConnectionState.done) {
                  return const Center(child: CircularProgressIndicator());
                }
                if (snapshot.hasError) {
                  return Center(child: Text(snapshot.error.toString()));
                }

                final overview = snapshot.data;
                if (overview == null) {
                  return const Center(
                    child: Text('No active shift was found for this terminal.'),
                  );
                }

                return _ShiftPanelBody(
                  overview: overview,
                  onCashManagement: () => _recordCashMovement(overview),
                  onCloseShift: _closeShift,
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}

class _ShiftPanelBody extends StatelessWidget {
  const _ShiftPanelBody({
    required this.overview,
    required this.onCashManagement,
    required this.onCloseShift,
  });

  final ShiftOverview overview;
  final Future<void> Function() onCashManagement;
  final Future<void> Function() onCloseShift;

  @override
  Widget build(BuildContext context) {
    final openedAtLabel = overview.openedAt == null
        ? 'Not recorded'
        : overview.openedAt!.toString().split('.').first;

    return SingleChildScrollView(
      padding: const EdgeInsets.fromLTRB(20, 16, 20, 24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Wrap(
            spacing: 12,
            runSpacing: 12,
            children: [
              _ShiftActionButton(
                label: 'Cash Management',
                icon: Icons.payments_outlined,
                onPressed: onCashManagement,
              ),
              _ShiftActionButton(
                label: 'Close Shift',
                icon: Icons.lock_clock_outlined,
                onPressed: onCloseShift,
              ),
            ],
          ),
          const SizedBox(height: 16),
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(18),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(20),
              border: Border.all(color: _shiftBorder),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Wrap(
                  spacing: 10,
                  runSpacing: 10,
                  crossAxisAlignment: WrapCrossAlignment.center,
                  children: [
                    Text(
                      'Shift number: ${overview.shiftNumber}',
                      style: const TextStyle(
                        fontSize: 20,
                        fontWeight: FontWeight.w700,
                        color: _shiftText,
                      ),
                    ),
                    _ShiftBadge(
                      label: overview.usingBackOffice
                          ? 'Back Office Live'
                          : 'Local Totals',
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                Text(
                  'Shift opened: ${overview.cashierName}',
                  style: const TextStyle(fontSize: 16, color: _shiftText),
                ),
                const SizedBox(height: 6),
                Text(
                  openedAtLabel,
                  style: const TextStyle(fontSize: 14, color: _shiftMuted),
                ),
              ],
            ),
          ),
          if ((overview.notice ?? '').isNotEmpty) ...[
            const SizedBox(height: 14),
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: const Color(0xFFF3F8EE),
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: _shiftBorder),
              ),
              child: Text(
                overview.notice!,
                style: const TextStyle(color: _shiftMuted),
              ),
            ),
          ],
          const SizedBox(height: 16),
          _ShiftSectionCard(
            title: 'Cash drawer',
            child: Column(
              children: [
                _ShiftAmountRow(
                  label: 'Starting cash',
                  valueMinor: overview.openingCashMinor,
                ),
                _ShiftAmountRow(
                  label: 'Cash payments',
                  valueMinor: overview.cashPaymentsMinor,
                ),
                _ShiftAmountRow(
                  label: 'Cash refunds',
                  valueMinor: overview.cashRefundsMinor,
                  negative: true,
                ),
                _ShiftAmountRow(
                  label: 'Paid in',
                  valueMinor: overview.paidInMinor,
                ),
                _ShiftAmountRow(
                  label: 'Paid out',
                  valueMinor: overview.paidOutMinor,
                  negative: true,
                ),
                const Divider(height: 28),
                _ShiftAmountRow(
                  label: 'Expected cash amount',
                  valueMinor: overview.expectedCashMinor,
                  emphasis: true,
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),
          _ShiftSectionCard(
            title: 'Sales summary',
            child: Column(
              children: [
                _ShiftAmountRow(
                  label: 'Gross sales',
                  valueMinor: overview.grossSalesMinor,
                ),
                _ShiftAmountRow(
                  label: 'Refunds',
                  valueMinor: overview.refundsMinor,
                  negative: true,
                ),
                _ShiftAmountRow(
                  label: 'Discounts',
                  valueMinor: overview.discountMinor,
                  negative: true,
                ),
                const Divider(height: 28),
                _ShiftAmountRow(
                  label: 'Net sales',
                  valueMinor: overview.netSalesMinor,
                  emphasis: true,
                ),
                _ShiftAmountRow(
                  label: 'Cash',
                  valueMinor: overview.cashSalesMinor,
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),
          _ShiftSectionCard(
            title: 'Cash management history',
            child: overview.recentMovements.isEmpty
                ? const Padding(
                    padding: EdgeInsets.symmetric(vertical: 12),
                    child: Text(
                      'No paid in or paid out entries have been recorded for this shift yet.',
                      style: TextStyle(color: _shiftMuted),
                    ),
                  )
                : Column(
                    children: [
                      for (var index = 0;
                          index < overview.recentMovements.length;
                          index += 1) ...[
                        if (index > 0) const Divider(height: 22),
                        _ShiftMovementTile(
                          movement: overview.recentMovements[index],
                        ),
                      ],
                      if (overview.totalMovements > overview.recentMovements.length)
                        Padding(
                          padding: const EdgeInsets.only(top: 14),
                          child: Text(
                            '${overview.totalMovements} total cash-management record(s) in this shift.',
                            style: const TextStyle(
                              fontSize: 12,
                              color: _shiftMuted,
                            ),
                          ),
                        ),
                    ],
                  ),
          ),
        ],
      ),
    );
  }
}

class _ShiftActionButton extends StatelessWidget {
  const _ShiftActionButton({
    required this.label,
    required this.icon,
    required this.onPressed,
  });

  final String label;
  final IconData icon;
  final Future<void> Function() onPressed;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: 240,
      child: OutlinedButton.icon(
        onPressed: onPressed,
        icon: Icon(icon, color: _shiftAccent),
        label: Text(label),
        style: OutlinedButton.styleFrom(
          foregroundColor: _shiftAccent,
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 18),
          textStyle: const TextStyle(
            fontSize: 18,
            fontWeight: FontWeight.w700,
          ),
          side: const BorderSide(color: _shiftAccent),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(14),
          ),
          backgroundColor: Colors.white,
        ),
      ),
    );
  }
}

class _ShiftSectionCard extends StatelessWidget {
  const _ShiftSectionCard({required this.title, required this.child});

  final String title;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: _shiftBorder),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            title,
            style: const TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.w700,
              color: _shiftAccent,
            ),
          ),
          const SizedBox(height: 18),
          child,
        ],
      ),
    );
  }
}

class _ShiftAmountRow extends StatelessWidget {
  const _ShiftAmountRow({
    required this.label,
    required this.valueMinor,
    this.emphasis = false,
    this.negative = false,
  });

  final String label;
  final int valueMinor;
  final bool emphasis;
  final bool negative;

  @override
  Widget build(BuildContext context) {
    final prefix = negative && valueMinor > 0 ? '- ' : '';
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 9),
      child: Row(
        children: [
          Expanded(
            child: Text(
              label,
              style: TextStyle(
                fontSize: emphasis ? 18 : 16,
                fontWeight: emphasis ? FontWeight.w700 : FontWeight.w500,
                color: _shiftText,
              ),
            ),
          ),
          const SizedBox(width: 12),
          Text(
            '$prefix${formatMoney(valueMinor)}',
            style: TextStyle(
              fontSize: emphasis ? 20 : 16,
              fontWeight: emphasis ? FontWeight.w700 : FontWeight.w600,
              color: _shiftText,
            ),
          ),
        ],
      ),
    );
  }
}

class _ShiftMovementTile extends StatelessWidget {
  const _ShiftMovementTile({required this.movement});

  final ShiftCashMovementRecord movement;

  @override
  Widget build(BuildContext context) {
    final isPaidOut = movement.type == ShiftCashMovementType.paidOut;
    final labelColor = isPaidOut ? const Color(0xFFB45309) : _shiftAccent;

    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          width: 40,
          height: 40,
          decoration: BoxDecoration(
            color: labelColor.withAlpha(24),
            borderRadius: BorderRadius.circular(12),
          ),
          child: Icon(
            isPaidOut ? Icons.arrow_upward_rounded : Icons.arrow_downward_rounded,
            color: labelColor,
          ),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                movement.type.label,
                style: const TextStyle(
                  fontWeight: FontWeight.w700,
                  color: _shiftText,
                ),
              ),
              const SizedBox(height: 4),
              Text(
                movement.note?.trim().isNotEmpty == true
                    ? movement.note!
                    : 'No note provided.',
                style: const TextStyle(color: _shiftMuted),
              ),
              const SizedBox(height: 4),
              Text(
                movement.createdAt.toString().split('.').first,
                style: const TextStyle(fontSize: 12, color: _shiftMuted),
              ),
            ],
          ),
        ),
        const SizedBox(width: 12),
        Text(
          '${isPaidOut ? '- ' : ''}${formatMoney(movement.amountMinor)}',
          style: const TextStyle(
            fontWeight: FontWeight.w700,
            color: _shiftText,
          ),
        ),
      ],
    );
  }
}

class _ShiftBadge extends StatelessWidget {
  const _ShiftBadge({required this.label});

  final String label;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: _shiftAccent.withAlpha(24),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        label,
        style: const TextStyle(
          color: _shiftAccent,
          fontSize: 12,
          fontWeight: FontWeight.w700,
        ),
      ),
    );
  }
}

class _CashManagementRequest {
  const _CashManagementRequest({
    required this.type,
    required this.amountMinor,
    this.note,
  });

  final ShiftCashMovementType type;
  final int amountMinor;
  final String? note;
}

Future<_CashManagementRequest?> _showCashManagementDialog(
  BuildContext context,
) async {
  final amountController = TextEditingController();
  final noteController = TextEditingController();
  var selectedType = ShiftCashMovementType.paidIn;
  String? validationMessage;

  final result = await showDialog<_CashManagementRequest>(
    context: context,
    builder: (dialogContext) {
      return StatefulBuilder(
        builder: (context, setState) {
          return AlertDialog(
            scrollable: true,
            title: const Text('Cash Management'),
            content: SizedBox(
              width: 420,
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Wrap(
                    spacing: 10,
                    runSpacing: 10,
                    children: [
                      ChoiceChip(
                        label: const Text('Paid In'),
                        selected: selectedType == ShiftCashMovementType.paidIn,
                        onSelected: (_) {
                          setState(() {
                            selectedType = ShiftCashMovementType.paidIn;
                            validationMessage = null;
                          });
                        },
                      ),
                      ChoiceChip(
                        label: const Text('Paid Out'),
                        selected: selectedType == ShiftCashMovementType.paidOut,
                        onSelected: (_) {
                          setState(() {
                            selectedType = ShiftCashMovementType.paidOut;
                            validationMessage = null;
                          });
                        },
                      ),
                    ],
                  ),
                  const SizedBox(height: 14),
                  TextField(
                    controller: amountController,
                    keyboardType: const TextInputType.numberWithOptions(
                      decimal: true,
                    ),
                    decoration: const InputDecoration(
                      labelText: 'Amount',
                      prefixText: 'PHP ',
                      border: OutlineInputBorder(),
                    ),
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: noteController,
                    maxLines: 2,
                    decoration: const InputDecoration(
                      labelText: 'Note / reason',
                      border: OutlineInputBorder(),
                    ),
                  ),
                  if ((validationMessage ?? '').isNotEmpty) ...[
                    const SizedBox(height: 10),
                    Text(
                      validationMessage!,
                      style: const TextStyle(color: Color(0xFFB42318)),
                    ),
                  ],
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
                  final amountMinor = moneyFromText(amountController.text);
                  if (amountMinor <= 0) {
                    setState(() {
                      validationMessage =
                          'Enter an amount greater than zero.';
                    });
                    return;
                  }

                  Navigator.of(dialogContext).pop(
                    _CashManagementRequest(
                      type: selectedType,
                      amountMinor: amountMinor,
                      note: noteController.text.trim().isEmpty
                          ? null
                          : noteController.text.trim(),
                    ),
                  );
                },
                child: const Text('Save'),
              ),
            ],
          );
        },
      );
    },
  );

  amountController.dispose();
  noteController.dispose();
  return result;
}
