import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'dart:ui';

import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:media_kit/media_kit.dart';
import 'package:media_kit_video/media_kit_video.dart';
import 'package:path/path.dart' as p;
import 'package:window_manager/window_manager.dart';

import '../../core/models/money.dart';
import '../../core/services/back_office_client.dart';
import 'customer_display_models.dart';
import 'customer_display_storage.dart';

class _T {
  static const bgStart = Color(0xFF0C1E36);
  static const bgEnd = Color(0xFF163055);
  static const surface = Color(0xFFFFFFFF);
  static const surfaceAlt = Color(0xFF1A2E4A);
  static const border = Color(0xFFDCE5F1);
  static const borderSoft = Color(0xFFD2DDEB);
  static const borderFaint = Color(0xFFF2F2F2);
  static const text1 = Color(0xFF1A1A1A);
  static const text2 = Color(0xFF2A2A2A);
  static const text3 = Color(0xFF555555);
  static const muted = Color(0xFFABABAB);
  static const muted2 = Color(0xFF888888);
  static const headerLabel = Color(0xFF4E688A);
  static const orderSideTint = Color(0xFFF6F9FF);
  static const titleNavy = Color(0xFF1A2E4A);
  static const amountStrong = Color(0xFF1E293B);
  static const headerTint = Color(0xFFEEF2F7);
  static const qtyBg = Color(0xFFEEF2F7);
  static const qtyText = Color(0xFF3B5B8A);
  static const payBlueStart = Color(0xFF1F66F2);
  static const payBlueEnd = Color(0xFF2F88FF);
  static const green = Color(0xFF3B6EF6);
  static const greenBg = Color(0xFFEBF0FE);
  static const greenBdr = Color(0xFFB3CCFB);
  static const thankBg = Color(0xFFF3F4F6);
  static const thankBorder = Color(0xFFE5E7EB);
  static const thankText = Color(0xFF111827);
  static const thankMuted = Color(0xFF6B7280);
  static const thankSubtle = Color(0xFF9CA3AF);
  static const ratingStar = Color(0xFFF59E0B);
  static const ratingStarSoft = Color(0xFFFFF4D6);
  static const ratingBorder = Color(0xFFF4D8A6);
}

const double _promoBackgroundBlurSigma = 15.15;
const double _promoImageBackgroundOpacity = 0.5;
const Duration _promoImageFadeDuration = Duration(milliseconds: 260);

String _asPeso(int minor) => formatMoney(minor);
String _amountOnly(int minor) => formatMoney(minor).replaceFirst('PHP ', '');

class CustomerDisplayApp extends StatelessWidget {
  const CustomerDisplayApp({super.key});

  @override
  Widget build(BuildContext context) {
    final baseTheme = ThemeData(
      brightness: Brightness.light,
      useMaterial3: true,
    );

    return MaterialApp(
      title: 'BIGTIME CFD',
      debugShowCheckedModeBanner: false,
      theme: baseTheme.copyWith(
        scaffoldBackgroundColor: _T.bgStart,
        splashFactory: NoSplash.splashFactory,
        textTheme: baseTheme.textTheme.apply(
          bodyColor: _T.text1,
          displayColor: _T.text1,
        ),
      ),
      routes: {'/customer-display': (_) => const CustomerDisplayScreen()},
      home: const CustomerDisplayScreen(),
    );
  }
}

class CustomerDisplayScreen extends StatefulWidget {
  const CustomerDisplayScreen({super.key});

  @override
  State<CustomerDisplayScreen> createState() => _CustomerDisplayScreenState();
}

class _CustomerDisplayScreenState extends State<CustomerDisplayScreen> {
  final CustomerDisplayStorage _storage = CustomerDisplayStorage();
  final BackOfficeClient _backOfficeClient = BackOfficeClient();
  late final Player _player = Player();
  late final VideoController _videoController = VideoController(_player);

  Timer? _pollTimer;
  Timer? _heartbeatTimer;
  Timer? _remoteSettingsTimer;
  Timer? _imageTimer;
  StreamSubscription<bool>? _completedSubscription;

  CustomerDisplaySettings _settings = CustomerDisplaySettings.defaults();
  CustomerDisplayState _state = CustomerDisplayState.idle();
  String _settingsSignature = '';
  String _stateSignature = '';
  String? _activeMediaPath;
  int _mediaIndex = 0;
  bool? _appliedFullscreen;
  bool _loading = true;
  bool _remoteSyncInFlight = false;
  String _lastSyncedBranchId = '';

  CustomerDisplayMediaAsset? get _currentAsset {
    if (_settings.assets.isEmpty) {
      return null;
    }
    return _settings.assets[_mediaIndex % _settings.assets.length];
  }

  @override
  void initState() {
    super.initState();
    unawaited(_player.setPlaylistMode(PlaylistMode.none));
    _completedSubscription = _player.stream.completed.listen((completed) {
      if (!mounted || !completed) {
        return;
      }
      if (_currentAsset?.kind == CustomerDisplayMediaKind.video) {
        _advanceMedia();
      }
    });
    _heartbeatTimer = Timer.periodic(
      const Duration(seconds: 2),
      (_) => unawaited(_storage.writeHeartbeat()),
    );
    _remoteSettingsTimer = Timer.periodic(
      const Duration(seconds: 8),
      (_) => unawaited(_syncRemoteSettings()),
    );
    _pollTimer = Timer.periodic(
      const Duration(milliseconds: 450),
      (_) => unawaited(_refresh()),
    );

    WidgetsBinding.instance.addPostFrameCallback((_) async {
      await _storage.writeHeartbeat();
      await _syncRemoteSettings(force: true);
      await _refresh(force: true);
    });
  }

  @override
  void dispose() {
    _pollTimer?.cancel();
    _heartbeatTimer?.cancel();
    _remoteSettingsTimer?.cancel();
    _imageTimer?.cancel();
    _completedSubscription?.cancel();
    unawaited(_storage.clearHeartbeat());
    unawaited(_player.dispose());
    super.dispose();
  }

  Future<void> _refresh({bool force = false}) async {
    final settings = await _storage.readSettings();
    final sanitizedSettings = settings.copyWith(
      assets: settings.assets
          .where((asset) => File(asset.path).existsSync())
          .toList(growable: false),
    );
    final state = await _storage.readState();
    final nextSettingsSignature = jsonEncode(sanitizedSettings.toJson());
    final nextStateSignature = jsonEncode(state.toJson());

    if (!force &&
        nextSettingsSignature == _settingsSignature &&
        nextStateSignature == _stateSignature) {
      return;
    }

    if (sanitizedSettings.assets.isEmpty) {
      _mediaIndex = 0;
    } else if (_mediaIndex >= sanitizedSettings.assets.length) {
      _mediaIndex = 0;
    }

    _settingsSignature = nextSettingsSignature;
    _stateSignature = nextStateSignature;

    if (mounted) {
      setState(() {
        _settings = sanitizedSettings;
        _state = state;
        _loading = false;
      });
    }

    final branchId = _effectiveBranchId(state);
    if (force || branchId != _lastSyncedBranchId) {
      _lastSyncedBranchId = branchId;
      unawaited(_syncRemoteSettings(branchId: branchId, force: true));
    }

    await _applyFullscreen(sanitizedSettings.launchFullscreen);
    await _ensureActiveMedia(force: force);
  }

  Future<void> _syncRemoteSettings({
    String? branchId,
    bool force = false,
  }) async {
    if (_remoteSyncInFlight) {
      return;
    }

    final targetBranchId = (branchId ?? _effectiveBranchId(_state)).trim();
    if (targetBranchId.isEmpty) {
      return;
    }

    _remoteSyncInFlight = true;

    try {
      final remoteSettings = await _backOfficeClient
          .fetchCustomerDisplaySettings(branchId: targetBranchId);
      final assets = <CustomerDisplayMediaAsset>[];
      final keepPaths = <String>{};

      for (final asset in remoteSettings.assets) {
        final file = await _storage.mediaFile(_cacheFileName(asset));
        if (force || !await file.exists()) {
          final bytes = await _backOfficeClient.downloadBytes(asset.url);
          await file.writeAsBytes(bytes, flush: true);
        }

        keepPaths.add(file.path);
        assets.add(
          CustomerDisplayMediaAsset(
            id: asset.id,
            path: file.path,
            kind: asset.kind == BackOfficeCustomerDisplayMediaKind.video
                ? CustomerDisplayMediaKind.video
                : CustomerDisplayMediaKind.image,
            sourceUrl: asset.url,
            label: asset.fileName,
          ),
        );
      }

      await _storage.pruneCachedMediaFiles(keepPaths);
      await _storage.writeSettings(
        CustomerDisplaySettings(
          assets: assets,
          thankYouMessage: remoteSettings.thankYouMessage,
          launchFullscreen: remoteSettings.launchFullscreen,
          imageDurationSeconds: remoteSettings.imageDurationSeconds,
        ),
      );
    } catch (_) {
      // Keep the last good local settings when the backend is unavailable.
    } finally {
      _remoteSyncInFlight = false;
    }
  }

  Future<void> _applyFullscreen(bool fullscreen) async {
    if (!Platform.isWindows || _appliedFullscreen == fullscreen) {
      return;
    }
    _appliedFullscreen = fullscreen;
    await windowManager.setFullScreen(fullscreen);
  }

  Future<void> _ensureActiveMedia({bool force = false}) async {
    _imageTimer?.cancel();
    _imageTimer = null;

    final asset = _currentAsset;
    if (asset == null) {
      _activeMediaPath = null;
      await _player.stop();
      return;
    }

    if (!force && _activeMediaPath == asset.path) {
      if (asset.kind == CustomerDisplayMediaKind.image) {
        _scheduleImageAdvance();
      }
      return;
    }

    _activeMediaPath = asset.path;

    if (asset.kind == CustomerDisplayMediaKind.image) {
      await _player.stop();
      _scheduleImageAdvance();
      return;
    }

    await _player.open(Media(Uri.file(asset.path).toString()));
  }

  void _scheduleImageAdvance() {
    if (_settings.assets.isEmpty) {
      return;
    }
    _imageTimer = Timer(
      Duration(seconds: _settings.imageDurationSeconds),
      _advanceMedia,
    );
  }

  void _advanceMedia() {
    if (_settings.assets.isEmpty) {
      return;
    }
    final nextIndex = (_mediaIndex + 1) % _settings.assets.length;
    final force = nextIndex == _mediaIndex;
    setState(() => _mediaIndex = nextIndex);
    unawaited(_ensureActiveMedia(force: force));
  }

  String _effectiveBranchId(CustomerDisplayState state) {
    final branchId = state.branchId?.trim();
    if (branchId != null && branchId.isNotEmpty) {
      return branchId;
    }
    return 'branch-manila';
  }

  String _cacheFileName(BackOfficeCustomerDisplayAsset asset) {
    final extension = p.extension(asset.fileName).toLowerCase();
    final safeExtension = extension.isNotEmpty
        ? extension
        : asset.kind == BackOfficeCustomerDisplayMediaKind.video
        ? '.mp4'
        : '.jpg';
    return '${asset.id}$safeExtension';
  }

  @override
  Widget build(BuildContext context) {
    final largeFormat = Platform.isAndroid;

    if (_loading) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }

    if (_state.mode == CustomerDisplayMode.idle) {
      return Scaffold(
        body: RepaintBoundary(
          child: _IdleFullscreenPromo(
            asset: _currentAsset,
            controller: _videoController,
            state: _state,
            settings: _settings,
          ),
        ),
      );
    }

    return Scaffold(
      backgroundColor: _T.bgStart,
      body: DecoratedBox(
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [_T.bgStart, _T.bgEnd],
          ),
        ),
        child: LayoutBuilder(
          builder: (context, constraints) {
            final compact =
                !largeFormat &&
                (constraints.maxWidth < 980 ||
                    constraints.maxWidth < constraints.maxHeight);

            Widget buildPanels({required bool immersive}) {
              if (compact) {
                return Column(
                  children: [
                    Expanded(
                      child: RepaintBoundary(
                        child: _PromoPanel(
                          asset: _currentAsset,
                          controller: _videoController,
                          largeFormat: immersive,
                        ),
                      ),
                    ),
                    const Divider(height: 1, thickness: 1, color: _T.border),
                    Expanded(
                      child: RepaintBoundary(
                        child: _OrderPanel(
                          settings: _settings,
                          state: _state,
                          largeFormat: immersive,
                        ),
                      ),
                    ),
                  ],
                );
              }

              return Row(
                children: [
                  Expanded(
                    flex: immersive ? 7 : 1,
                    child: RepaintBoundary(
                      child: _PromoPanel(
                        asset: _currentAsset,
                        controller: _videoController,
                        largeFormat: immersive,
                      ),
                    ),
                  ),
                  const VerticalDivider(
                    width: 1,
                    thickness: 1,
                    color: _T.border,
                  ),
                  Expanded(
                    flex: immersive ? 6 : 1,
                    child: RepaintBoundary(
                      child: _OrderPanel(
                        settings: _settings,
                        state: _state,
                        largeFormat: immersive,
                      ),
                    ),
                  ),
                ],
              );
            }

            if (largeFormat) {
              return buildPanels(immersive: true);
            }

            return SafeArea(
              child: Padding(
                padding: const EdgeInsets.all(14),
                child: DecoratedBox(
                  decoration: BoxDecoration(
                    color: _T.surface,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: _T.border),
                    boxShadow: const [
                      BoxShadow(
                        color: Color(0x1A000000),
                        blurRadius: 28,
                        offset: Offset(0, 6),
                      ),
                    ],
                  ),
                  child: ClipRRect(
                    borderRadius: BorderRadius.circular(12),
                    child: Column(
                      children: [
                        _TitleBar(branchName: _state.branchName),
                        Expanded(child: buildPanels(immersive: false)),
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

class _IdleFullscreenPromo extends StatelessWidget {
  const _IdleFullscreenPromo({
    required this.asset,
    required this.controller,
    required this.state,
    required this.settings,
  });

  final CustomerDisplayMediaAsset? asset;
  final VideoController controller;
  final CustomerDisplayState state;
  final CustomerDisplaySettings settings;

  @override
  Widget build(BuildContext context) {
    return Stack(
      fit: StackFit.expand,
      children: [
        _PromoBackdrop(asset: asset, controller: controller),
        SafeArea(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(22, 16, 22, 0),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 12,
                    vertical: 7,
                  ),
                  decoration: BoxDecoration(
                    color: const Color(0x99000000),
                    borderRadius: BorderRadius.circular(999),
                  ),
                  child: Text(
                    state.branchName ?? 'BIGTIME POS',
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 12,
                      fontWeight: FontWeight.w300,
                      letterSpacing: 0.4,
                    ),
                  ),
                ),
                const _LiveClockPill(dark: true),
              ],
            ),
          ),
        ),
        if (asset == null)
          Container(
            color: const Color(0xA6000000),
            alignment: Alignment.center,
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 620),
              child: Container(
                padding: const EdgeInsets.all(28),
                decoration: BoxDecoration(
                  color: const Color(0xCC171717),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: const Color(0x33FFFFFF)),
                ),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      state.branchName ?? 'BIGTIME POS',
                      style: Theme.of(context).textTheme.headlineSmall
                          ?.copyWith(
                            color: Colors.white,
                            fontWeight: FontWeight.w400,
                          ),
                    ),
                    const SizedBox(height: 10),
                    Text(
                      settings.assets.isEmpty
                          ? 'Upload image or video ads in Dashboard > Settings > Customer Face Display.'
                          : 'Waiting for the next transaction.',
                      style: Theme.of(context).textTheme.titleMedium?.copyWith(
                        color: Colors.white70,
                        fontWeight: FontWeight.w300,
                        height: 1.35,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
      ],
    );
  }
}

class _TitleBar extends StatelessWidget {
  const _TitleBar({required this.branchName});

  final String? branchName;

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 38,
      decoration: const BoxDecoration(
        color: _T.surfaceAlt,
        border: Border(bottom: BorderSide(color: _T.border)),
      ),
      padding: const EdgeInsets.symmetric(horizontal: 14),
      child: Row(
        children: [
          const SizedBox(
            width: 170,
            child: Align(
              alignment: Alignment.centerLeft,
              child: Text(
                'CFD',
                style: TextStyle(
                  fontSize: 10.5,
                  color: _T.headerTint,
                  letterSpacing: 0.7,
                  fontWeight: FontWeight.w400,
                ),
              ),
            ),
          ),
          Expanded(
            child: Text(
              branchName?.trim().isNotEmpty == true
                  ? '$branchName | BIGTIME CFD'
                  : 'BIGTIME CFD',
              textAlign: TextAlign.center,
              style: const TextStyle(
                fontSize: 11.5,
                color: Color(0xFFE7EEF8),
                letterSpacing: 0.7,
                fontWeight: FontWeight.w400,
              ),
            ),
          ),
          const SizedBox(
            width: 170,
            child: Align(
              alignment: Alignment.centerRight,
              child: _LiveClockPill(compact: true, showDate: false, dark: true),
            ),
          ),
        ],
      ),
    );
  }
}

class _LiveClockPill extends StatefulWidget {
  const _LiveClockPill({
    this.dark = false,
    this.compact = false,
    this.showDate = true,
    this.dense = false,
  });

  final bool dark;
  final bool compact;
  final bool showDate;
  final bool dense;

  @override
  State<_LiveClockPill> createState() => _LiveClockPillState();
}

class _LiveClockPillState extends State<_LiveClockPill> {
  static final DateFormat _dateFormatter = DateFormat('MMM d, yyyy');
  static final DateFormat _timeFormatter = DateFormat('hh:mm:ss a');
  late final Timer _timer;
  DateTime _now = DateTime.now();

  @override
  void initState() {
    super.initState();
    _timer = Timer.periodic(const Duration(seconds: 1), (_) {
      if (mounted) {
        setState(() => _now = DateTime.now());
      }
    });
  }

  @override
  void dispose() {
    _timer.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final textColor = widget.dark ? const Color(0xFFF3F8FF) : _T.text3;
    final background = widget.dark ? const Color(0x1FFFFFFF) : _T.surface;
    final borderColor = widget.dark ? const Color(0x40FFFFFF) : _T.borderSoft;
    final formatted = widget.showDate
        ? '${_dateFormatter.format(_now)} ${_timeFormatter.format(_now)}'
        : _timeFormatter.format(_now);

    return Container(
      padding: EdgeInsets.symmetric(
        horizontal: widget.dense
            ? 7
            : widget.compact
            ? 9
            : 11,
        vertical: widget.dense
            ? 2
            : widget.compact
            ? 4
            : 6,
      ),
      decoration: BoxDecoration(
        color: background,
        borderRadius: BorderRadius.circular(6),
        border: Border.all(color: borderColor),
      ),
      child: Text(
        formatted,
        style: TextStyle(
          fontSize: widget.dense
              ? 8.5
              : widget.compact
              ? 10
              : 11.5,
          color: textColor,
          fontWeight: FontWeight.w300,
          letterSpacing: 0.2,
        ),
      ),
    );
  }
}

class _PromoPanel extends StatelessWidget {
  const _PromoPanel({
    required this.asset,
    required this.controller,
    this.largeFormat = false,
  });

  final CustomerDisplayMediaAsset? asset;
  final VideoController controller;
  final bool largeFormat;

  @override
  Widget build(BuildContext context) {
    return Container(
      color: _T.surface,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (!largeFormat) const SizedBox(height: 8),
          Expanded(
            child: Padding(
              padding: largeFormat ? EdgeInsets.zero : const EdgeInsets.all(12),
              child: ClipRRect(
                borderRadius: BorderRadius.circular(largeFormat ? 0 : 8),
                child: Stack(
                  fit: StackFit.expand,
                  children: [
                    _PromoBackdrop(asset: asset, controller: controller),
                    const DecoratedBox(
                      decoration: BoxDecoration(
                        gradient: LinearGradient(
                          begin: Alignment.topCenter,
                          end: Alignment.bottomCenter,
                          colors: [
                            Color(0x12000000),
                            Color(0x00000000),
                            Color(0x42000000),
                          ],
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
          if (!largeFormat)
            Container(
              padding: const EdgeInsets.fromLTRB(14, 10, 14, 14),
              decoration: const BoxDecoration(
                border: Border(top: BorderSide(color: _T.border)),
              ),
              child: const Center(
                child: Text(
                  'Customer Face Display Advertisement',
                  style: TextStyle(
                    fontSize: 10.5,
                    fontWeight: FontWeight.w400,
                    color: _T.muted2,
                    letterSpacing: 0.4,
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }
}

class _PromoBackdrop extends StatelessWidget {
  const _PromoBackdrop({required this.asset, required this.controller});

  final CustomerDisplayMediaAsset? asset;
  final VideoController controller;

  @override
  Widget build(BuildContext context) {
    if (asset == null) {
      return const _PromoFallbackBackdrop();
    }

    if (asset!.kind == CustomerDisplayMediaKind.image) {
      final imageAsset = asset!;
      final imageKey =
          'promo-image:${imageAsset.id}:${imageAsset.sourceUrl ?? imageAsset.path}';
      return AnimatedSwitcher(
        duration: _promoImageFadeDuration,
        switchInCurve: Curves.easeOutCubic,
        switchOutCurve: Curves.easeOutCubic,
        layoutBuilder: (currentChild, previousChildren) => Stack(
          fit: StackFit.expand,
          children: [...previousChildren, ?currentChild],
        ),
        transitionBuilder: (child, animation) =>
            FadeTransition(opacity: animation, child: child),
        child: KeyedSubtree(
          key: ValueKey<String>(imageKey),
          child: _PromoImageBackdrop(asset: imageAsset),
        ),
      );
    }

    return _PromoVideoBackdrop(controller: controller);
  }
}

class _PromoFallbackBackdrop extends StatelessWidget {
  const _PromoFallbackBackdrop();

  @override
  Widget build(BuildContext context) {
    return const DecoratedBox(
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [Color(0xFF2F2111), Color(0xFF1A130A)],
        ),
      ),
      child: Center(
        child: Text(
          'NO ADVERTISING MEDIA',
          style: TextStyle(
            color: Color(0xFFF6DCA1),
            fontSize: 14,
            fontWeight: FontWeight.w300,
            letterSpacing: 1.2,
          ),
        ),
      ),
    );
  }
}

class _PromoImageBackdrop extends StatelessWidget {
  const _PromoImageBackdrop({required this.asset});

  final CustomerDisplayMediaAsset asset;

  @override
  Widget build(BuildContext context) {
    final foregroundPadding = Platform.isWindows
        ? const EdgeInsets.all(6)
        : const EdgeInsets.all(14);
    final foregroundRadius = Platform.isWindows ? 8.0 : 14.0;
    return Stack(
      fit: StackFit.expand,
      children: [
        const DecoratedBox(decoration: BoxDecoration(color: Color(0xFF091423))),
        ImageFiltered(
          imageFilter: ImageFilter.blur(
            sigmaX: _promoBackgroundBlurSigma,
            sigmaY: _promoBackgroundBlurSigma,
          ),
          child: Opacity(
            opacity: _promoImageBackgroundOpacity,
            child: _PromoAssetImageLayer(
              asset: asset,
              fit: BoxFit.cover,
              filterQuality: FilterQuality.low,
            ),
          ),
        ),
        const DecoratedBox(
          decoration: BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.topCenter,
              end: Alignment.bottomCenter,
              colors: [Color(0x26000000), Color(0x18000000), Color(0x42000000)],
            ),
          ),
        ),
        Padding(
          padding: foregroundPadding,
          child: DecoratedBox(
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(foregroundRadius),
              boxShadow: const [
                BoxShadow(
                  color: Color(0x33000000),
                  blurRadius: 24,
                  offset: Offset(0, 12),
                ),
              ],
            ),
            child: ClipRRect(
              borderRadius: BorderRadius.circular(foregroundRadius),
              child: _PromoAssetImageLayer(
                asset: asset,
                fit: BoxFit.contain,
                filterQuality: FilterQuality.high,
              ),
            ),
          ),
        ),
      ],
    );
  }
}

class _PromoAssetImageLayer extends StatelessWidget {
  const _PromoAssetImageLayer({
    required this.asset,
    required this.fit,
    required this.filterQuality,
  });

  final CustomerDisplayMediaAsset asset;
  final BoxFit fit;
  final FilterQuality filterQuality;

  @override
  Widget build(BuildContext context) {
    final sourceUrl = asset.sourceUrl?.trim();
    if (sourceUrl != null && sourceUrl.isNotEmpty) {
      return CachedNetworkImage(
        imageUrl: sourceUrl,
        fit: fit,
        filterQuality: filterQuality,
        fadeInDuration: _promoImageFadeDuration,
        fadeOutDuration: _promoImageFadeDuration,
        imageBuilder: (context, imageProvider) => Image(
          image: imageProvider,
          fit: fit,
          filterQuality: filterQuality,
          gaplessPlayback: true,
        ),
        placeholder: (context, _) => _LocalPromoImage(
          path: asset.path,
          fit: fit,
          filterQuality: filterQuality,
        ),
        errorWidget: (context, imageUrl, error) => _LocalPromoImage(
          path: asset.path,
          fit: fit,
          filterQuality: filterQuality,
        ),
      );
    }

    return _LocalPromoImage(
      path: asset.path,
      fit: fit,
      filterQuality: filterQuality,
    );
  }
}

class _LocalPromoImage extends StatelessWidget {
  const _LocalPromoImage({
    required this.path,
    required this.fit,
    required this.filterQuality,
  });

  final String path;
  final BoxFit fit;
  final FilterQuality filterQuality;

  @override
  Widget build(BuildContext context) {
    return Image.file(
      File(path),
      fit: fit,
      filterQuality: filterQuality,
      gaplessPlayback: true,
      errorBuilder: (context, error, stackTrace) => const SizedBox.expand(),
    );
  }
}

class _PromoVideoBackdrop extends StatelessWidget {
  const _PromoVideoBackdrop({required this.controller});

  final VideoController controller;

  @override
  Widget build(BuildContext context) {
    final fit = Platform.isWindows ? BoxFit.contain : BoxFit.cover;
    return Stack(
      fit: StackFit.expand,
      children: [
        const DecoratedBox(decoration: BoxDecoration(color: Colors.black)),
        Video(
          controller: controller,
          fit: fit,
          controls: null,
          wakelock: false,
          pauseUponEnteringBackgroundMode: false,
        ),
        const DecoratedBox(decoration: BoxDecoration(color: Color(0x1F000000))),
      ],
    );
  }
}

class _OrderPanel extends StatelessWidget {
  const _OrderPanel({
    required this.settings,
    required this.state,
    this.largeFormat = false,
  });

  final CustomerDisplaySettings settings;
  final CustomerDisplayState state;
  final bool largeFormat;

  @override
  Widget build(BuildContext context) {
    if (state.mode == CustomerDisplayMode.thankYou) {
      return SizedBox.expand(
        child: _ThankYouOverlay(settings: settings, state: state),
      );
    }

    return SizedBox.expand(
      child: Container(
        color: _T.orderSideTint,
        child: Column(
          children: [
            _OrderHeader(state: state, largeFormat: largeFormat),
            _ItemsMeta(count: state.itemCount, largeFormat: largeFormat),
            Expanded(
              child: _ItemsList(lines: state.lines, largeFormat: largeFormat),
            ),
            _TotalsSection(state: state, largeFormat: largeFormat),
          ],
        ),
      ),
    );
  }
}

class _OrderHeader extends StatelessWidget {
  const _OrderHeader({required this.state, this.largeFormat = false});

  final CustomerDisplayState state;
  final bool largeFormat;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: EdgeInsets.symmetric(
        horizontal: largeFormat ? 14 : 18,
        vertical: largeFormat ? 6 : 14,
      ),
      decoration: const BoxDecoration(
        color: _T.surfaceAlt,
        border: Border(bottom: BorderSide(color: _T.border)),
      ),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  state.branchName?.trim().isNotEmpty == true
                      ? state.branchName!
                      : 'Main Branch',
                  style: TextStyle(
                    fontSize: largeFormat ? 13.5 : 14,
                    fontWeight: largeFormat ? FontWeight.w500 : FontWeight.w400,
                    color: const Color(0xFFF0F5FD),
                    height: 1,
                  ),
                ),
                SizedBox(height: largeFormat ? 1 : 2),
                Text(
                  state.cashierName?.trim().isNotEmpty == true
                      ? 'Cashier: ${state.cashierName}'
                      : 'Cashier: --',
                  style: TextStyle(
                    fontSize: largeFormat ? 9 : 11,
                    color: const Color(0xFFC3D2E8),
                    fontWeight: FontWeight.w300,
                    height: 1,
                  ),
                ),
              ],
            ),
          ),
          Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              _LiveBadge(largeFormat: largeFormat),
              SizedBox(height: largeFormat ? 3 : 6),
              _LiveClockPill(
                compact: true,
                showDate: false,
                dark: true,
                dense: largeFormat,
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _LiveBadge extends StatelessWidget {
  const _LiveBadge({this.largeFormat = false});

  final bool largeFormat;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: EdgeInsets.symmetric(
        horizontal: largeFormat ? 7 : 11,
        vertical: largeFormat ? 3 : 5,
      ),
      decoration: BoxDecoration(
        color: _T.greenBg,
        border: Border.all(color: _T.greenBdr),
        borderRadius: BorderRadius.circular(largeFormat ? 3 : 4),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: largeFormat ? 4 : 6,
            height: largeFormat ? 4 : 6,
            decoration: const BoxDecoration(
              color: _T.green,
              shape: BoxShape.circle,
            ),
          ),
          SizedBox(width: largeFormat ? 4 : 6),
          Text(
            'Live Order',
            style: TextStyle(
              fontSize: largeFormat ? 9 : 10.5,
              fontWeight: FontWeight.w400,
              color: _T.green,
              letterSpacing: 0.4,
              height: 1,
            ),
          ),
        ],
      ),
    );
  }
}

class _ItemsMeta extends StatelessWidget {
  const _ItemsMeta({required this.count, this.largeFormat = false});

  final int count;
  final bool largeFormat;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: EdgeInsets.symmetric(
        horizontal: largeFormat ? 14 : 18,
        vertical: largeFormat ? 4 : 9,
      ),
      decoration: const BoxDecoration(
        color: _T.headerTint,
        border: Border(bottom: BorderSide(color: _T.border)),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(
            'ITEMS',
            style: TextStyle(
              fontSize: largeFormat ? 10 : 11,
              color: _T.headerLabel,
              letterSpacing: 0.8,
              fontWeight: FontWeight.w500,
              height: 1,
            ),
          ),
          Text(
            '$count item${count == 1 ? '' : 's'}',
            style: TextStyle(
              fontSize: largeFormat ? 10 : 11,
              color: _T.headerLabel,
              fontWeight: FontWeight.w400,
              height: 1,
            ),
          ),
        ],
      ),
    );
  }
}

class _ItemsList extends StatelessWidget {
  const _ItemsList({required this.lines, this.largeFormat = false});

  final List<CustomerDisplayCartLine> lines;
  final bool largeFormat;

  @override
  Widget build(BuildContext context) {
    if (lines.isEmpty) {
      return Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 56,
              height: 56,
              decoration: BoxDecoration(
                color: const Color(0xFFF7F7F7),
                borderRadius: BorderRadius.circular(14),
                border: Border.all(color: _T.borderSoft),
              ),
              alignment: Alignment.center,
              child: const Icon(
                Icons.shopping_basket_outlined,
                size: 28,
                color: _T.muted2,
              ),
            ),
            const SizedBox(height: 14),
            Text(
              'Waiting for items',
              style: TextStyle(
                fontSize: largeFormat ? 24 : 18,
                color: _T.text3,
                fontWeight: FontWeight.w400,
              ),
            ),
            const SizedBox(height: 4),
            Text(
              'Basket updates here in real time.',
              style: TextStyle(
                fontSize: largeFormat ? 14 : 12,
                color: _T.muted2,
                fontWeight: FontWeight.w300,
              ),
            ),
          ],
        ),
      );
    }

    return ListView.builder(
      padding: EdgeInsets.zero,
      itemExtent: largeFormat ? 20 : null,
      itemCount: lines.length,
      itemBuilder: (context, index) {
        return RepaintBoundary(
          child: _OrderItemRow(item: lines[index], largeFormat: largeFormat),
        );
      },
    );
  }
}

class _OrderItemRow extends StatelessWidget {
  const _OrderItemRow({required this.item, this.largeFormat = false});

  final CustomerDisplayCartLine item;
  final bool largeFormat;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: EdgeInsets.symmetric(
        horizontal: largeFormat ? 14 : 18,
        vertical: largeFormat ? 1 : 10,
      ),
      decoration: const BoxDecoration(
        border: Border(bottom: BorderSide(color: _T.borderFaint)),
      ),
      child: Row(
        children: [
          Container(
            width: largeFormat ? 14 : 24,
            height: largeFormat ? 14 : 24,
            decoration: BoxDecoration(
              color: _T.qtyBg,
              border: Border.all(color: _T.borderSoft),
              borderRadius: BorderRadius.circular(largeFormat ? 3 : 4),
            ),
            alignment: Alignment.center,
            child: Text(
              '${item.quantity}',
              style: TextStyle(
                fontSize: largeFormat ? 8.5 : 11.5,
                fontWeight: FontWeight.w500,
                color: _T.qtyText,
                height: 1,
              ),
            ),
          ),
          SizedBox(width: largeFormat ? 6 : 10),
          Expanded(
            child: Text(
              item.name,
              style: TextStyle(
                fontSize: largeFormat ? 9.5 : 12.5,
                color: _T.text2,
                fontWeight: largeFormat ? FontWeight.w400 : FontWeight.w300,
                height: 1,
              ),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
          ),
          SizedBox(width: largeFormat ? 6 : 10),
          Text(
            _asPeso(item.lineTotalMinor),
            style: TextStyle(
              fontSize: largeFormat ? 9.5 : 12.5,
              fontWeight: FontWeight.w600,
              color: _T.amountStrong,
              height: 1,
            ),
          ),
        ],
      ),
    );
  }
}

class _TotalsSection extends StatelessWidget {
  const _TotalsSection({required this.state, this.largeFormat = false});

  final CustomerDisplayState state;
  final bool largeFormat;

  @override
  Widget build(BuildContext context) {
    if (largeFormat) {
      return Container(
        decoration: const BoxDecoration(
          color: _T.surface,
          border: Border(top: BorderSide(color: _T.border)),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(14, 5, 14, 5),
              child: Row(
                children: [
                  Expanded(
                    child: _SubRow(
                      label: 'Subtotal',
                      value: _asPeso(state.subtotalMinor),
                      largeFormat: true,
                      dense: true,
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: _SubRow(
                      label: 'VAT',
                      value: _asPeso(state.vatMinor),
                      largeFormat: true,
                      dense: true,
                    ),
                  ),
                ],
              ),
            ),
            const Divider(height: 1, thickness: 1, color: _T.border),
            Padding(
              padding: const EdgeInsets.fromLTRB(14, 6, 14, 6),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                crossAxisAlignment: CrossAxisAlignment.center,
                children: [
                  const Text(
                    'TOTAL DUE',
                    style: TextStyle(
                      fontSize: 10.5,
                      fontWeight: FontWeight.w500,
                      color: _T.titleNavy,
                      letterSpacing: 0.4,
                      height: 1,
                    ),
                  ),
                  RichText(
                    text: TextSpan(
                      children: [
                        const TextSpan(
                          text: 'PHP ',
                          style: TextStyle(
                            fontSize: 10.5,
                            fontWeight: FontWeight.w300,
                            color: _T.muted,
                            height: 1,
                          ),
                        ),
                        TextSpan(
                          text: _amountOnly(state.totalMinor),
                          style: const TextStyle(
                            fontSize: 20,
                            fontWeight: FontWeight.w700,
                            color: _T.titleNavy,
                            letterSpacing: -0.3,
                            height: 1,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(14, 0, 14, 8),
              child: Container(
                width: double.infinity,
                padding: const EdgeInsets.symmetric(vertical: 7),
                decoration: BoxDecoration(
                  gradient: const LinearGradient(
                    begin: Alignment.centerLeft,
                    end: Alignment.centerRight,
                    colors: [_T.payBlueStart, _T.payBlueEnd],
                  ),
                  borderRadius: BorderRadius.circular(5),
                  boxShadow: const [
                    BoxShadow(
                      color: Color(0x66308CFF),
                      blurRadius: 8,
                      offset: Offset(0, 3),
                    ),
                  ],
                ),
                child: const Center(
                  child: Text(
                    'Waiting for cashier',
                    style: TextStyle(
                      color: Colors.white,
                      fontSize: 10.5,
                      letterSpacing: 0.3,
                      fontWeight: FontWeight.w500,
                      height: 1,
                    ),
                  ),
                ),
              ),
            ),
          ],
        ),
      );
    }

    return Container(
      decoration: const BoxDecoration(
        color: _T.surface,
        border: Border(top: BorderSide(color: _T.border)),
      ),
      child: Column(
        children: [
          Container(
            padding: EdgeInsets.fromLTRB(
              largeFormat ? 18 : 18,
              largeFormat ? 10 : 11,
              largeFormat ? 18 : 18,
              largeFormat ? 8 : 8,
            ),
            decoration: const BoxDecoration(
              border: Border(bottom: BorderSide(color: _T.border)),
            ),
            child: Column(
              children: [
                _SubRow(
                  label: 'Subtotal',
                  value: _asPeso(state.subtotalMinor),
                  largeFormat: largeFormat,
                ),
                const SizedBox(height: 5),
                _SubRow(
                  label: 'VAT (12%)',
                  value: _asPeso(state.vatMinor),
                  largeFormat: largeFormat,
                ),
              ],
            ),
          ),
          Padding(
            padding: EdgeInsets.symmetric(
              horizontal: largeFormat ? 18 : 18,
              vertical: largeFormat ? 10 : 12,
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              crossAxisAlignment: CrossAxisAlignment.center,
              children: [
                Text(
                  'TOTAL DUE',
                  style: TextStyle(
                    fontSize: largeFormat ? 13 : 12,
                    fontWeight: FontWeight.w400,
                    color: _T.titleNavy,
                    letterSpacing: 0.5,
                  ),
                ),
                RichText(
                  text: TextSpan(
                    children: [
                      TextSpan(
                        text: 'PHP ',
                        style: TextStyle(
                          fontSize: largeFormat ? 13 : 13,
                          fontWeight: FontWeight.w300,
                          color: _T.muted,
                        ),
                      ),
                      TextSpan(
                        text: _amountOnly(state.totalMinor),
                        style: TextStyle(
                          fontSize: largeFormat ? 28 : 22,
                          fontWeight: FontWeight.w600,
                          color: _T.titleNavy,
                          letterSpacing: -0.5,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          Padding(
            padding: EdgeInsets.fromLTRB(
              largeFormat ? 18 : 18,
              0,
              largeFormat ? 18 : 18,
              largeFormat ? 10 : 14,
            ),
            child: Container(
              width: double.infinity,
              padding: EdgeInsets.symmetric(vertical: largeFormat ? 10 : 11),
              decoration: BoxDecoration(
                gradient: const LinearGradient(
                  begin: Alignment.centerLeft,
                  end: Alignment.centerRight,
                  colors: [_T.payBlueStart, _T.payBlueEnd],
                ),
                borderRadius: BorderRadius.circular(6),
                boxShadow: const [
                  BoxShadow(
                    color: Color(0x66308CFF),
                    blurRadius: 12,
                    offset: Offset(0, 5),
                  ),
                ],
              ),
              child: Center(
                child: Text(
                  'Waiting for cashier',
                  style: TextStyle(
                    color: Colors.white,
                    fontSize: largeFormat ? 12 : 12,
                    letterSpacing: 0.4,
                    fontWeight: FontWeight.w400,
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _SubRow extends StatelessWidget {
  const _SubRow({
    required this.label,
    required this.value,
    this.largeFormat = false,
    this.dense = false,
  });

  final String label;
  final String value;
  final bool largeFormat;
  final bool dense;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(
          label,
          style: TextStyle(
            fontSize: dense
                ? 9.5
                : largeFormat
                ? 11.5
                : 11.5,
            color: _T.headerLabel,
            fontWeight: FontWeight.w300,
            height: 1,
          ),
        ),
        Text(
          value,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: TextStyle(
            fontSize: dense
                ? 9.5
                : largeFormat
                ? 11.5
                : 11.5,
            color: _T.headerLabel,
            fontWeight: FontWeight.w300,
            height: 1,
          ),
        ),
      ],
    );
  }
}

class _ThankYouOverlay extends StatefulWidget {
  const _ThankYouOverlay({required this.settings, required this.state});

  final CustomerDisplaySettings settings;
  final CustomerDisplayState state;

  @override
  State<_ThankYouOverlay> createState() => _ThankYouOverlayState();
}

class _ThankYouOverlayState extends State<_ThankYouOverlay>
    with TickerProviderStateMixin {
  late final AnimationController _ringCtrl;
  late final AnimationController _cardCtrl;
  late final AnimationController _checkCtrl;
  late final AnimationController _contentCtrl;
  late final AnimationController _pulseCtrl;
  int? _selectedRating;
  String? _ratedReceiptKey;

  @override
  void initState() {
    super.initState();

    _ringCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 3000),
    )..repeat(reverse: true);

    _cardCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 600),
    );

    _checkCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 500),
    );

    _contentCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 600),
    );

    _pulseCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1400),
    )..repeat(reverse: true);

    // Staggered entrance
    _cardCtrl.forward().then((_) {
      _checkCtrl.forward();
      Future.delayed(const Duration(milliseconds: 200), () {
        _contentCtrl.forward();
      });
    });
  }

  @override
  void dispose() {
    _ringCtrl.dispose();
    _cardCtrl.dispose();
    _checkCtrl.dispose();
    _contentCtrl.dispose();
    _pulseCtrl.dispose();
    super.dispose();
  }

  @override
  void didUpdateWidget(covariant _ThankYouOverlay oldWidget) {
    super.didUpdateWidget(oldWidget);
    final nextReceiptKey = _receiptKey(widget.state.lastReceipt);
    if (nextReceiptKey != _ratedReceiptKey) {
      _selectedRating = null;
      _ratedReceiptKey = nextReceiptKey;
    }
  }

  @override
  Widget build(BuildContext context) {
    final receipt = widget.state.lastReceipt;
    final paidTotal = receipt?.totalMinor ?? widget.state.totalMinor;
    final branchName = widget.state.branchName?.trim().isNotEmpty == true
        ? widget.state.branchName!
        : 'BIGTIME POS';
    final screenSize = MediaQuery.sizeOf(context);
    final compact = screenSize.height <= 800;
    final cardWidth = (screenSize.width - 96).clamp(420.0, 520.0).toDouble();
    final cardHorizontalPadding = compact ? 36.0 : 48.0;
    final cardVerticalPadding = compact ? 30.0 : 56.0;
    final sectionGap = compact ? 22.0 : 36.0;
    final smallGap = compact ? 20.0 : 32.0;
    final receiptGap = compact ? 10.0 : 14.0;
    final footerGap = compact ? 18.0 : 28.0;
    final headlineFontSize = compact ? 30.0 : 36.0;
    final subtitleFontSize = compact ? 14.0 : 16.0;
    final amountLabelFontSize = compact ? 11.0 : 12.0;
    final amountCurrencyFontSize = compact ? 16.0 : 18.0;
    final amountFontSize = compact ? 50.0 : 64.0;
    final footerTitleFontSize = compact ? 14.0 : 15.0;
    final footerBodyFontSize = compact ? 12.0 : 13.0;

    return Container(
      color: _T.thankBg,
      child: Stack(
        alignment: Alignment.center,
        children: [
          // ── PULSING BG RINGS ──
          AnimatedBuilder(
            animation: _ringCtrl,
            builder: (_, child2) {
              final v = _ringCtrl.value;
              return Stack(
                alignment: Alignment.center,
                children: [
                  _buildRing(320, 0.6 + 0.4 * _wave(v, 0.0)),
                  _buildRing(520, 0.6 + 0.4 * _wave(v, 0.33)),
                  _buildRing(720, 0.6 + 0.4 * _wave(v, 0.66)),
                ],
              );
            },
          ),

          // ── CARD ──
          ScaleTransition(
            scale: CurvedAnimation(
              parent: _cardCtrl,
              curve: const _BounceOutCurve(),
            ).drive(Tween(begin: 0.88, end: 1.0)),
            child: FadeTransition(
              opacity: _cardCtrl,
              child: Container(
                width: cardWidth,
                padding: EdgeInsets.symmetric(
                  horizontal: cardHorizontalPadding,
                  vertical: cardVerticalPadding,
                ),
                decoration: BoxDecoration(
                  color: _T.surface,
                  borderRadius: BorderRadius.circular(24),
                  boxShadow: const [
                    BoxShadow(
                      color: Color(0x1A000000),
                      blurRadius: 80,
                      offset: Offset(0, 24),
                    ),
                    BoxShadow(
                      color: Color(0x0A000000),
                      blurRadius: 8,
                      offset: Offset(0, 2),
                    ),
                  ],
                ),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    // ── CHECK ICON ──
                    ScaleTransition(
                      scale: CurvedAnimation(
                        parent: _checkCtrl,
                        curve: const _BounceOutCurve(),
                      ),
                      child: _RippleCheck(ctrl: _checkCtrl, compact: compact),
                    ),
                    SizedBox(height: smallGap),

                    // ── HEADLINE ──
                    _FadeUp(
                      ctrl: _contentCtrl,
                      delay: 0.0,
                      child: Text(
                        'Payment Done!',
                        style: TextStyle(
                          fontSize: headlineFontSize,
                          fontWeight: FontWeight.w800,
                          color: _T.thankText,
                          letterSpacing: -0.3,
                        ),
                      ),
                    ),
                    const SizedBox(height: 8),

                    _FadeUp(
                      ctrl: _contentCtrl,
                      delay: 0.1,
                      child: Text(
                        widget.settings.thankYouMessage.isNotEmpty
                            ? widget.settings.thankYouMessage
                            : 'Transaction completed successfully',
                        style: TextStyle(
                          fontSize: subtitleFontSize,
                          fontWeight: FontWeight.w500,
                          color: _T.thankMuted,
                        ),
                        textAlign: TextAlign.center,
                      ),
                    ),
                    SizedBox(height: sectionGap),
                    _FadeUp(
                      ctrl: _contentCtrl,
                      delay: 0.16,
                      child: _CustomerRatingCard(
                        selectedRating: _selectedRating,
                        compact: compact,
                        onRatingSelected: (rating) {
                          setState(() {
                            _selectedRating = rating;
                            _ratedReceiptKey = _receiptKey(receipt);
                          });
                        },
                      ),
                    ),
                    SizedBox(height: sectionGap),

                    // ── DIVIDER WITH NOTCHES ──
                    _FadeUp(
                      ctrl: _contentCtrl,
                      delay: 0.2,
                      child: _NotchedDivider(compact: compact),
                    ),
                    SizedBox(height: sectionGap),

                    // ── AMOUNT BLOCK ──
                    _FadeUp(
                      ctrl: _contentCtrl,
                      delay: 0.25,
                      child: Column(
                        children: [
                          Text(
                            'AMOUNT PAID',
                            style: TextStyle(
                              fontSize: amountLabelFontSize,
                              fontWeight: FontWeight.w700,
                              letterSpacing: 1.5,
                              color: _T.thankSubtle,
                            ),
                          ),
                          const SizedBox(height: 6),
                          Row(
                            mainAxisAlignment: MainAxisAlignment.center,
                            crossAxisAlignment: CrossAxisAlignment.baseline,
                            textBaseline: TextBaseline.alphabetic,
                            children: [
                              Text(
                                'PHP',
                                style: TextStyle(
                                  fontSize: amountCurrencyFontSize,
                                  fontWeight: FontWeight.w700,
                                  color: _T.thankMuted,
                                ),
                              ),
                              const SizedBox(width: 6),
                              Text(
                                _amountOnly(paidTotal),
                                style: TextStyle(
                                  fontSize: amountFontSize,
                                  fontWeight: FontWeight.w800,
                                  color: _T.green,
                                  letterSpacing: -1.5,
                                  height: 1,
                                ),
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),
                    SizedBox(height: sectionGap),

                    // ── RECEIPT ROWS ──
                    if (receipt != null)
                      _FadeUp(
                        ctrl: _contentCtrl,
                        delay: 0.35,
                        child: Column(
                          children: [
                            _ReceiptRow(
                              label: 'Official Receipt',
                              value: receipt.orLabel,
                              compact: compact,
                            ),
                            SizedBox(height: receiptGap),
                            _ReceiptRow(
                              label: 'Change',
                              value: _asPeso(receipt.changeMinor),
                              highlight: true,
                              compact: compact,
                            ),
                          ],
                        ),
                      ),
                    if (receipt != null) SizedBox(height: sectionGap),

                    SizedBox(height: footerGap),

                    // ── FOOTER ──
                    _FadeUp(
                      ctrl: _contentCtrl,
                      delay: 0.5,
                      child: Column(
                        children: [
                          Text(
                            'Store: $branchName',
                            style: TextStyle(
                              fontSize: footerTitleFontSize,
                              fontWeight: FontWeight.w700,
                              color: _T.thankText,
                            ),
                          ),
                          const SizedBox(height: 6),
                          Row(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              _PulseDot(ctrl: _pulseCtrl),
                              const SizedBox(width: 6),
                              Text(
                                'New order will appear automatically',
                                style: TextStyle(
                                  fontSize: footerBodyFontSize,
                                  color: _T.thankSubtle,
                                ),
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildRing(double size, double opacity) {
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        border: Border.all(
          color: _T.green.withValues(alpha: 0.08 * opacity),
          width: 1.5,
        ),
      ),
    );
  }

  double _wave(double t, double offset) {
    final shifted = (t + offset) % 1.0;
    return (shifted < 0.5) ? shifted * 2 : 2 - shifted * 2;
  }

  String? _receiptKey(CustomerDisplayReceipt? receipt) {
    if (receipt == null) {
      return null;
    }
    return '${receipt.referenceNumber}|${receipt.orLabel}|${receipt.createdAt.toUtc().toIso8601String()}';
  }
}

class _CustomerRatingCard extends StatelessWidget {
  const _CustomerRatingCard({
    required this.selectedRating,
    required this.compact,
    required this.onRatingSelected,
  });

  final int? selectedRating;
  final bool compact;
  final ValueChanged<int> onRatingSelected;

  @override
  Widget build(BuildContext context) {
    final hasSelection = selectedRating != null;

    return Container(
      width: double.infinity,
      padding: EdgeInsets.symmetric(
        horizontal: compact ? 18 : 22,
        vertical: compact ? 14 : 20,
      ),
      decoration: BoxDecoration(
        color: _T.ratingStarSoft,
        borderRadius: BorderRadius.circular(22),
        border: Border.all(color: _T.ratingBorder),
      ),
      child: Column(
        children: [
          Text(
            hasSelection ? 'Thank you for your feedback!' : 'Rate your visit',
            textAlign: TextAlign.center,
            style: TextStyle(
              fontSize: compact ? 19 : 22,
              fontWeight: FontWeight.w800,
              color: _T.thankText,
              letterSpacing: -0.2,
            ),
          ),
          const SizedBox(height: 6),
          Text(
            hasSelection
                ? _ratingLabel(selectedRating!)
                : 'Tap 1 to 5 stars and tell us how we did today.',
            textAlign: TextAlign.center,
            style: TextStyle(
              fontSize: compact ? 13 : 14,
              fontWeight: FontWeight.w500,
              color: _T.thankMuted,
            ),
          ),
          SizedBox(height: compact ? 14 : 18),
          Wrap(
            alignment: WrapAlignment.center,
            spacing: compact ? 8 : 10,
            runSpacing: compact ? 8 : 10,
            children: List.generate(5, (index) {
              final rating = index + 1;
              final active =
                  selectedRating != null && rating <= selectedRating!;
              return _RatingStarButton(
                rating: rating,
                active: active,
                compact: compact,
                onTap: () => onRatingSelected(rating),
              );
            }),
          ),
        ],
      ),
    );
  }

  static String _ratingLabel(int rating) {
    return switch (rating) {
      5 => '5 stars • Excellent',
      4 => '4 stars • Very good',
      3 => '3 stars • Good',
      2 => '2 stars • Needs improvement',
      _ => '1 star • We can do better',
    };
  }
}

class _RatingStarButton extends StatelessWidget {
  const _RatingStarButton({
    required this.rating,
    required this.active,
    required this.compact,
    required this.onTap,
  });

  final int rating;
  final bool active;
  final bool compact;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(18),
        child: Ink(
          width: compact ? 58 : 72,
          height: compact ? 68 : 82,
          decoration: BoxDecoration(
            color: active ? const Color(0xFFFFE7AD) : Colors.white,
            borderRadius: BorderRadius.circular(18),
            border: Border.all(
              color: active ? _T.ratingStar : _T.ratingBorder,
              width: active ? 1.8 : 1.2,
            ),
            boxShadow: [
              BoxShadow(
                color: active
                    ? const Color(0x1AF59E0B)
                    : const Color(0x0D111827),
                blurRadius: active ? 16 : 10,
                offset: const Offset(0, 6),
              ),
            ],
          ),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(
                active ? Icons.star_rounded : Icons.star_border_rounded,
                color: _T.ratingStar,
                size: compact ? 28 : 34,
              ),
              SizedBox(height: compact ? 4 : 6),
              Text(
                '$rating',
                style: TextStyle(
                  fontSize: compact ? 14 : 16,
                  fontWeight: FontWeight.w800,
                  color: active ? _T.thankText : _T.thankMuted,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

// ── Bounce-out curve matching CSS cubic-bezier(.34,1.56,.64,1) ──
class _BounceOutCurve extends Curve {
  const _BounceOutCurve();

  @override
  double transformInternal(double t) {
    // Approximation of cubic-bezier(.34,1.56,.64,1)
    if (t < 0.5) {
      return 4 * t * t * t;
    } else {
      final f = (2 * t - 2);
      return 0.5 * f * f * f + 1;
    }
  }
}

// ── Ripple check icon ──
class _RippleCheck extends StatelessWidget {
  const _RippleCheck({required this.ctrl, required this.compact});

  final AnimationController ctrl;
  final bool compact;

  @override
  Widget build(BuildContext context) {
    final outerSize = compact ? 88.0 : 112.0;
    final innerSize = compact ? 74.0 : 96.0;
    final iconSize = compact ? 34.0 : 44.0;

    return SizedBox(
      width: outerSize,
      height: outerSize,
      child: Stack(
        alignment: Alignment.center,
        children: [
          // Ripple ring
          AnimatedBuilder(
            animation: ctrl,
            builder: (_, child2) {
              return Container(
                width: outerSize,
                height: outerSize,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  border: Border.all(
                    color: _T.greenBg.withValues(alpha: 0.8 * (1 - ctrl.value)),
                    width: 2,
                  ),
                ),
              );
            },
          ),
          // Green ring with icon
          Container(
            width: innerSize,
            height: innerSize,
            decoration: const BoxDecoration(
              color: _T.greenBg,
              shape: BoxShape.circle,
            ),
            child: Icon(Icons.check_rounded, color: _T.green, size: iconSize),
          ),
        ],
      ),
    );
  }
}

// ── Staggered fade-up widget ──
class _FadeUp extends StatelessWidget {
  const _FadeUp({required this.ctrl, required this.delay, required this.child});

  final AnimationController ctrl;
  final double delay;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    final curved = CurvedAnimation(
      parent: ctrl,
      curve: Interval(delay, 1.0, curve: Curves.easeOut),
    );
    return FadeTransition(
      opacity: curved,
      child: SlideTransition(
        position: curved.drive(
          Tween(begin: const Offset(0, 0.15), end: Offset.zero),
        ),
        child: child,
      ),
    );
  }
}

// ── Notched divider (receipt-style) ──
class _NotchedDivider extends StatelessWidget {
  const _NotchedDivider({required this.compact});

  final bool compact;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: compact ? 12 : 14,
      child: Stack(
        alignment: Alignment.center,
        children: [
          Container(height: 1, color: _T.thankBorder),
          Positioned(
            left: compact ? -36 : -48,
            child: Container(
              width: compact ? 12 : 14,
              height: compact ? 12 : 14,
              decoration: BoxDecoration(
                color: _T.thankBg,
                shape: BoxShape.circle,
                border: Border.all(color: _T.thankBorder, width: 1),
              ),
            ),
          ),
          Positioned(
            right: compact ? -36 : -48,
            child: Container(
              width: compact ? 12 : 14,
              height: compact ? 12 : 14,
              decoration: BoxDecoration(
                color: _T.thankBg,
                shape: BoxShape.circle,
                border: Border.all(color: _T.thankBorder, width: 1),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

// ── Receipt info row ──
class _ReceiptRow extends StatelessWidget {
  const _ReceiptRow({
    required this.label,
    required this.value,
    required this.compact,
    this.highlight = false,
  });

  final String label;
  final String value;
  final bool compact;
  final bool highlight;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: EdgeInsets.symmetric(
        horizontal: compact ? 16 : 18,
        vertical: compact ? 11 : 14,
      ),
      decoration: BoxDecoration(
        color: _T.thankBg,
        borderRadius: BorderRadius.circular(14),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Row(
            children: [
              Container(
                width: 8,
                height: 8,
                decoration: BoxDecoration(
                  color: _T.greenBg,
                  shape: BoxShape.circle,
                  border: Border.all(color: _T.green, width: 2),
                ),
              ),
              const SizedBox(width: 8),
              Text(
                label,
                style: TextStyle(
                  fontSize: compact ? 12 : 13,
                  fontWeight: FontWeight.w600,
                  color: _T.thankMuted,
                ),
              ),
            ],
          ),
          Text(
            value,
            style: TextStyle(
              fontSize: compact ? 14 : 15,
              fontWeight: FontWeight.w700,
              color: highlight ? _T.green : _T.thankText,
            ),
          ),
        ],
      ),
    );
  }
}

// ── Pulsing dot ──
class _PulseDot extends StatelessWidget {
  const _PulseDot({required this.ctrl});

  final AnimationController ctrl;

  @override
  Widget build(BuildContext context) {
    return FadeTransition(
      opacity: ctrl.drive(Tween(begin: 0.2, end: 1.0)),
      child: Container(
        width: 7,
        height: 7,
        decoration: const BoxDecoration(
          color: _T.green,
          shape: BoxShape.circle,
        ),
      ),
    );
  }
}
