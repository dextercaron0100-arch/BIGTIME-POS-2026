import 'dart:convert';
import 'dart:io';

import 'package:path/path.dart' as p;
import 'package:path_provider/path_provider.dart';

import '../models/payment_settings.dart';

class PaymentSettingsStorage {
  Future<void> _writeQueue = Future<void>.value();

  static const _directoryName = 'payment_settings';
  static const _settingsFileName = 'settings.json';

  Future<PaymentSettings> readSettings() async {
    final payload = await _readJsonFile(_settingsFileName);
    if (payload == null) {
      return PaymentSettings.defaults();
    }
    return PaymentSettings.fromJson(payload);
  }

  Future<void> writeSettings(PaymentSettings settings) {
    return _enqueueWrite(_settingsFileName, settings.toJson());
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
    await tempFile.writeAsString('${jsonEncode(payload)}\n', flush: true);
    if (await file.exists()) {
      await file.delete();
    }
    await tempFile.rename(file.path);
  }
}
