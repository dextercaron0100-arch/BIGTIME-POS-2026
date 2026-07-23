import 'dart:io';
import 'dart:async';
import 'package:animations/animations.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/providers/app_providers.dart';
import '../../core/services/back_office_client.dart';
import '../../core/services/realtime_service.dart';
import '../auth/login_screen.dart';
import '../pos/payment_screen.dart';
import '../pos/pos_screen.dart';
import '../pos/receipt_screen.dart';
import '../shift/open_shift_screen.dart';
import 'app_flow_controller.dart';

class AppFlowView extends ConsumerStatefulWidget {
  const AppFlowView({super.key});

  @override
  ConsumerState<AppFlowView> createState() => _AppFlowViewState();
}

class _AppFlowViewState extends ConsumerState<AppFlowView> {
  ProviderSubscription<AppFlowState>? _flowSubscription;
  StreamSubscription<BackOfficeSessionEvent>? _sessionSubscription;
  StreamSubscription<CatalogRefreshEvent>? _catalogRefreshSubscription;
  bool _trialExpired = false;

  @override
  void initState() {
    super.initState();
    _sessionSubscription = ref
        .read(backOfficeClientProvider)
        .events
        .listen(_handleSessionEvent);
    _catalogRefreshSubscription = ref
        .read(realtimeServiceProvider)
        .catalogRefreshEvents
        .listen(_handleCatalogRefreshEvent);
    _flowSubscription = ref.listenManual<AppFlowState>(
      appFlowControllerProvider,
      (previous, next) {
        _syncRealtimeConnection(next);
      },
      fireImmediately: true,
    );
  }

  @override
  void dispose() {
    _flowSubscription?.close();
    _sessionSubscription?.cancel();
    _catalogRefreshSubscription?.cancel();
    super.dispose();
  }

  void _handleSessionEvent(BackOfficeSessionEvent event) {
    if (!mounted) {
      return;
    }

    if (event.type == BackOfficeSessionEventType.trialExpired) {
      setState(() {
        _trialExpired = true;
      });
      return;
    }

    if (event.type != BackOfficeSessionEventType.expired) {
      return;
    }

    if (ref.read(appFlowControllerProvider).stage == AppStage.login) {
      return;
    }

    ref.read(appFlowControllerProvider.notifier).logout();
    final messenger = ScaffoldMessenger.maybeOf(context);
    messenger?.showSnackBar(SnackBar(content: Text(event.message)));
  }

  Future<void> _handleCatalogRefreshEvent(CatalogRefreshEvent event) async {
    final flowState = ref.read(appFlowControllerProvider);
    if (flowState.branchId != event.branchId) {
      return;
    }

    try {
      await ref
          .read(syncServiceProvider)
          .refreshCatalog(branchId: event.branchId);
    } catch (_) {
      // The periodic sync remains as fallback if the live refresh fails.
    }
  }

  void _syncRealtimeConnection(AppFlowState state) {
    final realtimeService = ref.read(realtimeServiceProvider);
    final hasSession = ref.read(backOfficeClientProvider).hasAccessToken;
    if (state.stage == AppStage.login ||
        state.branchId == null ||
        !hasSession) {
      realtimeService.disconnect();
      return;
    }

    realtimeService.connect(branchId: state.branchId!);
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(appFlowControllerProvider);

    if (_trialExpired) {
      return const _TrialExpiredScreen();
    }

    final screen = switch (state.stage) {
      AppStage.login => const LoginScreen(),
      AppStage.openShift => const OpenShiftScreen(),
      AppStage.selling => const PosScreen(),
      AppStage.payment => const PaymentScreen(),
      AppStage.receipt => const ReceiptScreen(),
    };

    if (Platform.isWindows || Platform.isAndroid) {
      return KeyedSubtree(key: ValueKey(state.stage), child: screen);
    }

    return PageTransitionSwitcher(
      duration: const Duration(milliseconds: 220),
      transitionBuilder: (child, primaryAnimation, secondaryAnimation) {
        return SharedAxisTransition(
          animation: primaryAnimation,
          secondaryAnimation: secondaryAnimation,
          transitionType: SharedAxisTransitionType.horizontal,
          fillColor: Theme.of(context).scaffoldBackgroundColor,
          child: child,
        );
      },
      child: KeyedSubtree(key: ValueKey(state.stage), child: screen),
    );
  }
}

class _TrialExpiredScreen extends StatelessWidget {
  const _TrialExpiredScreen();

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Center(
        child: Padding(
          padding: const EdgeInsets.all(32),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.lock_clock, size: 56),
              const SizedBox(height: 16),
              Text(
                'Trial expired',
                style: Theme.of(context).textTheme.headlineSmall,
              ),
              const SizedBox(height: 8),
              const Text(
                'Your 30-day free trial has ended. Please contact your administrator to continue.',
                textAlign: TextAlign.center,
              ),
            ],
          ),
        ),
      ),
    );
  }
}
