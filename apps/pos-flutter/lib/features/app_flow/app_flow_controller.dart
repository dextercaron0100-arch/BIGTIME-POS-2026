import 'package:flutter_riverpod/flutter_riverpod.dart';

enum AppStage { login, openShift, selling, payment, receipt }

const bool _qaForceSelling = bool.fromEnvironment(
  'QA_FORCE_SELLING',
  defaultValue: false,
);

class ReceiptItemLine {
  const ReceiptItemLine({
    required this.name,
    required this.sku,
    required this.quantity,
    required this.unitPriceMinor,
    this.unit,
    this.vatType,
  });

  final String name;
  final String sku;
  final int quantity;
  final int unitPriceMinor;
  final String? unit;
  final String? vatType;

  int get lineTotalMinor => unitPriceMinor * quantity;

  ReceiptItemLine copyWith({
    String? name,
    String? sku,
    int? quantity,
    int? unitPriceMinor,
    String? unit,
    String? vatType,
  }) {
    return ReceiptItemLine(
      name: name ?? this.name,
      sku: sku ?? this.sku,
      quantity: quantity ?? this.quantity,
      unitPriceMinor: unitPriceMinor ?? this.unitPriceMinor,
      unit: unit ?? this.unit,
      vatType: vatType ?? this.vatType,
    );
  }
}

class ReceiptSummary {
  const ReceiptSummary({
    required this.transactionId,
    required this.referenceNumber,
    required this.orLabel,
    this.orNumber,
    this.customerName,
    this.customerTin,
    this.customerAddress,
    this.customerBusinessStyle,
    required this.totalMinor,
    required this.discountMinor,
    this.discountLabel,
    this.scPwdIdNumber,
    this.scPwdTin,
    required this.vatMinor,
    required this.changeMinor,
    required this.tenderedMinor,
    required this.paymentMethod,
    required this.items,
    required this.createdAt,
    this.autoPrintPending = false,
  });

  final String transactionId;
  final String referenceNumber;
  final String orLabel;
  final int? orNumber;
  final String? customerName;
  final String? customerTin;
  final String? customerAddress;
  final String? customerBusinessStyle;
  final int totalMinor;
  final int discountMinor;
  final String? discountLabel;
  final String? scPwdIdNumber;
  final String? scPwdTin;
  final int vatMinor;
  final int changeMinor;
  final int tenderedMinor;
  final String paymentMethod;
  final List<ReceiptItemLine> items;
  final DateTime createdAt;
  final bool autoPrintPending;

  ReceiptSummary copyWith({
    String? transactionId,
    String? referenceNumber,
    String? orLabel,
    int? orNumber,
    String? customerName,
    String? customerTin,
    String? customerAddress,
    String? customerBusinessStyle,
    int? totalMinor,
    int? discountMinor,
    String? discountLabel,
    String? scPwdIdNumber,
    String? scPwdTin,
    int? vatMinor,
    int? changeMinor,
    int? tenderedMinor,
    String? paymentMethod,
    List<ReceiptItemLine>? items,
    DateTime? createdAt,
    bool? autoPrintPending,
  }) {
    return ReceiptSummary(
      transactionId: transactionId ?? this.transactionId,
      referenceNumber: referenceNumber ?? this.referenceNumber,
      orLabel: orLabel ?? this.orLabel,
      orNumber: orNumber ?? this.orNumber,
      customerName: customerName ?? this.customerName,
      customerTin: customerTin ?? this.customerTin,
      customerAddress: customerAddress ?? this.customerAddress,
      customerBusinessStyle:
          customerBusinessStyle ?? this.customerBusinessStyle,
      totalMinor: totalMinor ?? this.totalMinor,
      discountMinor: discountMinor ?? this.discountMinor,
      discountLabel: discountLabel ?? this.discountLabel,
      scPwdIdNumber: scPwdIdNumber ?? this.scPwdIdNumber,
      scPwdTin: scPwdTin ?? this.scPwdTin,
      vatMinor: vatMinor ?? this.vatMinor,
      changeMinor: changeMinor ?? this.changeMinor,
      tenderedMinor: tenderedMinor ?? this.tenderedMinor,
      paymentMethod: paymentMethod ?? this.paymentMethod,
      items: items ?? this.items,
      createdAt: createdAt ?? this.createdAt,
      autoPrintPending: autoPrintPending ?? this.autoPrintPending,
    );
  }
}

class AppFlowState {
  const AppFlowState({
    required this.stage,
    this.cashierId,
    this.cashierCode,
    this.cashierName,
    this.branchId,
    this.branchName,
    this.terminalId,
    this.terminalName,
    this.shiftId,
    this.openingCashMinor,
    this.lastReceipt,
  });

  final AppStage stage;
  final String? cashierId;
  final String? cashierCode;
  final String? cashierName;
  final String? branchId;
  final String? branchName;
  final String? terminalId;
  final String? terminalName;
  final String? shiftId;
  final int? openingCashMinor;
  final ReceiptSummary? lastReceipt;

  AppFlowState copyWith({
    AppStage? stage,
    String? cashierId,
    String? cashierCode,
    String? cashierName,
    String? branchId,
    String? branchName,
    String? terminalId,
    String? terminalName,
    String? shiftId,
    int? openingCashMinor,
    ReceiptSummary? lastReceipt,
  }) {
    return AppFlowState(
      stage: stage ?? this.stage,
      cashierId: cashierId ?? this.cashierId,
      cashierCode: cashierCode ?? this.cashierCode,
      cashierName: cashierName ?? this.cashierName,
      branchId: branchId ?? this.branchId,
      branchName: branchName ?? this.branchName,
      terminalId: terminalId ?? this.terminalId,
      terminalName: terminalName ?? this.terminalName,
      shiftId: shiftId ?? this.shiftId,
      openingCashMinor: openingCashMinor ?? this.openingCashMinor,
      lastReceipt: lastReceipt ?? this.lastReceipt,
    );
  }
}

class AppFlowController extends StateNotifier<AppFlowState> {
  AppFlowController() : super(_initialAppFlowState());

  void signIn({
    required String cashierId,
    required String employeeCode,
    required String cashierName,
    required String branchId,
    required String terminalId,
    required String terminalName,
  }) {
    state = AppFlowState(
      stage: AppStage.openShift,
      cashierId: cashierId,
      cashierCode: employeeCode,
      cashierName: cashierName,
      branchId: branchId,
      branchName: _branchNameFor(branchId),
      terminalId: terminalId,
      terminalName: terminalName,
    );
  }

  void startSelling({required String shiftId, required int openingCashMinor}) {
    state = state.copyWith(
      stage: AppStage.selling,
      shiftId: shiftId,
      openingCashMinor: openingCashMinor,
    );
  }

  void startPayment() {
    state = state.copyWith(stage: AppStage.payment);
  }

  void completeSale(ReceiptSummary receipt) {
    state = state.copyWith(
      stage: AppStage.receipt,
      lastReceipt: receipt.copyWith(autoPrintPending: true),
    );
  }

  void showReceipt(ReceiptSummary receipt) {
    state = state.copyWith(stage: AppStage.receipt, lastReceipt: receipt);
  }

  void showSales() {
    state = state.copyWith(stage: AppStage.selling);
  }

  bool showLastReceipt() {
    final receipt = state.lastReceipt;
    if (receipt == null) {
      return false;
    }

    state = state.copyWith(stage: AppStage.receipt, lastReceipt: receipt);
    return true;
  }

  void reconcileQueuedReceipt({
    required String localTransactionId,
    required String serverTransactionId,
    required String referenceNumber,
    required String orLabel,
    required int orNumber,
    required int totalMinor,
    required int vatMinor,
    required int changeMinor,
  }) {
    final currentReceipt = state.lastReceipt;
    if (currentReceipt == null ||
        currentReceipt.transactionId != localTransactionId) {
      return;
    }

    state = state.copyWith(
      lastReceipt: currentReceipt.copyWith(
        transactionId: serverTransactionId,
        referenceNumber: referenceNumber,
        orLabel: orLabel,
        orNumber: orNumber,
        totalMinor: totalMinor,
        vatMinor: vatMinor,
        changeMinor: changeMinor,
      ),
    );
  }

  void markReceiptAutoPrintHandled(String transactionId) {
    final currentReceipt = state.lastReceipt;
    if (currentReceipt == null ||
        currentReceipt.transactionId != transactionId ||
        !currentReceipt.autoPrintPending) {
      return;
    }

    state = state.copyWith(
      lastReceipt: currentReceipt.copyWith(autoPrintPending: false),
    );
  }

  void backToSelling() {
    state = state.copyWith(stage: AppStage.selling);
  }

  void endShift() {
    state = AppFlowState(
      stage: AppStage.openShift,
      cashierId: state.cashierId,
      cashierCode: state.cashierCode,
      cashierName: state.cashierName,
      branchId: state.branchId,
      branchName: state.branchName,
      terminalId: state.terminalId,
      terminalName: state.terminalName,
    );
  }

  void logout() {
    state = const AppFlowState(stage: AppStage.login);
  }
}

AppFlowState _initialAppFlowState() {
  if (!_qaForceSelling) {
    return const AppFlowState(stage: AppStage.login);
  }

  return const AppFlowState(
    stage: AppStage.selling,
    cashierId: 'qa-cashier',
    cashierCode: 'ADM001',
    cashierName: 'Andrea Cruz',
    branchId: 'branch-manila',
    branchName: 'Manila Flagship',
    terminalId: 'term-android-qa',
    terminalName: 'Android POS',
    shiftId: 'shift-qa',
    openingCashMinor: 0,
  );
}

final appFlowControllerProvider =
    StateNotifierProvider<AppFlowController, AppFlowState>(
      (ref) => AppFlowController(),
    );

String branchIdForEmployeeCode(String employeeCode) {
  final normalized = employeeCode.trim().toUpperCase();

  return switch (normalized) {
    'ADM001' || 'SUP001' || 'MNL101' => 'branch-manila',
    'CSH101' || 'CEB201' => 'branch-cebu',
    'DVO301' || 'DVO302' => 'branch-davao',
    _ when normalized.startsWith('MNL') => 'branch-manila',
    _ when normalized.startsWith('CEB') || normalized.startsWith('CSH') =>
      'branch-cebu',
    _ when normalized.startsWith('DVO') => 'branch-davao',
    _ => 'branch-crossing-calmba',
  };
}

String _branchNameFor(String branchId) {
  return switch (branchId) {
    'branch-crossing-calmba' => 'CROSSING CALMBA',
    'branch-cebu' => 'Cebu Ayala',
    'branch-davao' => 'Davao Downtown',
    'branch-manila' => 'CALAMBA BANGA',
    _ => 'CROSSING CALMBA',
  };
}
