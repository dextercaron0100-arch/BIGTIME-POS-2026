import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../app_flow/app_flow_controller.dart';
import '../pos/cart_controller.dart';
import 'customer_display_launcher.dart';
import 'customer_display_models.dart';
import 'customer_display_storage.dart';

class CustomerDisplaySyncHost extends ConsumerStatefulWidget {
  const CustomerDisplaySyncHost({super.key, required this.child});

  final Widget child;

  @override
  ConsumerState<CustomerDisplaySyncHost> createState() =>
      _CustomerDisplaySyncHostState();
}

class _CustomerDisplaySyncHostState
    extends ConsumerState<CustomerDisplaySyncHost> {
  static const Duration _writeDebounceDuration = Duration(milliseconds: 240);
  static const Duration _autoLaunchInterval = Duration(seconds: 15);
  static const Duration _displayProbeInterval = Duration(seconds: 20);
  final CustomerDisplayStorage _storage = CustomerDisplayStorage();
  late final CustomerDisplayLauncher _launcher = CustomerDisplayLauncher(
    _storage,
  );
  ProviderSubscription<CartState>? _cartSubscription;
  ProviderSubscription<AppFlowState>? _flowSubscription;
  Timer? _writeDebounce;
  Timer? _autoLaunchTimer;
  bool _autoLaunchInFlight = false;
  bool _secondaryDisplayAvailable = false;
  DateTime _lastDisplayProbeAt = DateTime.fromMillisecondsSinceEpoch(0);
  String _lastStateSignature = '';

  @override
  void initState() {
    super.initState();
    _cartSubscription = ref.listenManual<CartState>(
      cartControllerProvider,
      (previous, next) => _scheduleWrite(),
    );
    _flowSubscription = ref.listenManual<AppFlowState>(
      appFlowControllerProvider,
      (previous, next) => _scheduleWrite(),
    );

    WidgetsBinding.instance.addPostFrameCallback((_) {
      _writeState();
      unawaited(_ensureCustomerDisplayLaunched(forceProbe: true));
    });
    if (Platform.isAndroid) {
      _autoLaunchTimer = Timer.periodic(
        _autoLaunchInterval,
        (_) => unawaited(_ensureCustomerDisplayLaunched()),
      );
    }
  }

  @override
  void dispose() {
    _autoLaunchTimer?.cancel();
    _writeDebounce?.cancel();
    _cartSubscription?.close();
    _flowSubscription?.close();
    super.dispose();
  }

  void _scheduleWrite() {
    _writeDebounce?.cancel();
    _writeDebounce = Timer(_writeDebounceDuration, _writeState);
  }

  void _writeState() {
    final cart = ref.read(cartControllerProvider);
    final flow = ref.read(appFlowControllerProvider);
    final state = _buildState(flow, cart);
    final signature = _stateSignature(state);

    if (signature == _lastStateSignature) {
      return;
    }

    _lastStateSignature = signature;
    unawaited(_storage.writeState(state));
  }

  String _stateSignature(CustomerDisplayState state) {
    final payload = state.toJson()..remove('updatedAt');
    return jsonEncode(payload);
  }

  Future<bool> _refreshSecondaryDisplayAvailability({
    bool force = false,
  }) async {
    if (!Platform.isAndroid) {
      return false;
    }

    final now = DateTime.now();
    if (!force && now.difference(_lastDisplayProbeAt) < _displayProbeInterval) {
      return _secondaryDisplayAvailable;
    }

    _lastDisplayProbeAt = now;
    _secondaryDisplayAvailable = await _launcher.hasSecondaryDisplay();
    return _secondaryDisplayAvailable;
  }

  Future<void> _ensureCustomerDisplayLaunched({bool forceProbe = false}) async {
    if (!Platform.isAndroid || _autoLaunchInFlight) {
      return;
    }

    if (!await _refreshSecondaryDisplayAvailability(force: forceProbe)) {
      return;
    }

    _autoLaunchInFlight = true;
    try {
      await _launcher.launch();
    } catch (_) {
      // Ignore transient second-screen launch failures and retry later.
    } finally {
      _autoLaunchInFlight = false;
    }
  }

  CustomerDisplayState _buildState(AppFlowState flow, CartState cart) {
    if (flow.stage == AppStage.receipt && flow.lastReceipt != null) {
      final receipt = flow.lastReceipt!;
      return CustomerDisplayState(
        mode: CustomerDisplayMode.thankYou,
        branchId: flow.branchId,
        branchName: flow.branchName,
        cashierName: flow.cashierName,
        itemCount: 0,
        subtotalMinor: receipt.totalMinor - receipt.vatMinor,
        vatMinor: receipt.vatMinor,
        totalMinor: receipt.totalMinor,
        lines: const <CustomerDisplayCartLine>[],
        lastReceipt: CustomerDisplayReceipt(
          referenceNumber: receipt.referenceNumber,
          orLabel: receipt.orLabel,
          totalMinor: receipt.totalMinor,
          vatMinor: receipt.vatMinor,
          changeMinor: receipt.changeMinor,
          paymentMethod: receipt.paymentMethod,
          createdAt: receipt.createdAt,
        ),
        updatedAt: DateTime.now(),
      );
    }

    if (cart.itemCount > 0 || flow.stage == AppStage.payment) {
      return CustomerDisplayState(
        mode: CustomerDisplayMode.cart,
        branchId: flow.branchId,
        branchName: flow.branchName,
        cashierName: flow.cashierName,
        itemCount: cart.itemCount,
        subtotalMinor: cart.subtotalMinor,
        vatMinor: cart.vatMinor,
        totalMinor: cart.totalMinor,
        lines: cart.lines
            .map(
              (line) => CustomerDisplayCartLine(
                name: line.item.name,
                quantity: line.quantity,
                lineTotalMinor: line.lineTotalMinor,
              ),
            )
            .toList(growable: false),
        lastReceipt: null,
        updatedAt: DateTime.now(),
      );
    }

    return CustomerDisplayState(
      mode: CustomerDisplayMode.idle,
      branchId: flow.branchId,
      branchName: flow.branchName,
      cashierName: flow.cashierName,
      itemCount: 0,
      subtotalMinor: 0,
      vatMinor: 0,
      totalMinor: 0,
      lines: const <CustomerDisplayCartLine>[],
      lastReceipt: null,
      updatedAt: DateTime.now(),
    );
  }

  @override
  Widget build(BuildContext context) {
    return widget.child;
  }
}
