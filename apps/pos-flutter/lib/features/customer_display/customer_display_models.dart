import 'dart:io';

enum CustomerDisplayMode {
  idle,
  cart,
  thankYou,
}

enum CustomerDisplayMediaKind {
  image,
  video,
}

const Set<String> _imageExtensions = {
  '.jpg',
  '.jpeg',
  '.png',
  '.gif',
  '.bmp',
  '.webp',
};

const Set<String> _videoExtensions = {
  '.mp4',
  '.mov',
  '.m4v',
  '.avi',
  '.wmv',
  '.mkv',
  '.webm',
};

CustomerDisplayMediaKind? customerDisplayMediaKindForPath(String path) {
  final extension = _extensionOf(path);
  if (_imageExtensions.contains(extension)) {
    return CustomerDisplayMediaKind.image;
  }
  if (_videoExtensions.contains(extension)) {
    return CustomerDisplayMediaKind.video;
  }
  return null;
}

String customerDisplayFileName(String path) {
  return path.split(Platform.pathSeparator).last;
}

class CustomerDisplayMediaAsset {
  const CustomerDisplayMediaAsset({
    required this.id,
    required this.path,
    required this.kind,
    this.sourceUrl,
    this.label,
  });

  final String id;
  final String path;
  final CustomerDisplayMediaKind kind;
  final String? sourceUrl;
  final String? label;

  String get fileName {
    final customLabel = label?.trim();
    if (customLabel != null && customLabel.isNotEmpty) {
      return customLabel;
    }
    return customerDisplayFileName(path);
  }

  static CustomerDisplayMediaAsset? fromPath(String path) {
    final kind = customerDisplayMediaKindForPath(path);
    if (kind == null) {
      return null;
    }

    return CustomerDisplayMediaAsset(
      id: '${DateTime.now().microsecondsSinceEpoch}-${path.hashCode}',
      path: path,
      kind: kind,
    );
  }

  factory CustomerDisplayMediaAsset.fromJson(Map<String, dynamic> json) {
    return CustomerDisplayMediaAsset(
      id: json['id']?.toString() ?? '',
      path: json['path']?.toString() ?? '',
      kind: switch (json['kind']?.toString()) {
        'video' => CustomerDisplayMediaKind.video,
        _ => CustomerDisplayMediaKind.image,
      },
      sourceUrl: json['sourceUrl']?.toString(),
      label: json['label']?.toString(),
    );
  }

  Map<String, Object?> toJson() {
    return {
      'id': id,
      'path': path,
      'kind': kind.name,
      'sourceUrl': sourceUrl,
      'label': label,
    };
  }
}

class CustomerDisplaySettings {
  const CustomerDisplaySettings({
    required this.assets,
    required this.thankYouMessage,
    required this.launchFullscreen,
    required this.imageDurationSeconds,
  });

  final List<CustomerDisplayMediaAsset> assets;
  final String thankYouMessage;
  final bool launchFullscreen;
  final int imageDurationSeconds;

  factory CustomerDisplaySettings.defaults() {
    return const CustomerDisplaySettings(
      assets: <CustomerDisplayMediaAsset>[],
      thankYouMessage: 'Thank you for your purchase',
      launchFullscreen: true,
      imageDurationSeconds: 7,
    );
  }

  factory CustomerDisplaySettings.fromJson(Map<String, dynamic> json) {
    return CustomerDisplaySettings(
      assets: (json['assets'] as List<dynamic>? ?? const <dynamic>[])
          .whereType<Map<String, dynamic>>()
          .map(CustomerDisplayMediaAsset.fromJson)
          .toList(growable: false),
      thankYouMessage: json['thankYouMessage']?.toString().trim().isNotEmpty ==
              true
          ? json['thankYouMessage']!.toString()
          : CustomerDisplaySettings.defaults().thankYouMessage,
      launchFullscreen: json['launchFullscreen'] as bool? ?? true,
      imageDurationSeconds:
          (json['imageDurationSeconds'] as num?)?.round().clamp(3, 20) ?? 7,
    );
  }

  CustomerDisplaySettings copyWith({
    List<CustomerDisplayMediaAsset>? assets,
    String? thankYouMessage,
    bool? launchFullscreen,
    int? imageDurationSeconds,
  }) {
    return CustomerDisplaySettings(
      assets: assets ?? this.assets,
      thankYouMessage: thankYouMessage ?? this.thankYouMessage,
      launchFullscreen: launchFullscreen ?? this.launchFullscreen,
      imageDurationSeconds: imageDurationSeconds ?? this.imageDurationSeconds,
    );
  }

  Map<String, Object?> toJson() {
    return {
      'assets': assets.map((asset) => asset.toJson()).toList(growable: false),
      'thankYouMessage': thankYouMessage,
      'launchFullscreen': launchFullscreen,
      'imageDurationSeconds': imageDurationSeconds,
    };
  }
}

class CustomerDisplayCartLine {
  const CustomerDisplayCartLine({
    required this.name,
    required this.quantity,
    required this.lineTotalMinor,
  });

  final String name;
  final int quantity;
  final int lineTotalMinor;

  factory CustomerDisplayCartLine.fromJson(Map<String, dynamic> json) {
    return CustomerDisplayCartLine(
      name: json['name']?.toString() ?? '',
      quantity: (json['quantity'] as num?)?.round() ?? 0,
      lineTotalMinor: (json['lineTotalMinor'] as num?)?.round() ?? 0,
    );
  }

  Map<String, Object?> toJson() {
    return {
      'name': name,
      'quantity': quantity,
      'lineTotalMinor': lineTotalMinor,
    };
  }
}

class CustomerDisplayReceipt {
  const CustomerDisplayReceipt({
    required this.referenceNumber,
    required this.orLabel,
    required this.totalMinor,
    required this.vatMinor,
    required this.changeMinor,
    required this.paymentMethod,
    required this.createdAt,
  });

  final String referenceNumber;
  final String orLabel;
  final int totalMinor;
  final int vatMinor;
  final int changeMinor;
  final String paymentMethod;
  final DateTime createdAt;

  factory CustomerDisplayReceipt.fromJson(Map<String, dynamic> json) {
    return CustomerDisplayReceipt(
      referenceNumber: json['referenceNumber']?.toString() ?? '',
      orLabel: json['orLabel']?.toString() ?? '',
      totalMinor: (json['totalMinor'] as num?)?.round() ?? 0,
      vatMinor: (json['vatMinor'] as num?)?.round() ?? 0,
      changeMinor: (json['changeMinor'] as num?)?.round() ?? 0,
      paymentMethod: json['paymentMethod']?.toString() ?? '',
      createdAt: DateTime.tryParse(json['createdAt']?.toString() ?? '') ??
          DateTime.now(),
    );
  }

  Map<String, Object?> toJson() {
    return {
      'referenceNumber': referenceNumber,
      'orLabel': orLabel,
      'totalMinor': totalMinor,
      'vatMinor': vatMinor,
      'changeMinor': changeMinor,
      'paymentMethod': paymentMethod,
      'createdAt': createdAt.toUtc().toIso8601String(),
    };
  }
}

class CustomerDisplayState {
  const CustomerDisplayState({
    required this.mode,
    required this.branchId,
    required this.branchName,
    required this.cashierName,
    required this.itemCount,
    required this.subtotalMinor,
    required this.vatMinor,
    required this.totalMinor,
    required this.lines,
    required this.lastReceipt,
    required this.updatedAt,
  });

  final CustomerDisplayMode mode;
  final String? branchId;
  final String? branchName;
  final String? cashierName;
  final int itemCount;
  final int subtotalMinor;
  final int vatMinor;
  final int totalMinor;
  final List<CustomerDisplayCartLine> lines;
  final CustomerDisplayReceipt? lastReceipt;
  final DateTime updatedAt;

  factory CustomerDisplayState.idle() {
    return CustomerDisplayState(
      mode: CustomerDisplayMode.idle,
      branchId: null,
      branchName: null,
      cashierName: null,
      itemCount: 0,
      subtotalMinor: 0,
      vatMinor: 0,
      totalMinor: 0,
      lines: const <CustomerDisplayCartLine>[],
      lastReceipt: null,
      updatedAt: DateTime.now(),
    );
  }

  factory CustomerDisplayState.fromJson(Map<String, dynamic> json) {
    return CustomerDisplayState(
      mode: switch (json['mode']?.toString()) {
        'cart' => CustomerDisplayMode.cart,
        'thankYou' => CustomerDisplayMode.thankYou,
        _ => CustomerDisplayMode.idle,
      },
      branchId: json['branchId']?.toString(),
      branchName: json['branchName']?.toString(),
      cashierName: json['cashierName']?.toString(),
      itemCount: (json['itemCount'] as num?)?.round() ?? 0,
      subtotalMinor: (json['subtotalMinor'] as num?)?.round() ?? 0,
      vatMinor: (json['vatMinor'] as num?)?.round() ?? 0,
      totalMinor: (json['totalMinor'] as num?)?.round() ?? 0,
      lines: (json['lines'] as List<dynamic>? ?? const <dynamic>[])
          .whereType<Map<String, dynamic>>()
          .map(CustomerDisplayCartLine.fromJson)
          .toList(growable: false),
      lastReceipt: json['lastReceipt'] is Map<String, dynamic>
          ? CustomerDisplayReceipt.fromJson(
              json['lastReceipt'] as Map<String, dynamic>,
            )
          : null,
      updatedAt: DateTime.tryParse(json['updatedAt']?.toString() ?? '') ??
          DateTime.now(),
    );
  }

  Map<String, Object?> toJson() {
    return {
      'mode': mode.name,
      'branchId': branchId,
      'branchName': branchName,
      'cashierName': cashierName,
      'itemCount': itemCount,
      'subtotalMinor': subtotalMinor,
      'vatMinor': vatMinor,
      'totalMinor': totalMinor,
      'lines': lines.map((line) => line.toJson()).toList(growable: false),
      'lastReceipt': lastReceipt?.toJson(),
      'updatedAt': updatedAt.toUtc().toIso8601String(),
    };
  }
}

String _extensionOf(String path) {
  final normalized = path.trim().toLowerCase();
  final dotIndex = normalized.lastIndexOf('.');
  if (dotIndex == -1) {
    return '';
  }
  return normalized.substring(dotIndex);
}
