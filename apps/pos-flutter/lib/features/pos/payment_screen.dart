import 'dart:async';
import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:uuid/uuid.dart';
import '../../core/models/money.dart';
import '../../core/models/payment_settings.dart';
import '../../core/providers/app_providers.dart';
import '../../core/services/back_office_client.dart';
import '../../core/services/payment_settings_storage.dart';
import '../app_flow/app_flow_controller.dart';
import 'cart_controller.dart';
import 'pos_drawer.dart';
import 'pos_drawer_actions.dart';

class _PaymentPalette {
  static const accent = Color(0xFF3B6EF6);
  static const accentGlow = Color(0x2E3B6EF6);
  static const success = Color(0xFF17B36B);
  static const successBg = Color(0x1417B36B);
  static const textPrimary = Color(0xFF14213D);
  static const textSecondary = Color(0xFF4A5D80);
  static const textMuted = Color(0xFF8A9BBF);
  static const border = Color(0xFFE2E8F4);
  static const borderBright = Color(0xFFCCD6EC);
  static const cardBg = Color(0xFFF8FAFD);
  static const pillBg = Color(0xFFF0F4FA);
  static const pageBg = Color(0xFFF0F4FA);
  static const androidBgStart = Color(0xFF0B0F13);
  static const androidBgEnd = Color(0xFF141A22);
  static const androidHeader = Color(0xFF20252C);
  static const androidPanel = Color(0xFF141920);
  static const androidPanelSoft = Color(0xFF1B2129);
  static const androidPanelElevated = Color(0xFF20262F);
  static const androidPillBg = Color(0xFF20262E);
  static const androidPillActiveBg = Color(0x3310B981);
  static const androidPillActiveBorder = Color(0x6658D0A9);
  static const androidPillText = Color(0xFFD1FAE5);
  static const androidAccent = Color(0xFF16A34A);
  static const androidAccentGlow = Color(0x3316A34A);
  static const androidSuccess = Color(0xFF34D399);
  static const androidSuccessBg = Color(0x1A34D399);
  static const androidTextPrimary = Color(0xFFF8FAFC);
  static const androidTextSecondary = Color(0xFFD7DEE8);
  static const androidTextMuted = Color(0xFF94A3B8);
  static const androidBorder = Color(0x26FFFFFF);
  static const androidBorderBright = Color(0x33FFFFFF);
  static const androidDivider = Color(0x14FFFFFF);
}

class PaymentScreen extends ConsumerStatefulWidget {
  const PaymentScreen({super.key});

  @override
  ConsumerState<PaymentScreen> createState() => _PaymentScreenState();
}

class _PaymentScreenState extends ConsumerState<PaymentScreen> {
  final GlobalKey<ScaffoldState> _scaffoldKey = GlobalKey<ScaffoldState>();
  final _tenderedController = TextEditingController();
  final _referenceController = TextEditingController();
  final _customerNameController = TextEditingController();
  final _customerTinController = TextEditingController();
  final _customerAddressController = TextEditingController();
  final _customerBusinessStyleController = TextEditingController();
  final _scPwdIdController = TextEditingController();
  final _scPwdTinController = TextEditingController();
  final PaymentSettingsStorage _paymentSettingsStorage =
      PaymentSettingsStorage();
  String _selectedMethod = 'CASH';
  PaymentSettings _paymentSettings = PaymentSettings.defaults();
  bool _paymentSettingsReady = false;
  static const _requireLiveReceiptIssuance = bool.fromEnvironment(
    'REQUIRE_LIVE_RECEIPT_ISSUANCE',
    defaultValue: false,
  );
  static const _allowOfflineSaleQueue = bool.fromEnvironment(
    'ALLOW_OFFLINE_SALE_QUEUE',
    defaultValue: true,
  );

  static const _paymentLabels = <String, String>{
    'CASH': 'Cash',
    'CARD': 'Card',
    'GCASH': 'GCash',
    'MAYA': 'Maya',
    'SPLIT': 'Split',
  };

  bool get _isAndroid => Platform.isAndroid;

  Duration get _surfaceDuration =>
      _isAndroid ? Duration.zero : const Duration(milliseconds: 300);

  Duration get _controlDuration =>
      _isAndroid ? Duration.zero : const Duration(milliseconds: 200);

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

  List<BoxShadow>? get _buttonShadow => _isAndroid
      ? null
      : [
          BoxShadow(
            color: _PaymentPalette.accentGlow,
            blurRadius: 24,
            offset: const Offset(0, 6),
          ),
        ];

  Color get _accentColor =>
      _isAndroid ? _PaymentPalette.androidAccent : _PaymentPalette.accent;

  Color get _accentGlowColor => _isAndroid
      ? _PaymentPalette.androidAccentGlow
      : _PaymentPalette.accentGlow;

  Color get _successColor =>
      _isAndroid ? _PaymentPalette.androidSuccess : _PaymentPalette.success;

  Color get _textPrimaryColor => _isAndroid
      ? _PaymentPalette.androidTextPrimary
      : _PaymentPalette.textPrimary;

  Color get _textMutedColor =>
      _isAndroid ? _PaymentPalette.androidTextMuted : _PaymentPalette.textMuted;

  Color get _panelColor =>
      _isAndroid ? _PaymentPalette.androidPanel : Colors.white;

  Color get _cardColor =>
      _isAndroid ? _PaymentPalette.androidPanelSoft : _PaymentPalette.cardBg;

  Color get _pillColor =>
      _isAndroid ? _PaymentPalette.androidPillBg : _PaymentPalette.pillBg;

  Color get _borderColor =>
      _isAndroid ? _PaymentPalette.androidBorder : _PaymentPalette.border;

  Color get _dividerColor =>
      _isAndroid ? _PaymentPalette.androidDivider : _PaymentPalette.border;

  BoxDecoration get _pageDecoration => BoxDecoration(
    color: _isAndroid ? null : _PaymentPalette.pageBg,
    gradient: _isAndroid
        ? const LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            colors: [
              _PaymentPalette.androidBgStart,
              _PaymentPalette.androidBgEnd,
            ],
          )
        : null,
  );

  @override
  void initState() {
    super.initState();
    unawaited(_loadPaymentSettings());
  }

  @override
  void dispose() {
    _tenderedController.dispose();
    _referenceController.dispose();
    _customerNameController.dispose();
    _customerTinController.dispose();
    _customerAddressController.dispose();
    _customerBusinessStyleController.dispose();
    _scPwdIdController.dispose();
    _scPwdTinController.dispose();
    super.dispose();
  }

  Future<void> _loadPaymentSettings() async {
    try {
      final settings = await _paymentSettingsStorage.readSettings();
      if (!mounted) {
        return;
      }
      setState(() {
        _paymentSettings = settings;
        _paymentSettingsReady = true;
      });
    } catch (_) {
      if (!mounted) {
        return;
      }
      setState(() {
        _paymentSettings = PaymentSettings.defaults();
        _paymentSettingsReady = true;
      });
    }
  }

  PaymentSettings _settingsForBranch(String? branchId) {
    final normalizedBranchId = branchId?.trim();
    if (normalizedBranchId == null || normalizedBranchId.isEmpty) {
      return _paymentSettings;
    }
    if (_paymentSettings.branchId == normalizedBranchId) {
      return _paymentSettings;
    }
    return PaymentSettings.defaults(branchId: normalizedBranchId);
  }

  void _selectMethod(String code) {
    setState(() {
      _selectedMethod = code;
      if (code == 'CASH') {
        _referenceController.clear();
      } else {
        _tenderedController.clear();
      }
    });
  }

  Future<void> _confirm() async {
    final cart = ref.read(cartControllerProvider);
    final flow = ref.read(appFlowControllerProvider);
    final paymentSettings = _settingsForBranch(flow.branchId);
    final selectedMethod = paymentSettings.resolveSelectedMethod(
      _selectedMethod,
    );
    final totalMinor = cart.totalMinor;
    final discountMinor = cart.discountMinor;
    if (totalMinor <= 0) {
      return;
    }
    final terminal = ref.read(terminalInfoProvider);
    final branchId = flow.branchId ?? 'branch-manila';
    final terminalId = flow.terminalId ?? terminal.id;
    final terminalName = flow.terminalName ?? terminal.name;
    final cashierId = flow.cashierId?.trim().isNotEmpty == true
        ? flow.cashierId!.trim()
        : (flow.cashierCode?.trim() ?? '');
    final tenderedMinor = selectedMethod == 'CASH'
        ? moneyFromText(_tenderedController.text)
        : totalMinor;

    if (selectedMethod == 'CASH' && tenderedMinor < totalMinor) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Tendered cash is lower than the total.')),
      );
      return;
    }

    if (cashierId.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Cashier identity is missing. Please log in again.'),
        ),
      );
      return;
    }

    final canQueueFallback =
        _allowOfflineSaleQueue && !_requireLiveReceiptIssuance;
    final syncService = ref.read(syncServiceProvider);
    final isOnline = await syncService.isOnline();
    if (!mounted) {
      return;
    }

    if (!isOnline && !canQueueFallback) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text(
            'Terminal is offline. Live server receipt issuance is required.',
          ),
        ),
      );
      return;
    }

    final paymentReference = _referenceController.text.trim();
    final customerName = _customerNameController.text.trim();
    final customerTin = _customerTinController.text.trim();
    final customerAddress = _customerAddressController.text.trim();
    final customerBusinessStyle = _customerBusinessStyleController.text.trim();
    final normalizedCustomerName = customerName.isEmpty
        ? 'Walk-in Customer'
        : customerName;
    final normalizedCustomerTin = customerTin.isEmpty ? null : customerTin;
    final normalizedCustomerAddress = customerAddress.isEmpty
        ? null
        : customerAddress;
    final normalizedCustomerBusinessStyle = customerBusinessStyle.isEmpty
        ? null
        : customerBusinessStyle;
    final itemsForServer = [
      for (final line in cart.lines)
        {
          'itemId': line.item.id,
          'name': line.item.name,
          'sku': line.item.sku,
          'quantity': line.quantity,
          'unitPrice': _toMajor(line.item.priceMinor),
          'unit': line.item.unit,
          'vatType': line.item.vatType,
        },
    ];
    final paymentsForServer = [
      {
        'method': selectedMethod,
        'amount': _toMajor(
          selectedMethod == 'CASH' ? tenderedMinor : totalMinor,
        ),
        'reference': paymentReference,
      },
    ];

    var transactionId = '';
    var referenceNumber = '';
    var orLabel = '';
    int? orNumber;
    var receiptTotalMinor = totalMinor;
    var receiptVatMinor = cart.vatMinor;
    var receiptChangeMinor = tenderedMinor > totalMinor
        ? tenderedMinor - totalMinor
        : 0;
    var postedToServer = false;

    if (isOnline) {
      try {
        final serverTransaction = await ref
            .read(backOfficeClientProvider)
            .createTransaction(
              branchId: branchId,
              terminalId: terminalId,
              cashierId: cashierId,
              shiftId: flow.shiftId,
              customerName: normalizedCustomerName,
              customerTin: normalizedCustomerTin,
              customerAddress: normalizedCustomerAddress,
              customerBusinessStyle: normalizedCustomerBusinessStyle,
              discountAmount: _toMajor(discountMinor),
              items: itemsForServer,
              payments: paymentsForServer,
            );
        postedToServer = true;
        transactionId = serverTransaction.id;
        referenceNumber = serverTransaction.refNumber;
        orNumber = serverTransaction.orNumber;
        orLabel = birInvoiceLabelFromNumber(serverTransaction.orNumber);
        receiptTotalMinor = _toMinor(serverTransaction.total);
        receiptVatMinor = _toMinor(serverTransaction.vatAmount);
        receiptChangeMinor = _toMinor(serverTransaction.changeAmount);
      } on BackOfficeException catch (error) {
        if (!canQueueFallback) {
          if (mounted) {
            ScaffoldMessenger.of(
              context,
            ).showSnackBar(SnackBar(content: Text(error.message)));
          }
          return;
        }
      } catch (error) {
        if (!canQueueFallback) {
          if (mounted) {
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(content: Text(error.toString().split('\n').first)),
            );
          }
          return;
        }
      }
    }

    if (!postedToServer) {
      transactionId = const Uuid().v4();
      referenceNumber = 'LOCAL-${DateTime.now().millisecondsSinceEpoch}';
      orLabel = 'PROVISIONAL SALES INVOICE - pending server sequence';

      await ref
          .read(databaseProvider)
          .enqueueTransaction(
            tableName: 'transactions',
            recordId: transactionId,
            operation: 'INSERT',
            payload: {
              'id': transactionId,
              'branch_id': branchId,
              'terminal_id': terminalId,
              'terminal_name': terminalName,
              'shift_id': flow.shiftId,
              'cashier_id': cashierId,
              'cashier_name': flow.cashierName,
              'customer_name': normalizedCustomerName,
              'customer_tin': normalizedCustomerTin,
              'customer_address': normalizedCustomerAddress,
              'customer_business_style': normalizedCustomerBusinessStyle,
              'reference_number': referenceNumber,
              'payment_method': selectedMethod,
              'payment_reference': paymentReference,
              'discount_amount_minor': discountMinor,
              'total_minor': cart.totalMinor,
              'items': [
                for (final line in cart.lines)
                  {
                    'item_id': line.item.id,
                    'name': line.item.name,
                    'sku': line.item.sku,
                    'qty': line.quantity,
                    'unit_price_minor': line.item.priceMinor,
                    'unit': line.item.unit,
                    'vat_type': line.item.vatType,
                  },
              ],
              'payments': [
                {
                  'method': selectedMethod,
                  'amount_minor': selectedMethod == 'CASH'
                      ? tenderedMinor
                      : totalMinor,
                  'reference': paymentReference,
                },
              ],
            },
          );

      final syncResult = await ref
          .read(syncServiceProvider)
          .flushPending(branchId: branchId, terminalId: terminalId);
      final reconciledReceipt = syncResult.transactionReceipts[transactionId];
      if (reconciledReceipt != null) {
        transactionId = reconciledReceipt.serverTransactionId;
        referenceNumber = reconciledReceipt.referenceNumber;
        orNumber = reconciledReceipt.orNumber;
        orLabel = birNormalizeInvoiceLabel(
          reconciledReceipt.orLabel,
          fallbackNumber: reconciledReceipt.orNumber,
        );
        receiptTotalMinor = _toMinor(reconciledReceipt.total);
        receiptVatMinor = _toMinor(reconciledReceipt.vatAmount);
        receiptChangeMinor = _toMinor(reconciledReceipt.changeAmount);
      }
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text(syncResult.message)));
      }
    }

    final receiptItems = [
      for (final line in cart.lines)
        ReceiptItemLine(
          name: line.item.name,
          sku: line.item.sku,
          quantity: line.quantity,
          unitPriceMinor: line.item.priceMinor,
          unit: line.item.unit,
          vatType: line.item.vatType,
        ),
    ];

    ref.read(cartControllerProvider.notifier).clear();
    ref
        .read(appFlowControllerProvider.notifier)
        .completeSale(
          ReceiptSummary(
            transactionId: transactionId,
            referenceNumber: referenceNumber,
            orLabel: orLabel,
            orNumber: orNumber,
            customerName: normalizedCustomerName,
            customerTin: normalizedCustomerTin,
            customerAddress: normalizedCustomerAddress,
            customerBusinessStyle: normalizedCustomerBusinessStyle,
            totalMinor: receiptTotalMinor,
            discountMinor: discountMinor,
            discountLabel: cart.discount?.discountLabel,
            scPwdIdNumber: () {
              if (!cart.isScPwdDiscount) return null;
              final id = _scPwdIdController.text.trim();
              return id.isEmpty ? null : id;
            }(),
            scPwdTin: () {
              if (!cart.isScPwdDiscount) return null;
              final tin = _scPwdTinController.text.trim();
              return tin.isEmpty ? null : tin;
            }(),
            vatMinor: receiptVatMinor,
            changeMinor: receiptChangeMinor,
            tenderedMinor: selectedMethod == 'CASH'
                ? tenderedMinor
                : receiptTotalMinor,
            paymentMethod: _paymentLabels[selectedMethod] ?? selectedMethod,
            items: receiptItems,
            createdAt: DateTime.now(),
          ),
        );

    if (selectedMethod == 'CASH') {
      unawaited(() async {
        try {
          await ref.read(hardwareAdapterProvider).openCashDrawer();
        } catch (error) {
          if (mounted) {
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(
                content: Text(
                  'Cash drawer pulse failed: ${error.toString().split('\n').first}',
                ),
              ),
            );
          }
        }
      }());
    }
  }

  double _toMajor(int minor) {
    return minor / 100;
  }

  int _toMinor(double major) {
    return (major * 100).round();
  }

  static const _methodIcons = <String, IconData>{
    'CASH': Icons.payments_outlined,
    'CARD': Icons.credit_card_outlined,
    'GCASH': Icons.smartphone_outlined,
    'MAYA': Icons.layers_outlined,
    'SPLIT': Icons.call_split_outlined,
  };

  Widget _buildPanelFrame({
    required Widget child,
    EdgeInsetsGeometry padding = const EdgeInsets.all(28),
  }) {
    return AnimatedContainer(
      duration: _surfaceDuration,
      curve: _isAndroid ? Curves.linear : Curves.easeOutCubic,
      padding: padding,
      decoration: BoxDecoration(
        color: _panelColor,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: _borderColor),
        boxShadow: _surfaceShadow,
      ),
      child: child,
    );
  }

  Widget _buildWidePaymentSetupPanel({
    required CartState cart,
    required int totalMinor,
    required List<int> quickAmounts,
    required List<PaymentMethodSettings> enabledMethods,
    required String selectedMethod,
  }) {
    return _buildPanelFrame(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(
            'Choose payment method',
            style: TextStyle(
              fontSize: 24,
              fontWeight: FontWeight.w600,
              color: _textPrimaryColor,
              letterSpacing: -0.2,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            '${cart.lines.length} item${cart.lines.length == 1 ? '' : 's'} | ${formatMoney(totalMinor)}',
            style: TextStyle(fontSize: 13, color: _textMutedColor),
          ),
          const SizedBox(height: 24),
          Text(
            'METHOD',
            style: TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.w600,
              color: _textMutedColor,
              letterSpacing: 1.0,
            ),
          ),
          const SizedBox(height: 10),
          Wrap(
            spacing: 10,
            runSpacing: 10,
            children: [
              for (final method in enabledMethods)
                _PaymentMethodTab(
                  icon: _methodIcons[method.code] ?? Icons.payment,
                  label: method.label,
                  selected: selectedMethod == method.code,
                  onPressed: () => _selectMethod(method.code),
                ),
            ],
          ),
          const SizedBox(height: 26),
          if (selectedMethod == 'CASH') ...[
            _TenderedInput(controller: _tenderedController),
            const SizedBox(height: 20),
            Text(
              'QUICK AMOUNTS',
              style: TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.w600,
                color: _textMutedColor,
                letterSpacing: 1.0,
              ),
            ),
            const SizedBox(height: 10),
            Row(
              children: [
                for (var i = 0; i < quickAmounts.length && i < 4; i++) ...[
                  if (i > 0) const SizedBox(width: 10),
                  Expanded(
                    child: _QuickAmountButton(
                      amountMinor: quickAmounts[i],
                      isExact: quickAmounts[i] == totalMinor,
                      onPressed: () {
                        _tenderedController.text = (quickAmounts[i] / 100)
                            .toStringAsFixed(
                              quickAmounts[i] % 100 == 0 ? 0 : 2,
                            );
                        setState(() {});
                      },
                    ),
                  ),
                ],
              ],
            ),
          ] else ...[
            _ReferenceInput(controller: _referenceController),
          ],
          const SizedBox(height: 24),
          _buildBuyerDetailsSection(isScPwdDiscount: cart.isScPwdDiscount),
        ],
      ),
    );
  }

  Widget _buildBuyerDetailsSection({bool isScPwdDiscount = false}) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final useTwoColumns = constraints.maxWidth >= 520;
        final spacing = useTwoColumns ? 12.0 : 0.0;
        final fieldWidth = useTwoColumns
            ? (constraints.maxWidth - spacing) / 2
            : constraints.maxWidth;

        return Container(
          decoration: BoxDecoration(
            color: _cardColor,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: _borderColor),
          ),
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Buyer details',
                style: TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.w600,
                  color: _textPrimaryColor,
                ),
              ),
              const SizedBox(height: 4),
              Text(
                'Optional for walk-in sales. Fill these in when the invoice needs named buyer information.',
                style: TextStyle(fontSize: 12, color: _textMutedColor),
              ),
              if (isScPwdDiscount) ...[
                const SizedBox(height: 14),
                _BuyerFieldInput(
                  controller: _scPwdIdController,
                  label: 'OSCA / PWD ID No.',
                  hintText: 'Enter card number',
                  textColor: _textPrimaryColor,
                  mutedColor: _textMutedColor,
                  borderColor: _borderColor,
                  fillColor: _panelColor,
                ),
                const SizedBox(height: 14),
                _BuyerFieldInput(
                  controller: _scPwdTinController,
                  label: 'SC / PWD TIN',
                  hintText: 'Enter TIN (optional)',
                  textColor: _textPrimaryColor,
                  mutedColor: _textMutedColor,
                  borderColor: _borderColor,
                  fillColor: _panelColor,
                ),
              ],
              const SizedBox(height: 14),
              Wrap(
                spacing: spacing,
                runSpacing: 12,
                children: [
                  SizedBox(
                    width: fieldWidth,
                    child: _BuyerFieldInput(
                      controller: _customerNameController,
                      label: 'Buyer name',
                      hintText: 'Walk-in Customer',
                      textColor: _textPrimaryColor,
                      mutedColor: _textMutedColor,
                      borderColor: _borderColor,
                      fillColor: _panelColor,
                    ),
                  ),
                  SizedBox(
                    width: fieldWidth,
                    child: _BuyerFieldInput(
                      controller: _customerTinController,
                      label: 'Buyer TIN / branch code',
                      hintText: '000-000-000-00000',
                      textColor: _textPrimaryColor,
                      mutedColor: _textMutedColor,
                      borderColor: _borderColor,
                      fillColor: _panelColor,
                    ),
                  ),
                  SizedBox(
                    width: fieldWidth,
                    child: _BuyerFieldInput(
                      controller: _customerBusinessStyleController,
                      label: 'Business style',
                      hintText: 'Retail / Trading / Services',
                      textColor: _textPrimaryColor,
                      mutedColor: _textMutedColor,
                      borderColor: _borderColor,
                      fillColor: _panelColor,
                    ),
                  ),
                  SizedBox(
                    width: useTwoColumns ? constraints.maxWidth : fieldWidth,
                    child: _BuyerFieldInput(
                      controller: _customerAddressController,
                      label: 'Buyer address',
                      hintText: 'Registered address',
                      textColor: _textPrimaryColor,
                      mutedColor: _textMutedColor,
                      borderColor: _borderColor,
                      fillColor: _panelColor,
                      maxLines: 2,
                    ),
                  ),
                ],
              ),
            ],
          ),
        );
      },
    );
  }

  Widget _buildWidePaymentSummaryPanel({
    required CartState cart,
    required int discountMinor,
    required int totalMinor,
    required int changeMinor,
    required String selectedMethod,
  }) {
    return _buildPanelFrame(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(
            'Payment summary',
            style: TextStyle(
              fontSize: 22,
              fontWeight: FontWeight.w600,
              color: _textPrimaryColor,
              letterSpacing: -0.2,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            'Selected method: ${_paymentLabels[selectedMethod] ?? selectedMethod}',
            style: TextStyle(fontSize: 13, color: _textMutedColor),
          ),
          const SizedBox(height: 20),
          Container(
            decoration: BoxDecoration(
              color: _cardColor,
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: _borderColor),
            ),
            child: Column(
              children: [
                _SummaryRow(
                  label: 'Subtotal',
                  value: formatMoney(cart.subtotalMinor),
                ),
                if (discountMinor > 0) ...[
                  Container(height: 1, color: _dividerColor),
                  _SummaryRow(
                    label: 'Discount',
                    value: '- ${formatMoney(discountMinor)}',
                  ),
                ],
                Container(height: 1, color: _dividerColor),
                _SummaryRow(
                  label: 'Total',
                  value: formatMoney(totalMinor),
                  isTotal: true,
                ),
                Container(height: 1, color: _dividerColor),
                _SummaryRow(
                  label: 'VAT (12%)',
                  value: formatMoney(cart.vatMinor),
                  badge: 'Incl.',
                ),
                Container(height: 1, color: _dividerColor),
                _SummaryRow(
                  label: 'Change due',
                  value: formatMoney(changeMinor),
                  isChange: true,
                  hasChange: changeMinor > 0,
                ),
              ],
            ),
          ),
          const SizedBox(height: 24),
          SizedBox(
            width: double.infinity,
            child: AnimatedContainer(
              duration: const Duration(milliseconds: 200),
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(14),
                boxShadow: [
                  BoxShadow(
                    color: _accentGlowColor,
                    blurRadius: 24,
                    offset: const Offset(0, 6),
                  ),
                ],
              ),
              child: FilledButton.icon(
                onPressed: totalMinor == 0 ? null : _confirm,
                icon: const Icon(Icons.check, size: 18),
                label: const Padding(
                  padding: EdgeInsets.symmetric(vertical: 16),
                  child: Text(
                    'Confirm Payment',
                    style: TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.w600,
                      letterSpacing: 0.3,
                    ),
                  ),
                ),
                style: FilledButton.styleFrom(
                  backgroundColor: _accentColor,
                  foregroundColor: Colors.white,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(14),
                  ),
                ),
              ),
            ),
          ),
          const SizedBox(height: 16),
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Container(
                width: 7,
                height: 7,
                decoration: BoxDecoration(
                  color: _successColor,
                  shape: BoxShape.circle,
                  boxShadow: [
                    BoxShadow(
                      color: _successColor.withValues(alpha: 0.45),
                      blurRadius: 8,
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 6),
              Icon(Icons.lock_outline, size: 12, color: _textMutedColor),
              const SizedBox(width: 5),
              Text(
                'Secure transaction | End-to-end encrypted',
                style: TextStyle(fontSize: 11.5, color: _textMutedColor),
              ),
            ],
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final cart = ref.watch(cartControllerProvider);
    final flow = ref.watch(appFlowControllerProvider);
    final terminal = ref.watch(terminalInfoProvider);
    final paymentSettings = _settingsForBranch(flow.branchId);
    final enabledMethods = paymentSettings.enabledMethods;
    final selectedMethod = paymentSettings.resolveSelectedMethod(
      _selectedMethod,
    );
    final keyboardInset = MediaQuery.of(context).viewInsets.bottom;
    final totalMinor = cart.totalMinor;
    final discountMinor = cart.discountMinor;
    final tenderedMinor = selectedMethod == 'CASH'
        ? moneyFromText(_tenderedController.text)
        : totalMinor;
    final changeMinor = tenderedMinor > totalMinor
        ? tenderedMinor - totalMinor
        : 0;

    // Quick-amount presets based on total
    final quickAmounts = <int>{
      totalMinor, // exact
      _ceilToNearest(totalMinor, 10000),
      _ceilToNearest(totalMinor, 10000) + 10000,
      _ceilToNearest(totalMinor, 10000) + 20000,
    }.toList();

    return Scaffold(
      key: _scaffoldKey,
      backgroundColor: _isAndroid
          ? _PaymentPalette.androidBgStart
          : _PaymentPalette.pageBg,
      resizeToAvoidBottomInset: false,
      drawer: PosDrawer(
        userName: flow.cashierName ?? 'Cashier',
        posName: flow.terminalName ?? terminal.name,
        storeName: flow.branchName ?? 'Main Store',
        appVersion: posAppVersionLabel,
        activeItem: PosNavItem.sales,
        onItemTap: (item) {
          if (!mounted) {
            return;
          }
          unawaited(handlePosDrawerItemTap(context, ref, item: item));
        },
      ),
      appBar: AppBar(
        backgroundColor: _isAndroid
            ? _PaymentPalette.androidHeader
            : Colors.white,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        leading: IconButton(
          onPressed: () =>
              ref.read(appFlowControllerProvider.notifier).backToSelling(),
          icon: Icon(
            Icons.arrow_back,
            size: 20,
            color: _isAndroid
                ? _PaymentPalette.androidTextPrimary
                : _PaymentPalette.textSecondary,
          ),
          style: IconButton.styleFrom(
            backgroundColor: _pillColor,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(8),
              side: BorderSide(color: _borderColor),
            ),
          ),
        ),
        title: Text(
          'Payment',
          style: TextStyle(
            fontSize: 13,
            fontWeight: FontWeight.w500,
            color: _isAndroid
                ? _PaymentPalette.androidTextPrimary
                : _PaymentPalette.textSecondary,
            letterSpacing: 0.3,
          ),
        ),
        actions: [
          Padding(
            padding: const EdgeInsets.only(right: 12),
            child: IconButton(
              onPressed: () => _scaffoldKey.currentState?.openDrawer(),
              icon: Icon(
                Icons.menu_rounded,
                size: 20,
                color: _isAndroid
                    ? _PaymentPalette.androidTextPrimary
                    : _PaymentPalette.textSecondary,
              ),
              style: IconButton.styleFrom(
                backgroundColor: _pillColor,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(8),
                  side: BorderSide(color: _borderColor),
                ),
              ),
            ),
          ),
        ],
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(1),
          child: Container(height: 1, color: _dividerColor),
        ),
      ),
      body: Container(
        decoration: _pageDecoration,
        child: LayoutBuilder(
          builder: (context, constraints) {
            if (!_paymentSettingsReady) {
              return Center(
                child: CircularProgressIndicator(color: _accentColor),
              );
            }

            final wideLayout = constraints.maxWidth >= 980;
            if (wideLayout) {
              return Align(
                alignment: Alignment.topCenter,
                child: SingleChildScrollView(
                  keyboardDismissBehavior:
                      ScrollViewKeyboardDismissBehavior.onDrag,
                  padding: EdgeInsets.fromLTRB(20, 24, 20, 24 + keyboardInset),
                  child: ConstrainedBox(
                    constraints: const BoxConstraints(maxWidth: 1240),
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Expanded(
                          child: _buildWidePaymentSetupPanel(
                            cart: cart,
                            totalMinor: totalMinor,
                            quickAmounts: quickAmounts,
                            enabledMethods: enabledMethods,
                            selectedMethod: selectedMethod,
                          ),
                        ),
                        const SizedBox(width: 24),
                        Expanded(
                          child: _buildWidePaymentSummaryPanel(
                            cart: cart,
                            discountMinor: discountMinor,
                            totalMinor: totalMinor,
                            changeMinor: changeMinor,
                            selectedMethod: selectedMethod,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              );
            }

            return Center(
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 540),
                child: SingleChildScrollView(
                  keyboardDismissBehavior:
                      ScrollViewKeyboardDismissBehavior.onDrag,
                  padding: EdgeInsets.fromLTRB(24, 28, 24, 28 + keyboardInset),
                  child: AnimatedContainer(
                    duration: _surfaceDuration,
                    curve: _isAndroid ? Curves.linear : Curves.easeOutCubic,
                    decoration: BoxDecoration(
                      color: _panelColor,
                      borderRadius: BorderRadius.circular(20),
                      border: Border.all(color: _borderColor),
                      boxShadow: _surfaceShadow,
                    ),
                    padding: const EdgeInsets.all(32),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        // Header
                        Text(
                          'Choose payment method',
                          style: TextStyle(
                            fontSize: 22,
                            fontWeight: FontWeight.w600,
                            color: _textPrimaryColor,
                            letterSpacing: -0.2,
                          ),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          '${cart.lines.length} item${cart.lines.length == 1 ? '' : 's'} · ${formatMoney(totalMinor)}',
                          style: TextStyle(
                            fontSize: 13,
                            color: _textMutedColor,
                          ),
                        ),
                        const SizedBox(height: 24),

                        // Method label
                        Text(
                          'METHOD',
                          style: TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.w600,
                            color: _textMutedColor,
                            letterSpacing: 1.0,
                          ),
                        ),
                        const SizedBox(height: 10),

                        // Payment method tabs
                        Wrap(
                          spacing: 8,
                          runSpacing: 8,
                          children: [
                            for (final method in enabledMethods)
                              _PaymentMethodTab(
                                icon:
                                    _methodIcons[method.code] ?? Icons.payment,
                                label: method.label,
                                selected: selectedMethod == method.code,
                                onPressed: () => _selectMethod(method.code),
                              ),
                          ],
                        ),
                        const SizedBox(height: 24),

                        // Cash input or reference input
                        if (selectedMethod == 'CASH') ...[
                          _TenderedInput(controller: _tenderedController),
                          const SizedBox(height: 20),

                          // Quick amounts
                          Text(
                            'QUICK AMOUNTS',
                            style: TextStyle(
                              fontSize: 11,
                              fontWeight: FontWeight.w600,
                              color: _textMutedColor,
                              letterSpacing: 1.0,
                            ),
                          ),
                          const SizedBox(height: 10),
                          Row(
                            children: [
                              for (
                                var i = 0;
                                i < quickAmounts.length && i < 4;
                                i++
                              ) ...[
                                if (i > 0) const SizedBox(width: 8),
                                Expanded(
                                  child: _QuickAmountButton(
                                    amountMinor: quickAmounts[i],
                                    isExact: quickAmounts[i] == totalMinor,
                                    onPressed: () {
                                      _tenderedController
                                          .text = (quickAmounts[i] / 100)
                                          .toStringAsFixed(
                                            quickAmounts[i] % 100 == 0 ? 0 : 2,
                                          );
                                      setState(() {});
                                    },
                                  ),
                                ),
                              ],
                            ],
                          ),
                          const SizedBox(height: 24),
                        ] else ...[
                          _ReferenceInput(controller: _referenceController),
                          const SizedBox(height: 24),
                        ],

                        _buildBuyerDetailsSection(isScPwdDiscount: cart.isScPwdDiscount),
                        const SizedBox(height: 24),

                        // Divider
                        Container(height: 1, color: _dividerColor),
                        const SizedBox(height: 24),

                        // Summary
                        Container(
                          decoration: BoxDecoration(
                            color: _cardColor,
                            borderRadius: BorderRadius.circular(14),
                            border: Border.all(color: _borderColor),
                          ),
                          child: Column(
                            children: [
                              _SummaryRow(
                                label: 'Subtotal',
                                value: formatMoney(cart.subtotalMinor),
                              ),
                              if (discountMinor > 0) ...[
                                Container(height: 1, color: _dividerColor),
                                _SummaryRow(
                                  label: 'Discount',
                                  value: '- ${formatMoney(discountMinor)}',
                                ),
                              ],
                              Container(height: 1, color: _dividerColor),
                              _SummaryRow(
                                label: 'Total',
                                value: formatMoney(totalMinor),
                                isTotal: true,
                              ),
                              Container(height: 1, color: _dividerColor),
                              _SummaryRow(
                                label: 'VAT (12%)',
                                value: formatMoney(cart.vatMinor),
                                badge: 'Incl.',
                              ),
                              Container(height: 1, color: _dividerColor),
                              _SummaryRow(
                                label: 'Change due',
                                value: formatMoney(changeMinor),
                                isChange: true,
                                hasChange: changeMinor > 0,
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(height: 24),

                        // Confirm button
                        SizedBox(
                          width: double.infinity,
                          child: AnimatedContainer(
                            duration: _controlDuration,
                            decoration: BoxDecoration(
                              borderRadius: BorderRadius.circular(14),
                              boxShadow: _buttonShadow,
                            ),
                            child: FilledButton.icon(
                              onPressed: totalMinor == 0 ? null : _confirm,
                              icon: const Icon(Icons.check, size: 18),
                              label: const Padding(
                                padding: EdgeInsets.symmetric(vertical: 14),
                                child: Text(
                                  'Confirm Payment',
                                  style: TextStyle(
                                    fontSize: 15,
                                    fontWeight: FontWeight.w600,
                                    letterSpacing: 0.3,
                                  ),
                                ),
                              ),
                              style: FilledButton.styleFrom(
                                backgroundColor: _accentColor,
                                foregroundColor: Colors.white,
                                shape: RoundedRectangleBorder(
                                  borderRadius: BorderRadius.circular(14),
                                ),
                              ),
                            ),
                          ),
                        ),
                        const SizedBox(height: 14),

                        // Secure note
                        Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Container(
                              width: 7,
                              height: 7,
                              decoration: BoxDecoration(
                                color: _successColor,
                                shape: BoxShape.circle,
                                boxShadow: [
                                  BoxShadow(
                                    color: _successColor.withValues(
                                      alpha: 0.45,
                                    ),
                                    blurRadius: 8,
                                  ),
                                ],
                              ),
                            ),
                            const SizedBox(width: 6),
                            Icon(
                              Icons.lock_outline,
                              size: 12,
                              color: _textMutedColor,
                            ),
                            const SizedBox(width: 5),
                            Text(
                              'Secure transaction · End-to-end encrypted',
                              style: TextStyle(
                                fontSize: 11.5,
                                color: _textMutedColor,
                              ),
                            ),
                          ],
                        ),
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

  int _ceilToNearest(int valueMinor, int stepMinor) {
    if (valueMinor % stepMinor == 0) return valueMinor + stepMinor;
    return ((valueMinor ~/ stepMinor) + 1) * stepMinor;
  }
}

class _PaymentMethodTab extends StatelessWidget {
  const _PaymentMethodTab({
    required this.icon,
    required this.label,
    required this.selected,
    required this.onPressed,
  });

  final IconData icon;
  final String label;
  final bool selected;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    final isAndroid = Platform.isAndroid;
    return Material(
      color: Colors.transparent,
      child: InkWell(
        borderRadius: BorderRadius.circular(10),
        onTap: onPressed,
        child: AnimatedContainer(
          duration: Platform.isAndroid
              ? Duration.zero
              : const Duration(milliseconds: 200),
          curve: Platform.isAndroid ? Curves.linear : Curves.easeOut,
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 9),
          decoration: BoxDecoration(
            color: selected
                ? (isAndroid
                      ? _PaymentPalette.androidPillActiveBg
                      : _PaymentPalette.accent)
                : (isAndroid
                      ? _PaymentPalette.androidPillBg
                      : _PaymentPalette.pillBg),
            borderRadius: BorderRadius.circular(10),
            border: Border.all(
              color: selected
                  ? (isAndroid
                        ? _PaymentPalette.androidPillActiveBorder
                        : _PaymentPalette.accent)
                  : (isAndroid
                        ? _PaymentPalette.androidBorder
                        : _PaymentPalette.border),
            ),
            boxShadow: selected && !Platform.isAndroid
                ? [
                    BoxShadow(
                      color: _PaymentPalette.accentGlow,
                      blurRadius: 16,
                      offset: const Offset(0, 4),
                    ),
                  ]
                : null,
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(
                icon,
                size: 15,
                color: selected
                    ? (isAndroid
                          ? _PaymentPalette.androidPillText
                          : Colors.white.withValues(alpha: 0.9))
                    : (isAndroid
                          ? _PaymentPalette.androidTextMuted
                          : _PaymentPalette.textSecondary.withValues(
                              alpha: 0.7,
                            )),
              ),
              const SizedBox(width: 7),
              Text(
                label,
                style: TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w500,
                  color: selected
                      ? (isAndroid
                            ? _PaymentPalette.androidPillText
                            : Colors.white)
                      : (isAndroid
                            ? _PaymentPalette.androidTextSecondary
                            : _PaymentPalette.textSecondary),
                  letterSpacing: 0.15,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _TenderedInput extends StatelessWidget {
  const _TenderedInput({required this.controller});

  final TextEditingController controller;

  @override
  Widget build(BuildContext context) {
    final isAndroid = Platform.isAndroid;
    return TextField(
      controller: controller,
      keyboardType: const TextInputType.numberWithOptions(decimal: true),
      style: TextStyle(
        fontFamily: 'Consolas',
        fontSize: 22,
        fontWeight: FontWeight.w500,
        color: isAndroid
            ? _PaymentPalette.androidTextPrimary
            : _PaymentPalette.textPrimary,
        letterSpacing: 0.2,
      ),
      decoration: InputDecoration(
        hintText: 'Enter amount',
        hintStyle: TextStyle(
          fontFamily: 'Segoe UI',
          fontSize: 14,
          fontWeight: FontWeight.w400,
          color: isAndroid
              ? _PaymentPalette.androidTextMuted
              : _PaymentPalette.textMuted,
        ),
        suffixText: 'PHP',
        suffixStyle: TextStyle(
          fontSize: 12,
          fontWeight: FontWeight.w600,
          color: isAndroid
              ? _PaymentPalette.androidTextSecondary
              : _PaymentPalette.textMuted,
          letterSpacing: 0.5,
        ),
        contentPadding: const EdgeInsets.symmetric(
          horizontal: 18,
          vertical: 14,
        ),
        filled: true,
        fillColor: isAndroid
            ? _PaymentPalette.androidPanelElevated
            : Colors.white,
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: BorderSide(
            color: isAndroid
                ? _PaymentPalette.androidBorderBright
                : _PaymentPalette.borderBright,
          ),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: BorderSide(
            color: isAndroid
                ? _PaymentPalette.androidBorderBright
                : _PaymentPalette.borderBright,
          ),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: BorderSide(
            color: isAndroid
                ? _PaymentPalette.androidAccent
                : _PaymentPalette.accent,
            width: isAndroid ? 1.4 : 1.5,
          ),
        ),
      ),
    );
  }
}

class _BuyerFieldInput extends StatelessWidget {
  const _BuyerFieldInput({
    required this.controller,
    required this.label,
    required this.hintText,
    required this.textColor,
    required this.mutedColor,
    required this.borderColor,
    required this.fillColor,
    this.maxLines = 1,
  });

  final TextEditingController controller;
  final String label;
  final String hintText;
  final Color textColor;
  final Color mutedColor;
  final Color borderColor;
  final Color fillColor;
  final int maxLines;

  @override
  Widget build(BuildContext context) {
    final isAndroid = Platform.isAndroid;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label.toUpperCase(),
          style: TextStyle(
            fontSize: 11,
            fontWeight: FontWeight.w600,
            color: mutedColor,
            letterSpacing: 1.0,
          ),
        ),
        const SizedBox(height: 8),
        TextField(
          controller: controller,
          maxLines: maxLines,
          minLines: maxLines,
          style: TextStyle(
            fontSize: 14,
            fontWeight: FontWeight.w500,
            color: textColor,
          ),
          decoration: InputDecoration(
            hintText: hintText,
            hintStyle: TextStyle(color: mutedColor),
            filled: true,
            fillColor: fillColor,
            contentPadding: EdgeInsets.symmetric(
              horizontal: 14,
              vertical: maxLines > 1 ? 14 : 12,
            ),
            enabledBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(14),
              borderSide: BorderSide(color: borderColor),
            ),
            focusedBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(14),
              borderSide: BorderSide(
                color: isAndroid
                    ? _PaymentPalette.androidAccent
                    : _PaymentPalette.accent,
              ),
            ),
          ),
        ),
      ],
    );
  }
}

class _ReferenceInput extends StatelessWidget {
  const _ReferenceInput({required this.controller});

  final TextEditingController controller;

  @override
  Widget build(BuildContext context) {
    final isAndroid = Platform.isAndroid;
    return TextField(
      controller: controller,
      style: TextStyle(
        fontSize: 14,
        fontWeight: FontWeight.w500,
        color: isAndroid
            ? _PaymentPalette.androidTextPrimary
            : _PaymentPalette.textPrimary,
      ),
      decoration: InputDecoration(
        hintText: 'Reference number / callback token',
        hintStyle: TextStyle(
          fontSize: 13,
          fontWeight: FontWeight.w400,
          color: isAndroid
              ? _PaymentPalette.androidTextMuted
              : _PaymentPalette.textMuted,
        ),
        contentPadding: const EdgeInsets.symmetric(
          horizontal: 18,
          vertical: 14,
        ),
        filled: true,
        fillColor: isAndroid
            ? _PaymentPalette.androidPanelElevated
            : Colors.white,
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: BorderSide(
            color: isAndroid
                ? _PaymentPalette.androidBorderBright
                : _PaymentPalette.borderBright,
          ),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: BorderSide(
            color: isAndroid
                ? _PaymentPalette.androidBorderBright
                : _PaymentPalette.borderBright,
          ),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: BorderSide(
            color: isAndroid
                ? _PaymentPalette.androidAccent
                : _PaymentPalette.accent,
            width: isAndroid ? 1.4 : 1.5,
          ),
        ),
      ),
    );
  }
}

class _QuickAmountButton extends StatelessWidget {
  const _QuickAmountButton({
    required this.amountMinor,
    required this.isExact,
    required this.onPressed,
  });

  final int amountMinor;
  final bool isExact;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    final isAndroid = Platform.isAndroid;
    final display = amountMinor % 100 == 0
        ? (amountMinor ~/ 100).toString().replaceAllMapped(
            RegExp(r'(\d)(?=(\d{3})+$)'),
            (m) => '${m[1]},',
          )
        : (amountMinor / 100).toStringAsFixed(2);

    return Material(
      color: Colors.transparent,
      child: InkWell(
        borderRadius: BorderRadius.circular(10),
        onTap: onPressed,
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 8),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(10),
            color: isExact
                ? (isAndroid
                      ? _PaymentPalette.androidSuccessBg
                      : _PaymentPalette.successBg)
                : (isAndroid
                      ? _PaymentPalette.androidPillBg
                      : _PaymentPalette.pillBg),
            border: Border.all(
              color: isExact
                  ? (isAndroid
                        ? _PaymentPalette.androidPillActiveBorder
                        : _PaymentPalette.success.withValues(alpha: 0.3))
                  : (isAndroid
                        ? _PaymentPalette.androidBorder
                        : _PaymentPalette.border),
            ),
          ),
          alignment: Alignment.center,
          child: Text(
            display,
            style: TextStyle(
              fontFamily: 'Consolas',
              fontSize: 13,
              fontWeight: FontWeight.w500,
              color: isExact
                  ? (isAndroid
                        ? _PaymentPalette.androidSuccess
                        : _PaymentPalette.success)
                  : (isAndroid
                        ? _PaymentPalette.androidTextSecondary
                        : _PaymentPalette.textSecondary),
              letterSpacing: 0.15,
            ),
          ),
        ),
      ),
    );
  }
}

class _SummaryRow extends StatelessWidget {
  const _SummaryRow({
    required this.label,
    required this.value,
    this.badge,
    this.isTotal = false,
    this.isChange = false,
    this.hasChange = false,
  });

  final String label;
  final String value;
  final String? badge;
  final bool isTotal;
  final bool isChange;
  final bool hasChange;

  @override
  Widget build(BuildContext context) {
    final isAndroid = Platform.isAndroid;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 13),
      color: isTotal
          ? (isAndroid ? const Color(0x1410B981) : const Color(0x083B6EF6))
          : Colors.transparent,
      child: Row(
        children: [
          Text(
            label,
            style: TextStyle(
              fontSize: isTotal ? 14 : 13,
              fontWeight: isTotal ? FontWeight.w600 : FontWeight.w400,
              color: isTotal
                  ? (isAndroid
                        ? _PaymentPalette.androidTextPrimary
                        : _PaymentPalette.textPrimary)
                  : (isAndroid
                        ? _PaymentPalette.androidTextSecondary
                        : _PaymentPalette.textSecondary),
            ),
          ),
          if (badge != null) ...[
            const SizedBox(width: 8),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
              decoration: BoxDecoration(
                color: isAndroid
                    ? const Color(0x1A10B981)
                    : const Color(0x1E3B6EF6),
                borderRadius: BorderRadius.circular(5),
                border: Border.all(
                  color: isAndroid
                      ? _PaymentPalette.androidPillActiveBorder
                      : const Color(0x333B6EF6),
                ),
              ),
              child: Text(
                badge!,
                style: TextStyle(
                  fontSize: 10,
                  fontWeight: FontWeight.w600,
                  color: isAndroid
                      ? _PaymentPalette.androidPillText
                      : const Color(0xFF7DA4FF),
                  letterSpacing: 0.5,
                ),
              ),
            ),
          ],
          const Spacer(),
          Text(
            value,
            style: TextStyle(
              fontFamily: 'Consolas',
              fontSize: isTotal ? 18 : 13,
              fontWeight: isTotal ? FontWeight.w600 : FontWeight.w500,
              color: isChange
                  ? (hasChange
                        ? (isAndroid
                              ? _PaymentPalette.androidSuccess
                              : _PaymentPalette.success)
                        : (isAndroid
                              ? _PaymentPalette.androidTextMuted
                              : _PaymentPalette.textMuted))
                  : (isAndroid
                        ? _PaymentPalette.androidTextPrimary
                        : _PaymentPalette.textPrimary),
              letterSpacing: 0.15,
            ),
          ),
        ],
      ),
    );
  }
}
