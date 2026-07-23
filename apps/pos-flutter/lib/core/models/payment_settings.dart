const List<String> supportedPaymentMethodCodes = <String>[
  'CASH',
  'CARD',
  'GCASH',
  'MAYA',
  'SPLIT',
];

class PaymentMethodSettings {
  const PaymentMethodSettings({
    required this.code,
    required this.label,
    required this.enabled,
    required this.supportsSplit,
    required this.requiresReference,
  });

  final String code;
  final String label;
  final bool enabled;
  final bool supportsSplit;
  final bool requiresReference;

  factory PaymentMethodSettings.fromJson(Map<String, dynamic> json) {
    final code = json['code']?.toString().toUpperCase() ?? 'CASH';
    return PaymentMethodSettings(
      code: supportedPaymentMethodCodes.contains(code) ? code : 'CASH',
      label: json['label']?.toString().trim().isNotEmpty == true
          ? json['label']!.toString()
          : _defaultLabelForCode(code),
      enabled: json['enabled'] as bool? ?? true,
      supportsSplit: json['supportsSplit'] as bool? ?? false,
      requiresReference: json['requiresReference'] as bool? ?? false,
    );
  }

  Map<String, Object?> toJson() {
    return {
      'code': code,
      'label': label,
      'enabled': enabled,
      'supportsSplit': supportsSplit,
      'requiresReference': requiresReference,
    };
  }

  static String _defaultLabelForCode(String code) {
    return switch (code.toUpperCase()) {
      'CARD' => 'Card',
      'GCASH' => 'GCash',
      'MAYA' => 'Maya',
      'SPLIT' => 'Split',
      _ => 'Cash',
    };
  }
}

class PaymentSettings {
  const PaymentSettings({
    required this.branchId,
    required this.defaultMethod,
    required this.updatedAt,
    required this.methods,
  });

  final String branchId;
  final String defaultMethod;
  final DateTime updatedAt;
  final List<PaymentMethodSettings> methods;

  factory PaymentSettings.defaults({String branchId = 'branch-manila'}) {
    return PaymentSettings(
      branchId: branchId,
      defaultMethod: 'CASH',
      updatedAt: DateTime.now(),
      methods: const [
        PaymentMethodSettings(
          code: 'CASH',
          label: 'Cash',
          enabled: true,
          supportsSplit: true,
          requiresReference: false,
        ),
        PaymentMethodSettings(
          code: 'CARD',
          label: 'Card',
          enabled: true,
          supportsSplit: true,
          requiresReference: true,
        ),
        PaymentMethodSettings(
          code: 'GCASH',
          label: 'GCash',
          enabled: true,
          supportsSplit: true,
          requiresReference: true,
        ),
        PaymentMethodSettings(
          code: 'MAYA',
          label: 'Maya',
          enabled: true,
          supportsSplit: true,
          requiresReference: true,
        ),
        PaymentMethodSettings(
          code: 'SPLIT',
          label: 'Split',
          enabled: true,
          supportsSplit: false,
          requiresReference: false,
        ),
      ],
    );
  }

  factory PaymentSettings.fromJson(Map<String, dynamic> json) {
    final branchId = json['branchId']?.toString() ?? 'branch-manila';
    final rows = (json['methods'] as List<dynamic>? ?? const [])
        .whereType<Map<String, dynamic>>()
        .map(PaymentMethodSettings.fromJson)
        .toList(growable: false);
    final methods = _normalizeMethods(rows);
    final sanitizedMethods = methods.any((method) => method.enabled)
        ? methods
        : PaymentSettings.defaults(branchId: branchId).methods;
    final defaultMethod = json['defaultMethod']?.toString().toUpperCase() ?? '';
    final effectiveDefault =
        sanitizedMethods.any(
          (method) => method.code == defaultMethod && method.enabled,
        )
        ? defaultMethod
        : sanitizedMethods.firstWhere((method) => method.enabled).code;

    return PaymentSettings(
      branchId: branchId,
      defaultMethod: effectiveDefault,
      updatedAt:
          DateTime.tryParse(json['updatedAt']?.toString() ?? '') ??
          DateTime.now(),
      methods: sanitizedMethods,
    );
  }

  Map<String, Object?> toJson() {
    return {
      'branchId': branchId,
      'defaultMethod': defaultMethod,
      'updatedAt': updatedAt.toUtc().toIso8601String(),
      'methods': methods
          .map((method) => method.toJson())
          .toList(growable: false),
    };
  }

  List<PaymentMethodSettings> get enabledMethods {
    final enabled = methods
        .where((method) => method.enabled)
        .toList(growable: false);
    return enabled.isEmpty
        ? PaymentSettings.defaults(branchId: branchId).enabledMethods
        : enabled;
  }

  String resolveSelectedMethod(String? selectedMethod) {
    final normalized = selectedMethod?.trim().toUpperCase();
    if (normalized != null &&
        enabledMethods.any((method) => method.code == normalized)) {
      return normalized;
    }

    final normalizedDefault = defaultMethod.trim().toUpperCase();
    if (enabledMethods.any((method) => method.code == normalizedDefault)) {
      return normalizedDefault;
    }

    return enabledMethods.first.code;
  }

  static List<PaymentMethodSettings> _normalizeMethods(
    List<PaymentMethodSettings> rows,
  ) {
    final byCode = <String, PaymentMethodSettings>{
      for (final method in rows)
        if (supportedPaymentMethodCodes.contains(method.code))
          method.code: method,
    };
    final defaults = PaymentSettings.defaults().methods;

    return supportedPaymentMethodCodes
        .map((code) {
          return byCode[code] ??
              defaults.firstWhere((method) => method.code == code);
        })
        .toList(growable: false);
  }
}
