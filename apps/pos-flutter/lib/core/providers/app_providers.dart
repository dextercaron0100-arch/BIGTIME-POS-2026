import 'dart:io';

import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../database/app_database.dart';
import '../services/back_office_client.dart';
import '../services/realtime_service.dart';
import '../services/sync_service.dart';
import '../../platform/hardware_adapter.dart';
import '../../platform/android/android_hardware_adapter.dart';
import '../../platform/windows/windows_hardware_adapter.dart';
import '../../features/catalog/catalog_item.dart';
import '../../features/catalog/catalog_repository.dart';

class TerminalInfo {
  const TerminalInfo({required this.id, required this.name});

  final String id;
  final String name;
}

final databaseProvider = Provider<AppDatabase>((ref) {
  final database = AppDatabase();
  ref.onDispose(() {
    database.close();
  });
  return database;
});

final catalogRepositoryProvider = Provider<CatalogRepository>((ref) {
  return CatalogRepository(ref.watch(databaseProvider));
});

final databaseBootstrapProvider = FutureProvider<void>((ref) async {
  await ref.watch(catalogRepositoryProvider).seedInitialData();
});

final catalogItemsProvider = StreamProvider<List<CatalogItemModel>>((ref) {
  ref.watch(databaseBootstrapProvider);
  return ref.watch(catalogRepositoryProvider).watchItems();
});

final pendingSyncCountProvider = StreamProvider<int>((ref) {
  return ref.watch(databaseProvider).watchPendingSyncCount();
});

final backOfficeClientProvider = Provider<BackOfficeClient>((ref) {
  return BackOfficeClient();
});

final backOfficeSessionEventProvider = StreamProvider<BackOfficeSessionEvent>((
  ref,
) {
  return ref.watch(backOfficeClientProvider).events;
});

final syncServiceProvider = Provider<SyncService>((ref) {
  return SyncService(
    ref.watch(databaseProvider),
    ref.watch(backOfficeClientProvider),
  );
});

final realtimeServiceProvider = Provider<RealtimeService>((ref) {
  final service = RealtimeService();
  ref.onDispose(service.dispose);
  return service;
});

final hardwareAdapterProvider = Provider<HardwareAdapter>((ref) {
  if (defaultTargetPlatform == TargetPlatform.windows) {
    return WindowsHardwareAdapter();
  }
  if (defaultTargetPlatform == TargetPlatform.android) {
    return AndroidHardwareAdapter();
  }

  return WindowsHardwareAdapter();
});

final onlineStatusProvider = StreamProvider<bool>((ref) {
  return ref.watch(syncServiceProvider).watchOnlineStatus();
});

final terminalInfoProvider = Provider<TerminalInfo>((ref) {
  final hostname = Platform.localHostname
      .replaceAll(RegExp(r'[^A-Za-z0-9]+'), '-')
      .replaceAll(RegExp(r'-{2,}'), '-')
      .replaceAll(RegExp(r'^-|-$'), '')
      .toLowerCase();
  final deviceKind = defaultTargetPlatform == TargetPlatform.windows
      ? 'windows'
      : 'android';

  return TerminalInfo(
    id: 'term-$deviceKind-${hostname.isEmpty ? 'local' : hostname}',
    name: defaultTargetPlatform == TargetPlatform.windows
        ? 'Windows POS'
        : 'Android POS',
  );
});
