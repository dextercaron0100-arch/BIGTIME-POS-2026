import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../core/models/money.dart';
import '../../core/providers/app_providers.dart';
import '../app_flow/app_flow_controller.dart';

class _ShiftColors {
  static const androidBgStart = Color(0xFF0B0F13);
  static const androidBgEnd = Color(0xFF141A22);
  static const androidPanel = Color(0x59000000);
  static const androidPanelSoft = Color(0x0DFFFFFF);
  static const androidPanelBorder = Color(0x26FFFFFF);
  static const androidText = Color(0xFFF8FAFC);
  static const androidTextMuted = Color(0xFF94A3B8);
  static const androidPillBg = Color(0x3310B981);
  static const androidPillBorder = Color(0x6658D0A9);
  static const androidPillText = Color(0xFFD1FAE5);
  static const androidPrimaryStart = Color(0xE716A34A);
  static const androidPrimaryEnd = Color(0xE715803D);
}

class OpenShiftScreen extends ConsumerStatefulWidget {
  const OpenShiftScreen({super.key});

  @override
  ConsumerState<OpenShiftScreen> createState() => _OpenShiftScreenState();
}

class _OpenShiftScreenState extends ConsumerState<OpenShiftScreen> {
  final _openingCashController = TextEditingController(text: '1000.00');
  late final DateTime _draftOpenedAt;

  @override
  void initState() {
    super.initState();
    _draftOpenedAt = DateTime.now();
  }

  @override
  void dispose() {
    _openingCashController.dispose();
    super.dispose();
  }

  Future<void> _openShift() async {
    final flowState = ref.read(appFlowControllerProvider);
    final openingCashMinor = moneyFromText(_openingCashController.text);
    final terminal = ref.read(terminalInfoProvider);

    final shiftId = await ref.read(databaseProvider).openShiftSession(
          branchId: flowState.branchId ?? 'branch-manila',
          cashierName: flowState.cashierName ?? 'Cashier',
          openingCashMinor: openingCashMinor,
        );
    await ref.read(databaseProvider).enqueueTransaction(
          tableName: 'shift_sessions',
          recordId: shiftId,
          operation: 'INSERT',
          payload: {
            'id': shiftId,
            'branch_id': flowState.branchId,
            'terminal_id': flowState.terminalId ?? terminal.id,
            'terminal_name': flowState.terminalName ?? terminal.name,
            'cashier_id': flowState.cashierId,
            'cashier_name': flowState.cashierName,
            'opening_cash_minor': openingCashMinor,
          },
        );
    final syncResult = await ref.read(syncServiceProvider).flushPending(
          branchId: flowState.branchId ?? 'branch-manila',
          terminalId: flowState.terminalId ?? terminal.id,
        );

    ref.read(appFlowControllerProvider.notifier).startSelling(
          shiftId: shiftId,
          openingCashMinor: openingCashMinor,
        );

    if (mounted && syncResult.syncedCount > 0) {
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(syncResult.message)));
    }
  }

  @override
  Widget build(BuildContext context) {
    final isAndroid = Platform.isAndroid;
    final flowState = ref.watch(appFlowControllerProvider);
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;
    final keyboardInset = MediaQuery.of(context).viewInsets.bottom;
    final cashierName = flowState.cashierName ?? 'Cashier';
    final branchName = flowState.branchName ?? 'Main Branch';
    final shiftDateLabel = DateFormat('EEE, d MMM').format(_draftOpenedAt);
    final shiftTimeLabel = DateFormat('h:mm a').format(_draftOpenedAt);

    return Scaffold(
      resizeToAvoidBottomInset: false,
      backgroundColor: isAndroid ? _ShiftColors.androidBgStart : null,
      body: DecoratedBox(
        decoration: BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: isAndroid
                ? const [
                    _ShiftColors.androidBgStart,
                    _ShiftColors.androidBgEnd,
                  ]
                : [
                    theme.scaffoldBackgroundColor,
                    theme.scaffoldBackgroundColor,
                  ],
          ),
        ),
        child: SafeArea(
          child: SingleChildScrollView(
            keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
            padding: EdgeInsets.fromLTRB(24, 24, 24, 24 + keyboardInset),
            child: Center(
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 620),
                child: DecoratedBox(
                  decoration: BoxDecoration(
                    color: isAndroid ? _ShiftColors.androidPanel : Colors.white,
                    borderRadius: BorderRadius.circular(32),
                    border: Border.all(
                      color: isAndroid
                          ? _ShiftColors.androidPanelBorder
                          : Colors.black.withValues(alpha: 0.08),
                    ),
                    boxShadow: isAndroid
                        ? const [
                            BoxShadow(
                              color: Color(0x66000000),
                              blurRadius: 28,
                              offset: Offset(0, 16),
                            ),
                          ]
                        : const [
                            BoxShadow(
                              color: Color(0x12000000),
                              blurRadius: 20,
                              offset: Offset(0, 10),
                            ),
                          ],
                  ),
                  child: Padding(
                    padding: const EdgeInsets.all(32),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Container(
                              width: 72,
                              height: 72,
                              decoration: BoxDecoration(
                                shape: BoxShape.circle,
                                color: isAndroid
                                    ? Colors.white.withValues(alpha: 0.08)
                                    : colorScheme.primary.withValues(alpha: 0.16),
                                border: isAndroid
                                    ? Border.all(
                                        color: _ShiftColors.androidPanelBorder,
                                      )
                                    : null,
                              ),
                              alignment: Alignment.center,
                              child: Text(
                                _cashierInitials(cashierName),
                                style: theme.textTheme.headlineSmall?.copyWith(
                                  color: isAndroid
                                      ? _ShiftColors.androidText
                                      : colorScheme.primary,
                                  fontWeight: FontWeight.w500,
                                ),
                              ),
                            ),
                            const SizedBox(width: 16),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    'Open shift',
                                    style: theme.textTheme.headlineSmall?.copyWith(
                                      fontWeight: FontWeight.w400,
                                      color: isAndroid
                                          ? _ShiftColors.androidText
                                          : null,
                                    ),
                                  ),
                                  const SizedBox(height: 4),
                                  Text(
                                    '$cashierName - $branchName',
                                    style: theme.textTheme.titleLarge?.copyWith(
                                      color: isAndroid
                                          ? _ShiftColors.androidTextMuted
                                          : Colors.black.withValues(alpha: 0.72),
                                    ),
                                  ),
                                ],
                              ),
                            ),
                            const SizedBox(width: 16),
                            Container(
                              padding: const EdgeInsets.symmetric(
                                horizontal: 20,
                                vertical: 12,
                              ),
                              decoration: BoxDecoration(
                                color: isAndroid
                                    ? _ShiftColors.androidPillBg
                                    : const Color(0xFFE3EBCF),
                                borderRadius: BorderRadius.circular(18),
                                border: isAndroid
                                    ? Border.all(
                                        color: _ShiftColors.androidPillBorder,
                                      )
                                    : null,
                              ),
                              child: Text(
                                'Ready',
                                style: theme.textTheme.titleMedium?.copyWith(
                                  color: isAndroid
                                      ? _ShiftColors.androidPillText
                                      : const Color(0xFF2F6B2C),
                                  fontWeight: FontWeight.w500,
                                ),
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 24),
                        Divider(
                          color: isAndroid
                              ? _ShiftColors.androidPanelBorder
                              : Colors.black.withValues(alpha: 0.12),
                        ),
                        const SizedBox(height: 24),
                        Text(
                          'Opening cash float',
                          style: theme.textTheme.titleLarge?.copyWith(
                            color: isAndroid
                                ? _ShiftColors.androidText
                                : Colors.black.withValues(alpha: 0.72),
                          ),
                        ),
                        const SizedBox(height: 16),
                        TextField(
                          controller: _openingCashController,
                          keyboardType: const TextInputType.numberWithOptions(
                            decimal: true,
                          ),
                          style: theme.textTheme.headlineMedium?.copyWith(
                            fontWeight: FontWeight.w500,
                            color: isAndroid ? _ShiftColors.androidText : null,
                          ),
                          decoration: InputDecoration(
                            prefixText: 'PHP ',
                            prefixStyle: theme.textTheme.titleLarge?.copyWith(
                              fontWeight: FontWeight.w600,
                              color: isAndroid
                                  ? _ShiftColors.androidText
                                  : Colors.black.withValues(alpha: 0.72),
                            ),
                            hintText: '0.00',
                            hintStyle: theme.textTheme.headlineMedium?.copyWith(
                              color: isAndroid
                                  ? _ShiftColors.androidTextMuted
                                  : null,
                            ),
                            filled: true,
                            fillColor: isAndroid
                                ? _ShiftColors.androidPanelSoft
                                : const Color(0xFFF6F4EC),
                            contentPadding: const EdgeInsets.symmetric(
                              horizontal: 24,
                              vertical: 24,
                            ),
                            border: OutlineInputBorder(
                              borderRadius: BorderRadius.circular(18),
                              borderSide: BorderSide(
                                color: isAndroid
                                    ? _ShiftColors.androidPanelBorder
                                    : Colors.black.withValues(alpha: 0.18),
                                width: 1.6,
                              ),
                            ),
                            enabledBorder: OutlineInputBorder(
                              borderRadius: BorderRadius.circular(18),
                              borderSide: BorderSide(
                                color: isAndroid
                                    ? _ShiftColors.androidPanelBorder
                                    : Colors.black.withValues(alpha: 0.18),
                                width: 1.6,
                              ),
                            ),
                            focusedBorder: OutlineInputBorder(
                              borderRadius: BorderRadius.circular(18),
                              borderSide: BorderSide(
                                color: isAndroid
                                    ? const Color(0x6658D0A9)
                                    : colorScheme.primary,
                                width: 2,
                              ),
                            ),
                          ),
                        ),
                        const SizedBox(height: 16),
                        Text(
                          'Saved locally and synced after transaction activity.',
                          style: theme.textTheme.bodyLarge?.copyWith(
                            color: isAndroid
                                ? _ShiftColors.androidTextMuted
                                : Colors.black.withValues(alpha: 0.56),
                          ),
                        ),
                        const SizedBox(height: 24),
                        LayoutBuilder(
                          builder: (context, constraints) {
                            final details = [
                              _ShiftMetaCard(
                                label: 'Shift date',
                                value: shiftDateLabel,
                                isAndroid: isAndroid,
                              ),
                              _ShiftMetaCard(
                                label: 'Start time',
                                value: shiftTimeLabel,
                                isAndroid: isAndroid,
                              ),
                            ];

                            if (constraints.maxWidth < 520) {
                              return Column(
                                children: [
                                  for (final item in details) ...[
                                    item,
                                    if (item != details.last)
                                      const SizedBox(height: 12),
                                  ],
                                ],
                              );
                            }

                            return Row(
                              children: [
                                Expanded(child: details[0]),
                                const SizedBox(width: 16),
                                Expanded(child: details[1]),
                              ],
                            );
                          },
                        ),
                        const SizedBox(height: 28),
                        _StartSellingButton(
                          isAndroid: isAndroid,
                          labelStyle: theme.textTheme.headlineSmall?.copyWith(
                            fontWeight: FontWeight.w600,
                          ),
                          onPressed: _openShift,
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

String _cashierInitials(String cashierName) {
  final parts = cashierName
      .split(RegExp(r'\s+'))
      .where((part) => part.isNotEmpty)
      .toList();
  if (parts.isEmpty) {
    return 'DX';
  }
  if (parts.length == 1) {
    final initialLength = parts.first.length >= 2 ? 2 : 1;
    return parts.first.substring(0, initialLength).toUpperCase();
  }
  return (parts.first[0] + parts.last[0]).toUpperCase();
}

class _ShiftMetaCard extends StatelessWidget {
  const _ShiftMetaCard({
    required this.label,
    required this.value,
    required this.isAndroid,
  });

  final String label;
  final String value;
  final bool isAndroid;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: isAndroid
            ? _ShiftColors.androidPanelSoft
            : const Color(0xFFF6F4EC),
        borderRadius: BorderRadius.circular(18),
        border: isAndroid
            ? Border.all(color: _ShiftColors.androidPanelBorder)
            : null,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label,
            style: theme.textTheme.titleMedium?.copyWith(
              color: isAndroid
                  ? _ShiftColors.androidTextMuted
                  : Colors.black.withValues(alpha: 0.64),
            ),
          ),
          const SizedBox(height: 8),
          Text(
            value,
            style: theme.textTheme.headlineSmall?.copyWith(
              color: isAndroid ? _ShiftColors.androidText : null,
              fontWeight: FontWeight.w500,
            ),
          ),
        ],
      ),
    );
  }
}

class _StartSellingButton extends StatelessWidget {
  const _StartSellingButton({
    required this.isAndroid,
    required this.labelStyle,
    required this.onPressed,
  });

  final bool isAndroid;
  final TextStyle? labelStyle;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    if (!isAndroid) {
      final colorScheme = Theme.of(context).colorScheme;
      return SizedBox(
        width: double.infinity,
        child: FilledButton(
          onPressed: onPressed,
          style: FilledButton.styleFrom(
            backgroundColor: colorScheme.primary,
            foregroundColor: colorScheme.onPrimary,
            padding: const EdgeInsets.symmetric(vertical: 24),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(18),
            ),
            textStyle: labelStyle,
          ),
          child: const Text('Start selling'),
        ),
      );
    }

    final borderRadius = BorderRadius.circular(18);
    return SizedBox(
      width: double.infinity,
      child: DecoratedBox(
        decoration: BoxDecoration(
          borderRadius: borderRadius,
          gradient: const LinearGradient(
            colors: [
              _ShiftColors.androidPrimaryStart,
              _ShiftColors.androidPrimaryEnd,
            ],
          ),
          boxShadow: const [
            BoxShadow(
              color: Color(0x3316A34A),
              blurRadius: 18,
              offset: Offset(0, 10),
            ),
          ],
        ),
        child: Material(
          color: Colors.transparent,
          child: InkWell(
            borderRadius: borderRadius,
            onTap: onPressed,
            child: Padding(
              padding: const EdgeInsets.symmetric(vertical: 24),
              child: Center(
                child: Text(
                  'Start selling',
                  style: labelStyle?.copyWith(
                    color: Colors.white,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
