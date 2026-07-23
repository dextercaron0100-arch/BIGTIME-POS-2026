import 'dart:convert';
import 'dart:math' as math;

import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:drift/drift.dart';
import 'package:path/path.dart' as p;

import '../database/app_database.dart';
import 'back_office_client.dart';
import 'payment_settings_storage.dart';
import '../../features/customer_display/customer_display_models.dart';
import '../../features/customer_display/customer_display_storage.dart';

class SyncedTransactionReceipt {
  const SyncedTransactionReceipt({
    required this.localTransactionId,
    required this.serverTransactionId,
    required this.orNumber,
    required this.orLabel,
    required this.referenceNumber,
    required this.total,
    required this.vatAmount,
    required this.changeAmount,
    required this.paymentMethod,
    required this.createdAt,
  });

  final String localTransactionId;
  final String serverTransactionId;
  final int orNumber;
  final String orLabel;
  final String referenceNumber;
  final double total;
  final double vatAmount;
  final double changeAmount;
  final String paymentMethod;
  final DateTime createdAt;
}

class SyncRunResult {
  const SyncRunResult({
    required this.synced,
    required this.syncedCount,
    required this.message,
    this.transactionReceipts = const <String, SyncedTransactionReceipt>{},
  });

  final bool synced;
  final int syncedCount;
  final String message;
  final Map<String, SyncedTransactionReceipt> transactionReceipts;
}

class SyncService {
  SyncService(this.database, this.backOfficeClient)
    : _connectivity = Connectivity();

  static const _syncBatchMaxEntries = int.fromEnvironment(
    'SYNC_UPLOAD_BATCH_MAX_ENTRIES',
    defaultValue: 40,
  );
  static const _syncBatchMaxBytes = int.fromEnvironment(
    'SYNC_UPLOAD_BATCH_MAX_BYTES',
    defaultValue: 250000,
  );
  static const _maxRetryBackoffMinutes = int.fromEnvironment(
    'SYNC_MAX_RETRY_BACKOFF_MINUTES',
    defaultValue: 20,
  );

  final AppDatabase database;
  final BackOfficeClient backOfficeClient;
  final Connectivity _connectivity;
  final CustomerDisplayStorage _customerDisplayStorage =
      CustomerDisplayStorage();
  final PaymentSettingsStorage _paymentSettingsStorage =
      PaymentSettingsStorage();

  Stream<bool> watchOnlineStatus() async* {
    final initialConnectivity = await _connectivity.checkConnectivity();
    yield !initialConnectivity.contains(ConnectivityResult.none);
    yield* _connectivity.onConnectivityChanged
        .map((results) => !results.contains(ConnectivityResult.none))
        .distinct();
  }

  Stream<List<SyncQueueEntry>> watchOutboxRecords({int limit = 120}) {
    return database.watchRecentSyncQueueEntries(limit: limit);
  }

  String outboxErrorMessage(String? value) {
    return _decodeSyncErrorMessage(value);
  }

  DateTime? outboxNextRetryAt(String? value) {
    return _decodeSyncNextRetryAt(value);
  }

  Future<bool> isOnline() async {
    final connectivity = await _connectivity.checkConnectivity();
    return !connectivity.contains(ConnectivityResult.none);
  }

  Future<void> refreshCatalog({required String branchId}) async {
    final snapshot = await backOfficeClient.fetchCatalogSnapshot(
      branchId: branchId,
    );
    final categoriesById = {
      for (final category in snapshot.categories) category.id: category.name,
    };

    await database.replaceCatalogItems(
      branchId: branchId,
      items: snapshot.items.map(
        (item) => CatalogCacheItemsCompanion.insert(
          id: item.id,
          branchId: item.branchId,
          categoryName: categoriesById[item.categoryId] ?? 'Uncategorized',
          name: item.name,
          sku: item.sku,
          barcode: Value(item.barcode.isEmpty ? null : item.barcode),
          priceMinor: _toMinorUnits(item.price),
          vatType: item.vatType,
          unit: item.unit,
          hasVariants: Value(item.hasVariants),
          updatedAt: Value(DateTime.now()),
        ),
      ),
    );
  }

  Future<void> refreshCustomerDisplaySettings({
    required String branchId,
  }) async {
    final settings = await backOfficeClient.fetchCustomerDisplaySettings(
      branchId: branchId,
    );
    final keepPaths = <String>{};
    final assets = <CustomerDisplayMediaAsset>[];

    for (final asset in settings.assets) {
      final file = await _customerDisplayStorage.mediaFile(
        _customerDisplayCacheFileName(asset),
      );
      if (!await file.exists()) {
        final bytes = await backOfficeClient.downloadBytes(asset.url);
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

    await _customerDisplayStorage.pruneCachedMediaFiles(keepPaths);
    await _customerDisplayStorage.writeSettings(
      CustomerDisplaySettings(
        assets: assets,
        thankYouMessage: settings.thankYouMessage,
        launchFullscreen: settings.launchFullscreen,
        imageDurationSeconds: settings.imageDurationSeconds,
      ),
    );
  }

  Future<void> refreshPaymentSettings({required String branchId}) async {
    final settings = await backOfficeClient.fetchPaymentSettings(
      branchId: branchId,
    );
    await _paymentSettingsStorage.writeSettings(settings);
  }

  Future<SyncRunResult> runFullSync({
    required String branchId,
    required String terminalId,
  }) async {
    final connectivity = await _connectivity.checkConnectivity();
    final isOnline = !connectivity.contains(ConnectivityResult.none);
    if (!isOnline) {
      return const SyncRunResult(
        synced: false,
        syncedCount: 0,
        message: 'Terminal is offline. Queue retained locally.',
      );
    }
    if (!backOfficeClient.hasAccessToken) {
      return const SyncRunResult(
        synced: false,
        syncedCount: 0,
        message: 'Session missing. Please logout and login again while online.',
      );
    }

    final uploadResult = await flushPending(
      branchId: branchId,
      terminalId: terminalId,
    );

    try {
      await refreshCatalog(branchId: branchId);
    } catch (error) {
      if (!uploadResult.synced && uploadResult.syncedCount == 0) {
        return SyncRunResult(
          synced: false,
          syncedCount: uploadResult.syncedCount,
          message: 'Sync failed: ${error.toString().split('\n').first}',
          transactionReceipts: uploadResult.transactionReceipts,
        );
      }

      return SyncRunResult(
        synced: uploadResult.synced,
        syncedCount: uploadResult.syncedCount,
        message:
            '${uploadResult.message} Catalog refresh will retry automatically.',
        transactionReceipts: uploadResult.transactionReceipts,
      );
    }

    final syncWarnings = <String>[];
    try {
      await refreshCustomerDisplaySettings(branchId: branchId);
    } catch (_) {
      syncWarnings.add('customer display media');
    }

    try {
      await refreshPaymentSettings(branchId: branchId);
    } catch (_) {
      syncWarnings.add('payment settings');
    }

    final warningSuffix = syncWarnings.isEmpty
        ? ''
        : ' ${syncWarnings.join(' and ')} will retry on the next sync.';

    final message = uploadResult.syncedCount == 0
        ? 'Catalog synced from back office.$warningSuffix'
        : uploadResult.synced
        ? '${uploadResult.syncedCount} record(s) synced and catalog refreshed.$warningSuffix'
        : '${uploadResult.message} Catalog refreshed from back office.$warningSuffix';

    return SyncRunResult(
      synced: uploadResult.synced,
      syncedCount: uploadResult.syncedCount,
      message: message,
      transactionReceipts: uploadResult.transactionReceipts,
    );
  }

  Future<SyncRunResult> flushPending({
    required String branchId,
    required String terminalId,
  }) async {
    final connectivity = await _connectivity.checkConnectivity();
    final isOnline = !connectivity.contains(ConnectivityResult.none);
    if (!isOnline) {
      return const SyncRunResult(
        synced: false,
        syncedCount: 0,
        message: 'Terminal is offline. Queue retained locally.',
      );
    }
    if (!backOfficeClient.hasAccessToken) {
      return const SyncRunResult(
        synced: false,
        syncedCount: 0,
        message: 'Session missing. Please logout and login again while online.',
      );
    }

    final pending = await database.pendingEntries();
    if (pending.isEmpty) {
      return const SyncRunResult(
        synced: true,
        syncedCount: 0,
        message: 'No pending records to sync.',
      );
    }

    final now = DateTime.now().toUtc();
    final dueEntries = pending
        .where((entry) => _isRetryDue(entry, now))
        .map(_prepareEntry)
        .toList(growable: false);

    if (dueEntries.isEmpty) {
      return SyncRunResult(
        synced: false,
        syncedCount: 0,
        message:
            'Pending records are waiting for retry cooldown (${pending.length} queued).',
      );
    }

    var cursor = 0;
    var syncedCount = 0;
    var failedCount = 0;
    final transactionReceipts = <String, SyncedTransactionReceipt>{};

    while (cursor < dueEntries.length) {
      final chunk = _pickChunk(dueEntries, startIndex: cursor);
      if (chunk.isEmpty) {
        break;
      }
      cursor += chunk.length;

      try {
        final chunkResult = await _submitChunkWithAdaptiveSplit(
          branchId: branchId,
          terminalId: terminalId,
          chunk: chunk,
        );
        syncedCount += chunkResult.syncedCount;
        failedCount += chunkResult.failedCount;
        transactionReceipts.addAll(chunkResult.transactionReceipts);
      } on BackOfficeException catch (error) {
        if (error.statusCode == 401) {
          return SyncRunResult(
            synced: false,
            syncedCount: syncedCount,
            message: error.message,
            transactionReceipts: transactionReceipts,
          );
        }

        failedCount += chunk.length;
        await _markEntriesFailed(
          chunk,
          reason: error.message,
          now: DateTime.now().toUtc(),
        );
      } catch (error) {
        failedCount += chunk.length;
        await _markEntriesFailed(
          chunk,
          reason: error.toString().split('\n').first,
          now: DateTime.now().toUtc(),
        );
      }
    }

    final pendingAfter = await database.pendingEntries();
    final remainingCount = pendingAfter.length;
    final fullySynced = remainingCount == 0;
    final message = syncedCount > 0
        ? failedCount > 0
              ? '$syncedCount record(s) synced. $remainingCount still queued for retry.'
              : '$syncedCount record(s) synced to server.'
        : failedCount > 0
        ? '$failedCount record(s) failed to sync and are scheduled for retry.'
        : 'No due records to sync right now.';

    return SyncRunResult(
      synced: fullySynced,
      syncedCount: syncedCount,
      message: message,
      transactionReceipts: transactionReceipts,
    );
  }

  _PreparedSyncEntry _prepareEntry(SyncQueueEntry entry) {
    Map<String, dynamic> payload;
    try {
      payload = jsonDecode(entry.payload) as Map<String, dynamic>;
    } catch (_) {
      payload = <String, dynamic>{};
    }

    final requestEntry = <String, Object?>{
      'id': entry.id,
      'tableName': entry.targetTable,
      'recordId': entry.recordId,
      'operation': entry.operation,
      'localCreatedAt': entry.localCreatedAt.toUtc().toIso8601String(),
      'payload': payload,
    };

    final bytes = utf8.encode(jsonEncode(requestEntry)).length;
    return _PreparedSyncEntry(
      source: entry,
      requestEntry: requestEntry,
      estimatedBytes: math.max(bytes, 1),
    );
  }

  List<_PreparedSyncEntry> _pickChunk(
    List<_PreparedSyncEntry> entries, {
    required int startIndex,
  }) {
    if (startIndex < 0 || startIndex >= entries.length) {
      return const [];
    }

    final chunk = <_PreparedSyncEntry>[];
    final maxEntries = math.max(_syncBatchMaxEntries, 1);
    final maxBytes = math.max(_syncBatchMaxBytes, 24 * 1024);
    var totalBytes = 0;

    for (var index = startIndex; index < entries.length; index += 1) {
      final candidate = entries[index];
      if (chunk.length >= maxEntries) {
        break;
      }

      final projectedBytes = totalBytes + candidate.estimatedBytes;
      if (chunk.isNotEmpty && projectedBytes > maxBytes) {
        break;
      }

      chunk.add(candidate);
      totalBytes = projectedBytes;
    }

    if (chunk.isEmpty) {
      return [entries[startIndex]];
    }
    return chunk;
  }

  Future<_ChunkSubmitResult> _submitChunkWithAdaptiveSplit({
    required String branchId,
    required String terminalId,
    required List<_PreparedSyncEntry> chunk,
  }) async {
    if (chunk.isEmpty) {
      return const _ChunkSubmitResult(
        syncedCount: 0,
        failedCount: 0,
        transactionReceipts: <String, SyncedTransactionReceipt>{},
      );
    }

    try {
      final response = await backOfficeClient.submitSyncBatch(
        branchId: branchId,
        terminalId: terminalId,
        entries: [for (final row in chunk) row.requestEntry],
      );

      final acceptedEntryIds = response.acceptedIds
          .map((value) => value.split(':').first)
          .where((value) => value.isNotEmpty)
          .toSet();
      if (acceptedEntryIds.isNotEmpty) {
        await database.markEntriesSynced(acceptedEntryIds);
      }

      final failures = <String, String>{};
      final rejectedIds = <String>{};
      for (final rejection in response.rejectedIds) {
        final id = rejection['id']?.trim() ?? '';
        if (id.isEmpty) {
          continue;
        }
        rejectedIds.add(id);
        failures[id] = _encodeSyncFailure(
          message: rejection['reason']?.trim().isNotEmpty == true
              ? rejection['reason']!.trim()
              : 'Sync rejected by server.',
          retryCount: _retryCountForChunkEntry(chunk, id) + 1,
          nextRetryAt: DateTime.now().toUtc().add(
            Duration(
              milliseconds: _retryDelayMs(
                _retryCountForChunkEntry(chunk, id) + 1,
              ),
            ),
          ),
        );
      }

      final decidedIds = <String>{...acceptedEntryIds, ...rejectedIds};
      for (final row in chunk) {
        if (decidedIds.contains(row.source.id)) {
          continue;
        }
        failures[row.source.id] = _encodeSyncFailure(
          message: 'Server response did not acknowledge this record.',
          retryCount: row.source.retryCount + 1,
          nextRetryAt: DateTime.now().toUtc().add(
            Duration(milliseconds: _retryDelayMs(row.source.retryCount + 1)),
          ),
        );
      }

      if (failures.isNotEmpty) {
        await database.markEntriesFailed(failures);
      }

      final transactionReceipts = <String, SyncedTransactionReceipt>{};
      for (final receipt in response.transactionReceipts) {
        transactionReceipts[receipt.localTransactionId] =
            SyncedTransactionReceipt(
              localTransactionId: receipt.localTransactionId,
              serverTransactionId: receipt.serverTransactionId,
              orNumber: receipt.orNumber,
              orLabel: receipt.orLabel,
              referenceNumber: receipt.referenceNumber,
              total: receipt.total,
              vatAmount: receipt.vatAmount,
              changeAmount: receipt.changeAmount,
              paymentMethod: receipt.paymentMethod,
              createdAt: receipt.createdAt,
            );
      }

      return _ChunkSubmitResult(
        syncedCount: acceptedEntryIds.length,
        failedCount: failures.length,
        transactionReceipts: transactionReceipts,
      );
    } on BackOfficeException catch (error) {
      if (error.statusCode == 413 && chunk.length > 1) {
        final mid = chunk.length ~/ 2;
        final left = await _submitChunkWithAdaptiveSplit(
          branchId: branchId,
          terminalId: terminalId,
          chunk: chunk.sublist(0, mid),
        );
        final right = await _submitChunkWithAdaptiveSplit(
          branchId: branchId,
          terminalId: terminalId,
          chunk: chunk.sublist(mid),
        );
        return left.merge(right);
      }

      if (error.statusCode == 401) {
        rethrow;
      }

      await _markEntriesFailed(
        chunk,
        reason: error.message,
        now: DateTime.now().toUtc(),
      );
      return _ChunkSubmitResult(
        syncedCount: 0,
        failedCount: chunk.length,
        transactionReceipts: const <String, SyncedTransactionReceipt>{},
      );
    } catch (error) {
      await _markEntriesFailed(
        chunk,
        reason: error.toString().split('\n').first,
        now: DateTime.now().toUtc(),
      );
      return _ChunkSubmitResult(
        syncedCount: 0,
        failedCount: chunk.length,
        transactionReceipts: const <String, SyncedTransactionReceipt>{},
      );
    }
  }

  Future<void> _markEntriesFailed(
    List<_PreparedSyncEntry> chunk, {
    required String reason,
    required DateTime now,
  }) async {
    final failures = <String, String>{};
    for (final row in chunk) {
      final nextRetryCount = row.source.retryCount + 1;
      failures[row.source.id] = _encodeSyncFailure(
        message: reason,
        retryCount: nextRetryCount,
        nextRetryAt: now.add(
          Duration(milliseconds: _retryDelayMs(nextRetryCount)),
        ),
      );
    }
    await database.markEntriesFailed(failures);
  }

  int _retryCountForChunkEntry(List<_PreparedSyncEntry> chunk, String id) {
    for (final row in chunk) {
      if (row.source.id == id) {
        return row.source.retryCount;
      }
    }
    return 0;
  }

  bool _isRetryDue(SyncQueueEntry entry, DateTime nowUtc) {
    final nextRetryAt = _decodeSyncNextRetryAt(entry.error);
    if (nextRetryAt == null) {
      return true;
    }
    return !nextRetryAt.isAfter(nowUtc);
  }

  String _encodeSyncFailure({
    required String message,
    required int retryCount,
    required DateTime nextRetryAt,
  }) {
    return jsonEncode({
      'message': message.trim().isEmpty ? 'Sync failed.' : message.trim(),
      'retryCount': retryCount,
      'nextRetryAt': nextRetryAt.toUtc().toIso8601String(),
      'updatedAt': DateTime.now().toUtc().toIso8601String(),
    });
  }

  String _decodeSyncErrorMessage(String? value) {
    final raw = value?.trim();
    if (raw == null || raw.isEmpty) {
      return '';
    }
    try {
      final decoded = jsonDecode(raw);
      if (decoded is Map<String, dynamic>) {
        final message = decoded['message'];
        if (message is String && message.trim().isNotEmpty) {
          return message.trim();
        }
      }
    } catch (_) {
      // Preserve backwards compatibility with plain text error payloads.
    }
    return raw;
  }

  DateTime? _decodeSyncNextRetryAt(String? value) {
    final raw = value?.trim();
    if (raw == null || raw.isEmpty) {
      return null;
    }
    try {
      final decoded = jsonDecode(raw);
      if (decoded is Map<String, dynamic>) {
        final nextRetryAt = decoded['nextRetryAt'];
        if (nextRetryAt is String) {
          return DateTime.tryParse(nextRetryAt)?.toUtc();
        }
      }
    } catch (_) {
      return null;
    }
    return null;
  }

  int _retryDelayMs(int retryCount) {
    final safeRetryCount = math.max(retryCount, 1);
    final exponentialSeconds = 5 * (1 << math.min(safeRetryCount, 10));
    final cappedSeconds = math.min(
      _maxRetryBackoffMinutes * 60,
      math.max(5, exponentialSeconds),
    );
    return cappedSeconds * 1000;
  }

  int _toMinorUnits(double amount) {
    return (amount * 100).round();
  }

  String _customerDisplayCacheFileName(BackOfficeCustomerDisplayAsset asset) {
    final extension = p.extension(asset.fileName).toLowerCase();
    final safeExtension = extension.isNotEmpty
        ? extension
        : asset.kind == BackOfficeCustomerDisplayMediaKind.video
        ? '.mp4'
        : '.jpg';
    return '${asset.id}$safeExtension';
  }
}

class _PreparedSyncEntry {
  const _PreparedSyncEntry({
    required this.source,
    required this.requestEntry,
    required this.estimatedBytes,
  });

  final SyncQueueEntry source;
  final Map<String, Object?> requestEntry;
  final int estimatedBytes;
}

class _ChunkSubmitResult {
  const _ChunkSubmitResult({
    required this.syncedCount,
    required this.failedCount,
    required this.transactionReceipts,
  });

  final int syncedCount;
  final int failedCount;
  final Map<String, SyncedTransactionReceipt> transactionReceipts;

  _ChunkSubmitResult merge(_ChunkSubmitResult other) {
    return _ChunkSubmitResult(
      syncedCount: syncedCount + other.syncedCount,
      failedCount: failedCount + other.failedCount,
      transactionReceipts: {
        ...transactionReceipts,
        ...other.transactionReceipts,
      },
    );
  }
}
