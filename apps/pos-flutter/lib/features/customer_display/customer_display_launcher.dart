import 'dart:io';

import 'package:flutter/services.dart';
import 'package:path/path.dart' as p;

import 'customer_display_storage.dart';

class CustomerDisplayLauncher {
  static const MethodChannel _androidChannel = MethodChannel(
    'com.apex.pos/customer_display',
  );

  CustomerDisplayLauncher(this._storage);

  final CustomerDisplayStorage _storage;

  Future<bool> hasSecondaryDisplay() async {
    if (!Platform.isAndroid) {
      return false;
    }

    try {
      return await _androidChannel.invokeMethod<bool>('hasSecondaryDisplay') ??
          false;
    } catch (_) {
      return false;
    }
  }

  Future<bool> launch() async {
    if (await _storage.hasFreshHeartbeat()) {
      return false;
    }

    if (Platform.isAndroid) {
      if (!await hasSecondaryDisplay()) {
        return false;
      }

      return await _androidChannel.invokeMethod<bool>(
            'openOnSecondaryDisplay',
          ) ??
          false;
    }

    if (!Platform.isWindows) {
      return false;
    }

    final executable = await _resolveExecutablePath();
    await Process.start(
      executable,
      const ['--customer-display'],
      environment: const {'POS_CUSTOMER_DISPLAY': '1'},
      includeParentEnvironment: true,
      workingDirectory: p.dirname(executable),
      mode: ProcessStartMode.detached,
      runInShell: false,
    );
    return true;
  }

  Future<String> _resolveExecutablePath() async {
    final currentExecutable = Platform.resolvedExecutable;
    final currentFileName = p.basename(currentExecutable).toLowerCase();
    if (currentFileName == 'pos_flutter.exe') {
      return currentExecutable;
    }

    final cwd = Directory.current.path;
    final currentDirectory = p.dirname(currentExecutable);
    final candidates = <String>[
      p.join(currentDirectory, 'pos_flutter.exe'),
      p.join(
        cwd,
        'build',
        'windows',
        'x64',
        'runner',
        'Release',
        'pos_flutter.exe',
      ),
      p.join(
        cwd,
        'build',
        'windows',
        'x64',
        'runner',
        'Debug',
        'pos_flutter.exe',
      ),
      p.join(
        cwd,
        'apps',
        'pos-flutter',
        'build',
        'windows',
        'x64',
        'runner',
        'Release',
        'pos_flutter.exe',
      ),
      p.join(
        cwd,
        'apps',
        'pos-flutter',
        'build',
        'windows',
        'x64',
        'runner',
        'Debug',
        'pos_flutter.exe',
      ),
    ];

    for (final candidate in candidates) {
      if (await File(candidate).exists()) {
        return candidate;
      }
    }

    return currentExecutable;
  }
}
