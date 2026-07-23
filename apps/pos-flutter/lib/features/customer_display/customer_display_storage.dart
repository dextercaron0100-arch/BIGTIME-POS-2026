import 'dart:convert';
import 'dart:io';

import 'package:path/path.dart' as p;
import 'package:path_provider/path_provider.dart';

import 'customer_display_models.dart';

class CustomerDisplayStorage {
  Future<void> _writeQueue = Future<void>.value();

  static const _directoryName = 'customer_display';
  static const _assetsDirectoryName = 'assets';
  static const _settingsFileName = 'settings.json';
  static const _stateFileName = 'state.json';
  static const _heartbeatFileName = 'heartbeat.json';

  Future<CustomerDisplaySettings> readSettings() async {
    final payload = await _readJsonFile(_settingsFileName);
    if (payload == null) {
      return CustomerDisplaySettings.defaults();
    }
    return CustomerDisplaySettings.fromJson(payload);
  }

  Future<void> writeSettings(CustomerDisplaySettings settings) {
    return _enqueueWrite(_settingsFileName, settings.toJson());
  }

  Future<CustomerDisplayState> readState() async {
    final payload = await _readJsonFile(_stateFileName);
    if (payload == null) {
      return CustomerDisplayState.idle();
    }
    return CustomerDisplayState.fromJson(payload);
  }

  Future<void> writeState(CustomerDisplayState state) {
    return _enqueueWrite(_stateFileName, state.toJson());
  }

  Future<void> writeHeartbeat() {
    return _enqueueWrite(_heartbeatFileName, {
      'updatedAt': DateTime.now().toUtc().toIso8601String(),
    });
  }

  Future<void> clearHeartbeat() async {
    final file = await _fileFor(_heartbeatFileName);
    if (await file.exists()) {
      await file.delete();
    }
  }

  Future<bool> hasFreshHeartbeat({
    Duration ttl = const Duration(seconds: 6),
  }) async {
    final payload = await _readJsonFile(_heartbeatFileName);
    final updatedAt = DateTime.tryParse(payload?['updatedAt']?.toString() ?? '');
    if (updatedAt == null) {
      return false;
    }
    return DateTime.now().difference(updatedAt.toLocal()) <= ttl;
  }

  Future<String> directoryPath() async {
    final directory = await _directory();
    return directory.path;
  }

  Future<File> mediaFile(String fileName) async {
    final directory = await _assetsDirectory();
    return File(p.join(directory.path, fileName));
  }

  Future<void> pruneCachedMediaFiles(Set<String> keepPaths) async {
    final directory = await _assetsDirectory();
    if (!await directory.exists()) {
      return;
    }

    await for (final entity in directory.list()) {
      if (entity is! File) {
        continue;
      }
      if (keepPaths.contains(entity.path)) {
        continue;
      }
      try {
        await entity.delete();
      } catch (_) {
        continue;
      }
    }
  }

  Future<File> _fileFor(String fileName) async {
    final directory = await _directory();
    return File(p.join(directory.path, fileName));
  }

  Future<Directory> _directory() async {
    final base = await getApplicationSupportDirectory();
    final directory = Directory(p.join(base.path, _directoryName));
    if (!await directory.exists()) {
      await directory.create(recursive: true);
    }
    return directory;
  }

  Future<Directory> _assetsDirectory() async {
    final parent = await _directory();
    final directory = Directory(p.join(parent.path, _assetsDirectoryName));
    if (!await directory.exists()) {
      await directory.create(recursive: true);
    }
    return directory;
  }

  Future<Map<String, dynamic>?> _readJsonFile(String fileName) async {
    try {
      final file = await _fileFor(fileName);
      if (!await file.exists()) {
        return null;
      }
      final content = await file.readAsString();
      if (content.trim().isEmpty) {
        return null;
      }
      final decoded = jsonDecode(content);
      if (decoded is Map<String, dynamic>) {
        return decoded;
      }
    } catch (_) {
      return null;
    }
    return null;
  }

  Future<void> _enqueueWrite(String fileName, Map<String, Object?> payload) {
    final task = _writeQueue.then((_) => _writeJsonFile(fileName, payload));
    _writeQueue = task.catchError((_) {});
    return task;
  }

  Future<void> _writeJsonFile(
    String fileName,
    Map<String, Object?> payload,
  ) async {
    final file = await _fileFor(fileName);
    final tempFile = File('${file.path}.tmp');
    await file.parent.create(recursive: true);
    await tempFile.parent.create(recursive: true);

    try {
      await tempFile.writeAsString('${jsonEncode(payload)}\n', flush: true);
      if (await file.exists()) {
        await file.delete();
      }
      await tempFile.rename(file.path);
      return;
    } catch (_) {
      try {
        if (await tempFile.exists()) {
          await tempFile.delete();
        }
      } catch (_) {}
    }

    await file.writeAsString('${jsonEncode(payload)}\n', flush: true);
  }
}
