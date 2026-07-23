// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'app_database.dart';

// ignore_for_file: type=lint
class $CatalogCacheItemsTable extends CatalogCacheItems
    with TableInfo<$CatalogCacheItemsTable, CatalogCacheItem> {
  @override
  final GeneratedDatabase attachedDatabase;
  final String? _alias;
  $CatalogCacheItemsTable(this.attachedDatabase, [this._alias]);
  static const VerificationMeta _idMeta = const VerificationMeta('id');
  @override
  late final GeneratedColumn<String> id = GeneratedColumn<String>(
    'id',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _branchIdMeta = const VerificationMeta(
    'branchId',
  );
  @override
  late final GeneratedColumn<String> branchId = GeneratedColumn<String>(
    'branch_id',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _categoryNameMeta = const VerificationMeta(
    'categoryName',
  );
  @override
  late final GeneratedColumn<String> categoryName = GeneratedColumn<String>(
    'category_name',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _nameMeta = const VerificationMeta('name');
  @override
  late final GeneratedColumn<String> name = GeneratedColumn<String>(
    'name',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _skuMeta = const VerificationMeta('sku');
  @override
  late final GeneratedColumn<String> sku = GeneratedColumn<String>(
    'sku',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _barcodeMeta = const VerificationMeta(
    'barcode',
  );
  @override
  late final GeneratedColumn<String> barcode = GeneratedColumn<String>(
    'barcode',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _priceMinorMeta = const VerificationMeta(
    'priceMinor',
  );
  @override
  late final GeneratedColumn<int> priceMinor = GeneratedColumn<int>(
    'price_minor',
    aliasedName,
    false,
    type: DriftSqlType.int,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _vatTypeMeta = const VerificationMeta(
    'vatType',
  );
  @override
  late final GeneratedColumn<String> vatType = GeneratedColumn<String>(
    'vat_type',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _unitMeta = const VerificationMeta('unit');
  @override
  late final GeneratedColumn<String> unit = GeneratedColumn<String>(
    'unit',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _hasVariantsMeta = const VerificationMeta(
    'hasVariants',
  );
  @override
  late final GeneratedColumn<bool> hasVariants = GeneratedColumn<bool>(
    'has_variants',
    aliasedName,
    false,
    type: DriftSqlType.bool,
    requiredDuringInsert: false,
    defaultConstraints: GeneratedColumn.constraintIsAlways(
      'CHECK ("has_variants" IN (0, 1))',
    ),
    defaultValue: const Constant(false),
  );
  static const VerificationMeta _updatedAtMeta = const VerificationMeta(
    'updatedAt',
  );
  @override
  late final GeneratedColumn<DateTime> updatedAt = GeneratedColumn<DateTime>(
    'updated_at',
    aliasedName,
    false,
    type: DriftSqlType.dateTime,
    requiredDuringInsert: false,
    defaultValue: currentDateAndTime,
  );
  @override
  List<GeneratedColumn> get $columns => [
    id,
    branchId,
    categoryName,
    name,
    sku,
    barcode,
    priceMinor,
    vatType,
    unit,
    hasVariants,
    updatedAt,
  ];
  @override
  String get aliasedName => _alias ?? actualTableName;
  @override
  String get actualTableName => $name;
  static const String $name = 'catalog_cache_items';
  @override
  VerificationContext validateIntegrity(
    Insertable<CatalogCacheItem> instance, {
    bool isInserting = false,
  }) {
    final context = VerificationContext();
    final data = instance.toColumns(true);
    if (data.containsKey('id')) {
      context.handle(_idMeta, id.isAcceptableOrUnknown(data['id']!, _idMeta));
    } else if (isInserting) {
      context.missing(_idMeta);
    }
    if (data.containsKey('branch_id')) {
      context.handle(
        _branchIdMeta,
        branchId.isAcceptableOrUnknown(data['branch_id']!, _branchIdMeta),
      );
    } else if (isInserting) {
      context.missing(_branchIdMeta);
    }
    if (data.containsKey('category_name')) {
      context.handle(
        _categoryNameMeta,
        categoryName.isAcceptableOrUnknown(
          data['category_name']!,
          _categoryNameMeta,
        ),
      );
    } else if (isInserting) {
      context.missing(_categoryNameMeta);
    }
    if (data.containsKey('name')) {
      context.handle(
        _nameMeta,
        name.isAcceptableOrUnknown(data['name']!, _nameMeta),
      );
    } else if (isInserting) {
      context.missing(_nameMeta);
    }
    if (data.containsKey('sku')) {
      context.handle(
        _skuMeta,
        sku.isAcceptableOrUnknown(data['sku']!, _skuMeta),
      );
    } else if (isInserting) {
      context.missing(_skuMeta);
    }
    if (data.containsKey('barcode')) {
      context.handle(
        _barcodeMeta,
        barcode.isAcceptableOrUnknown(data['barcode']!, _barcodeMeta),
      );
    }
    if (data.containsKey('price_minor')) {
      context.handle(
        _priceMinorMeta,
        priceMinor.isAcceptableOrUnknown(data['price_minor']!, _priceMinorMeta),
      );
    } else if (isInserting) {
      context.missing(_priceMinorMeta);
    }
    if (data.containsKey('vat_type')) {
      context.handle(
        _vatTypeMeta,
        vatType.isAcceptableOrUnknown(data['vat_type']!, _vatTypeMeta),
      );
    } else if (isInserting) {
      context.missing(_vatTypeMeta);
    }
    if (data.containsKey('unit')) {
      context.handle(
        _unitMeta,
        unit.isAcceptableOrUnknown(data['unit']!, _unitMeta),
      );
    } else if (isInserting) {
      context.missing(_unitMeta);
    }
    if (data.containsKey('has_variants')) {
      context.handle(
        _hasVariantsMeta,
        hasVariants.isAcceptableOrUnknown(
          data['has_variants']!,
          _hasVariantsMeta,
        ),
      );
    }
    if (data.containsKey('updated_at')) {
      context.handle(
        _updatedAtMeta,
        updatedAt.isAcceptableOrUnknown(data['updated_at']!, _updatedAtMeta),
      );
    }
    return context;
  }

  @override
  Set<GeneratedColumn> get $primaryKey => {id};
  @override
  CatalogCacheItem map(Map<String, dynamic> data, {String? tablePrefix}) {
    final effectivePrefix = tablePrefix != null ? '$tablePrefix.' : '';
    return CatalogCacheItem(
      id: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}id'],
      )!,
      branchId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}branch_id'],
      )!,
      categoryName: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}category_name'],
      )!,
      name: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}name'],
      )!,
      sku: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}sku'],
      )!,
      barcode: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}barcode'],
      ),
      priceMinor: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}price_minor'],
      )!,
      vatType: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}vat_type'],
      )!,
      unit: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}unit'],
      )!,
      hasVariants: attachedDatabase.typeMapping.read(
        DriftSqlType.bool,
        data['${effectivePrefix}has_variants'],
      )!,
      updatedAt: attachedDatabase.typeMapping.read(
        DriftSqlType.dateTime,
        data['${effectivePrefix}updated_at'],
      )!,
    );
  }

  @override
  $CatalogCacheItemsTable createAlias(String alias) {
    return $CatalogCacheItemsTable(attachedDatabase, alias);
  }
}

class CatalogCacheItem extends DataClass
    implements Insertable<CatalogCacheItem> {
  final String id;
  final String branchId;
  final String categoryName;
  final String name;
  final String sku;
  final String? barcode;
  final int priceMinor;
  final String vatType;
  final String unit;
  final bool hasVariants;
  final DateTime updatedAt;
  const CatalogCacheItem({
    required this.id,
    required this.branchId,
    required this.categoryName,
    required this.name,
    required this.sku,
    this.barcode,
    required this.priceMinor,
    required this.vatType,
    required this.unit,
    required this.hasVariants,
    required this.updatedAt,
  });
  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    map['id'] = Variable<String>(id);
    map['branch_id'] = Variable<String>(branchId);
    map['category_name'] = Variable<String>(categoryName);
    map['name'] = Variable<String>(name);
    map['sku'] = Variable<String>(sku);
    if (!nullToAbsent || barcode != null) {
      map['barcode'] = Variable<String>(barcode);
    }
    map['price_minor'] = Variable<int>(priceMinor);
    map['vat_type'] = Variable<String>(vatType);
    map['unit'] = Variable<String>(unit);
    map['has_variants'] = Variable<bool>(hasVariants);
    map['updated_at'] = Variable<DateTime>(updatedAt);
    return map;
  }

  CatalogCacheItemsCompanion toCompanion(bool nullToAbsent) {
    return CatalogCacheItemsCompanion(
      id: Value(id),
      branchId: Value(branchId),
      categoryName: Value(categoryName),
      name: Value(name),
      sku: Value(sku),
      barcode: barcode == null && nullToAbsent
          ? const Value.absent()
          : Value(barcode),
      priceMinor: Value(priceMinor),
      vatType: Value(vatType),
      unit: Value(unit),
      hasVariants: Value(hasVariants),
      updatedAt: Value(updatedAt),
    );
  }

  factory CatalogCacheItem.fromJson(
    Map<String, dynamic> json, {
    ValueSerializer? serializer,
  }) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return CatalogCacheItem(
      id: serializer.fromJson<String>(json['id']),
      branchId: serializer.fromJson<String>(json['branchId']),
      categoryName: serializer.fromJson<String>(json['categoryName']),
      name: serializer.fromJson<String>(json['name']),
      sku: serializer.fromJson<String>(json['sku']),
      barcode: serializer.fromJson<String?>(json['barcode']),
      priceMinor: serializer.fromJson<int>(json['priceMinor']),
      vatType: serializer.fromJson<String>(json['vatType']),
      unit: serializer.fromJson<String>(json['unit']),
      hasVariants: serializer.fromJson<bool>(json['hasVariants']),
      updatedAt: serializer.fromJson<DateTime>(json['updatedAt']),
    );
  }
  @override
  Map<String, dynamic> toJson({ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return <String, dynamic>{
      'id': serializer.toJson<String>(id),
      'branchId': serializer.toJson<String>(branchId),
      'categoryName': serializer.toJson<String>(categoryName),
      'name': serializer.toJson<String>(name),
      'sku': serializer.toJson<String>(sku),
      'barcode': serializer.toJson<String?>(barcode),
      'priceMinor': serializer.toJson<int>(priceMinor),
      'vatType': serializer.toJson<String>(vatType),
      'unit': serializer.toJson<String>(unit),
      'hasVariants': serializer.toJson<bool>(hasVariants),
      'updatedAt': serializer.toJson<DateTime>(updatedAt),
    };
  }

  CatalogCacheItem copyWith({
    String? id,
    String? branchId,
    String? categoryName,
    String? name,
    String? sku,
    Value<String?> barcode = const Value.absent(),
    int? priceMinor,
    String? vatType,
    String? unit,
    bool? hasVariants,
    DateTime? updatedAt,
  }) => CatalogCacheItem(
    id: id ?? this.id,
    branchId: branchId ?? this.branchId,
    categoryName: categoryName ?? this.categoryName,
    name: name ?? this.name,
    sku: sku ?? this.sku,
    barcode: barcode.present ? barcode.value : this.barcode,
    priceMinor: priceMinor ?? this.priceMinor,
    vatType: vatType ?? this.vatType,
    unit: unit ?? this.unit,
    hasVariants: hasVariants ?? this.hasVariants,
    updatedAt: updatedAt ?? this.updatedAt,
  );
  CatalogCacheItem copyWithCompanion(CatalogCacheItemsCompanion data) {
    return CatalogCacheItem(
      id: data.id.present ? data.id.value : this.id,
      branchId: data.branchId.present ? data.branchId.value : this.branchId,
      categoryName: data.categoryName.present
          ? data.categoryName.value
          : this.categoryName,
      name: data.name.present ? data.name.value : this.name,
      sku: data.sku.present ? data.sku.value : this.sku,
      barcode: data.barcode.present ? data.barcode.value : this.barcode,
      priceMinor: data.priceMinor.present
          ? data.priceMinor.value
          : this.priceMinor,
      vatType: data.vatType.present ? data.vatType.value : this.vatType,
      unit: data.unit.present ? data.unit.value : this.unit,
      hasVariants: data.hasVariants.present
          ? data.hasVariants.value
          : this.hasVariants,
      updatedAt: data.updatedAt.present ? data.updatedAt.value : this.updatedAt,
    );
  }

  @override
  String toString() {
    return (StringBuffer('CatalogCacheItem(')
          ..write('id: $id, ')
          ..write('branchId: $branchId, ')
          ..write('categoryName: $categoryName, ')
          ..write('name: $name, ')
          ..write('sku: $sku, ')
          ..write('barcode: $barcode, ')
          ..write('priceMinor: $priceMinor, ')
          ..write('vatType: $vatType, ')
          ..write('unit: $unit, ')
          ..write('hasVariants: $hasVariants, ')
          ..write('updatedAt: $updatedAt')
          ..write(')'))
        .toString();
  }

  @override
  int get hashCode => Object.hash(
    id,
    branchId,
    categoryName,
    name,
    sku,
    barcode,
    priceMinor,
    vatType,
    unit,
    hasVariants,
    updatedAt,
  );
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is CatalogCacheItem &&
          other.id == this.id &&
          other.branchId == this.branchId &&
          other.categoryName == this.categoryName &&
          other.name == this.name &&
          other.sku == this.sku &&
          other.barcode == this.barcode &&
          other.priceMinor == this.priceMinor &&
          other.vatType == this.vatType &&
          other.unit == this.unit &&
          other.hasVariants == this.hasVariants &&
          other.updatedAt == this.updatedAt);
}

class CatalogCacheItemsCompanion extends UpdateCompanion<CatalogCacheItem> {
  final Value<String> id;
  final Value<String> branchId;
  final Value<String> categoryName;
  final Value<String> name;
  final Value<String> sku;
  final Value<String?> barcode;
  final Value<int> priceMinor;
  final Value<String> vatType;
  final Value<String> unit;
  final Value<bool> hasVariants;
  final Value<DateTime> updatedAt;
  final Value<int> rowid;
  const CatalogCacheItemsCompanion({
    this.id = const Value.absent(),
    this.branchId = const Value.absent(),
    this.categoryName = const Value.absent(),
    this.name = const Value.absent(),
    this.sku = const Value.absent(),
    this.barcode = const Value.absent(),
    this.priceMinor = const Value.absent(),
    this.vatType = const Value.absent(),
    this.unit = const Value.absent(),
    this.hasVariants = const Value.absent(),
    this.updatedAt = const Value.absent(),
    this.rowid = const Value.absent(),
  });
  CatalogCacheItemsCompanion.insert({
    required String id,
    required String branchId,
    required String categoryName,
    required String name,
    required String sku,
    this.barcode = const Value.absent(),
    required int priceMinor,
    required String vatType,
    required String unit,
    this.hasVariants = const Value.absent(),
    this.updatedAt = const Value.absent(),
    this.rowid = const Value.absent(),
  }) : id = Value(id),
       branchId = Value(branchId),
       categoryName = Value(categoryName),
       name = Value(name),
       sku = Value(sku),
       priceMinor = Value(priceMinor),
       vatType = Value(vatType),
       unit = Value(unit);
  static Insertable<CatalogCacheItem> custom({
    Expression<String>? id,
    Expression<String>? branchId,
    Expression<String>? categoryName,
    Expression<String>? name,
    Expression<String>? sku,
    Expression<String>? barcode,
    Expression<int>? priceMinor,
    Expression<String>? vatType,
    Expression<String>? unit,
    Expression<bool>? hasVariants,
    Expression<DateTime>? updatedAt,
    Expression<int>? rowid,
  }) {
    return RawValuesInsertable({
      if (id != null) 'id': id,
      if (branchId != null) 'branch_id': branchId,
      if (categoryName != null) 'category_name': categoryName,
      if (name != null) 'name': name,
      if (sku != null) 'sku': sku,
      if (barcode != null) 'barcode': barcode,
      if (priceMinor != null) 'price_minor': priceMinor,
      if (vatType != null) 'vat_type': vatType,
      if (unit != null) 'unit': unit,
      if (hasVariants != null) 'has_variants': hasVariants,
      if (updatedAt != null) 'updated_at': updatedAt,
      if (rowid != null) 'rowid': rowid,
    });
  }

  CatalogCacheItemsCompanion copyWith({
    Value<String>? id,
    Value<String>? branchId,
    Value<String>? categoryName,
    Value<String>? name,
    Value<String>? sku,
    Value<String?>? barcode,
    Value<int>? priceMinor,
    Value<String>? vatType,
    Value<String>? unit,
    Value<bool>? hasVariants,
    Value<DateTime>? updatedAt,
    Value<int>? rowid,
  }) {
    return CatalogCacheItemsCompanion(
      id: id ?? this.id,
      branchId: branchId ?? this.branchId,
      categoryName: categoryName ?? this.categoryName,
      name: name ?? this.name,
      sku: sku ?? this.sku,
      barcode: barcode ?? this.barcode,
      priceMinor: priceMinor ?? this.priceMinor,
      vatType: vatType ?? this.vatType,
      unit: unit ?? this.unit,
      hasVariants: hasVariants ?? this.hasVariants,
      updatedAt: updatedAt ?? this.updatedAt,
      rowid: rowid ?? this.rowid,
    );
  }

  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    if (id.present) {
      map['id'] = Variable<String>(id.value);
    }
    if (branchId.present) {
      map['branch_id'] = Variable<String>(branchId.value);
    }
    if (categoryName.present) {
      map['category_name'] = Variable<String>(categoryName.value);
    }
    if (name.present) {
      map['name'] = Variable<String>(name.value);
    }
    if (sku.present) {
      map['sku'] = Variable<String>(sku.value);
    }
    if (barcode.present) {
      map['barcode'] = Variable<String>(barcode.value);
    }
    if (priceMinor.present) {
      map['price_minor'] = Variable<int>(priceMinor.value);
    }
    if (vatType.present) {
      map['vat_type'] = Variable<String>(vatType.value);
    }
    if (unit.present) {
      map['unit'] = Variable<String>(unit.value);
    }
    if (hasVariants.present) {
      map['has_variants'] = Variable<bool>(hasVariants.value);
    }
    if (updatedAt.present) {
      map['updated_at'] = Variable<DateTime>(updatedAt.value);
    }
    if (rowid.present) {
      map['rowid'] = Variable<int>(rowid.value);
    }
    return map;
  }

  @override
  String toString() {
    return (StringBuffer('CatalogCacheItemsCompanion(')
          ..write('id: $id, ')
          ..write('branchId: $branchId, ')
          ..write('categoryName: $categoryName, ')
          ..write('name: $name, ')
          ..write('sku: $sku, ')
          ..write('barcode: $barcode, ')
          ..write('priceMinor: $priceMinor, ')
          ..write('vatType: $vatType, ')
          ..write('unit: $unit, ')
          ..write('hasVariants: $hasVariants, ')
          ..write('updatedAt: $updatedAt, ')
          ..write('rowid: $rowid')
          ..write(')'))
        .toString();
  }
}

class $SyncQueueEntriesTable extends SyncQueueEntries
    with TableInfo<$SyncQueueEntriesTable, SyncQueueEntry> {
  @override
  final GeneratedDatabase attachedDatabase;
  final String? _alias;
  $SyncQueueEntriesTable(this.attachedDatabase, [this._alias]);
  static const VerificationMeta _idMeta = const VerificationMeta('id');
  @override
  late final GeneratedColumn<String> id = GeneratedColumn<String>(
    'id',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _targetTableMeta = const VerificationMeta(
    'targetTable',
  );
  @override
  late final GeneratedColumn<String> targetTable = GeneratedColumn<String>(
    'table_name',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _recordIdMeta = const VerificationMeta(
    'recordId',
  );
  @override
  late final GeneratedColumn<String> recordId = GeneratedColumn<String>(
    'record_id',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _operationMeta = const VerificationMeta(
    'operation',
  );
  @override
  late final GeneratedColumn<String> operation = GeneratedColumn<String>(
    'operation',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _payloadMeta = const VerificationMeta(
    'payload',
  );
  @override
  late final GeneratedColumn<String> payload = GeneratedColumn<String>(
    'payload',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _localCreatedAtMeta = const VerificationMeta(
    'localCreatedAt',
  );
  @override
  late final GeneratedColumn<DateTime> localCreatedAt =
      GeneratedColumn<DateTime>(
        'local_created_at',
        aliasedName,
        false,
        type: DriftSqlType.dateTime,
        requiredDuringInsert: true,
      );
  static const VerificationMeta _syncedAtMeta = const VerificationMeta(
    'syncedAt',
  );
  @override
  late final GeneratedColumn<DateTime> syncedAt = GeneratedColumn<DateTime>(
    'synced_at',
    aliasedName,
    true,
    type: DriftSqlType.dateTime,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _retryCountMeta = const VerificationMeta(
    'retryCount',
  );
  @override
  late final GeneratedColumn<int> retryCount = GeneratedColumn<int>(
    'retry_count',
    aliasedName,
    false,
    type: DriftSqlType.int,
    requiredDuringInsert: false,
    defaultValue: const Constant(0),
  );
  static const VerificationMeta _errorMeta = const VerificationMeta('error');
  @override
  late final GeneratedColumn<String> error = GeneratedColumn<String>(
    'error',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  @override
  List<GeneratedColumn> get $columns => [
    id,
    targetTable,
    recordId,
    operation,
    payload,
    localCreatedAt,
    syncedAt,
    retryCount,
    error,
  ];
  @override
  String get aliasedName => _alias ?? actualTableName;
  @override
  String get actualTableName => $name;
  static const String $name = 'sync_queue_entries';
  @override
  VerificationContext validateIntegrity(
    Insertable<SyncQueueEntry> instance, {
    bool isInserting = false,
  }) {
    final context = VerificationContext();
    final data = instance.toColumns(true);
    if (data.containsKey('id')) {
      context.handle(_idMeta, id.isAcceptableOrUnknown(data['id']!, _idMeta));
    } else if (isInserting) {
      context.missing(_idMeta);
    }
    if (data.containsKey('table_name')) {
      context.handle(
        _targetTableMeta,
        targetTable.isAcceptableOrUnknown(
          data['table_name']!,
          _targetTableMeta,
        ),
      );
    } else if (isInserting) {
      context.missing(_targetTableMeta);
    }
    if (data.containsKey('record_id')) {
      context.handle(
        _recordIdMeta,
        recordId.isAcceptableOrUnknown(data['record_id']!, _recordIdMeta),
      );
    } else if (isInserting) {
      context.missing(_recordIdMeta);
    }
    if (data.containsKey('operation')) {
      context.handle(
        _operationMeta,
        operation.isAcceptableOrUnknown(data['operation']!, _operationMeta),
      );
    } else if (isInserting) {
      context.missing(_operationMeta);
    }
    if (data.containsKey('payload')) {
      context.handle(
        _payloadMeta,
        payload.isAcceptableOrUnknown(data['payload']!, _payloadMeta),
      );
    } else if (isInserting) {
      context.missing(_payloadMeta);
    }
    if (data.containsKey('local_created_at')) {
      context.handle(
        _localCreatedAtMeta,
        localCreatedAt.isAcceptableOrUnknown(
          data['local_created_at']!,
          _localCreatedAtMeta,
        ),
      );
    } else if (isInserting) {
      context.missing(_localCreatedAtMeta);
    }
    if (data.containsKey('synced_at')) {
      context.handle(
        _syncedAtMeta,
        syncedAt.isAcceptableOrUnknown(data['synced_at']!, _syncedAtMeta),
      );
    }
    if (data.containsKey('retry_count')) {
      context.handle(
        _retryCountMeta,
        retryCount.isAcceptableOrUnknown(data['retry_count']!, _retryCountMeta),
      );
    }
    if (data.containsKey('error')) {
      context.handle(
        _errorMeta,
        error.isAcceptableOrUnknown(data['error']!, _errorMeta),
      );
    }
    return context;
  }

  @override
  Set<GeneratedColumn> get $primaryKey => {id};
  @override
  SyncQueueEntry map(Map<String, dynamic> data, {String? tablePrefix}) {
    final effectivePrefix = tablePrefix != null ? '$tablePrefix.' : '';
    return SyncQueueEntry(
      id: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}id'],
      )!,
      targetTable: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}table_name'],
      )!,
      recordId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}record_id'],
      )!,
      operation: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}operation'],
      )!,
      payload: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}payload'],
      )!,
      localCreatedAt: attachedDatabase.typeMapping.read(
        DriftSqlType.dateTime,
        data['${effectivePrefix}local_created_at'],
      )!,
      syncedAt: attachedDatabase.typeMapping.read(
        DriftSqlType.dateTime,
        data['${effectivePrefix}synced_at'],
      ),
      retryCount: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}retry_count'],
      )!,
      error: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}error'],
      ),
    );
  }

  @override
  $SyncQueueEntriesTable createAlias(String alias) {
    return $SyncQueueEntriesTable(attachedDatabase, alias);
  }
}

class SyncQueueEntry extends DataClass implements Insertable<SyncQueueEntry> {
  final String id;
  final String targetTable;
  final String recordId;
  final String operation;
  final String payload;
  final DateTime localCreatedAt;
  final DateTime? syncedAt;
  final int retryCount;
  final String? error;
  const SyncQueueEntry({
    required this.id,
    required this.targetTable,
    required this.recordId,
    required this.operation,
    required this.payload,
    required this.localCreatedAt,
    this.syncedAt,
    required this.retryCount,
    this.error,
  });
  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    map['id'] = Variable<String>(id);
    map['table_name'] = Variable<String>(targetTable);
    map['record_id'] = Variable<String>(recordId);
    map['operation'] = Variable<String>(operation);
    map['payload'] = Variable<String>(payload);
    map['local_created_at'] = Variable<DateTime>(localCreatedAt);
    if (!nullToAbsent || syncedAt != null) {
      map['synced_at'] = Variable<DateTime>(syncedAt);
    }
    map['retry_count'] = Variable<int>(retryCount);
    if (!nullToAbsent || error != null) {
      map['error'] = Variable<String>(error);
    }
    return map;
  }

  SyncQueueEntriesCompanion toCompanion(bool nullToAbsent) {
    return SyncQueueEntriesCompanion(
      id: Value(id),
      targetTable: Value(targetTable),
      recordId: Value(recordId),
      operation: Value(operation),
      payload: Value(payload),
      localCreatedAt: Value(localCreatedAt),
      syncedAt: syncedAt == null && nullToAbsent
          ? const Value.absent()
          : Value(syncedAt),
      retryCount: Value(retryCount),
      error: error == null && nullToAbsent
          ? const Value.absent()
          : Value(error),
    );
  }

  factory SyncQueueEntry.fromJson(
    Map<String, dynamic> json, {
    ValueSerializer? serializer,
  }) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return SyncQueueEntry(
      id: serializer.fromJson<String>(json['id']),
      targetTable: serializer.fromJson<String>(json['targetTable']),
      recordId: serializer.fromJson<String>(json['recordId']),
      operation: serializer.fromJson<String>(json['operation']),
      payload: serializer.fromJson<String>(json['payload']),
      localCreatedAt: serializer.fromJson<DateTime>(json['localCreatedAt']),
      syncedAt: serializer.fromJson<DateTime?>(json['syncedAt']),
      retryCount: serializer.fromJson<int>(json['retryCount']),
      error: serializer.fromJson<String?>(json['error']),
    );
  }
  @override
  Map<String, dynamic> toJson({ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return <String, dynamic>{
      'id': serializer.toJson<String>(id),
      'targetTable': serializer.toJson<String>(targetTable),
      'recordId': serializer.toJson<String>(recordId),
      'operation': serializer.toJson<String>(operation),
      'payload': serializer.toJson<String>(payload),
      'localCreatedAt': serializer.toJson<DateTime>(localCreatedAt),
      'syncedAt': serializer.toJson<DateTime?>(syncedAt),
      'retryCount': serializer.toJson<int>(retryCount),
      'error': serializer.toJson<String?>(error),
    };
  }

  SyncQueueEntry copyWith({
    String? id,
    String? targetTable,
    String? recordId,
    String? operation,
    String? payload,
    DateTime? localCreatedAt,
    Value<DateTime?> syncedAt = const Value.absent(),
    int? retryCount,
    Value<String?> error = const Value.absent(),
  }) => SyncQueueEntry(
    id: id ?? this.id,
    targetTable: targetTable ?? this.targetTable,
    recordId: recordId ?? this.recordId,
    operation: operation ?? this.operation,
    payload: payload ?? this.payload,
    localCreatedAt: localCreatedAt ?? this.localCreatedAt,
    syncedAt: syncedAt.present ? syncedAt.value : this.syncedAt,
    retryCount: retryCount ?? this.retryCount,
    error: error.present ? error.value : this.error,
  );
  SyncQueueEntry copyWithCompanion(SyncQueueEntriesCompanion data) {
    return SyncQueueEntry(
      id: data.id.present ? data.id.value : this.id,
      targetTable: data.targetTable.present
          ? data.targetTable.value
          : this.targetTable,
      recordId: data.recordId.present ? data.recordId.value : this.recordId,
      operation: data.operation.present ? data.operation.value : this.operation,
      payload: data.payload.present ? data.payload.value : this.payload,
      localCreatedAt: data.localCreatedAt.present
          ? data.localCreatedAt.value
          : this.localCreatedAt,
      syncedAt: data.syncedAt.present ? data.syncedAt.value : this.syncedAt,
      retryCount: data.retryCount.present
          ? data.retryCount.value
          : this.retryCount,
      error: data.error.present ? data.error.value : this.error,
    );
  }

  @override
  String toString() {
    return (StringBuffer('SyncQueueEntry(')
          ..write('id: $id, ')
          ..write('targetTable: $targetTable, ')
          ..write('recordId: $recordId, ')
          ..write('operation: $operation, ')
          ..write('payload: $payload, ')
          ..write('localCreatedAt: $localCreatedAt, ')
          ..write('syncedAt: $syncedAt, ')
          ..write('retryCount: $retryCount, ')
          ..write('error: $error')
          ..write(')'))
        .toString();
  }

  @override
  int get hashCode => Object.hash(
    id,
    targetTable,
    recordId,
    operation,
    payload,
    localCreatedAt,
    syncedAt,
    retryCount,
    error,
  );
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is SyncQueueEntry &&
          other.id == this.id &&
          other.targetTable == this.targetTable &&
          other.recordId == this.recordId &&
          other.operation == this.operation &&
          other.payload == this.payload &&
          other.localCreatedAt == this.localCreatedAt &&
          other.syncedAt == this.syncedAt &&
          other.retryCount == this.retryCount &&
          other.error == this.error);
}

class SyncQueueEntriesCompanion extends UpdateCompanion<SyncQueueEntry> {
  final Value<String> id;
  final Value<String> targetTable;
  final Value<String> recordId;
  final Value<String> operation;
  final Value<String> payload;
  final Value<DateTime> localCreatedAt;
  final Value<DateTime?> syncedAt;
  final Value<int> retryCount;
  final Value<String?> error;
  final Value<int> rowid;
  const SyncQueueEntriesCompanion({
    this.id = const Value.absent(),
    this.targetTable = const Value.absent(),
    this.recordId = const Value.absent(),
    this.operation = const Value.absent(),
    this.payload = const Value.absent(),
    this.localCreatedAt = const Value.absent(),
    this.syncedAt = const Value.absent(),
    this.retryCount = const Value.absent(),
    this.error = const Value.absent(),
    this.rowid = const Value.absent(),
  });
  SyncQueueEntriesCompanion.insert({
    required String id,
    required String targetTable,
    required String recordId,
    required String operation,
    required String payload,
    required DateTime localCreatedAt,
    this.syncedAt = const Value.absent(),
    this.retryCount = const Value.absent(),
    this.error = const Value.absent(),
    this.rowid = const Value.absent(),
  }) : id = Value(id),
       targetTable = Value(targetTable),
       recordId = Value(recordId),
       operation = Value(operation),
       payload = Value(payload),
       localCreatedAt = Value(localCreatedAt);
  static Insertable<SyncQueueEntry> custom({
    Expression<String>? id,
    Expression<String>? targetTable,
    Expression<String>? recordId,
    Expression<String>? operation,
    Expression<String>? payload,
    Expression<DateTime>? localCreatedAt,
    Expression<DateTime>? syncedAt,
    Expression<int>? retryCount,
    Expression<String>? error,
    Expression<int>? rowid,
  }) {
    return RawValuesInsertable({
      if (id != null) 'id': id,
      if (targetTable != null) 'table_name': targetTable,
      if (recordId != null) 'record_id': recordId,
      if (operation != null) 'operation': operation,
      if (payload != null) 'payload': payload,
      if (localCreatedAt != null) 'local_created_at': localCreatedAt,
      if (syncedAt != null) 'synced_at': syncedAt,
      if (retryCount != null) 'retry_count': retryCount,
      if (error != null) 'error': error,
      if (rowid != null) 'rowid': rowid,
    });
  }

  SyncQueueEntriesCompanion copyWith({
    Value<String>? id,
    Value<String>? targetTable,
    Value<String>? recordId,
    Value<String>? operation,
    Value<String>? payload,
    Value<DateTime>? localCreatedAt,
    Value<DateTime?>? syncedAt,
    Value<int>? retryCount,
    Value<String?>? error,
    Value<int>? rowid,
  }) {
    return SyncQueueEntriesCompanion(
      id: id ?? this.id,
      targetTable: targetTable ?? this.targetTable,
      recordId: recordId ?? this.recordId,
      operation: operation ?? this.operation,
      payload: payload ?? this.payload,
      localCreatedAt: localCreatedAt ?? this.localCreatedAt,
      syncedAt: syncedAt ?? this.syncedAt,
      retryCount: retryCount ?? this.retryCount,
      error: error ?? this.error,
      rowid: rowid ?? this.rowid,
    );
  }

  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    if (id.present) {
      map['id'] = Variable<String>(id.value);
    }
    if (targetTable.present) {
      map['table_name'] = Variable<String>(targetTable.value);
    }
    if (recordId.present) {
      map['record_id'] = Variable<String>(recordId.value);
    }
    if (operation.present) {
      map['operation'] = Variable<String>(operation.value);
    }
    if (payload.present) {
      map['payload'] = Variable<String>(payload.value);
    }
    if (localCreatedAt.present) {
      map['local_created_at'] = Variable<DateTime>(localCreatedAt.value);
    }
    if (syncedAt.present) {
      map['synced_at'] = Variable<DateTime>(syncedAt.value);
    }
    if (retryCount.present) {
      map['retry_count'] = Variable<int>(retryCount.value);
    }
    if (error.present) {
      map['error'] = Variable<String>(error.value);
    }
    if (rowid.present) {
      map['rowid'] = Variable<int>(rowid.value);
    }
    return map;
  }

  @override
  String toString() {
    return (StringBuffer('SyncQueueEntriesCompanion(')
          ..write('id: $id, ')
          ..write('targetTable: $targetTable, ')
          ..write('recordId: $recordId, ')
          ..write('operation: $operation, ')
          ..write('payload: $payload, ')
          ..write('localCreatedAt: $localCreatedAt, ')
          ..write('syncedAt: $syncedAt, ')
          ..write('retryCount: $retryCount, ')
          ..write('error: $error, ')
          ..write('rowid: $rowid')
          ..write(')'))
        .toString();
  }
}

class $ShiftSessionsTable extends ShiftSessions
    with TableInfo<$ShiftSessionsTable, ShiftSession> {
  @override
  final GeneratedDatabase attachedDatabase;
  final String? _alias;
  $ShiftSessionsTable(this.attachedDatabase, [this._alias]);
  static const VerificationMeta _idMeta = const VerificationMeta('id');
  @override
  late final GeneratedColumn<String> id = GeneratedColumn<String>(
    'id',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _branchIdMeta = const VerificationMeta(
    'branchId',
  );
  @override
  late final GeneratedColumn<String> branchId = GeneratedColumn<String>(
    'branch_id',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _cashierNameMeta = const VerificationMeta(
    'cashierName',
  );
  @override
  late final GeneratedColumn<String> cashierName = GeneratedColumn<String>(
    'cashier_name',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _openingCashMinorMeta = const VerificationMeta(
    'openingCashMinor',
  );
  @override
  late final GeneratedColumn<int> openingCashMinor = GeneratedColumn<int>(
    'opening_cash_minor',
    aliasedName,
    false,
    type: DriftSqlType.int,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _openedAtMeta = const VerificationMeta(
    'openedAt',
  );
  @override
  late final GeneratedColumn<DateTime> openedAt = GeneratedColumn<DateTime>(
    'opened_at',
    aliasedName,
    false,
    type: DriftSqlType.dateTime,
    requiredDuringInsert: false,
    defaultValue: currentDateAndTime,
  );
  static const VerificationMeta _closedAtMeta = const VerificationMeta(
    'closedAt',
  );
  @override
  late final GeneratedColumn<DateTime> closedAt = GeneratedColumn<DateTime>(
    'closed_at',
    aliasedName,
    true,
    type: DriftSqlType.dateTime,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _isActiveMeta = const VerificationMeta(
    'isActive',
  );
  @override
  late final GeneratedColumn<bool> isActive = GeneratedColumn<bool>(
    'is_active',
    aliasedName,
    false,
    type: DriftSqlType.bool,
    requiredDuringInsert: false,
    defaultConstraints: GeneratedColumn.constraintIsAlways(
      'CHECK ("is_active" IN (0, 1))',
    ),
    defaultValue: const Constant(true),
  );
  @override
  List<GeneratedColumn> get $columns => [
    id,
    branchId,
    cashierName,
    openingCashMinor,
    openedAt,
    closedAt,
    isActive,
  ];
  @override
  String get aliasedName => _alias ?? actualTableName;
  @override
  String get actualTableName => $name;
  static const String $name = 'shift_sessions';
  @override
  VerificationContext validateIntegrity(
    Insertable<ShiftSession> instance, {
    bool isInserting = false,
  }) {
    final context = VerificationContext();
    final data = instance.toColumns(true);
    if (data.containsKey('id')) {
      context.handle(_idMeta, id.isAcceptableOrUnknown(data['id']!, _idMeta));
    } else if (isInserting) {
      context.missing(_idMeta);
    }
    if (data.containsKey('branch_id')) {
      context.handle(
        _branchIdMeta,
        branchId.isAcceptableOrUnknown(data['branch_id']!, _branchIdMeta),
      );
    } else if (isInserting) {
      context.missing(_branchIdMeta);
    }
    if (data.containsKey('cashier_name')) {
      context.handle(
        _cashierNameMeta,
        cashierName.isAcceptableOrUnknown(
          data['cashier_name']!,
          _cashierNameMeta,
        ),
      );
    } else if (isInserting) {
      context.missing(_cashierNameMeta);
    }
    if (data.containsKey('opening_cash_minor')) {
      context.handle(
        _openingCashMinorMeta,
        openingCashMinor.isAcceptableOrUnknown(
          data['opening_cash_minor']!,
          _openingCashMinorMeta,
        ),
      );
    } else if (isInserting) {
      context.missing(_openingCashMinorMeta);
    }
    if (data.containsKey('opened_at')) {
      context.handle(
        _openedAtMeta,
        openedAt.isAcceptableOrUnknown(data['opened_at']!, _openedAtMeta),
      );
    }
    if (data.containsKey('closed_at')) {
      context.handle(
        _closedAtMeta,
        closedAt.isAcceptableOrUnknown(data['closed_at']!, _closedAtMeta),
      );
    }
    if (data.containsKey('is_active')) {
      context.handle(
        _isActiveMeta,
        isActive.isAcceptableOrUnknown(data['is_active']!, _isActiveMeta),
      );
    }
    return context;
  }

  @override
  Set<GeneratedColumn> get $primaryKey => {id};
  @override
  ShiftSession map(Map<String, dynamic> data, {String? tablePrefix}) {
    final effectivePrefix = tablePrefix != null ? '$tablePrefix.' : '';
    return ShiftSession(
      id: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}id'],
      )!,
      branchId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}branch_id'],
      )!,
      cashierName: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}cashier_name'],
      )!,
      openingCashMinor: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}opening_cash_minor'],
      )!,
      openedAt: attachedDatabase.typeMapping.read(
        DriftSqlType.dateTime,
        data['${effectivePrefix}opened_at'],
      )!,
      closedAt: attachedDatabase.typeMapping.read(
        DriftSqlType.dateTime,
        data['${effectivePrefix}closed_at'],
      ),
      isActive: attachedDatabase.typeMapping.read(
        DriftSqlType.bool,
        data['${effectivePrefix}is_active'],
      )!,
    );
  }

  @override
  $ShiftSessionsTable createAlias(String alias) {
    return $ShiftSessionsTable(attachedDatabase, alias);
  }
}

class ShiftSession extends DataClass implements Insertable<ShiftSession> {
  final String id;
  final String branchId;
  final String cashierName;
  final int openingCashMinor;
  final DateTime openedAt;
  final DateTime? closedAt;
  final bool isActive;
  const ShiftSession({
    required this.id,
    required this.branchId,
    required this.cashierName,
    required this.openingCashMinor,
    required this.openedAt,
    this.closedAt,
    required this.isActive,
  });
  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    map['id'] = Variable<String>(id);
    map['branch_id'] = Variable<String>(branchId);
    map['cashier_name'] = Variable<String>(cashierName);
    map['opening_cash_minor'] = Variable<int>(openingCashMinor);
    map['opened_at'] = Variable<DateTime>(openedAt);
    if (!nullToAbsent || closedAt != null) {
      map['closed_at'] = Variable<DateTime>(closedAt);
    }
    map['is_active'] = Variable<bool>(isActive);
    return map;
  }

  ShiftSessionsCompanion toCompanion(bool nullToAbsent) {
    return ShiftSessionsCompanion(
      id: Value(id),
      branchId: Value(branchId),
      cashierName: Value(cashierName),
      openingCashMinor: Value(openingCashMinor),
      openedAt: Value(openedAt),
      closedAt: closedAt == null && nullToAbsent
          ? const Value.absent()
          : Value(closedAt),
      isActive: Value(isActive),
    );
  }

  factory ShiftSession.fromJson(
    Map<String, dynamic> json, {
    ValueSerializer? serializer,
  }) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return ShiftSession(
      id: serializer.fromJson<String>(json['id']),
      branchId: serializer.fromJson<String>(json['branchId']),
      cashierName: serializer.fromJson<String>(json['cashierName']),
      openingCashMinor: serializer.fromJson<int>(json['openingCashMinor']),
      openedAt: serializer.fromJson<DateTime>(json['openedAt']),
      closedAt: serializer.fromJson<DateTime?>(json['closedAt']),
      isActive: serializer.fromJson<bool>(json['isActive']),
    );
  }
  @override
  Map<String, dynamic> toJson({ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return <String, dynamic>{
      'id': serializer.toJson<String>(id),
      'branchId': serializer.toJson<String>(branchId),
      'cashierName': serializer.toJson<String>(cashierName),
      'openingCashMinor': serializer.toJson<int>(openingCashMinor),
      'openedAt': serializer.toJson<DateTime>(openedAt),
      'closedAt': serializer.toJson<DateTime?>(closedAt),
      'isActive': serializer.toJson<bool>(isActive),
    };
  }

  ShiftSession copyWith({
    String? id,
    String? branchId,
    String? cashierName,
    int? openingCashMinor,
    DateTime? openedAt,
    Value<DateTime?> closedAt = const Value.absent(),
    bool? isActive,
  }) => ShiftSession(
    id: id ?? this.id,
    branchId: branchId ?? this.branchId,
    cashierName: cashierName ?? this.cashierName,
    openingCashMinor: openingCashMinor ?? this.openingCashMinor,
    openedAt: openedAt ?? this.openedAt,
    closedAt: closedAt.present ? closedAt.value : this.closedAt,
    isActive: isActive ?? this.isActive,
  );
  ShiftSession copyWithCompanion(ShiftSessionsCompanion data) {
    return ShiftSession(
      id: data.id.present ? data.id.value : this.id,
      branchId: data.branchId.present ? data.branchId.value : this.branchId,
      cashierName: data.cashierName.present
          ? data.cashierName.value
          : this.cashierName,
      openingCashMinor: data.openingCashMinor.present
          ? data.openingCashMinor.value
          : this.openingCashMinor,
      openedAt: data.openedAt.present ? data.openedAt.value : this.openedAt,
      closedAt: data.closedAt.present ? data.closedAt.value : this.closedAt,
      isActive: data.isActive.present ? data.isActive.value : this.isActive,
    );
  }

  @override
  String toString() {
    return (StringBuffer('ShiftSession(')
          ..write('id: $id, ')
          ..write('branchId: $branchId, ')
          ..write('cashierName: $cashierName, ')
          ..write('openingCashMinor: $openingCashMinor, ')
          ..write('openedAt: $openedAt, ')
          ..write('closedAt: $closedAt, ')
          ..write('isActive: $isActive')
          ..write(')'))
        .toString();
  }

  @override
  int get hashCode => Object.hash(
    id,
    branchId,
    cashierName,
    openingCashMinor,
    openedAt,
    closedAt,
    isActive,
  );
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is ShiftSession &&
          other.id == this.id &&
          other.branchId == this.branchId &&
          other.cashierName == this.cashierName &&
          other.openingCashMinor == this.openingCashMinor &&
          other.openedAt == this.openedAt &&
          other.closedAt == this.closedAt &&
          other.isActive == this.isActive);
}

class ShiftSessionsCompanion extends UpdateCompanion<ShiftSession> {
  final Value<String> id;
  final Value<String> branchId;
  final Value<String> cashierName;
  final Value<int> openingCashMinor;
  final Value<DateTime> openedAt;
  final Value<DateTime?> closedAt;
  final Value<bool> isActive;
  final Value<int> rowid;
  const ShiftSessionsCompanion({
    this.id = const Value.absent(),
    this.branchId = const Value.absent(),
    this.cashierName = const Value.absent(),
    this.openingCashMinor = const Value.absent(),
    this.openedAt = const Value.absent(),
    this.closedAt = const Value.absent(),
    this.isActive = const Value.absent(),
    this.rowid = const Value.absent(),
  });
  ShiftSessionsCompanion.insert({
    required String id,
    required String branchId,
    required String cashierName,
    required int openingCashMinor,
    this.openedAt = const Value.absent(),
    this.closedAt = const Value.absent(),
    this.isActive = const Value.absent(),
    this.rowid = const Value.absent(),
  }) : id = Value(id),
       branchId = Value(branchId),
       cashierName = Value(cashierName),
       openingCashMinor = Value(openingCashMinor);
  static Insertable<ShiftSession> custom({
    Expression<String>? id,
    Expression<String>? branchId,
    Expression<String>? cashierName,
    Expression<int>? openingCashMinor,
    Expression<DateTime>? openedAt,
    Expression<DateTime>? closedAt,
    Expression<bool>? isActive,
    Expression<int>? rowid,
  }) {
    return RawValuesInsertable({
      if (id != null) 'id': id,
      if (branchId != null) 'branch_id': branchId,
      if (cashierName != null) 'cashier_name': cashierName,
      if (openingCashMinor != null) 'opening_cash_minor': openingCashMinor,
      if (openedAt != null) 'opened_at': openedAt,
      if (closedAt != null) 'closed_at': closedAt,
      if (isActive != null) 'is_active': isActive,
      if (rowid != null) 'rowid': rowid,
    });
  }

  ShiftSessionsCompanion copyWith({
    Value<String>? id,
    Value<String>? branchId,
    Value<String>? cashierName,
    Value<int>? openingCashMinor,
    Value<DateTime>? openedAt,
    Value<DateTime?>? closedAt,
    Value<bool>? isActive,
    Value<int>? rowid,
  }) {
    return ShiftSessionsCompanion(
      id: id ?? this.id,
      branchId: branchId ?? this.branchId,
      cashierName: cashierName ?? this.cashierName,
      openingCashMinor: openingCashMinor ?? this.openingCashMinor,
      openedAt: openedAt ?? this.openedAt,
      closedAt: closedAt ?? this.closedAt,
      isActive: isActive ?? this.isActive,
      rowid: rowid ?? this.rowid,
    );
  }

  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    if (id.present) {
      map['id'] = Variable<String>(id.value);
    }
    if (branchId.present) {
      map['branch_id'] = Variable<String>(branchId.value);
    }
    if (cashierName.present) {
      map['cashier_name'] = Variable<String>(cashierName.value);
    }
    if (openingCashMinor.present) {
      map['opening_cash_minor'] = Variable<int>(openingCashMinor.value);
    }
    if (openedAt.present) {
      map['opened_at'] = Variable<DateTime>(openedAt.value);
    }
    if (closedAt.present) {
      map['closed_at'] = Variable<DateTime>(closedAt.value);
    }
    if (isActive.present) {
      map['is_active'] = Variable<bool>(isActive.value);
    }
    if (rowid.present) {
      map['rowid'] = Variable<int>(rowid.value);
    }
    return map;
  }

  @override
  String toString() {
    return (StringBuffer('ShiftSessionsCompanion(')
          ..write('id: $id, ')
          ..write('branchId: $branchId, ')
          ..write('cashierName: $cashierName, ')
          ..write('openingCashMinor: $openingCashMinor, ')
          ..write('openedAt: $openedAt, ')
          ..write('closedAt: $closedAt, ')
          ..write('isActive: $isActive, ')
          ..write('rowid: $rowid')
          ..write(')'))
        .toString();
  }
}

abstract class _$AppDatabase extends GeneratedDatabase {
  _$AppDatabase(QueryExecutor e) : super(e);
  $AppDatabaseManager get managers => $AppDatabaseManager(this);
  late final $CatalogCacheItemsTable catalogCacheItems =
      $CatalogCacheItemsTable(this);
  late final $SyncQueueEntriesTable syncQueueEntries = $SyncQueueEntriesTable(
    this,
  );
  late final $ShiftSessionsTable shiftSessions = $ShiftSessionsTable(this);
  @override
  Iterable<TableInfo<Table, Object?>> get allTables =>
      allSchemaEntities.whereType<TableInfo<Table, Object?>>();
  @override
  List<DatabaseSchemaEntity> get allSchemaEntities => [
    catalogCacheItems,
    syncQueueEntries,
    shiftSessions,
  ];
}

typedef $$CatalogCacheItemsTableCreateCompanionBuilder =
    CatalogCacheItemsCompanion Function({
      required String id,
      required String branchId,
      required String categoryName,
      required String name,
      required String sku,
      Value<String?> barcode,
      required int priceMinor,
      required String vatType,
      required String unit,
      Value<bool> hasVariants,
      Value<DateTime> updatedAt,
      Value<int> rowid,
    });
typedef $$CatalogCacheItemsTableUpdateCompanionBuilder =
    CatalogCacheItemsCompanion Function({
      Value<String> id,
      Value<String> branchId,
      Value<String> categoryName,
      Value<String> name,
      Value<String> sku,
      Value<String?> barcode,
      Value<int> priceMinor,
      Value<String> vatType,
      Value<String> unit,
      Value<bool> hasVariants,
      Value<DateTime> updatedAt,
      Value<int> rowid,
    });

class $$CatalogCacheItemsTableFilterComposer
    extends Composer<_$AppDatabase, $CatalogCacheItemsTable> {
  $$CatalogCacheItemsTableFilterComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnFilters<String> get id => $composableBuilder(
    column: $table.id,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get branchId => $composableBuilder(
    column: $table.branchId,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get categoryName => $composableBuilder(
    column: $table.categoryName,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get name => $composableBuilder(
    column: $table.name,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get sku => $composableBuilder(
    column: $table.sku,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get barcode => $composableBuilder(
    column: $table.barcode,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<int> get priceMinor => $composableBuilder(
    column: $table.priceMinor,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get vatType => $composableBuilder(
    column: $table.vatType,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get unit => $composableBuilder(
    column: $table.unit,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<bool> get hasVariants => $composableBuilder(
    column: $table.hasVariants,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<DateTime> get updatedAt => $composableBuilder(
    column: $table.updatedAt,
    builder: (column) => ColumnFilters(column),
  );
}

class $$CatalogCacheItemsTableOrderingComposer
    extends Composer<_$AppDatabase, $CatalogCacheItemsTable> {
  $$CatalogCacheItemsTableOrderingComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnOrderings<String> get id => $composableBuilder(
    column: $table.id,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get branchId => $composableBuilder(
    column: $table.branchId,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get categoryName => $composableBuilder(
    column: $table.categoryName,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get name => $composableBuilder(
    column: $table.name,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get sku => $composableBuilder(
    column: $table.sku,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get barcode => $composableBuilder(
    column: $table.barcode,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<int> get priceMinor => $composableBuilder(
    column: $table.priceMinor,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get vatType => $composableBuilder(
    column: $table.vatType,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get unit => $composableBuilder(
    column: $table.unit,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<bool> get hasVariants => $composableBuilder(
    column: $table.hasVariants,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<DateTime> get updatedAt => $composableBuilder(
    column: $table.updatedAt,
    builder: (column) => ColumnOrderings(column),
  );
}

class $$CatalogCacheItemsTableAnnotationComposer
    extends Composer<_$AppDatabase, $CatalogCacheItemsTable> {
  $$CatalogCacheItemsTableAnnotationComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  GeneratedColumn<String> get id =>
      $composableBuilder(column: $table.id, builder: (column) => column);

  GeneratedColumn<String> get branchId =>
      $composableBuilder(column: $table.branchId, builder: (column) => column);

  GeneratedColumn<String> get categoryName => $composableBuilder(
    column: $table.categoryName,
    builder: (column) => column,
  );

  GeneratedColumn<String> get name =>
      $composableBuilder(column: $table.name, builder: (column) => column);

  GeneratedColumn<String> get sku =>
      $composableBuilder(column: $table.sku, builder: (column) => column);

  GeneratedColumn<String> get barcode =>
      $composableBuilder(column: $table.barcode, builder: (column) => column);

  GeneratedColumn<int> get priceMinor => $composableBuilder(
    column: $table.priceMinor,
    builder: (column) => column,
  );

  GeneratedColumn<String> get vatType =>
      $composableBuilder(column: $table.vatType, builder: (column) => column);

  GeneratedColumn<String> get unit =>
      $composableBuilder(column: $table.unit, builder: (column) => column);

  GeneratedColumn<bool> get hasVariants => $composableBuilder(
    column: $table.hasVariants,
    builder: (column) => column,
  );

  GeneratedColumn<DateTime> get updatedAt =>
      $composableBuilder(column: $table.updatedAt, builder: (column) => column);
}

class $$CatalogCacheItemsTableTableManager
    extends
        RootTableManager<
          _$AppDatabase,
          $CatalogCacheItemsTable,
          CatalogCacheItem,
          $$CatalogCacheItemsTableFilterComposer,
          $$CatalogCacheItemsTableOrderingComposer,
          $$CatalogCacheItemsTableAnnotationComposer,
          $$CatalogCacheItemsTableCreateCompanionBuilder,
          $$CatalogCacheItemsTableUpdateCompanionBuilder,
          (
            CatalogCacheItem,
            BaseReferences<
              _$AppDatabase,
              $CatalogCacheItemsTable,
              CatalogCacheItem
            >,
          ),
          CatalogCacheItem,
          PrefetchHooks Function()
        > {
  $$CatalogCacheItemsTableTableManager(
    _$AppDatabase db,
    $CatalogCacheItemsTable table,
  ) : super(
        TableManagerState(
          db: db,
          table: table,
          createFilteringComposer: () =>
              $$CatalogCacheItemsTableFilterComposer($db: db, $table: table),
          createOrderingComposer: () =>
              $$CatalogCacheItemsTableOrderingComposer($db: db, $table: table),
          createComputedFieldComposer: () =>
              $$CatalogCacheItemsTableAnnotationComposer(
                $db: db,
                $table: table,
              ),
          updateCompanionCallback:
              ({
                Value<String> id = const Value.absent(),
                Value<String> branchId = const Value.absent(),
                Value<String> categoryName = const Value.absent(),
                Value<String> name = const Value.absent(),
                Value<String> sku = const Value.absent(),
                Value<String?> barcode = const Value.absent(),
                Value<int> priceMinor = const Value.absent(),
                Value<String> vatType = const Value.absent(),
                Value<String> unit = const Value.absent(),
                Value<bool> hasVariants = const Value.absent(),
                Value<DateTime> updatedAt = const Value.absent(),
                Value<int> rowid = const Value.absent(),
              }) => CatalogCacheItemsCompanion(
                id: id,
                branchId: branchId,
                categoryName: categoryName,
                name: name,
                sku: sku,
                barcode: barcode,
                priceMinor: priceMinor,
                vatType: vatType,
                unit: unit,
                hasVariants: hasVariants,
                updatedAt: updatedAt,
                rowid: rowid,
              ),
          createCompanionCallback:
              ({
                required String id,
                required String branchId,
                required String categoryName,
                required String name,
                required String sku,
                Value<String?> barcode = const Value.absent(),
                required int priceMinor,
                required String vatType,
                required String unit,
                Value<bool> hasVariants = const Value.absent(),
                Value<DateTime> updatedAt = const Value.absent(),
                Value<int> rowid = const Value.absent(),
              }) => CatalogCacheItemsCompanion.insert(
                id: id,
                branchId: branchId,
                categoryName: categoryName,
                name: name,
                sku: sku,
                barcode: barcode,
                priceMinor: priceMinor,
                vatType: vatType,
                unit: unit,
                hasVariants: hasVariants,
                updatedAt: updatedAt,
                rowid: rowid,
              ),
          withReferenceMapper: (p0) => p0
              .map((e) => (e.readTable(table), BaseReferences(db, table, e)))
              .toList(),
          prefetchHooksCallback: null,
        ),
      );
}

typedef $$CatalogCacheItemsTableProcessedTableManager =
    ProcessedTableManager<
      _$AppDatabase,
      $CatalogCacheItemsTable,
      CatalogCacheItem,
      $$CatalogCacheItemsTableFilterComposer,
      $$CatalogCacheItemsTableOrderingComposer,
      $$CatalogCacheItemsTableAnnotationComposer,
      $$CatalogCacheItemsTableCreateCompanionBuilder,
      $$CatalogCacheItemsTableUpdateCompanionBuilder,
      (
        CatalogCacheItem,
        BaseReferences<
          _$AppDatabase,
          $CatalogCacheItemsTable,
          CatalogCacheItem
        >,
      ),
      CatalogCacheItem,
      PrefetchHooks Function()
    >;
typedef $$SyncQueueEntriesTableCreateCompanionBuilder =
    SyncQueueEntriesCompanion Function({
      required String id,
      required String targetTable,
      required String recordId,
      required String operation,
      required String payload,
      required DateTime localCreatedAt,
      Value<DateTime?> syncedAt,
      Value<int> retryCount,
      Value<String?> error,
      Value<int> rowid,
    });
typedef $$SyncQueueEntriesTableUpdateCompanionBuilder =
    SyncQueueEntriesCompanion Function({
      Value<String> id,
      Value<String> targetTable,
      Value<String> recordId,
      Value<String> operation,
      Value<String> payload,
      Value<DateTime> localCreatedAt,
      Value<DateTime?> syncedAt,
      Value<int> retryCount,
      Value<String?> error,
      Value<int> rowid,
    });

class $$SyncQueueEntriesTableFilterComposer
    extends Composer<_$AppDatabase, $SyncQueueEntriesTable> {
  $$SyncQueueEntriesTableFilterComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnFilters<String> get id => $composableBuilder(
    column: $table.id,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get targetTable => $composableBuilder(
    column: $table.targetTable,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get recordId => $composableBuilder(
    column: $table.recordId,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get operation => $composableBuilder(
    column: $table.operation,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get payload => $composableBuilder(
    column: $table.payload,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<DateTime> get localCreatedAt => $composableBuilder(
    column: $table.localCreatedAt,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<DateTime> get syncedAt => $composableBuilder(
    column: $table.syncedAt,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<int> get retryCount => $composableBuilder(
    column: $table.retryCount,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get error => $composableBuilder(
    column: $table.error,
    builder: (column) => ColumnFilters(column),
  );
}

class $$SyncQueueEntriesTableOrderingComposer
    extends Composer<_$AppDatabase, $SyncQueueEntriesTable> {
  $$SyncQueueEntriesTableOrderingComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnOrderings<String> get id => $composableBuilder(
    column: $table.id,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get targetTable => $composableBuilder(
    column: $table.targetTable,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get recordId => $composableBuilder(
    column: $table.recordId,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get operation => $composableBuilder(
    column: $table.operation,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get payload => $composableBuilder(
    column: $table.payload,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<DateTime> get localCreatedAt => $composableBuilder(
    column: $table.localCreatedAt,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<DateTime> get syncedAt => $composableBuilder(
    column: $table.syncedAt,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<int> get retryCount => $composableBuilder(
    column: $table.retryCount,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get error => $composableBuilder(
    column: $table.error,
    builder: (column) => ColumnOrderings(column),
  );
}

class $$SyncQueueEntriesTableAnnotationComposer
    extends Composer<_$AppDatabase, $SyncQueueEntriesTable> {
  $$SyncQueueEntriesTableAnnotationComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  GeneratedColumn<String> get id =>
      $composableBuilder(column: $table.id, builder: (column) => column);

  GeneratedColumn<String> get targetTable => $composableBuilder(
    column: $table.targetTable,
    builder: (column) => column,
  );

  GeneratedColumn<String> get recordId =>
      $composableBuilder(column: $table.recordId, builder: (column) => column);

  GeneratedColumn<String> get operation =>
      $composableBuilder(column: $table.operation, builder: (column) => column);

  GeneratedColumn<String> get payload =>
      $composableBuilder(column: $table.payload, builder: (column) => column);

  GeneratedColumn<DateTime> get localCreatedAt => $composableBuilder(
    column: $table.localCreatedAt,
    builder: (column) => column,
  );

  GeneratedColumn<DateTime> get syncedAt =>
      $composableBuilder(column: $table.syncedAt, builder: (column) => column);

  GeneratedColumn<int> get retryCount => $composableBuilder(
    column: $table.retryCount,
    builder: (column) => column,
  );

  GeneratedColumn<String> get error =>
      $composableBuilder(column: $table.error, builder: (column) => column);
}

class $$SyncQueueEntriesTableTableManager
    extends
        RootTableManager<
          _$AppDatabase,
          $SyncQueueEntriesTable,
          SyncQueueEntry,
          $$SyncQueueEntriesTableFilterComposer,
          $$SyncQueueEntriesTableOrderingComposer,
          $$SyncQueueEntriesTableAnnotationComposer,
          $$SyncQueueEntriesTableCreateCompanionBuilder,
          $$SyncQueueEntriesTableUpdateCompanionBuilder,
          (
            SyncQueueEntry,
            BaseReferences<
              _$AppDatabase,
              $SyncQueueEntriesTable,
              SyncQueueEntry
            >,
          ),
          SyncQueueEntry,
          PrefetchHooks Function()
        > {
  $$SyncQueueEntriesTableTableManager(
    _$AppDatabase db,
    $SyncQueueEntriesTable table,
  ) : super(
        TableManagerState(
          db: db,
          table: table,
          createFilteringComposer: () =>
              $$SyncQueueEntriesTableFilterComposer($db: db, $table: table),
          createOrderingComposer: () =>
              $$SyncQueueEntriesTableOrderingComposer($db: db, $table: table),
          createComputedFieldComposer: () =>
              $$SyncQueueEntriesTableAnnotationComposer($db: db, $table: table),
          updateCompanionCallback:
              ({
                Value<String> id = const Value.absent(),
                Value<String> targetTable = const Value.absent(),
                Value<String> recordId = const Value.absent(),
                Value<String> operation = const Value.absent(),
                Value<String> payload = const Value.absent(),
                Value<DateTime> localCreatedAt = const Value.absent(),
                Value<DateTime?> syncedAt = const Value.absent(),
                Value<int> retryCount = const Value.absent(),
                Value<String?> error = const Value.absent(),
                Value<int> rowid = const Value.absent(),
              }) => SyncQueueEntriesCompanion(
                id: id,
                targetTable: targetTable,
                recordId: recordId,
                operation: operation,
                payload: payload,
                localCreatedAt: localCreatedAt,
                syncedAt: syncedAt,
                retryCount: retryCount,
                error: error,
                rowid: rowid,
              ),
          createCompanionCallback:
              ({
                required String id,
                required String targetTable,
                required String recordId,
                required String operation,
                required String payload,
                required DateTime localCreatedAt,
                Value<DateTime?> syncedAt = const Value.absent(),
                Value<int> retryCount = const Value.absent(),
                Value<String?> error = const Value.absent(),
                Value<int> rowid = const Value.absent(),
              }) => SyncQueueEntriesCompanion.insert(
                id: id,
                targetTable: targetTable,
                recordId: recordId,
                operation: operation,
                payload: payload,
                localCreatedAt: localCreatedAt,
                syncedAt: syncedAt,
                retryCount: retryCount,
                error: error,
                rowid: rowid,
              ),
          withReferenceMapper: (p0) => p0
              .map((e) => (e.readTable(table), BaseReferences(db, table, e)))
              .toList(),
          prefetchHooksCallback: null,
        ),
      );
}

typedef $$SyncQueueEntriesTableProcessedTableManager =
    ProcessedTableManager<
      _$AppDatabase,
      $SyncQueueEntriesTable,
      SyncQueueEntry,
      $$SyncQueueEntriesTableFilterComposer,
      $$SyncQueueEntriesTableOrderingComposer,
      $$SyncQueueEntriesTableAnnotationComposer,
      $$SyncQueueEntriesTableCreateCompanionBuilder,
      $$SyncQueueEntriesTableUpdateCompanionBuilder,
      (
        SyncQueueEntry,
        BaseReferences<_$AppDatabase, $SyncQueueEntriesTable, SyncQueueEntry>,
      ),
      SyncQueueEntry,
      PrefetchHooks Function()
    >;
typedef $$ShiftSessionsTableCreateCompanionBuilder =
    ShiftSessionsCompanion Function({
      required String id,
      required String branchId,
      required String cashierName,
      required int openingCashMinor,
      Value<DateTime> openedAt,
      Value<DateTime?> closedAt,
      Value<bool> isActive,
      Value<int> rowid,
    });
typedef $$ShiftSessionsTableUpdateCompanionBuilder =
    ShiftSessionsCompanion Function({
      Value<String> id,
      Value<String> branchId,
      Value<String> cashierName,
      Value<int> openingCashMinor,
      Value<DateTime> openedAt,
      Value<DateTime?> closedAt,
      Value<bool> isActive,
      Value<int> rowid,
    });

class $$ShiftSessionsTableFilterComposer
    extends Composer<_$AppDatabase, $ShiftSessionsTable> {
  $$ShiftSessionsTableFilterComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnFilters<String> get id => $composableBuilder(
    column: $table.id,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get branchId => $composableBuilder(
    column: $table.branchId,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get cashierName => $composableBuilder(
    column: $table.cashierName,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<int> get openingCashMinor => $composableBuilder(
    column: $table.openingCashMinor,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<DateTime> get openedAt => $composableBuilder(
    column: $table.openedAt,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<DateTime> get closedAt => $composableBuilder(
    column: $table.closedAt,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<bool> get isActive => $composableBuilder(
    column: $table.isActive,
    builder: (column) => ColumnFilters(column),
  );
}

class $$ShiftSessionsTableOrderingComposer
    extends Composer<_$AppDatabase, $ShiftSessionsTable> {
  $$ShiftSessionsTableOrderingComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnOrderings<String> get id => $composableBuilder(
    column: $table.id,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get branchId => $composableBuilder(
    column: $table.branchId,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get cashierName => $composableBuilder(
    column: $table.cashierName,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<int> get openingCashMinor => $composableBuilder(
    column: $table.openingCashMinor,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<DateTime> get openedAt => $composableBuilder(
    column: $table.openedAt,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<DateTime> get closedAt => $composableBuilder(
    column: $table.closedAt,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<bool> get isActive => $composableBuilder(
    column: $table.isActive,
    builder: (column) => ColumnOrderings(column),
  );
}

class $$ShiftSessionsTableAnnotationComposer
    extends Composer<_$AppDatabase, $ShiftSessionsTable> {
  $$ShiftSessionsTableAnnotationComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  GeneratedColumn<String> get id =>
      $composableBuilder(column: $table.id, builder: (column) => column);

  GeneratedColumn<String> get branchId =>
      $composableBuilder(column: $table.branchId, builder: (column) => column);

  GeneratedColumn<String> get cashierName => $composableBuilder(
    column: $table.cashierName,
    builder: (column) => column,
  );

  GeneratedColumn<int> get openingCashMinor => $composableBuilder(
    column: $table.openingCashMinor,
    builder: (column) => column,
  );

  GeneratedColumn<DateTime> get openedAt =>
      $composableBuilder(column: $table.openedAt, builder: (column) => column);

  GeneratedColumn<DateTime> get closedAt =>
      $composableBuilder(column: $table.closedAt, builder: (column) => column);

  GeneratedColumn<bool> get isActive =>
      $composableBuilder(column: $table.isActive, builder: (column) => column);
}

class $$ShiftSessionsTableTableManager
    extends
        RootTableManager<
          _$AppDatabase,
          $ShiftSessionsTable,
          ShiftSession,
          $$ShiftSessionsTableFilterComposer,
          $$ShiftSessionsTableOrderingComposer,
          $$ShiftSessionsTableAnnotationComposer,
          $$ShiftSessionsTableCreateCompanionBuilder,
          $$ShiftSessionsTableUpdateCompanionBuilder,
          (
            ShiftSession,
            BaseReferences<_$AppDatabase, $ShiftSessionsTable, ShiftSession>,
          ),
          ShiftSession,
          PrefetchHooks Function()
        > {
  $$ShiftSessionsTableTableManager(_$AppDatabase db, $ShiftSessionsTable table)
    : super(
        TableManagerState(
          db: db,
          table: table,
          createFilteringComposer: () =>
              $$ShiftSessionsTableFilterComposer($db: db, $table: table),
          createOrderingComposer: () =>
              $$ShiftSessionsTableOrderingComposer($db: db, $table: table),
          createComputedFieldComposer: () =>
              $$ShiftSessionsTableAnnotationComposer($db: db, $table: table),
          updateCompanionCallback:
              ({
                Value<String> id = const Value.absent(),
                Value<String> branchId = const Value.absent(),
                Value<String> cashierName = const Value.absent(),
                Value<int> openingCashMinor = const Value.absent(),
                Value<DateTime> openedAt = const Value.absent(),
                Value<DateTime?> closedAt = const Value.absent(),
                Value<bool> isActive = const Value.absent(),
                Value<int> rowid = const Value.absent(),
              }) => ShiftSessionsCompanion(
                id: id,
                branchId: branchId,
                cashierName: cashierName,
                openingCashMinor: openingCashMinor,
                openedAt: openedAt,
                closedAt: closedAt,
                isActive: isActive,
                rowid: rowid,
              ),
          createCompanionCallback:
              ({
                required String id,
                required String branchId,
                required String cashierName,
                required int openingCashMinor,
                Value<DateTime> openedAt = const Value.absent(),
                Value<DateTime?> closedAt = const Value.absent(),
                Value<bool> isActive = const Value.absent(),
                Value<int> rowid = const Value.absent(),
              }) => ShiftSessionsCompanion.insert(
                id: id,
                branchId: branchId,
                cashierName: cashierName,
                openingCashMinor: openingCashMinor,
                openedAt: openedAt,
                closedAt: closedAt,
                isActive: isActive,
                rowid: rowid,
              ),
          withReferenceMapper: (p0) => p0
              .map((e) => (e.readTable(table), BaseReferences(db, table, e)))
              .toList(),
          prefetchHooksCallback: null,
        ),
      );
}

typedef $$ShiftSessionsTableProcessedTableManager =
    ProcessedTableManager<
      _$AppDatabase,
      $ShiftSessionsTable,
      ShiftSession,
      $$ShiftSessionsTableFilterComposer,
      $$ShiftSessionsTableOrderingComposer,
      $$ShiftSessionsTableAnnotationComposer,
      $$ShiftSessionsTableCreateCompanionBuilder,
      $$ShiftSessionsTableUpdateCompanionBuilder,
      (
        ShiftSession,
        BaseReferences<_$AppDatabase, $ShiftSessionsTable, ShiftSession>,
      ),
      ShiftSession,
      PrefetchHooks Function()
    >;

class $AppDatabaseManager {
  final _$AppDatabase _db;
  $AppDatabaseManager(this._db);
  $$CatalogCacheItemsTableTableManager get catalogCacheItems =>
      $$CatalogCacheItemsTableTableManager(_db, _db.catalogCacheItems);
  $$SyncQueueEntriesTableTableManager get syncQueueEntries =>
      $$SyncQueueEntriesTableTableManager(_db, _db.syncQueueEntries);
  $$ShiftSessionsTableTableManager get shiftSessions =>
      $$ShiftSessionsTableTableManager(_db, _db.shiftSessions);
}
