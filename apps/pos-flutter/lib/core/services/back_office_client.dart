import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:flutter/foundation.dart';

import '../models/payment_settings.dart';

const String _configuredApiUrl = String.fromEnvironment(
  'API_URL',
  defaultValue: '',
);
const String _configuredAndroidLanApiUrl = String.fromEnvironment(
  'ANDROID_LAN_API_URL',
  defaultValue: '',
);
const int _requestTimeoutSeconds = int.fromEnvironment(
  'BACK_OFFICE_TIMEOUT_SECONDS',
  defaultValue: 5,
);
const bool _allowInsecureHttp = bool.fromEnvironment(
  'ALLOW_INSECURE_HTTP',
  defaultValue: false,
);
const String _desktopApiUrl = 'http://localhost:3000/api';

String _normalizeApiBaseUrl(String value) {
  final trimmed = value.trim();
  if (trimmed.isEmpty) {
    return trimmed;
  }
  final normalized = trimmed.replaceFirst(RegExp(r'/+$'), '');
  final uri = Uri.tryParse(normalized);
  if (uri == null || !uri.hasScheme || uri.host.isEmpty) {
    throw StateError('API_URL must be a complete http or https URL.');
  }
  final isLoopback =
      uri.host == 'localhost' || uri.host == '127.0.0.1' || uri.host == '::1';
  if (uri.scheme != 'https' && !(isLoopback || _allowInsecureHttp)) {
    throw StateError(
      'Remote POS API connections require HTTPS. For isolated development only, set ALLOW_INSECURE_HTTP=true.',
    );
  }
  return normalized;
}

Duration get _requestTimeout =>
    Duration(seconds: _requestTimeoutSeconds.clamp(3, 30));

String get apiBaseUrl {
  final configured = _normalizeApiBaseUrl(_configuredApiUrl);
  if (configured.isNotEmpty) {
    return configured;
  }

  if (defaultTargetPlatform == TargetPlatform.android) {
    final androidLanApiUrl = _normalizeApiBaseUrl(_configuredAndroidLanApiUrl);
    if (androidLanApiUrl.isNotEmpty) {
      return androidLanApiUrl;
    }
    throw StateError(
      'Android requires API_URL or ANDROID_LAN_API_URL. Use HTTPS outside isolated development.',
    );
  }

  return _desktopApiUrl;
}

String get apiBaseUrlLabel => apiBaseUrl;

String birInvoiceLabelFromNumber(int? number) {
  final safeNumber = number ?? 0;
  if (safeNumber <= 0) {
    return 'SALES INVOICE';
  }
  return 'SI ${safeNumber.toString().padLeft(6, '0')}';
}

String birNormalizeInvoiceLabel(String? rawLabel, {int? fallbackNumber}) {
  final trimmed = rawLabel?.trim() ?? '';
  if (trimmed.isEmpty) {
    if ((fallbackNumber ?? 0) > 0) {
      return birInvoiceLabelFromNumber(fallbackNumber);
    }
    return 'SALES INVOICE';
  }

  final upper = trimmed.toUpperCase();
  if (upper.startsWith('PROVISIONAL OR')) {
    return 'PROVISIONAL SALES INVOICE - pending server sequence';
  }
  if (upper.startsWith('PROVISIONAL SALES INVOICE')) {
    return trimmed;
  }

  final numberMatch = RegExp(r'(\d+)').firstMatch(trimmed);
  final parsedNumber = int.tryParse(numberMatch?.group(1) ?? '');
  if (parsedNumber != null && parsedNumber > 0) {
    return birInvoiceLabelFromNumber(parsedNumber);
  }

  if (upper.startsWith('OFFICIAL RECEIPT')) {
    return trimmed.replaceFirst(
      RegExp(r'^OFFICIAL RECEIPT', caseSensitive: false),
      'SALES INVOICE',
    );
  }
  if (upper.startsWith('OR ')) {
    return trimmed.replaceFirst(RegExp(r'^OR', caseSensitive: false), 'SI');
  }
  if (upper.startsWith('INV ')) {
    return trimmed.replaceFirst(RegExp(r'^INV', caseSensitive: false), 'SI');
  }
  if (upper.startsWith('INVOICE ')) {
    return trimmed.replaceFirst(
      RegExp(r'^INVOICE', caseSensitive: false),
      'SALES INVOICE',
    );
  }

  return trimmed;
}

class BackOfficeException implements Exception {
  const BackOfficeException(this.message, {this.statusCode, this.code});

  final String message;
  final int? statusCode;
  final String? code;

  @override
  String toString() => message;
}

class BackOfficeSession {
  const BackOfficeSession({
    required this.accessToken,
    required this.refreshToken,
    required this.sessionId,
    required this.userId,
    required this.branchId,
    required this.employeeCode,
    required this.name,
    required this.role,
    required this.permissions,
    this.pinChangeRequired = false,
    this.pinChangeReason,
    this.pinUpdatedAt,
    this.pinExpiresAt,
  });

  final String accessToken;
  final String refreshToken;
  final String sessionId;
  final String userId;
  final String branchId;
  final String employeeCode;
  final String name;
  final String role;
  final List<String> permissions;
  final bool pinChangeRequired;
  final String? pinChangeReason;
  final String? pinUpdatedAt;
  final String? pinExpiresAt;
}

class BackOfficePinChangeResult {
  const BackOfficePinChangeResult({
    required this.message,
    required this.pinChangeRequired,
    this.pinUpdatedAt,
    this.pinExpiresAt,
  });

  final String message;
  final bool pinChangeRequired;
  final String? pinUpdatedAt;
  final String? pinExpiresAt;
}

enum BackOfficeSessionEventType { expired, trialExpired }

class BackOfficeSessionEvent {
  const BackOfficeSessionEvent({required this.type, required this.message});

  final BackOfficeSessionEventType type;
  final String message;
}

class BackOfficeDeviceSession {
  const BackOfficeDeviceSession({
    required this.id,
    required this.terminalId,
    required this.terminalName,
    required this.platform,
    required this.appVersion,
    required this.createdAt,
    required this.lastSeenAt,
    required this.isCurrent,
  });

  final String id;
  final String terminalId;
  final String terminalName;
  final String platform;
  final String appVersion;
  final DateTime createdAt;
  final DateTime lastSeenAt;
  final bool isCurrent;
}

class BackOfficeSessionPresence {
  const BackOfficeSessionPresence({
    required this.currentSessionId,
    required this.sessions,
  });

  final String? currentSessionId;
  final List<BackOfficeDeviceSession> sessions;
}

class BackOfficeCatalogCategory {
  const BackOfficeCatalogCategory({
    required this.id,
    required this.name,
    required this.color,
    required this.groupName,
  });

  final String id;
  final String name;
  final String color;
  final String groupName;
}

class BackOfficeCatalogItem {
  const BackOfficeCatalogItem({
    required this.id,
    required this.branchId,
    required this.categoryId,
    required this.name,
    required this.sku,
    required this.barcode,
    required this.price,
    required this.vatType,
    required this.unit,
    required this.trackInventory,
    required this.hasVariants,
  });

  final String id;
  final String branchId;
  final String categoryId;
  final String name;
  final String sku;
  final String barcode;
  final double price;
  final String vatType;
  final String unit;
  final bool trackInventory;
  final bool hasVariants;
}

class BackOfficeCatalogSnapshot {
  const BackOfficeCatalogSnapshot({
    required this.categories,
    required this.items,
    required this.syncCursor,
  });

  final List<BackOfficeCatalogCategory> categories;
  final List<BackOfficeCatalogItem> items;
  final String? syncCursor;
}

enum BackOfficeCustomerDisplayMediaKind { image, video }

class BackOfficeCustomerDisplayAsset {
  const BackOfficeCustomerDisplayAsset({
    required this.id,
    required this.fileName,
    required this.kind,
    required this.url,
    required this.uploadedAt,
  });

  final String id;
  final String fileName;
  final BackOfficeCustomerDisplayMediaKind kind;
  final String url;
  final DateTime uploadedAt;
}

class BackOfficeCustomerDisplaySettings {
  const BackOfficeCustomerDisplaySettings({
    required this.thankYouMessage,
    required this.launchFullscreen,
    required this.imageDurationSeconds,
    required this.assets,
  });

  final String thankYouMessage;
  final bool launchFullscreen;
  final int imageDurationSeconds;
  final List<BackOfficeCustomerDisplayAsset> assets;
}

class BackOfficeBirSettings {
  const BackOfficeBirSettings({
    required this.birEnabled,
    required this.autoZRead,
    required this.storeName,
    required this.proprietorName,
    required this.vatTin,
    required this.permitNumber,
    required this.permitDateIssued,
    required this.authorityToPrintNumber,
    required this.authorityToPrintDateIssued,
    required this.approvedSerialRange,
    required this.machineIdentificationNumber,
    required this.serialNumber,
    required this.businessAddressLines,
    required this.footerLines,
  });

  final bool birEnabled;
  final bool autoZRead;
  final String storeName;
  final String proprietorName;
  final String vatTin;
  final String permitNumber;
  final String permitDateIssued;
  final String authorityToPrintNumber;
  final String authorityToPrintDateIssued;
  final String approvedSerialRange;
  final String machineIdentificationNumber;
  final String serialNumber;
  final List<String> businessAddressLines;
  final List<String> footerLines;
}

class BackOfficeSyncBatchResult {
  const BackOfficeSyncBatchResult({
    required this.acceptedIds,
    required this.rejectedIds,
    required this.nextCursor,
    required this.transactionReceipts,
  });

  final List<String> acceptedIds;
  final List<Map<String, String>> rejectedIds;
  final String? nextCursor;
  final List<BackOfficeSyncTransactionReceipt> transactionReceipts;
}

class BackOfficeSyncTransactionReceipt {
  const BackOfficeSyncTransactionReceipt({
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

class BackOfficePosTransaction {
  const BackOfficePosTransaction({
    required this.id,
    required this.branchId,
    required this.terminalId,
    required this.cashierId,
    required this.shiftId,
    required this.status,
    required this.type,
    required this.orNumber,
    required this.refNumber,
    required this.total,
    required this.subtotal,
    required this.vatAmount,
    required this.discountAmount,
    required this.changeAmount,
    required this.paymentMethod,
    required this.payments,
    required this.createdAt,
    this.terminalName,
    this.cashierName,
  });

  final String id;
  final String branchId;
  final String terminalId;
  final String cashierId;
  final String? shiftId;
  final String status;
  final String type;
  final int orNumber;
  final String refNumber;
  final double total;
  final double subtotal;
  final double vatAmount;
  final double discountAmount;
  final double changeAmount;
  final String paymentMethod;
  final List<BackOfficePosTransactionPayment> payments;
  final DateTime createdAt;
  final String? terminalName;
  final String? cashierName;
}

class BackOfficePosTransactionPayment {
  const BackOfficePosTransactionPayment({
    required this.method,
    required this.amount,
    this.reference,
    this.changeAmount = 0,
  });

  final String method;
  final double amount;
  final String? reference;
  final double changeAmount;
}

class BackOfficeClient {
  String? _accessToken;
  String? _refreshToken;
  Future<void>? _refreshInFlight;
  String? _sessionId;
  final Map<String, BackOfficeBirSettings> _birSettingsCache = {};
  final StreamController<BackOfficeSessionEvent> _events =
      StreamController<BackOfficeSessionEvent>.broadcast();

  bool get hasAccessToken => _accessToken?.isNotEmpty == true;
  bool get hasTrackedSession => _sessionId?.isNotEmpty == true;
  String? get currentSessionId => _sessionId;
  Stream<BackOfficeSessionEvent> get events => _events.stream;

  void clearSession({
    bool notifyExpired = false,
    String message =
        'Session expired or missing. Please login again while online.',
  }) {
    final hadSession =
        _accessToken?.isNotEmpty == true ||
        _refreshToken?.isNotEmpty == true ||
        _sessionId?.isNotEmpty == true;
    _accessToken = null;
    _refreshToken = null;
    _sessionId = null;
    if (notifyExpired && hadSession && !_events.isClosed) {
      _events.add(
        BackOfficeSessionEvent(
          type: BackOfficeSessionEventType.expired,
          message: message,
        ),
      );
    }
  }

  Future<BackOfficeSession> login({
    required String branchId,
    required String terminalId,
    String? terminalName,
    String? platform,
    String? appVersion,
    required String employeeCode,
    required String pin,
  }) async {
    final data = await _requestJson(
      path: '/auth/login',
      method: 'POST',
      body: {
        'branchId': branchId,
        'terminalId': terminalId,
        'terminalName': terminalName,
        'platform': platform,
        'appVersion': appVersion,
        'employeeCode': employeeCode,
        'pin': pin,
      },
    );

    final user = data['user'] as Map<String, dynamic>? ?? const {};
    final permissions = (data['permissions'] as List<dynamic>? ?? const [])
        .map((value) => value.toString())
        .toList(growable: false);
    final accessToken = data['accessToken']?.toString() ?? '';
    final refreshToken = data['refreshToken']?.toString() ?? '';
    final sessionId = data['sessionId']?.toString() ?? '';
    _accessToken = accessToken.isEmpty ? null : accessToken;
    _refreshToken = refreshToken.isEmpty ? null : refreshToken;
    _sessionId = sessionId.isEmpty ? null : sessionId;

    return BackOfficeSession(
      accessToken: accessToken,
      refreshToken: refreshToken,
      sessionId: sessionId,
      userId: user['id']?.toString() ?? employeeCode,
      branchId: user['branchId']?.toString() ?? branchId,
      employeeCode: user['employeeCode']?.toString() ?? employeeCode,
      name: user['name']?.toString() ?? employeeCode,
      role: user['role']?.toString() ?? 'CASHIER',
      permissions: permissions,
      pinChangeRequired: data['pinChangeRequired'] as bool? ?? false,
      pinChangeReason: data['pinChangeReason']?.toString(),
      pinUpdatedAt: data['pinUpdatedAt']?.toString(),
      pinExpiresAt: data['pinExpiresAt']?.toString(),
    );
  }

  Future<BackOfficePinChangeResult> changePin({
    required String currentPin,
    required String newPin,
  }) async {
    final data = await _requestJson(
      path: '/auth/change-pin',
      method: 'POST',
      body: {
        'currentPin': currentPin,
        'newPin': newPin,
      },
    );

    return BackOfficePinChangeResult(
      message: data['message']?.toString() ?? 'PIN updated successfully.',
      pinUpdatedAt: data['pinUpdatedAt']?.toString(),
      pinExpiresAt: data['pinExpiresAt']?.toString(),
      pinChangeRequired: data['pinChangeRequired'] as bool? ?? false,
    );
  }

  Future<BackOfficeSessionPresence> fetchActiveSessions() async {
    final data = await _requestJson(path: '/auth/sessions');
    final currentSessionId = data['currentSessionId']?.toString();
    final sessions = (data['sessions'] as List<dynamic>? ?? const [])
        .whereType<Map<String, dynamic>>()
        .map(
          (row) => BackOfficeDeviceSession(
            id: row['id']?.toString() ?? '',
            terminalId: row['terminalId']?.toString() ?? '',
            terminalName: row['terminalName']?.toString() ?? 'POS Device',
            platform: row['platform']?.toString() ?? 'device',
            appVersion: row['appVersion']?.toString() ?? '',
            createdAt:
                DateTime.tryParse(row['createdAt']?.toString() ?? '') ??
                DateTime.now(),
            lastSeenAt:
                DateTime.tryParse(row['lastSeenAt']?.toString() ?? '') ??
                DateTime.now(),
            isCurrent: row['isCurrent'] as bool? ?? false,
          ),
        )
        .where((session) => session.id.isNotEmpty)
        .toList(growable: false);

    return BackOfficeSessionPresence(
      currentSessionId:
          currentSessionId != null && currentSessionId.trim().isNotEmpty
          ? currentSessionId
          : _sessionId,
      sessions: sessions,
    );
  }

  Future<int> signOutOtherSessions() async {
    final data = await _requestJson(
      path: '/auth/sessions/logout-others',
      method: 'POST',
    );
    return (data['revokedCount'] as num?)?.toInt() ?? 0;
  }

  Future<void> signOutSession(String sessionId) async {
    await _requestJson(
      path: '/auth/sessions/$sessionId/revoke',
      method: 'POST',
    );
  }

  Future<BackOfficeCatalogSnapshot> fetchCatalogSnapshot({
    required String branchId,
  }) async {
    final data = await _requestJson(
      path: '/catalog/snapshot?branchId=$branchId',
    );
    final categories = (data['categories'] as List<dynamic>? ?? const [])
        .whereType<Map<String, dynamic>>()
        .map(
          (row) => BackOfficeCatalogCategory(
            id: row['id']?.toString() ?? '',
            name: row['name']?.toString() ?? 'Uncategorized',
            color: row['color']?.toString() ?? '#3B82F6',
            groupName: row['groupName']?.toString() ?? 'General',
          ),
        )
        .toList(growable: false);
    final items = (data['items'] as List<dynamic>? ?? const [])
        .whereType<Map<String, dynamic>>()
        .map(
          (row) => BackOfficeCatalogItem(
            id: row['id']?.toString() ?? '',
            branchId: row['branchId']?.toString() ?? branchId,
            categoryId: row['categoryId']?.toString() ?? '',
            name: row['name']?.toString() ?? 'Unnamed item',
            sku: row['sku']?.toString() ?? '',
            barcode: row['barcode']?.toString() ?? '',
            price: (row['price'] as num?)?.toDouble() ?? 0,
            vatType: row['vatType']?.toString() ?? 'VATABLE',
            unit: row['unit']?.toString() ?? 'unit',
            trackInventory: row['trackInventory'] as bool? ?? false,
            hasVariants: row['hasVariants'] as bool? ?? false,
          ),
        )
        .toList(growable: false);

    return BackOfficeCatalogSnapshot(
      categories: categories,
      items: items,
      syncCursor: data['syncCursor']?.toString(),
    );
  }

  Future<BackOfficeCatalogSnapshot> replaceCatalogSnapshot({
    required String branchId,
    required List<Map<String, Object?>> categories,
    required List<Map<String, Object?>> items,
    String? syncCursor,
  }) async {
    final data = await _requestJson(
      path: '/catalog/snapshot/$branchId',
      method: 'PUT',
      body: {
        'categories': categories,
        'items': items,
        if (syncCursor != null && syncCursor.trim().isNotEmpty)
          'syncCursor': syncCursor.trim(),
      },
    );

    final nextCategories = (data['categories'] as List<dynamic>? ?? const [])
        .whereType<Map<String, dynamic>>()
        .map(
          (row) => BackOfficeCatalogCategory(
            id: row['id']?.toString() ?? '',
            name: row['name']?.toString() ?? 'Uncategorized',
            color: row['color']?.toString() ?? '#3B82F6',
            groupName: row['groupName']?.toString() ?? 'General',
          ),
        )
        .toList(growable: false);
    final nextItems = (data['items'] as List<dynamic>? ?? const [])
        .whereType<Map<String, dynamic>>()
        .map(
          (row) => BackOfficeCatalogItem(
            id: row['id']?.toString() ?? '',
            branchId: row['branchId']?.toString() ?? branchId,
            categoryId: row['categoryId']?.toString() ?? '',
            name: row['name']?.toString() ?? 'Unnamed item',
            sku: row['sku']?.toString() ?? '',
            barcode: row['barcode']?.toString() ?? '',
            price: (row['price'] as num?)?.toDouble() ?? 0,
            vatType: row['vatType']?.toString() ?? 'VATABLE',
            unit: row['unit']?.toString() ?? 'unit',
            trackInventory: row['trackInventory'] as bool? ?? false,
            hasVariants: row['hasVariants'] as bool? ?? false,
          ),
        )
        .toList(growable: false);

    return BackOfficeCatalogSnapshot(
      categories: nextCategories,
      items: nextItems,
      syncCursor: data['syncCursor']?.toString(),
    );
  }

  Future<BackOfficeSyncBatchResult> submitSyncBatch({
    required String branchId,
    required String terminalId,
    required List<Map<String, Object?>> entries,
  }) async {
    final data = await _requestJson(
      path: '/sync/batch',
      method: 'POST',
      body: {
        'branchId': branchId,
        'terminalId': terminalId,
        'entries': entries,
      },
    );

    final acceptedIds = (data['acceptedIds'] as List<dynamic>? ?? const [])
        .map((value) => value.toString())
        .toList(growable: false);
    final rejectedIds = (data['rejectedIds'] as List<dynamic>? ?? const [])
        .whereType<Map<String, dynamic>>()
        .map(
          (row) => {
            'id': row['id']?.toString() ?? '',
            'reason': row['reason']?.toString() ?? 'Sync rejected.',
          },
        )
        .toList(growable: false);
    final transactionReceipts =
        (data['transactionReceipts'] as List<dynamic>? ?? const [])
            .whereType<Map<String, dynamic>>()
            .map(
              (row) => BackOfficeSyncTransactionReceipt(
                localTransactionId: row['localTransactionId']?.toString() ?? '',
                serverTransactionId:
                    row['serverTransactionId']?.toString() ?? '',
                orNumber: (row['orNumber'] as num?)?.toInt() ?? 0,
                orLabel: birNormalizeInvoiceLabel(
                  row['orLabel']?.toString(),
                  fallbackNumber: (row['orNumber'] as num?)?.toInt(),
                ),
                referenceNumber: row['referenceNumber']?.toString() ?? '',
                total: (row['total'] as num?)?.toDouble() ?? 0,
                vatAmount: (row['vatAmount'] as num?)?.toDouble() ?? 0,
                changeAmount: (row['changeAmount'] as num?)?.toDouble() ?? 0,
                paymentMethod: row['paymentMethod']?.toString() ?? 'CASH',
                createdAt:
                    DateTime.tryParse(row['createdAt']?.toString() ?? '') ??
                    DateTime.now(),
              ),
            )
            .where(
              (row) =>
                  row.localTransactionId.isNotEmpty &&
                  row.serverTransactionId.isNotEmpty,
            )
            .toList(growable: false);

    return BackOfficeSyncBatchResult(
      acceptedIds: acceptedIds,
      rejectedIds: rejectedIds,
      nextCursor: data['nextCursor']?.toString(),
      transactionReceipts: transactionReceipts,
    );
  }

  Future<BackOfficePosTransaction> createTransaction({
    required String branchId,
    required String terminalId,
    required String cashierId,
    String? shiftId,
    String? customerName,
    String? customerTin,
    String? customerAddress,
    String? customerBusinessStyle,
    String? note,
    double discountAmount = 0,
    required List<Map<String, Object?>> items,
    required List<Map<String, Object?>> payments,
  }) async {
    final data = await _requestJson(
      path: '/pos/transactions',
      method: 'POST',
      body: {
        'branchId': branchId,
        'terminalId': terminalId,
        'cashierId': cashierId,
        'shiftId': shiftId,
        'type': 'SALE',
        'customerName': customerName ?? 'Walk-in Customer',
        'customerTin': customerTin,
        'customerAddress': customerAddress,
        'customerBusinessStyle': customerBusinessStyle,
        'note': note,
        'discountAmount': discountAmount,
        'items': items,
        'payments': payments,
      },
    );

    return BackOfficePosTransaction(
      id: data['id']?.toString() ?? '',
      branchId: data['branchId']?.toString() ?? branchId,
      terminalId: data['terminalId']?.toString() ?? terminalId,
      cashierId: data['cashierId']?.toString() ?? cashierId,
      shiftId: data['shiftId']?.toString(),
      status: data['status']?.toString() ?? 'COMPLETED',
      type: data['type']?.toString() ?? 'SALE',
      orNumber: (data['orNumber'] as num?)?.toInt() ?? 0,
      refNumber: data['refNumber']?.toString() ?? '',
      total: (data['total'] as num?)?.toDouble() ?? 0,
      subtotal: (data['subtotal'] as num?)?.toDouble() ?? 0,
      vatAmount: (data['vatAmount'] as num?)?.toDouble() ?? 0,
      discountAmount: (data['discountAmount'] as num?)?.toDouble() ?? 0,
      changeAmount: (data['changeAmount'] as num?)?.toDouble() ?? 0,
      paymentMethod: data['paymentMethod']?.toString() ?? 'CASH',
      payments: _parseTransactionPayments(data['payments']),
      createdAt:
          DateTime.tryParse(data['createdAt']?.toString() ?? '') ??
          DateTime.now(),
      terminalName: data['terminalName']?.toString(),
      cashierName: data['cashierName']?.toString(),
    );
  }

  Future<List<BackOfficePosTransaction>> fetchTransactions({
    required String branchId,
    String? terminalId,
    String? cashierId,
    String? shiftId,
  }) async {
    final queryParameters = <String, String>{
      'branchId': branchId,
      if (terminalId != null && terminalId.trim().isNotEmpty)
        'terminalId': terminalId.trim(),
      if (cashierId != null && cashierId.trim().isNotEmpty)
        'cashierId': cashierId.trim(),
      if (shiftId != null && shiftId.trim().isNotEmpty)
        'shiftId': shiftId.trim(),
    };
    final query = Uri(queryParameters: queryParameters).query;
    final data = await _requestJson(
      path: '/pos/transactions${query.isEmpty ? '' : '?$query'}',
    );
    final rows = (data['items'] as List<dynamic>? ?? const [])
        .whereType<Map<String, dynamic>>();

    return rows
        .map(
          (row) => BackOfficePosTransaction(
            id: row['id']?.toString() ?? '',
            branchId: row['branchId']?.toString() ?? branchId,
            terminalId:
                row['terminalId']?.toString() ??
                terminalId ??
                'terminal-unknown',
            cashierId:
                row['cashierId']?.toString() ?? cashierId ?? 'cashier-unknown',
            shiftId: row['shiftId']?.toString(),
            status: row['status']?.toString() ?? 'COMPLETED',
            type: row['type']?.toString() ?? 'SALE',
            orNumber: (row['orNumber'] as num?)?.toInt() ?? 0,
            refNumber: row['refNumber']?.toString() ?? '',
            total: (row['total'] as num?)?.toDouble() ?? 0,
            subtotal: (row['subtotal'] as num?)?.toDouble() ?? 0,
            vatAmount: (row['vatAmount'] as num?)?.toDouble() ?? 0,
            discountAmount: (row['discountAmount'] as num?)?.toDouble() ?? 0,
            changeAmount: (row['changeAmount'] as num?)?.toDouble() ?? 0,
            paymentMethod: row['paymentMethod']?.toString() ?? 'CASH',
            payments: _parseTransactionPayments(row['payments']),
            createdAt:
                DateTime.tryParse(row['createdAt']?.toString() ?? '') ??
                DateTime.now(),
            terminalName: row['terminalName']?.toString(),
            cashierName: row['cashierName']?.toString(),
          ),
        )
        .where((transaction) => transaction.id.isNotEmpty)
        .toList(growable: false);
  }

  Future<BackOfficeCustomerDisplaySettings> fetchCustomerDisplaySettings({
    required String branchId,
  }) async {
    final data = await _requestJson(
      path: '/customer-display/settings?branchId=$branchId',
    );

    final assets = (data['assets'] as List<dynamic>? ?? const [])
        .whereType<Map<String, dynamic>>()
        .map(
          (row) => BackOfficeCustomerDisplayAsset(
            id: row['id']?.toString() ?? '',
            fileName: row['fileName']?.toString() ?? 'asset',
            kind: switch (row['kind']?.toString()) {
              'video' => BackOfficeCustomerDisplayMediaKind.video,
              _ => BackOfficeCustomerDisplayMediaKind.image,
            },
            url: row['url']?.toString() ?? '',
            uploadedAt:
                DateTime.tryParse(row['uploadedAt']?.toString() ?? '') ??
                DateTime.now(),
          ),
        )
        .where((asset) => asset.id.isNotEmpty && asset.url.isNotEmpty)
        .toList(growable: false);

    return BackOfficeCustomerDisplaySettings(
      thankYouMessage:
          data['thankYouMessage']?.toString().trim().isNotEmpty == true
          ? data['thankYouMessage']!.toString()
          : 'Thank you for your purchase',
      launchFullscreen: data['launchFullscreen'] as bool? ?? true,
      imageDurationSeconds:
          (data['imageDurationSeconds'] as num?)?.round().clamp(3, 20) ?? 7,
      assets: assets,
    );
  }

  Future<PaymentSettings> fetchPaymentSettings({
    required String branchId,
  }) async {
    final data = await _requestJson(
      path: '/payments/settings?branchId=$branchId',
    );
    return PaymentSettings.fromJson(data);
  }

  BackOfficeBirSettings? cachedBirSettings({required String branchId}) {
    final normalizedBranchId = branchId.trim();
    if (normalizedBranchId.isEmpty) {
      return null;
    }
    return _birSettingsCache[normalizedBranchId];
  }

  Future<BackOfficeBirSettings> fetchBirSettings({
    required String branchId,
  }) async {
    final normalizedBranchId = branchId.trim();
    final data = await _requestJson(
      path: '/bir/settings?branchId=$normalizedBranchId',
    );
    final settings = BackOfficeBirSettings(
      birEnabled: data['birEnabled'] as bool? ?? true,
      autoZRead: data['autoZRead'] as bool? ?? false,
      storeName: data['storeName']?.toString().trim() ?? '',
      proprietorName: data['proprietorName']?.toString().trim() ?? '',
      vatTin: data['vatTin']?.toString().trim() ?? '',
      permitNumber: data['permitNumber']?.toString().trim() ?? '',
      permitDateIssued: data['permitDateIssued']?.toString().trim() ?? '',
      authorityToPrintNumber:
          data['authorityToPrintNumber']?.toString().trim() ?? '',
      authorityToPrintDateIssued:
          data['authorityToPrintDateIssued']?.toString().trim() ?? '',
      approvedSerialRange:
          data['approvedSerialRange']?.toString().trim() ?? '',
      machineIdentificationNumber:
          data['machineIdentificationNumber']?.toString().trim() ?? '',
      serialNumber: data['serialNumber']?.toString().trim() ?? '',
      businessAddressLines: _parseStringList(data['businessAddressLines']),
      footerLines: _parseStringList(data['footerLines']),
    );
    if (normalizedBranchId.isNotEmpty) {
      _birSettingsCache[normalizedBranchId] = settings;
    }
    return settings;
  }

  List<BackOfficePosTransactionPayment> _parseTransactionPayments(Object? raw) {
    if (raw is! List) {
      return const [];
    }

    return raw
        .whereType<Map<String, dynamic>>()
        .map(
          (row) => BackOfficePosTransactionPayment(
            method: row['method']?.toString() ?? 'CASH',
            amount: (row['amount'] as num?)?.toDouble() ?? 0,
            reference: row['reference']?.toString(),
            changeAmount: (row['changeAmount'] as num?)?.toDouble() ?? 0,
          ),
        )
        .toList(growable: false);
  }

  List<String> _parseStringList(Object? raw) {
    if (raw is! List) {
      return const [];
    }

    return raw
        .map((value) => value.toString().trim())
        .where((value) => value.isNotEmpty)
        .toList(growable: false);
  }

  Future<List<int>> downloadBytes(
    String url, {
    bool allowTokenRefresh = true,
  }) async {
    final httpClient = HttpClient();

    try {
      final request = await httpClient
          .getUrl(Uri.parse(url))
          .timeout(_requestTimeout);
      request.headers.set(HttpHeaders.acceptHeader, '*/*');
      if (hasAccessToken) {
        request.headers.set(
          HttpHeaders.authorizationHeader,
          'Bearer $_accessToken',
        );
      }
      final response = await request.close().timeout(_requestTimeout);
      final bytes = await consolidateHttpClientResponseBytes(response);

      if (response.statusCode < 200 || response.statusCode >= 300) {
        if (response.statusCode == 401 &&
            allowTokenRefresh &&
            _refreshToken != null &&
            _refreshToken!.isNotEmpty) {
          await _refreshAccessToken();
          return downloadBytes(url, allowTokenRefresh: false);
        }
        throw BackOfficeException(
          'Media download failed with ${response.statusCode}.',
          statusCode: response.statusCode,
        );
      }

      return bytes;
    } on SocketException catch (error) {
      throw BackOfficeException(error.message);
    } on TimeoutException {
      throw const BackOfficeException('Back office request timed out.');
    } finally {
      httpClient.close(force: true);
    }
  }

  Future<Map<String, dynamic>> _requestJson({
    required String path,
    String method = 'GET',
    Map<String, Object?>? body,
    bool allowTokenRefresh = true,
  }) async {
    final httpClient = HttpClient();

    try {
      final uri = Uri.parse('$apiBaseUrl$path');
      final request = await httpClient
          .openUrl(method, uri)
          .timeout(_requestTimeout);
      request.headers.contentType = ContentType.json;
      request.headers.set(HttpHeaders.acceptHeader, 'application/json');
      if (hasAccessToken) {
        request.headers.set(
          HttpHeaders.authorizationHeader,
          'Bearer $_accessToken',
        );
      }

      if (body != null) {
        request.write(jsonEncode(body));
      }

      final response = await request.close().timeout(_requestTimeout);
      final responseBody = await response.transform(utf8.decoder).join();
      final payload = responseBody.isEmpty
          ? const <String, dynamic>{}
          : await compute(_decodeEnvelopePayload, responseBody);

      if (response.statusCode < 200 || response.statusCode >= 300) {
        if (response.statusCode == 401) {
          if (allowTokenRefresh &&
              _refreshToken != null &&
              _refreshToken!.isNotEmpty &&
              path != '/auth/login' &&
              path != '/auth/refresh') {
            await _refreshAccessToken();
            return _requestJson(
              path: path,
              method: method,
              body: body,
              allowTokenRefresh: false,
            );
          }
          clearSession(notifyExpired: true);
          throw const BackOfficeException(
            'Session expired or missing. Please login again while online.',
            statusCode: 401,
          );
        }
        final errorCode = _extractErrorCode(payload);
        if (errorCode == 'TRIAL_EXPIRED' && !_events.isClosed) {
          _events.add(
            BackOfficeSessionEvent(
              type: BackOfficeSessionEventType.trialExpired,
              message:
                  _extractErrorMessage(payload) ??
                  'Your 30-day trial has ended.',
            ),
          );
        }
        throw BackOfficeException(
          _extractErrorMessage(payload) ??
              'Server returned ${response.statusCode}.',
          statusCode: response.statusCode,
          code: errorCode,
        );
      }

      final data = payload['data'];
      if (data is Map<String, dynamic>) {
        return data;
      }

      throw const BackOfficeException('Unexpected API response shape.');
    } on SocketException catch (error) {
      throw BackOfficeException(error.message);
    } on TimeoutException {
      throw const BackOfficeException('Back office request timed out.');
    } finally {
      httpClient.close(force: true);
    }
  }

  Future<void> _refreshAccessToken() {
    final activeRefresh = _refreshInFlight;
    if (activeRefresh != null) {
      return activeRefresh;
    }

    final refresh = _performAccessTokenRefresh();
    _refreshInFlight = refresh;
    return refresh.whenComplete(() {
      if (identical(_refreshInFlight, refresh)) {
        _refreshInFlight = null;
      }
    });
  }

  Future<void> _performAccessTokenRefresh() async {
    final refreshToken = _refreshToken;
    if (refreshToken == null || refreshToken.isEmpty) {
      throw const BackOfficeException(
        'Session expired or missing. Please login again while online.',
        statusCode: 401,
      );
    }

    final httpClient = HttpClient();
    try {
      final uri = Uri.parse('$apiBaseUrl/auth/refresh');
      final request = await httpClient.postUrl(uri).timeout(_requestTimeout);
      request.headers.contentType = ContentType.json;
      request.headers.set(HttpHeaders.acceptHeader, 'application/json');
      request.write(
        jsonEncode(<String, Object?>{'refreshToken': refreshToken}),
      );
      final response = await request.close().timeout(_requestTimeout);
      final responseBody = await response.transform(utf8.decoder).join();
      final payload = responseBody.isEmpty
          ? const <String, dynamic>{}
          : await compute(_decodeEnvelopePayload, responseBody);

      if (response.statusCode < 200 || response.statusCode >= 300) {
        clearSession(notifyExpired: true);
        throw const BackOfficeException(
          'Session expired or missing. Please login again while online.',
          statusCode: 401,
        );
      }

      final data = payload['data'];
      if (data is! Map<String, dynamic>) {
        clearSession(notifyExpired: true);
        throw const BackOfficeException(
          'Session refresh failed due to unexpected API payload.',
          statusCode: 401,
        );
      }

      final accessToken = data['accessToken']?.toString().trim() ?? '';
      final nextRefreshToken = data['refreshToken']?.toString().trim() ?? '';
      final sessionId =
          data['sessionId']?.toString().trim() ?? _sessionId ?? '';

      if (accessToken.isEmpty || nextRefreshToken.isEmpty) {
        clearSession(notifyExpired: true);
        throw const BackOfficeException(
          'Session refresh failed due to incomplete token payload.',
          statusCode: 401,
        );
      }

      _accessToken = accessToken;
      _refreshToken = nextRefreshToken;
      _sessionId = sessionId.isEmpty ? null : sessionId;
    } on SocketException catch (error) {
      throw BackOfficeException(error.message);
    } on TimeoutException {
      throw const BackOfficeException('Back office request timed out.');
    } finally {
      httpClient.close(force: true);
    }
  }

  String? _extractErrorMessage(Map<String, dynamic> payload) {
    final message = payload['message'];
    if (message is String && message.trim().isNotEmpty) {
      return message;
    }

    final error = payload['error'];
    if (error is String && error.trim().isNotEmpty) {
      return error;
    }

    return null;
  }

  String? _extractErrorCode(Map<String, dynamic> payload) {
    final code = payload['code'];
    if (code is String && code.trim().isNotEmpty) {
      return code;
    }
    return null;
  }
}

Map<String, dynamic> _decodeEnvelopePayload(String body) {
  final decoded = jsonDecode(body);
  if (decoded is Map<String, dynamic>) {
    return decoded;
  }
  throw const FormatException('Unexpected API response payload.');
}
