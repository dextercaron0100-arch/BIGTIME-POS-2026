import 'dart:async';
import 'dart:collection';
import 'dart:io';
import 'package:easy_debounce/easy_debounce.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:scroll_animator/scroll_animator.dart';
import '../../core/models/money.dart';
import '../../core/providers/app_providers.dart';
import '../../features/catalog/catalog_item.dart';
import '../customer_display/customer_display_controls.dart';
import '../app_flow/app_flow_controller.dart';
import 'cart_controller.dart';
import 'hardware_readiness_panel.dart';
import 'pos_drawer.dart';
import 'pos_drawer_actions.dart';
import 'pos_view_state.dart';
import 'shift_close_flow.dart';
import 'sync_outbox_panel.dart';

class _PosColors {
  static const bgStart = Color(0xFF0C1E36);
  static const bgEnd = Color(0xFF163055);
  static const surface = Color(0xFFFFFFFF);
  static const surfaceSoft = Color(0xFFF6F9FF);
  static const titleNavy = Color(0xFF1A2E4A);
  static const border = Color(0xFFDCE5F1);
  static const borderSoft = Color(0xFFD2DDEB);
  static const headerTint = Color(0xFFEEF2F7);
  static const headerLabel = Color(0xFF4E688A);
  static const amountStrong = Color(0xFF1E293B);
  static const qtyBg = Color(0xFFEEF2F7);
  static const qtyText = Color(0xFF3B5B8A);
  static const tagBlueBg = Color(0xFFE8F1FF);
  static const tagBlueText = Color(0xFF2D5B9F);
  static const tagBlueBorder = Color(0xFFBFD5FF);
  static const tagTealBg = Color(0xFFE6F8F8);
  static const tagTealText = Color(0xFF1F6F74);
  static const tagTealBorder = Color(0xFFBFE5E7);
  static const tagNeutralBg = Color(0xFFF2F4F8);
  static const tagNeutralText = Color(0xFF5A6F8E);
  static const tagNeutralBorder = Color(0xFFDCE4EF);
  static const payBlueStart = Color(0xFF1F66F2);
  static const payBlueEnd = Color(0xFF2F88FF);

  static const androidBgStart = Color(0xFF0B0F13);
  static const androidBgEnd = Color(0xFF141A22);
  static const androidPanel = Color(0x59000000);
  static const androidPanelSoft = Color(0x0DFFFFFF);
  static const androidPanelBorder = Color(0x26FFFFFF);
  static const androidHeader = Color(0x1AFFFFFF);
  static const androidText = Color(0xFFF8FAFC);
  static const androidTextMuted = Color(0xFF94A3B8);
  static const androidActionBg = Color(0x14FFFFFF);
  static const androidActionBorder = Color(0x1FFFFFFF);
  static const androidDangerBg = Color(0x19EF4444);
  static const androidDangerBorder = Color(0x33EF4444);
  static const androidTagBg = Color(0x12FFFFFF);
  static const androidTagBorder = Color(0x1FFFFFFF);
  static const androidPillBg = Color(0x12FFFFFF);
  static const androidPillBorder = Color(0x24FFFFFF);
  static const androidPillActiveBg = Color(0x3310B981);
  static const androidPillActiveBorder = Color(0x6658D0A9);
}

class PosScreen extends ConsumerStatefulWidget {
  const PosScreen({super.key});

  @override
  ConsumerState<PosScreen> createState() => _PosScreenState();
}

class _PosScreenState extends ConsumerState<PosScreen> {
  static const String _appVersionLabel = posAppVersionLabel;
  static const _initialSyncDelay = Duration(milliseconds: 900);
  final GlobalKey<ScaffoldState> _scaffoldKey = GlobalKey<ScaffoldState>();
  Timer? _initialSyncTimer;
  Timer? _syncTimer;
  StreamSubscription<bool>? _onlineSubscription;
  bool _syncInFlight = false;
  DateTime _lastCatalogInteractionAt = DateTime.fromMillisecondsSinceEpoch(0);

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final syncService = ref.read(syncServiceProvider);
      final hasSession = ref.read(backOfficeClientProvider).hasAccessToken;
      if (hasSession) {
        _initialSyncTimer = Timer(_initialSyncDelay, () {
          _runSync();
        });
      }
      _syncTimer = Timer.periodic(const Duration(seconds: 20), (_) {
        if (!mounted) {
          return;
        }
        _runSync();
      });
      _onlineSubscription = ref
          .read(syncServiceProvider)
          .watchOnlineStatus()
          .listen((isOnline) {
            if (isOnline && syncService.backOfficeClient.hasAccessToken) {
              _runSync();
            }
          });
    });
  }

  @override
  void dispose() {
    _initialSyncTimer?.cancel();
    _syncTimer?.cancel();
    _onlineSubscription?.cancel();
    super.dispose();
  }

  Future<void> _runSync({bool interactive = false}) async {
    if (_syncInFlight) {
      return;
    }

    if (!interactive &&
        DateTime.now().difference(_lastCatalogInteractionAt) <
            const Duration(milliseconds: 1500)) {
      return;
    }

    final flow = ref.read(appFlowControllerProvider);
    final branchId = flow.branchId;
    final terminal = ref.read(terminalInfoProvider);
    final terminalId = flow.terminalId ?? terminal.id;

    if (branchId == null) {
      return;
    }

    _syncInFlight = true;
    final result = await ref
        .read(syncServiceProvider)
        .runFullSync(branchId: branchId, terminalId: terminalId);
    _syncInFlight = false;

    if (result.transactionReceipts.isNotEmpty) {
      final flowController = ref.read(appFlowControllerProvider.notifier);
      for (final receipt in result.transactionReceipts.values) {
        flowController.reconcileQueuedReceipt(
          localTransactionId: receipt.localTransactionId,
          serverTransactionId: receipt.serverTransactionId,
          referenceNumber: receipt.referenceNumber,
          orLabel: receipt.orLabel,
          orNumber: receipt.orNumber,
          totalMinor: (receipt.total * 100).round(),
          vatMinor: (receipt.vatAmount * 100).round(),
          changeMinor: (receipt.changeAmount * 100).round(),
        );
      }
    }

    if (interactive && mounted) {
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(result.message)));
    }
  }

  void _markCatalogInteraction() {
    _lastCatalogInteractionAt = DateTime.now();
  }

  void _openDrawer() {
    _scaffoldKey.currentState?.openDrawer();
  }

  Future<void> _endShift() async {
    await endCurrentShift(context, ref);
  }

  @override
  Widget build(BuildContext context) {
    final isAndroid = Platform.isAndroid;
    final terminal = ref.watch(terminalInfoProvider);
    final branchId = ref.watch(
      appFlowControllerProvider.select(
        (state) => state.branchId ?? 'branch-manila',
      ),
    );
    final cashierName = ref.watch(
      appFlowControllerProvider.select(
        (state) => state.cashierName ?? 'Cashier',
      ),
    );
    final branchName = ref.watch(
      appFlowControllerProvider.select(
        (state) => state.branchName ?? 'Main Store',
      ),
    );
    final terminalName = ref.watch(
      appFlowControllerProvider.select(
        (state) => state.terminalName ?? terminal.name,
      ),
    );
    final terminalId = ref.watch(
      appFlowControllerProvider.select(
        (state) => state.terminalId ?? terminal.id,
      ),
    );
    return PopScope(
      canPop: false,
      child: Scaffold(
        key: _scaffoldKey,
        backgroundColor: isAndroid
            ? _PosColors.androidBgStart
            : _PosColors.bgStart,
        resizeToAvoidBottomInset: false,
        drawer: PosDrawer(
          userName: cashierName,
          posName: terminalName,
          storeName: branchName,
          appVersion: _appVersionLabel,
          activeItem: PosNavItem.sales,
          onItemTap: (item) {
            if (!mounted) {
              return;
            }
            unawaited(handlePosDrawerItemTap(context, ref, item: item));
          },
        ),
        body: DecoratedBox(
          decoration: BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: isAndroid
                  ? const [_PosColors.androidBgStart, _PosColors.androidBgEnd]
                  : const [_PosColors.bgStart, _PosColors.bgEnd],
            ),
          ),
          child: SafeArea(
            child: Padding(
              padding: const EdgeInsets.all(14),
              child: LayoutBuilder(
                builder: (context, constraints) {
                  final wide = constraints.maxWidth >= 1100;
                  return Flex(
                    direction: wide ? Axis.horizontal : Axis.vertical,
                    children: [
                      Expanded(
                        flex: wide ? 55 : 1,
                        child: RepaintBoundary(
                          child: _CatalogPanel(
                            branchId: branchId,
                            cashierName: cashierName,
                            onSyncPressed: () => _runSync(interactive: true),
                            onEndShiftPressed: _endShift,
                            onOutboxPressed: () {
                              showSyncOutboxPanel(
                                context,
                                branchId: branchId,
                                terminalId: terminalId,
                              );
                            },
                            onHardwarePressed: () {
                              showHardwareReadinessPanel(context);
                            },
                            showDrawerButton: true,
                            onMenuPressed: _openDrawer,
                            onUserInteraction: _markCatalogInteraction,
                          ),
                        ),
                      ),
                      const SizedBox(width: 14, height: 14),
                      Expanded(
                        flex: wide ? 45 : 1,
                        child: const RepaintBoundary(child: _CartPanel()),
                      ),
                    ],
                  );
                },
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _CatalogPanel extends ConsumerStatefulWidget {
  const _CatalogPanel({
    required this.branchId,
    required this.cashierName,
    required this.onSyncPressed,
    required this.onEndShiftPressed,
    required this.onOutboxPressed,
    required this.onHardwarePressed,
    required this.showDrawerButton,
    required this.onMenuPressed,
    required this.onUserInteraction,
  });

  final String branchId;
  final String cashierName;
  final VoidCallback onSyncPressed;
  final VoidCallback onEndShiftPressed;
  final VoidCallback onOutboxPressed;
  final VoidCallback onHardwarePressed;
  final bool showDrawerButton;
  final VoidCallback? onMenuPressed;
  final VoidCallback onUserInteraction;

  @override
  ConsumerState<_CatalogPanel> createState() => _CatalogPanelState();
}

class _CatalogPanelState extends ConsumerState<_CatalogPanel> {
  static const double _nextPageThreshold = 1100;
  static const int _scannerRapidGapMs = 35;
  static const int _scannerResetGapMs = 140;
  static const int _scannerMaxLength = 64;
  late final ScrollController _catalogScrollController = Platform.isAndroid
      ? ScrollController()
      : AnimatedScrollController(animationFactory: const ChromiumImpulse());
  final Queue<String> _pendingScans = Queue<String>();
  final StringBuffer _scannerBuffer = StringBuffer();
  StreamSubscription<List<CatalogItemModel>>? _catalogItemsSubscription;
  Timer? _catalogReloadDebounce;
  List<CatalogItemModel> _items = const [];
  bool _loadingInitial = true;
  bool _loadingMore = false;
  bool _hasMore = true;
  bool _processingScans = false;
  int _offset = 0;
  int _totalCount = 0;
  int _activeRequestToken = 0;
  int _rapidScanTransitions = 0;
  DateTime? _scanStartedAt;
  DateTime? _lastScanKeyAt;
  String _lastFilterKey = '';
  String? _loadError;

  @override
  void initState() {
    super.initState();
    _catalogScrollController.addListener(_handleCatalogScroll);
    HardwareKeyboard.instance.addHandler(_onHardwareKeyEvent);
    _catalogItemsSubscription = ref
        .read(catalogRepositoryProvider)
        .watchItems()
        .listen((_) {
          if (!mounted) {
            return;
          }

          _catalogReloadDebounce?.cancel();
          _catalogReloadDebounce = Timer(const Duration(milliseconds: 180), () {
            if (!mounted) {
              return;
            }

            ref.invalidate(posCatalogCategoriesProvider(widget.branchId));
            _scheduleReload();
          });
        });
  }

  @override
  void didUpdateWidget(covariant _CatalogPanel oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.branchId != widget.branchId) {
      _scheduleReload();
    }
  }

  @override
  void dispose() {
    HardwareKeyboard.instance.removeHandler(_onHardwareKeyEvent);
    _catalogScrollController.removeListener(_handleCatalogScroll);
    _catalogScrollController.dispose();
    _catalogReloadDebounce?.cancel();
    _catalogItemsSubscription?.cancel();
    super.dispose();
  }

  void _handleCatalogScroll() {
    widget.onUserInteraction();
    _maybeLoadNextPage();
  }

  void _maybeLoadNextPage() {
    if (!_catalogScrollController.hasClients) {
      return;
    }

    if (_catalogScrollController.position.extentAfter < _nextPageThreshold) {
      _loadNextPage();
    }
  }

  void _ensureViewportFilled() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) {
        return;
      }
      _maybeLoadNextPage();
    });
  }

  void _scheduleReload() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) {
        return;
      }
      _reloadCatalog();
    });
  }

  Future<void> _reloadCatalog() async {
    final requestToken = ++_activeRequestToken;
    final search = ref.read(posSearchProvider).trim();
    final selectedCategory = ref.read(posCategoryProvider);
    final categoryFilter = selectedCategory == 'All' ? null : selectedCategory;
    final repository = ref.read(catalogRepositoryProvider);

    setState(() {
      _items = const [];
      _loadingInitial = true;
      _loadingMore = false;
      _hasMore = true;
      _offset = 0;
      _totalCount = 0;
      _loadError = null;
    });

    try {
      final totalCount = await repository.countItems(
        branchId: widget.branchId,
        categoryName: categoryFilter,
        search: search,
      );
      final firstPage = await repository.fetchItemsPage(
        branchId: widget.branchId,
        categoryName: categoryFilter,
        search: search,
        limit: catalogPageSize,
        offset: 0,
      );

      if (!mounted || requestToken != _activeRequestToken) {
        return;
      }

      setState(() {
        _items = firstPage;
        _loadingInitial = false;
        _offset = firstPage.length;
        _totalCount = totalCount;
        _hasMore = _offset < _totalCount;
      });
      _ensureViewportFilled();
    } catch (error) {
      if (!mounted || requestToken != _activeRequestToken) {
        return;
      }
      setState(() {
        _loadingInitial = false;
        _loadError = error.toString().split('\n').first;
      });
    }
  }

  Future<void> _loadNextPage() async {
    if (_loadingInitial || _loadingMore || !_hasMore) {
      return;
    }

    final requestToken = _activeRequestToken;
    final search = ref.read(posSearchProvider).trim();
    final selectedCategory = ref.read(posCategoryProvider);
    final categoryFilter = selectedCategory == 'All' ? null : selectedCategory;
    final repository = ref.read(catalogRepositoryProvider);

    setState(() {
      _loadingMore = true;
    });

    try {
      final page = await repository.fetchItemsPage(
        branchId: widget.branchId,
        categoryName: categoryFilter,
        search: search,
        limit: catalogPageSize,
        offset: _offset,
      );

      if (!mounted || requestToken != _activeRequestToken) {
        return;
      }

      setState(() {
        _items = [..._items, ...page];
        _offset = _items.length;
        _hasMore = _offset < _totalCount && page.isNotEmpty;
        _loadingMore = false;
      });

      if (_hasMore) {
        _ensureViewportFilled();
      }
    } catch (error) {
      if (!mounted || requestToken != _activeRequestToken) {
        return;
      }
      setState(() {
        _loadingMore = false;
        _hasMore = false;
        _loadError = error.toString().split('\n').first;
      });
    }
  }

  bool _onHardwareKeyEvent(KeyEvent event) {
    if (event is! KeyDownEvent || !mounted) {
      return false;
    }

    if (_hasModifierPressed()) {
      _resetScannerCapture();
      return false;
    }

    final key = event.logicalKey;
    final now = DateTime.now();
    final isEnter =
        key == LogicalKeyboardKey.enter ||
        key == LogicalKeyboardKey.numpadEnter;
    final isBackspace = key == LogicalKeyboardKey.backspace;

    if (isEnter) {
      final scannedCode = _scannerBuffer.toString().trim();
      final likelyScanner = _isLikelyScannerPayload(scannedCode, now);
      _resetScannerCapture();
      if (!likelyScanner) {
        return false;
      }
      _enqueueScannedCode(scannedCode);
      return true;
    }

    if (isBackspace) {
      if (_scannerBuffer.isEmpty) {
        return false;
      }
      final value = _scannerBuffer.toString();
      _scannerBuffer
        ..clear()
        ..write(value.substring(0, value.length - 1));
      return _isScannerLikelyInProgress();
    }

    final keyFragment = _extractScannableKey(event);
    if (keyFragment == null) {
      return false;
    }

    if (_lastScanKeyAt != null) {
      final gapMs = now.difference(_lastScanKeyAt!).inMilliseconds;
      if (gapMs > _scannerResetGapMs) {
        _resetScannerCapture();
      } else if (gapMs <= _scannerRapidGapMs) {
        _rapidScanTransitions += 1;
      }
    }

    _lastScanKeyAt = now;
    _scanStartedAt ??= now;

    if (_scannerBuffer.length >= _scannerMaxLength) {
      _resetScannerCapture();
      return false;
    }

    _scannerBuffer.write(keyFragment);
    return _isScannerLikelyInProgress();
  }

  bool _hasModifierPressed() {
    final keyboard = HardwareKeyboard.instance;
    return keyboard.isAltPressed ||
        keyboard.isControlPressed ||
        keyboard.isMetaPressed;
  }

  String? _extractScannableKey(KeyEvent event) {
    final character = event.character;
    final source = (character != null && character.isNotEmpty)
        ? character
        : event.logicalKey.keyLabel;
    if (source.isEmpty || source.length != 1) {
      return null;
    }

    final codeUnit = source.codeUnitAt(0);
    if (codeUnit < 32 || codeUnit > 126) {
      return null;
    }

    return source;
  }

  bool _isLikelyScannerPayload(String code, DateTime endedAt) {
    if (code.length < 4 || _scanStartedAt == null) {
      return false;
    }

    final durationMs = endedAt.difference(_scanStartedAt!).inMilliseconds;
    if (durationMs <= 0) {
      return false;
    }

    if (_rapidScanTransitions >= 3 && durationMs <= 900) {
      return true;
    }

    return code.length >= 8 && durationMs <= 650;
  }

  bool _isScannerLikelyInProgress() {
    if (_scannerBuffer.isEmpty) {
      return false;
    }

    if (_rapidScanTransitions >= 2) {
      return true;
    }

    if (_scanStartedAt == null) {
      return false;
    }

    final elapsedMs = DateTime.now().difference(_scanStartedAt!).inMilliseconds;
    return _scannerBuffer.length >= 6 && elapsedMs <= 700;
  }

  void _resetScannerCapture() {
    _scannerBuffer.clear();
    _scanStartedAt = null;
    _lastScanKeyAt = null;
    _rapidScanTransitions = 0;
  }

  void _enqueueScannedCode(String code) {
    final normalized = code.trim();
    if (normalized.isEmpty) {
      return;
    }
    _pendingScans.addLast(normalized);
    if (!_processingScans) {
      unawaited(_drainPendingScans());
    }
  }

  Future<void> _drainPendingScans() async {
    if (_processingScans) {
      return;
    }

    _processingScans = true;
    final repository = ref.read(catalogRepositoryProvider);
    try {
      while (_pendingScans.isNotEmpty) {
        final code = _pendingScans.removeFirst();
        final item = await repository.findItemByScanCode(
          branchId: widget.branchId,
          code: code,
        );

        if (!mounted) {
          return;
        }

        if (item == null) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text('Scanned code not found: $code')),
          );
          continue;
        }

        widget.onUserInteraction();
        ref.read(cartControllerProvider.notifier).addItem(item);
      }
    } finally {
      _processingScans = false;
    }
  }

  @override
  Widget build(BuildContext context) {
    final isAndroid = Platform.isAndroid;
    final panelColor = isAndroid ? _PosColors.androidPanel : _PosColors.surface;
    final panelBorder = isAndroid
        ? _PosColors.androidPanelBorder
        : _PosColors.border;
    final headerColor = isAndroid
        ? _PosColors.androidHeader
        : _PosColors.titleNavy;
    final titleColor = isAndroid
        ? _PosColors.androidText
        : const Color(0xFFF0F5FD);
    final subtitleColor = isAndroid
        ? _PosColors.androidTextMuted
        : const Color(0xFFC3D2E8);
    final categoriesState = ref.watch(
      posCatalogCategoriesProvider(widget.branchId),
    );
    final selectedCategory = ref.watch(posCategoryProvider);
    final searchValue = ref.watch(posSearchProvider);
    final categories = categoriesState.value ?? const <String>['All'];
    final effectiveCategory = categories.contains(selectedCategory)
        ? selectedCategory
        : 'All';

    if (effectiveCategory != selectedCategory) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (!mounted) {
          return;
        }
        ref.read(posCategoryProvider.notifier).state = 'All';
      });
    }

    final filterKey =
        '${widget.branchId}|$effectiveCategory|${searchValue.trim()}';
    if (_lastFilterKey != filterKey) {
      _lastFilterKey = filterKey;
      _scheduleReload();
    }

    return Card(
      color: panelColor,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(28),
        side: BorderSide(color: panelBorder),
      ),
      clipBehavior: Clip.antiAlias,
      child: Column(
        children: [
          Container(
            color: headerColor,
            padding: const EdgeInsets.fromLTRB(20, 14, 20, 14),
            child: Row(
              children: [
                if (widget.showDrawerButton) ...[
                  Container(
                    decoration: BoxDecoration(
                      color: isAndroid
                          ? _PosColors.androidActionBg
                          : Colors.white.withValues(alpha: 0.08),
                      shape: BoxShape.circle,
                    ),
                    child: IconButton(
                      tooltip: 'Open navigation',
                      onPressed: widget.onMenuPressed,
                      icon: Icon(Icons.menu_rounded, color: titleColor),
                    ),
                  ),
                  const SizedBox(width: 12),
                ],
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'POS',
                        style: Theme.of(context).textTheme.headlineSmall
                            ?.copyWith(
                              fontWeight: FontWeight.w600,
                              color: titleColor,
                            ),
                      ),
                      const SizedBox(height: 4),
                      _QueueSummary(
                        cashierName: widget.cashierName,
                        style: TextStyle(
                          color: subtitleColor,
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        'BIGTIME POS $posAppVersionLabel',
                        style: TextStyle(
                          color: subtitleColor.withValues(alpha: 0.6),
                          fontSize: 10,
                          letterSpacing: 0.8,
                        ),
                      ),
                    ],
                  ),
                ),
                Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    _EndShiftButton(onPressed: widget.onEndShiftPressed),
                    const SizedBox(width: 8),
                    if (Platform.isWindows) ...[
                      _OutboxButton(onPressed: widget.onOutboxPressed),
                      const SizedBox(width: 8),
                      _HardwareButton(onPressed: widget.onHardwarePressed),
                      const SizedBox(width: 8),
                    ],
                    _CustomerDisplayButton(
                      onPressed: () => showCustomerDisplayControls(context),
                    ),
                    const SizedBox(width: 8),
                    _SyncButton(onPressed: widget.onSyncPressed),
                  ],
                ),
              ],
            ),
          ),
          Expanded(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(16, 14, 16, 16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  _DebouncedCatalogSearchField(
                    onUserInteraction: widget.onUserInteraction,
                  ),
                  const SizedBox(height: 12),
                  SizedBox(
                    height: 40,
                    child: _SmoothScrollRegion(
                      axis: Axis.horizontal,
                      child: ListView.separated(
                        scrollDirection: Axis.horizontal,
                        itemBuilder: (context, index) {
                          final category = categories[index];
                          final selected = category == effectiveCategory;
                          return _SelectionPill(
                            label: Text(category),
                            selected: selected,
                            onPressed: () {
                              widget.onUserInteraction();
                              ref.read(posCategoryProvider.notifier).state =
                                  category;
                            },
                          );
                        },
                        separatorBuilder: (_, _) => const SizedBox(width: 8),
                        itemCount: categories.length,
                      ),
                    ),
                  ),
                  const SizedBox(height: 14),
                  Expanded(
                    child: LayoutBuilder(
                      builder: (context, constraints) {
                        final crossAxisCount = _catalogCrossAxisCount(
                          constraints.maxWidth,
                        );
                        final childAspectRatio = _catalogChildAspectRatio(
                          constraints.maxWidth,
                        );
                        if (_loadingInitial && _items.isEmpty) {
                          return const Center(
                            child: CircularProgressIndicator(),
                          );
                        }

                        if (_loadError != null && _items.isEmpty) {
                          return Center(
                            child: Text(
                              'Catalog load failed: $_loadError',
                              textAlign: TextAlign.center,
                            ),
                          );
                        }

                        if (_items.isEmpty) {
                          return const Center(
                            child: Text(
                              'No items match the current branch and search filter.',
                            ),
                          );
                        }

                        final visibleCount =
                            _items.length + (_loadingMore ? 1 : 0);

                        return _SmoothScrollRegion(
                          child: GridView.builder(
                            controller: _catalogScrollController,
                            cacheExtent: Platform.isAndroid ? 360 : 1400,
                            addAutomaticKeepAlives: false,
                            addRepaintBoundaries: true,
                            addSemanticIndexes: false,
                            gridDelegate:
                                SliverGridDelegateWithFixedCrossAxisCount(
                                  crossAxisCount: crossAxisCount,
                                  mainAxisSpacing: 8,
                                  crossAxisSpacing: 8,
                                  childAspectRatio: childAspectRatio,
                                ),
                            itemCount: visibleCount,
                            itemBuilder: (context, index) {
                              if (index >= _items.length) {
                                return const Center(
                                  child: SizedBox(
                                    height: 22,
                                    width: 22,
                                    child: CircularProgressIndicator(
                                      strokeWidth: 2,
                                    ),
                                  ),
                                );
                              }

                              final item = _items[index];
                              return _CatalogItemCard(
                                key: ValueKey(item.id),
                                item: item,
                                onPressed: () => ref
                                    .read(cartControllerProvider.notifier)
                                    .addItem(item),
                              );
                            },
                          ),
                        );
                      },
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

int _catalogCrossAxisCount(double width) {
  if (width >= 1180) {
    return 5;
  }
  if (width >= 900) {
    return 4;
  }
  if (width >= 620) {
    return 3;
  }
  return 2;
}

double _catalogChildAspectRatio(double width) {
  if (width >= 1180) {
    return 1.28;
  }
  if (width >= 900) {
    return 1.26;
  }
  if (width >= 620) {
    return 1.34;
  }
  return 1.08;
}

class _QueueSummary extends ConsumerWidget {
  const _QueueSummary({required this.cashierName, this.style});

  final String cashierName;
  final TextStyle? style;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final pendingSyncCount = ref.watch(pendingSyncCountProvider).value ?? 0;
    return Text('$cashierName | Queue $pendingSyncCount', style: style);
  }
}

class _SyncButton extends ConsumerWidget {
  const _SyncButton({required this.onPressed});

  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final isAndroid = Platform.isAndroid;
    final isOnline = ref.watch(onlineStatusProvider).value ?? false;
    return FilledButton.icon(
      onPressed: onPressed,
      style: FilledButton.styleFrom(
        backgroundColor: isAndroid
            ? const Color(0x2D16A34A)
            : _PosColors.payBlueStart,
        foregroundColor: isAndroid ? _PosColors.androidText : Colors.white,
        side: isAndroid
            ? const BorderSide(color: Color(0x6658D0A9))
            : BorderSide.none,
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 11),
        textStyle: const TextStyle(fontWeight: FontWeight.w600),
      ),
      icon: Icon(
        isOnline ? Icons.cloud_done_outlined : Icons.cloud_off_outlined,
      ),
      label: Text(isOnline ? 'Sync' : 'Offline'),
    );
  }
}

class _CustomerDisplayButton extends StatelessWidget {
  const _CustomerDisplayButton({required this.onPressed});

  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    final isAndroid = Platform.isAndroid;
    return OutlinedButton.icon(
      onPressed: onPressed,
      style: OutlinedButton.styleFrom(
        foregroundColor: isAndroid
            ? _PosColors.androidText
            : const Color(0xFFF0F5FD),
        backgroundColor: isAndroid
            ? _PosColors.androidActionBg
            : const Color(0x1C5B77A0),
        side: BorderSide(
          color: isAndroid
              ? _PosColors.androidActionBorder
              : const Color(0x66D5E3F8),
        ),
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 11),
        textStyle: const TextStyle(fontWeight: FontWeight.w600),
      ),
      icon: const Icon(Icons.monitor_outlined),
      label: const Text('CFD'),
    );
  }
}

class _OutboxButton extends StatelessWidget {
  const _OutboxButton({required this.onPressed});

  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    final isAndroid = Platform.isAndroid;
    return OutlinedButton.icon(
      onPressed: onPressed,
      style: OutlinedButton.styleFrom(
        foregroundColor: isAndroid
            ? _PosColors.androidText
            : const Color(0xFFF0F5FD),
        backgroundColor: isAndroid
            ? _PosColors.androidActionBg
            : const Color(0x1C5B77A0),
        side: BorderSide(
          color: isAndroid
              ? _PosColors.androidActionBorder
              : const Color(0x66D5E3F8),
        ),
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 11),
        textStyle: const TextStyle(fontWeight: FontWeight.w600),
      ),
      icon: const Icon(Icons.sync_alt_outlined),
      label: const Text('Outbox'),
    );
  }
}

class _HardwareButton extends StatelessWidget {
  const _HardwareButton({required this.onPressed});

  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    final isAndroid = Platform.isAndroid;
    return OutlinedButton.icon(
      onPressed: onPressed,
      style: OutlinedButton.styleFrom(
        foregroundColor: isAndroid
            ? _PosColors.androidText
            : const Color(0xFFF0F5FD),
        backgroundColor: isAndroid
            ? _PosColors.androidActionBg
            : const Color(0x1C5B77A0),
        side: BorderSide(
          color: isAndroid
              ? _PosColors.androidActionBorder
              : const Color(0x66D5E3F8),
        ),
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 11),
        textStyle: const TextStyle(fontWeight: FontWeight.w600),
      ),
      icon: const Icon(Icons.developer_board_outlined),
      label: const Text('Hardware'),
    );
  }
}

class _EndShiftButton extends StatelessWidget {
  const _EndShiftButton({required this.onPressed});

  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    final isAndroid = Platform.isAndroid;
    return OutlinedButton.icon(
      onPressed: onPressed,
      style: OutlinedButton.styleFrom(
        foregroundColor: isAndroid
            ? _PosColors.androidText
            : const Color(0xFFF0F5FD),
        backgroundColor: isAndroid
            ? _PosColors.androidActionBg
            : const Color(0x1C5B77A0),
        side: BorderSide(
          color: isAndroid
              ? _PosColors.androidActionBorder
              : const Color(0x66D5E3F8),
        ),
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 11),
        textStyle: const TextStyle(fontWeight: FontWeight.w600),
      ),
      icon: const Icon(Icons.logout_outlined),
      label: const Text('End Shift'),
    );
  }
}

class _HeaderIconButton extends StatelessWidget {
  const _HeaderIconButton({required this.icon, required this.onTap});

  final IconData icon;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      borderRadius: BorderRadius.circular(12),
      onTap: onTap,
      child: Container(
        width: 34,
        height: 34,
        decoration: BoxDecoration(
          color: _PosColors.androidActionBg,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: _PosColors.androidActionBorder),
        ),
        child: Icon(icon, size: 16, color: _PosColors.androidText),
      ),
    );
  }
}

class _CatalogItemCard extends StatelessWidget {
  const _CatalogItemCard({
    super.key,
    required this.item,
    required this.onPressed,
  });

  final CatalogItemModel item;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    final isWindows = Platform.isWindows;
    final isAndroid = Platform.isAndroid;
    final titleColor = isAndroid
        ? _PosColors.androidText
        : _PosColors.titleNavy;
    final amountColor = isAndroid
        ? const Color(0xFFE2E8F0)
        : _PosColors.amountStrong;
    return DecoratedBox(
      decoration: BoxDecoration(
        color: isAndroid ? _PosColors.androidPanelSoft : _PosColors.surfaceSoft,
        gradient: isAndroid
            ? const LinearGradient(
                begin: Alignment.topCenter,
                end: Alignment.bottomCenter,
                colors: [Color(0x14FFFFFF), Color(0x0AFFFFFF)],
              )
            : null,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: isAndroid
              ? _PosColors.androidPanelBorder
              : _PosColors.borderSoft,
        ),
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          borderRadius: BorderRadius.circular(16),
          hoverColor: isWindows
              ? Colors.transparent
              : (isAndroid ? const Color(0x1F334155) : const Color(0x1A3B5B8A)),
          splashFactory: isWindows
              ? NoSplash.splashFactory
              : InkRipple.splashFactory,
          highlightColor: isWindows ? Colors.transparent : null,
          onTap: onPressed,
          child: Padding(
            padding: const EdgeInsets.fromLTRB(12, 12, 12, 10),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  item.name,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: Theme.of(context).textTheme.titleSmall?.copyWith(
                    color: titleColor,
                    fontWeight: FontWeight.w700,
                    height: 1.1,
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  formatMoney(item.priceMinor),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                    color: amountColor,
                    fontWeight: FontWeight.w700,
                    fontSize: 18,
                    height: 1.05,
                  ),
                ),
                const Spacer(),
                Wrap(
                  spacing: 4,
                  runSpacing: 4,
                  children: [
                    _ItemTag(label: item.vatType),
                    _ItemTag(label: item.hasVariants ? 'Variants' : item.unit),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _CartPanel extends ConsumerWidget {
  const _CartPanel();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final cart = ref.watch(cartControllerProvider);
    final isAndroid = Platform.isAndroid;
    final panelColor = isAndroid ? _PosColors.androidPanel : _PosColors.surface;
    final panelBorder = isAndroid
        ? _PosColors.androidPanelBorder
        : _PosColors.border;
    final headerColor = isAndroid
        ? _PosColors.androidHeader
        : _PosColors.titleNavy;
    final headerTextColor = isAndroid
        ? _PosColors.androidText
        : const Color(0xFFF0F5FD);
    final rowBg = isAndroid
        ? _PosColors.androidPanelSoft
        : _PosColors.surfaceSoft;
    final rowBorder = isAndroid
        ? _PosColors.androidPanelBorder
        : _PosColors.borderSoft;
    final rowText = isAndroid ? _PosColors.androidText : _PosColors.titleNavy;
    final amountText = isAndroid
        ? const Color(0xFFE2E8F0)
        : _PosColors.amountStrong;

    return Card(
      color: panelColor,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(28),
        side: BorderSide(color: panelBorder),
      ),
      clipBehavior: Clip.antiAlias,
      child: Column(
        children: [
          Container(
            color: headerColor,
            width: double.infinity,
            padding: const EdgeInsets.fromLTRB(14, 10, 14, 10),
            child: Row(
              children: [
                Expanded(
                  child: Text(
                    'Cart | ${cart.itemCount} items',
                    style: Theme.of(context).textTheme.titleLarge?.copyWith(
                      color: headerTextColor,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
                if (isAndroid)
                  Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      _HeaderIconButton(
                        icon: Icons.open_in_full_rounded,
                        onTap: () {},
                      ),
                      const SizedBox(width: 6),
                      _HeaderIconButton(
                        icon: Icons.smartphone_rounded,
                        onTap: () {},
                      ),
                    ],
                  ),
              ],
            ),
          ),
          Expanded(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(12, 10, 12, 10),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const _CartColumnHeader(),
                  const SizedBox(height: 6),
                  Expanded(
                    child: cart.lines.isEmpty
                        ? Center(
                            child: Text(
                              'Tap an item to build a basket.',
                              style: TextStyle(
                                color: isAndroid
                                    ? _PosColors.androidTextMuted
                                    : _PosColors.headerLabel,
                              ),
                            ),
                          )
                        : _SmoothScrollRegion(
                            child: ListView.builder(
                              cacheExtent: Platform.isAndroid ? 220 : 900,
                              addAutomaticKeepAlives: false,
                              addRepaintBoundaries: true,
                              addSemanticIndexes: false,
                              itemExtent: 56,
                              itemCount: cart.lines.length,
                              itemBuilder: (context, index) {
                                final line = cart.lines[index];
                                return RepaintBoundary(
                                  child: Container(
                                    margin: const EdgeInsets.symmetric(
                                      vertical: 3,
                                    ),
                                    decoration: BoxDecoration(
                                      color: rowBg,
                                      borderRadius: BorderRadius.circular(10),
                                      border: Border.all(color: rowBorder),
                                    ),
                                    padding: const EdgeInsets.symmetric(
                                      horizontal: 8,
                                      vertical: 6,
                                    ),
                                    child: Row(
                                      children: [
                                        Expanded(
                                          child: Text(
                                            line.item.name,
                                            maxLines: 1,
                                            overflow: TextOverflow.ellipsis,
                                            style: TextStyle(
                                              color: rowText,
                                              fontSize: 12,
                                              fontWeight: FontWeight.w600,
                                            ),
                                          ),
                                        ),
                                        const SizedBox(width: 6),
                                        _CartQuantityStepper(
                                          quantity: line.quantity,
                                          onDecrease: () => ref
                                              .read(
                                                cartControllerProvider.notifier,
                                              )
                                              .updateQuantity(
                                                line.item.id,
                                                line.quantity - 1,
                                              ),
                                          onIncrease: () => ref
                                              .read(
                                                cartControllerProvider.notifier,
                                              )
                                              .updateQuantity(
                                                line.item.id,
                                                line.quantity + 1,
                                              ),
                                        ),
                                        const SizedBox(width: 8),
                                        SizedBox(
                                          width: 84,
                                          child: Text(
                                            formatMoney(line.lineTotalMinor),
                                            textAlign: TextAlign.end,
                                            style: TextStyle(
                                              color: amountText,
                                              fontSize: 12,
                                              fontWeight: FontWeight.w700,
                                            ),
                                          ),
                                        ),
                                      ],
                                    ),
                                  ),
                                );
                              },
                            ),
                          ),
                  ),
                  const SizedBox(height: 8),
                  _TotalRow(
                    label: 'Subtotal',
                    value: formatMoney(cart.subtotalMinor),
                  ),
                  if (cart.hasDiscount)
                    _TotalRow(
                      label: 'Discount',
                      value: '- ${formatMoney(cart.discountMinor)}',
                    ),
                  _TotalRow(label: 'VAT', value: formatMoney(cart.vatMinor)),
                  _TotalRow(
                    label: 'TOTAL',
                    value: formatMoney(cart.totalMinor),
                    emphasize: true,
                  ),
                  if (cart.hasDiscount) ...[
                    const SizedBox(height: 6),
                    Text(
                      'Applied discount: ${_discountSummary(cart)}',
                      style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                        color: _PosColors.headerLabel,
                        fontSize: 11,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                  ],
                  const SizedBox(height: 8),
                  SingleChildScrollView(
                    scrollDirection: Axis.horizontal,
                    child: Row(
                      children: [
                        OutlinedButton(
                          onPressed: cart.lines.isEmpty
                              ? null
                              : () => _showDiscountEditor(
                                  context: context,
                                  ref: ref,
                                  cart: cart,
                                ),
                          style: OutlinedButton.styleFrom(
                            minimumSize: const Size(0, 30),
                            padding: const EdgeInsets.symmetric(
                              horizontal: 10,
                              vertical: 6,
                            ),
                            tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                            visualDensity: VisualDensity.compact,
                            foregroundColor: isAndroid
                                ? _PosColors.androidText
                                : _PosColors.headerLabel,
                            side: BorderSide(
                              color: isAndroid
                                  ? _PosColors.androidActionBorder
                                  : _PosColors.borderSoft,
                            ),
                            backgroundColor: isAndroid
                                ? _PosColors.androidActionBg
                                : _PosColors.surfaceSoft,
                          ),
                          child: Text(
                            cart.hasDiscount ? 'Edit Discount' : 'Discount',
                            style: const TextStyle(fontSize: 12),
                          ),
                        ),
                        const SizedBox(width: 6),
                        OutlinedButton(
                          onPressed: () {},
                          style: OutlinedButton.styleFrom(
                            minimumSize: const Size(0, 30),
                            padding: const EdgeInsets.symmetric(
                              horizontal: 10,
                              vertical: 6,
                            ),
                            tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                            visualDensity: VisualDensity.compact,
                            foregroundColor: isAndroid
                                ? _PosColors.androidText
                                : _PosColors.headerLabel,
                            side: BorderSide(
                              color: isAndroid
                                  ? _PosColors.androidActionBorder
                                  : _PosColors.borderSoft,
                            ),
                            backgroundColor: isAndroid
                                ? _PosColors.androidActionBg
                                : _PosColors.surfaceSoft,
                          ),
                          child: const Text(
                            'Hold',
                            style: TextStyle(fontSize: 12),
                          ),
                        ),
                        const SizedBox(width: 6),
                        OutlinedButton(
                          onPressed: () {
                            ref.read(cartControllerProvider.notifier).clear();
                            ScaffoldMessenger.of(context).showSnackBar(
                              const SnackBar(
                                content: Text('Cart voided locally.'),
                              ),
                            );
                          },
                          style: OutlinedButton.styleFrom(
                            minimumSize: const Size(0, 30),
                            padding: const EdgeInsets.symmetric(
                              horizontal: 10,
                              vertical: 6,
                            ),
                            tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                            visualDensity: VisualDensity.compact,
                            foregroundColor: isAndroid
                                ? _PosColors.androidText
                                : _PosColors.headerLabel,
                            side: BorderSide(
                              color: isAndroid
                                  ? _PosColors.androidActionBorder
                                  : _PosColors.borderSoft,
                            ),
                            backgroundColor: isAndroid
                                ? _PosColors.androidActionBg
                                : _PosColors.surfaceSoft,
                          ),
                          child: const Text(
                            'Void',
                            style: TextStyle(fontSize: 12),
                          ),
                        ),
                        const SizedBox(width: 6),
                        OutlinedButton(
                          onPressed: cart.lines.isEmpty
                              ? null
                              : () {
                                  ref
                                      .read(cartControllerProvider.notifier)
                                      .clear();
                                  ScaffoldMessenger.of(context).showSnackBar(
                                    const SnackBar(
                                      content: Text('Cart cleared.'),
                                    ),
                                  );
                                },
                          style: OutlinedButton.styleFrom(
                            minimumSize: const Size(0, 30),
                            padding: const EdgeInsets.symmetric(
                              horizontal: 10,
                              vertical: 6,
                            ),
                            tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                            visualDensity: VisualDensity.compact,
                            foregroundColor: isAndroid
                                ? const Color(0xFFFCA5A5)
                                : const Color(0xFFB91C1C),
                            side: BorderSide(
                              color: isAndroid
                                  ? _PosColors.androidDangerBorder
                                  : const Color(0xFFFCA5A5),
                            ),
                            backgroundColor: isAndroid
                                ? _PosColors.androidDangerBg
                                : const Color(0xFFFEF2F2),
                          ),
                          child: const Text(
                            'Clear Cart',
                            style: TextStyle(fontSize: 12),
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 8),
                  _GradientChargeButton(
                    enabled: cart.itemCount > 0,
                    amountLabel: formatMoney(cart.totalMinor),
                    onPressed: () => ref
                        .read(appFlowControllerProvider.notifier)
                        .startPayment(),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _DiscountSheetResult {
  const _DiscountSheetResult.apply(this.discount) : clear = false;

  const _DiscountSheetResult.clear() : discount = null, clear = true;

  final CartDiscount? discount;
  final bool clear;
}

Future<void> _showDiscountEditor({
  required BuildContext context,
  required WidgetRef ref,
  required CartState cart,
}) async {
  final existing = cart.discount;
  final valueController = TextEditingController(
    text: existing?.editorValue ?? '',
  );
  var selectedType = existing?.type ?? CartDiscountType.amount;

  final result = await showDialog<_DiscountSheetResult>(
    context: context,
    builder: (dialogContext) {
      return StatefulBuilder(
        builder: (dialogContext, setDialogState) {
          final draftDiscount = _parseCartDiscount(
            type: selectedType,
            rawValue: valueController.text,
          );
          final previewMinor =
              draftDiscount?.resolveMinor(cart.subtotalMinor) ?? 0;
          final projectedTotalMinor = (cart.subtotalMinor - previewMinor)
              .clamp(0, cart.subtotalMinor)
              .toInt();

          return AlertDialog(
            scrollable: true,
            title: const Text('Apply discount'),
            content: SizedBox(
              width: 420,
              child: SingleChildScrollView(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Choose a flat amount or percentage discount for the current basket.',
                      style: Theme.of(dialogContext).textTheme.bodyMedium
                          ?.copyWith(color: _PosColors.headerLabel),
                    ),
                    const SizedBox(height: 12),
                    Text(
                      'GOVERNMENT DISCOUNTS',
                      style: Theme.of(dialogContext).textTheme.labelSmall
                          ?.copyWith(
                            color: _PosColors.headerLabel,
                            letterSpacing: 0.8,
                            fontWeight: FontWeight.w600,
                          ),
                    ),
                    const SizedBox(height: 8),
                    Wrap(
                      spacing: 8,
                      runSpacing: 8,
                      children: [
                        FilledButton.tonal(
                          onPressed: () => Navigator.of(
                            dialogContext,
                          ).pop(
                            _DiscountSheetResult.apply(
                              CartDiscount.percentage(
                                percentage: 20,
                                discountLabel: 'SC DISCOUNT',
                              ),
                            ),
                          ),
                          child: const Text('SC 20%'),
                        ),
                        FilledButton.tonal(
                          onPressed: () => Navigator.of(
                            dialogContext,
                          ).pop(
                            _DiscountSheetResult.apply(
                              CartDiscount.percentage(
                                percentage: 20,
                                discountLabel: 'PWD DISCOUNT',
                              ),
                            ),
                          ),
                          child: const Text('PWD 20%'),
                        ),
                      ],
                    ),
                    const SizedBox(height: 16),
                    Wrap(
                      spacing: 8,
                      runSpacing: 8,
                      children: [
                        ChoiceChip(
                          label: const Text('Amount'),
                          selected: selectedType == CartDiscountType.amount,
                          onSelected: (_) {
                            setDialogState(() {
                              selectedType = CartDiscountType.amount;
                            });
                          },
                        ),
                        ChoiceChip(
                          label: const Text('Percentage'),
                          selected: selectedType == CartDiscountType.percentage,
                          onSelected: (_) {
                            setDialogState(() {
                              selectedType = CartDiscountType.percentage;
                            });
                          },
                        ),
                      ],
                    ),
                    const SizedBox(height: 16),
                    TextField(
                      controller: valueController,
                      autofocus: false,
                      keyboardType: const TextInputType.numberWithOptions(
                        decimal: true,
                      ),
                      decoration: InputDecoration(
                        labelText: selectedType == CartDiscountType.amount
                            ? 'Discount amount'
                            : 'Discount percent',
                        hintText: selectedType == CartDiscountType.amount
                            ? '0.00'
                            : '10',
                        prefixText: selectedType == CartDiscountType.amount
                            ? 'PHP '
                            : null,
                        suffixText: selectedType == CartDiscountType.percentage
                            ? '%'
                            : null,
                        border: const OutlineInputBorder(),
                      ),
                      onChanged: (_) => setDialogState(() {}),
                    ),
                    const SizedBox(height: 16),
                    Container(
                      width: double.infinity,
                      padding: const EdgeInsets.all(14),
                      decoration: BoxDecoration(
                        color: _PosColors.surfaceSoft,
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(color: _PosColors.borderSoft),
                      ),
                      child: Column(
                        children: [
                          _TotalRow(
                            label: 'Current subtotal',
                            value: formatMoney(cart.subtotalMinor),
                          ),
                          _TotalRow(
                            label: 'Discount preview',
                            value: '- ${formatMoney(previewMinor)}',
                          ),
                          _TotalRow(
                            label: 'New total',
                            value: formatMoney(projectedTotalMinor),
                            emphasize: true,
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),
            actions: [
              if (cart.hasDiscount)
                TextButton(
                  onPressed: () => Navigator.of(
                    dialogContext,
                  ).pop(const _DiscountSheetResult.clear()),
                  child: const Text('Remove'),
                ),
              TextButton(
                onPressed: () => Navigator.of(dialogContext).pop(),
                child: const Text('Cancel'),
              ),
              FilledButton(
                onPressed: previewMinor <= 0
                    ? null
                    : () => Navigator.of(
                        dialogContext,
                      ).pop(_DiscountSheetResult.apply(draftDiscount!)),
                child: const Text('Apply'),
              ),
            ],
          );
        },
      );
    },
  );

  valueController.dispose();

  if (result == null) {
    return;
  }

  final cartController = ref.read(cartControllerProvider.notifier);
  if (result.clear) {
    cartController.clearDiscount();
    return;
  }

  final discount = result.discount;
  if (discount == null) {
    return;
  }

  cartController.applyDiscount(discount);
}

CartDiscount? _parseCartDiscount({
  required CartDiscountType type,
  required String rawValue,
}) {
  final trimmed = rawValue.trim().replaceAll('%', '');
  if (trimmed.isEmpty) {
    return null;
  }

  return switch (type) {
    CartDiscountType.amount => () {
      final amountMinor = moneyFromText(trimmed);
      if (amountMinor <= 0) {
        return null;
      }
      return CartDiscount.amount(amountMinor: amountMinor);
    }(),
    CartDiscountType.percentage => () {
      final percentage = double.tryParse(trimmed) ?? 0;
      if (percentage <= 0) {
        return null;
      }
      return CartDiscount.percentage(percentage: percentage);
    }(),
  };
}

String _discountSummary(CartState cart) {
  final discount = cart.discount;
  if (discount == null || !cart.hasDiscount) {
    return 'None';
  }

  return switch (discount.type) {
    CartDiscountType.amount => 'Flat ${formatMoney(cart.discountMinor)} off',
    CartDiscountType.percentage => '${discount.displayLabel} off',
  };
}

class _CartColumnHeader extends StatelessWidget {
  const _CartColumnHeader();

  @override
  Widget build(BuildContext context) {
    final isAndroid = Platform.isAndroid;
    final bg = isAndroid ? _PosColors.androidActionBg : _PosColors.headerTint;
    final border = isAndroid
        ? _PosColors.androidPanelBorder
        : _PosColors.borderSoft;
    final textColor = isAndroid
        ? _PosColors.androidTextMuted
        : _PosColors.headerLabel;
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: border),
      ),
      child: Row(
        children: [
          Expanded(
            child: Text(
              'ITEM',
              style: TextStyle(
                fontSize: 10,
                color: textColor,
                fontWeight: FontWeight.w500,
                letterSpacing: 0.6,
              ),
            ),
          ),
          SizedBox(width: 74),
          SizedBox(
            width: 84,
            child: Text(
              'AMOUNT',
              textAlign: TextAlign.end,
              style: TextStyle(
                fontSize: 10,
                color: textColor,
                fontWeight: FontWeight.w500,
                letterSpacing: 0.6,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _CartQuantityStepper extends StatelessWidget {
  const _CartQuantityStepper({
    required this.quantity,
    required this.onDecrease,
    required this.onIncrease,
  });

  final int quantity;
  final VoidCallback onDecrease;
  final VoidCallback onIncrease;

  @override
  Widget build(BuildContext context) {
    final isAndroid = Platform.isAndroid;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 3, vertical: 1),
      decoration: BoxDecoration(
        color: isAndroid ? _PosColors.androidActionBg : _PosColors.qtyBg,
        borderRadius: BorderRadius.circular(7),
        border: Border.all(
          color: isAndroid
              ? _PosColors.androidPanelBorder
              : _PosColors.borderSoft,
        ),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          _CartStepperButton(icon: Icons.remove_rounded, onTap: onDecrease),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 6),
            child: Text(
              '$quantity',
              style: TextStyle(
                color: isAndroid ? _PosColors.androidText : _PosColors.qtyText,
                fontSize: 11.5,
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
          _CartStepperButton(icon: Icons.add_rounded, onTap: onIncrease),
        ],
      ),
    );
  }
}

class _CartStepperButton extends StatelessWidget {
  const _CartStepperButton({required this.icon, required this.onTap});

  final IconData icon;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final isAndroid = Platform.isAndroid;
    return InkWell(
      borderRadius: BorderRadius.circular(5),
      onTap: onTap,
      child: SizedBox(
        width: 18,
        height: 18,
        child: Icon(
          icon,
          size: 12,
          color: isAndroid
              ? _PosColors.androidTextMuted
              : _PosColors.headerLabel,
        ),
      ),
    );
  }
}

class _GradientChargeButton extends StatelessWidget {
  const _GradientChargeButton({
    required this.enabled,
    required this.amountLabel,
    required this.onPressed,
  });

  final bool enabled;
  final String amountLabel;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    final isAndroid = Platform.isAndroid;
    final borderRadius = BorderRadius.circular(14);
    final disabledColor = const Color(0xFFB9C4D6);
    final glowColor =
        (isAndroid ? const Color(0xFF16A34A) : _PosColors.payBlueStart)
            .withValues(alpha: 0.4);

    return SizedBox(
      width: double.infinity,
      child: DecoratedBox(
        decoration: BoxDecoration(
          borderRadius: borderRadius,
          gradient: LinearGradient(
            colors: enabled
                ? (isAndroid
                      ? const [Color(0xE716A34A), Color(0xE715803D)]
                      : const [_PosColors.payBlueStart, _PosColors.payBlueEnd])
                : [disabledColor, disabledColor],
          ),
          boxShadow: enabled && !isAndroid
              ? [
                  BoxShadow(
                    color: glowColor,
                    blurRadius: 20,
                    offset: const Offset(0, 8),
                  ),
                ]
              : null,
        ),
        child: Material(
          type: MaterialType.transparency,
          child: InkWell(
            borderRadius: borderRadius,
            onTap: enabled ? onPressed : null,
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 11),
              child: Row(
                children: [
                  const Icon(
                    Icons.lock_outline_rounded,
                    color: Colors.white,
                    size: 16,
                  ),
                  const SizedBox(width: 8),
                  const Text(
                    'Charge',
                    style: TextStyle(
                      color: Colors.white,
                      fontSize: 13,
                      fontWeight: FontWeight.w700,
                      letterSpacing: 0.3,
                    ),
                  ),
                  const Spacer(),
                  Text(
                    amountLabel,
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 13,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _DebouncedCatalogSearchField extends ConsumerStatefulWidget {
  const _DebouncedCatalogSearchField({required this.onUserInteraction});

  final VoidCallback onUserInteraction;

  @override
  ConsumerState<_DebouncedCatalogSearchField> createState() =>
      _DebouncedCatalogSearchFieldState();
}

class _DebouncedCatalogSearchFieldState
    extends ConsumerState<_DebouncedCatalogSearchField> {
  static const _debounceTag = 'pos-catalog-search';
  final TextEditingController _controller = TextEditingController();

  @override
  void dispose() {
    EasyDebounce.cancel(_debounceTag);
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final isAndroid = Platform.isAndroid;
    final fillColor = isAndroid
        ? _PosColors.androidActionBg
        : _PosColors.surfaceSoft;
    final borderColor = isAndroid
        ? _PosColors.androidPanelBorder
        : _PosColors.borderSoft;
    final iconColor = isAndroid
        ? _PosColors.androidTextMuted
        : _PosColors.headerLabel;
    final hintColor = isAndroid
        ? _PosColors.androidTextMuted
        : _PosColors.headerLabel;
    return TextField(
      controller: _controller,
      style: TextStyle(
        color: isAndroid ? _PosColors.androidText : _PosColors.titleNavy,
      ),
      textInputAction: TextInputAction.search,
      onChanged: (value) {
        widget.onUserInteraction();
        EasyDebounce.debounce(
          _debounceTag,
          const Duration(milliseconds: 300),
          () => ref.read(posSearchProvider.notifier).state = value,
        );
      },
      decoration: InputDecoration(
        isDense: true,
        filled: true,
        fillColor: fillColor,
        contentPadding: const EdgeInsets.symmetric(
          horizontal: 14,
          vertical: 12,
        ),
        prefixIcon: Icon(Icons.search, color: iconColor),
        suffixIcon: Icon(Icons.qr_code_scanner, color: iconColor),
        hintText: 'Search item, SKU, or barcode',
        hintStyle: TextStyle(color: hintColor),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(10),
          borderSide: BorderSide(color: borderColor),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(10),
          borderSide: BorderSide(color: borderColor),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(10),
          borderSide: BorderSide(
            color: isAndroid ? const Color(0x8058D0A9) : _PosColors.titleNavy,
          ),
        ),
      ),
    );
  }
}

class _SmoothScrollRegion extends StatelessWidget {
  const _SmoothScrollRegion({required this.child, this.axis = Axis.vertical});

  final Widget child;
  final Axis axis;

  @override
  Widget build(BuildContext context) {
    if (Platform.isAndroid) {
      return child;
    }

    return AnimatedPrimaryScrollController(
      scrollDirection: axis,
      animationFactory: const ChromiumImpulse(),
      child: child,
    );
  }
}

class _ItemTag extends StatelessWidget {
  const _ItemTag({required this.label});

  final String label;

  @override
  Widget build(BuildContext context) {
    final isAndroid = Platform.isAndroid;
    final normalized = label.toUpperCase();
    Color background = isAndroid
        ? _PosColors.androidTagBg
        : _PosColors.tagNeutralBg;
    Color border = isAndroid
        ? _PosColors.androidTagBorder
        : _PosColors.tagNeutralBorder;
    Color text = isAndroid
        ? _PosColors.androidTextMuted
        : _PosColors.tagNeutralText;
    if (normalized.contains('LIMITED')) {
      background = isAndroid ? const Color(0x30F59E0B) : _PosColors.tagBlueBg;
      border = isAndroid ? const Color(0x66FCD34D) : _PosColors.tagBlueBorder;
      text = isAndroid ? const Color(0xFFFDE68A) : _PosColors.tagBlueText;
    } else if (normalized.contains('RTD')) {
      background = isAndroid ? const Color(0x2934D399) : _PosColors.tagTealBg;
      border = isAndroid ? const Color(0x605DDCB2) : _PosColors.tagTealBorder;
      text = isAndroid ? const Color(0xFFD1FAE5) : _PosColors.tagTealText;
    }

    return DecoratedBox(
      decoration: BoxDecoration(
        color: background,
        border: Border.all(color: border),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 4),
        child: Text(
          label,
          style: Theme.of(context).textTheme.labelSmall?.copyWith(
            color: text,
            fontWeight: FontWeight.w500,
          ),
        ),
      ),
    );
  }
}

class _SelectionPill extends StatelessWidget {
  const _SelectionPill({
    required this.label,
    required this.selected,
    required this.onPressed,
  });

  final Widget label;
  final bool selected;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    final isAndroid = Platform.isAndroid;
    final background = isAndroid
        ? (selected ? _PosColors.androidPillActiveBg : _PosColors.androidPillBg)
        : (selected ? _PosColors.titleNavy : _PosColors.headerTint);
    final border = isAndroid
        ? (selected
              ? _PosColors.androidPillActiveBorder
              : _PosColors.androidPillBorder)
        : (selected ? _PosColors.titleNavy : _PosColors.borderSoft);
    final textColor = isAndroid
        ? (selected ? _PosColors.androidText : _PosColors.androidTextMuted)
        : (selected ? Colors.white : _PosColors.headerLabel);
    return InkWell(
      borderRadius: BorderRadius.circular(999),
      onTap: onPressed,
      child: DecoratedBox(
        decoration: BoxDecoration(
          color: background,
          border: Border.all(color: border),
          borderRadius: BorderRadius.circular(999),
        ),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
          child: DefaultTextStyle.merge(
            style: Theme.of(context).textTheme.labelLarge?.copyWith(
              color: textColor,
              fontWeight: FontWeight.w600,
            ),
            child: label,
          ),
        ),
      ),
    );
  }
}

class _TotalRow extends StatelessWidget {
  const _TotalRow({
    required this.label,
    required this.value,
    this.emphasize = false,
  });

  final String label;
  final String value;
  final bool emphasize;

  @override
  Widget build(BuildContext context) {
    final isAndroid = Platform.isAndroid;
    final normalLabelColor = isAndroid
        ? _PosColors.androidTextMuted
        : _PosColors.headerLabel;
    final emphasizeColor = isAndroid
        ? _PosColors.androidText
        : _PosColors.titleNavy;
    final valueColor = isAndroid
        ? const Color(0xFFE2E8F0)
        : _PosColors.amountStrong;
    final style = emphasize
        ? Theme.of(context).textTheme.titleMedium?.copyWith(
            color: emphasizeColor,
            fontWeight: FontWeight.w700,
          )
        : Theme.of(context).textTheme.bodyLarge?.copyWith(
            color: normalLabelColor,
            fontWeight: FontWeight.w400,
          );

    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 2),
      child: Row(
        children: [
          Expanded(child: Text(label, style: style)),
          Text(
            value,
            style: emphasize
                ? style?.copyWith(color: emphasizeColor)
                : style?.copyWith(
                    color: valueColor,
                    fontWeight: FontWeight.w600,
                  ),
          ),
        ],
      ),
    );
  }
}
