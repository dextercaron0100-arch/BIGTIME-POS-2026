import 'dart:io';
import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:media_kit/media_kit.dart';
import 'package:screen_retriever/screen_retriever.dart';
import 'package:window_manager/window_manager.dart';
import 'app.dart';
import 'features/customer_display/customer_display_app.dart';

bool _hasCustomerDisplayArg(List<String> args) {
  for (final arg in args) {
    final normalized = arg.trim().toLowerCase();
    if (normalized == '--customer-display' ||
        normalized == '--customer-display=true' ||
        normalized == 'customer-display=true') {
      return true;
    }
  }
  return false;
}

bool _hasCustomerDisplayEnv() {
  final value = Platform.environment['POS_CUSTOMER_DISPLAY']
      ?.trim()
      .toLowerCase();
  return value == '1' || value == 'true' || value == 'yes';
}

bool _hasCustomerDisplayRoute() {
  final routeName = WidgetsBinding.instance.platformDispatcher.defaultRouteName
      .trim()
      .toLowerCase();
  return routeName == '/customer-display' || routeName == 'customer-display';
}

Future<void> _positionCustomerDisplayOnSecondaryMonitor() async {
  if (!Platform.isWindows) {
    return;
  }

  try {
    final displays = await screenRetriever.getAllDisplays();
    if (displays.length < 2) {
      return;
    }

    final primary = await screenRetriever.getPrimaryDisplay();
    final secondary = displays.firstWhere(
      (display) => display.id != primary.id,
      orElse: () => displays.first,
    );
    if (secondary.id == primary.id) {
      return;
    }

    final currentSize = await windowManager.getSize();
    final visiblePosition = secondary.visiblePosition ?? Offset.zero;
    final visibleSize = secondary.visibleSize ?? secondary.size;
    final targetWidth = currentSize.width > visibleSize.width
        ? visibleSize.width
        : currentSize.width;
    final targetHeight = currentSize.height > visibleSize.height
        ? visibleSize.height
        : currentSize.height;

    final targetRect = Rect.fromLTWH(
      visiblePosition.dx + ((visibleSize.width - targetWidth) / 2),
      visiblePosition.dy + ((visibleSize.height - targetHeight) / 2),
      targetWidth,
      targetHeight,
    );
    await windowManager.setBounds(targetRect);
  } catch (_) {
    // Keep default centered placement if display metadata is unavailable.
  }
}

Future<void> main(List<String> args) async {
  WidgetsFlutterBinding.ensureInitialized();
  final isCustomerDisplay =
      _hasCustomerDisplayArg(args) ||
      _hasCustomerDisplayEnv() ||
      _hasCustomerDisplayRoute();

  if (Platform.isWindows || isCustomerDisplay) {
    MediaKit.ensureInitialized();
  }

  if (Platform.isWindows) {
    await windowManager.ensureInitialized();
    final windowOptions = WindowOptions(
      title: isCustomerDisplay ? 'BIGTIME CFD' : 'BIGTIME POS',
      size: isCustomerDisplay ? const Size(1280, 720) : const Size(1440, 900),
      minimumSize: isCustomerDisplay
          ? const Size(800, 520)
          : const Size(1180, 760),
      center: true,
      backgroundColor: isCustomerDisplay
          ? const Color(0xFF080909)
          : const Color(0xFFF4EEE6),
    );
    windowManager.waitUntilReadyToShow(windowOptions, () async {
      if (isCustomerDisplay) {
        await _positionCustomerDisplayOnSecondaryMonitor();
      }
      await windowManager.show();
      await windowManager.focus();
    });
  }

  if (isCustomerDisplay) {
    runApp(const CustomerDisplayApp());
    return;
  }

  runApp(const ProviderScope(child: PosApp()));
}
