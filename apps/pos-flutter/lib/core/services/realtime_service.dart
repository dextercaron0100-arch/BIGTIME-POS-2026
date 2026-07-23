import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:socket_io_client/socket_io_client.dart' as io;

import 'back_office_client.dart';

class CatalogRefreshEvent {
  const CatalogRefreshEvent({
    required this.branchId,
    required this.refreshedAt,
  });

  final String branchId;
  final DateTime refreshedAt;
}

class RealtimeService {
  final StreamController<CatalogRefreshEvent> _catalogRefreshEvents =
      StreamController<CatalogRefreshEvent>.broadcast();

  io.Socket? _socket;
  String? _branchId;

  Stream<CatalogRefreshEvent> get catalogRefreshEvents =>
      _catalogRefreshEvents.stream;

  void connect({required String branchId}) {
    final nextBranchId = branchId.trim();
    if (nextBranchId.isEmpty) {
      return;
    }

    if (_socket != null && _branchId == nextBranchId) {
      return;
    }

    disconnect();
    _branchId = nextBranchId;

    final realtimeUri = _buildRealtimeUri();
    final socket = io.io(
      realtimeUri,
      io.OptionBuilder()
          .setTransports(['websocket'])
          .disableAutoConnect()
          .enableReconnection()
          .setReconnectionAttempts(999999)
          .setReconnectionDelay(1000)
          .build(),
    );

    socket.onConnect((_) {
      debugPrint('Realtime connected for $nextBranchId');
    });
    socket.onDisconnect((_) {
      debugPrint('Realtime disconnected for $nextBranchId');
    });
    socket.onError((error) {
      debugPrint('Realtime error: $error');
    });
    socket.onConnectError((error) {
      debugPrint('Realtime connect error: $error');
    });
    socket.on('catalog.refresh', (payload) {
      final branch = _readString(payload, 'branchId');
      if (branch == null || branch != _branchId || _catalogRefreshEvents.isClosed) {
        return;
      }

      final refreshedAtRaw = _readString(payload, 'refreshedAt');
      _catalogRefreshEvents.add(
        CatalogRefreshEvent(
          branchId: branch,
          refreshedAt:
              DateTime.tryParse(refreshedAtRaw ?? '') ?? DateTime.now(),
        ),
      );
    });

    socket.connect();
    _socket = socket;
  }

  void disconnect() {
    final socket = _socket;
    _socket = null;
    _branchId = null;
    socket?.dispose();
    socket?.disconnect();
  }

  void dispose() {
    disconnect();
    if (!_catalogRefreshEvents.isClosed) {
      unawaited(_catalogRefreshEvents.close());
    }
  }

  String _buildRealtimeUri() {
    final apiUri = Uri.parse(apiBaseUrl);
    final pathSegments = List<String>.from(apiUri.pathSegments);
    if (pathSegments.isNotEmpty && pathSegments.last == 'api') {
      pathSegments.removeLast();
    }

    return apiUri
        .replace(
          pathSegments: [...pathSegments, 'realtime'],
          query: null,
          fragment: null,
        )
        .toString();
  }

  String? _readString(dynamic payload, String key) {
    if (payload is Map) {
      final value = payload[key];
      if (value != null) {
        return value.toString();
      }
    }
    return null;
  }
}
