import 'dart:convert';
import 'dart:io';

import 'package:drift/drift.dart';
import 'package:drift/native.dart';
import 'package:path/path.dart' as p;
import 'package:path_provider/path_provider.dart';
import 'package:sqlite3_flutter_libs/sqlite3_flutter_libs.dart';
import 'package:uuid/uuid.dart';

part 'app_database.g.dart';

enum ShiftCashMovementType { paidIn, paidOut }

extension ShiftCashMovementTypeX on ShiftCashMovementType {
  String get dbValue => switch (this) {
    ShiftCashMovementType.paidIn => 'PAID_IN',
    ShiftCashMovementType.paidOut => 'PAID_OUT',
  };

  String get label => switch (this) {
    ShiftCashMovementType.paidIn => 'Paid In',
    ShiftCashMovementType.paidOut => 'Paid Out',
  };
}

ShiftCashMovementType shiftCashMovementTypeFromDb(String value) {
  return switch (value.trim().toUpperCase()) {
    'PAID_OUT' => ShiftCashMovementType.paidOut,
    _ => ShiftCashMovementType.paidIn,
  };
}

class ShiftCashMovementRecord {
  const ShiftCashMovementRecord({
    required this.id,
    required this.shiftId,
    required this.branchId,
    required this.terminalId,
    required this.terminalName,
    required this.cashierId,
    required this.cashierName,
    required this.type,
    required this.amountMinor,
    required this.note,
    required this.createdAt,
  });

  final String id;
  final String shiftId;
  final String branchId;
  final String terminalId;
  final String? terminalName;
  final String? cashierId;
  final String? cashierName;
  final ShiftCashMovementType type;
  final int amountMinor;
  final String? note;
  final DateTime createdAt;
}

class CatalogCacheItems extends Table {
  TextColumn get id => text()();
  TextColumn get branchId => text()();
  TextColumn get categoryName => text()();
  TextColumn get name => text()();
  TextColumn get sku => text()();
  TextColumn get barcode => text().nullable()();
  IntColumn get priceMinor => integer()();
  TextColumn get vatType => text()();
  TextColumn get unit => text()();
  BoolColumn get hasVariants => boolean().withDefault(const Constant(false))();
  DateTimeColumn get updatedAt => dateTime().withDefault(currentDateAndTime)();

  @override
  Set<Column> get primaryKey => {id};
}

class SyncQueueEntries extends Table {
  TextColumn get id => text()();
  TextColumn get targetTable => text().named('table_name')();
  TextColumn get recordId => text()();
  TextColumn get operation => text()();
  TextColumn get payload => text()();
  DateTimeColumn get localCreatedAt => dateTime()();
  DateTimeColumn get syncedAt => dateTime().nullable()();
  IntColumn get retryCount => integer().withDefault(const Constant(0))();
  TextColumn get error => text().nullable()();

  @override
  Set<Column> get primaryKey => {id};
}

class ShiftSessions extends Table {
  TextColumn get id => text()();
  TextColumn get branchId => text()();
  TextColumn get cashierName => text()();
  IntColumn get openingCashMinor => integer()();
  DateTimeColumn get openedAt => dateTime().withDefault(currentDateAndTime)();
  DateTimeColumn get closedAt => dateTime().nullable()();
  BoolColumn get isActive => boolean().withDefault(const Constant(true))();

  @override
  Set<Column> get primaryKey => {id};
}

@DriftDatabase(tables: [CatalogCacheItems, SyncQueueEntries, ShiftSessions])
class AppDatabase extends _$AppDatabase {
  AppDatabase() : super(_openConnection());

  final Uuid _uuid = const Uuid();

  @override
  int get schemaVersion => 2;

  @override
  MigrationStrategy get migration => MigrationStrategy(
    onCreate: (migrator) async {
      await migrator.createAll();
      await _createCashMovementEntriesTable();
    },
    onUpgrade: (migrator, from, to) async {
      if (from < 2) {
        await _createCashMovementEntriesTable();
      }
    },
  );

  Future<void> seedCatalogIfEmpty() async {
    final itemCountExpression = catalogCacheItems.id.count();
    final countQuery = selectOnly(catalogCacheItems)
      ..addColumns([itemCountExpression]);
    final existingCount = await countQuery
        .map((row) => row.read(itemCountExpression) ?? 0)
        .getSingle();
    if (existingCount > 0) {
      return;
    }

    final now = DateTime.now();
    await batch((batch) {
      batch.insertAll(catalogCacheItems, [
        CatalogCacheItemsCompanion.insert(
          id: 'item-americano',
          branchId: 'branch-manila',
          categoryName: 'Coffee',
          name: 'Iced Americano',
          sku: 'COF-AMER-12',
          barcode: const Value('480100100001'),
          priceMinor: 13500,
          vatType: 'VATABLE',
          unit: 'cup',
          hasVariants: const Value(true),
          updatedAt: Value(now),
        ),
        CatalogCacheItemsCompanion.insert(
          id: 'item-latte',
          branchId: 'branch-manila',
          categoryName: 'Coffee',
          name: 'Cafe Latte',
          sku: 'COF-LATT-12',
          barcode: const Value('480100100002'),
          priceMinor: 16500,
          vatType: 'VATABLE',
          unit: 'cup',
          hasVariants: const Value(true),
          updatedAt: Value(now),
        ),
        CatalogCacheItemsCompanion.insert(
          id: 'item-pasta',
          branchId: 'branch-manila',
          categoryName: 'Meals',
          name: 'Creamy Pesto Pasta',
          sku: 'MEAL-PST-01',
          barcode: const Value('480100100101'),
          priceMinor: 31000,
          vatType: 'VATABLE',
          unit: 'plate',
          updatedAt: Value(now),
        ),
        CatalogCacheItemsCompanion.insert(
          id: 'item-croissant',
          branchId: 'branch-cebu',
          categoryName: 'Bakery',
          name: 'Butter Croissant',
          sku: 'BAK-CRO-01',
          barcode: const Value('480100100201'),
          priceMinor: 9500,
          vatType: 'VATABLE',
          unit: 'piece',
          updatedAt: Value(now),
        ),
      ]);
    });
  }

  Future<void> replaceCatalogItems({
    required String branchId,
    required Iterable<CatalogCacheItemsCompanion> items,
  }) async {
    final nextItems = items.toList(growable: false);

    await transaction(() async {
      await (delete(
        catalogCacheItems,
      )..where((table) => table.branchId.equals(branchId))).go();

      if (nextItems.isEmpty) {
        return;
      }

      await batch((batch) {
        batch.insertAll(
          catalogCacheItems,
          nextItems,
          mode: InsertMode.insertOrReplace,
        );
      });
    });
  }

  Future<CatalogCacheItem> saveCatalogItem({
    String? id,
    required String branchId,
    required String categoryName,
    required String name,
    required String sku,
    String? barcode,
    required int priceMinor,
    required String vatType,
    required String unit,
    bool hasVariants = false,
  }) async {
    final itemId = (id ?? '').trim().isEmpty ? _uuid.v4() : id!.trim();
    final normalizedCategory = categoryName.trim();
    final normalizedName = name.trim();
    final normalizedSku = sku.trim();
    final normalizedBarcode = barcode?.trim();
    final updatedAt = DateTime.now();

    await into(catalogCacheItems).insertOnConflictUpdate(
      CatalogCacheItemsCompanion(
        id: Value(itemId),
        branchId: Value(branchId),
        categoryName: Value(normalizedCategory),
        name: Value(normalizedName),
        sku: Value(normalizedSku),
        barcode: Value(
          (normalizedBarcode ?? '').isEmpty ? null : normalizedBarcode,
        ),
        priceMinor: Value(priceMinor),
        vatType: Value(vatType.trim()),
        unit: Value(unit.trim()),
        hasVariants: Value(hasVariants),
        updatedAt: Value(updatedAt),
      ),
    );

    return (select(catalogCacheItems)
          ..where((table) => table.id.equals(itemId)))
        .getSingle();
  }

  Stream<List<CatalogCacheItem>> watchCatalogItems() {
    final query = select(catalogCacheItems)
      ..orderBy([
        (table) => OrderingTerm.asc(table.categoryName),
        (table) => OrderingTerm.asc(table.name),
      ]);
    return query.watch();
  }

  Future<List<CatalogCacheItem>> listCatalogItemsPage({
    required String branchId,
    required int limit,
    required int offset,
    String? categoryName,
    String search = '',
  }) async {
    final normalizedCategory = (categoryName ?? '').trim();
    final normalizedSearch = search.trim().toLowerCase();
    final wildcardSearch = '%$normalizedSearch%';

    final rows = await customSelect(
      '''
      SELECT *
      FROM catalog_cache_items
      WHERE branch_id = ?
        AND (? = '' OR category_name = ?)
        AND (
          ? = ''
          OR lower(name) LIKE ?
          OR lower(sku) LIKE ?
          OR lower(coalesce(barcode, '')) LIKE ?
        )
      ORDER BY category_name ASC, name ASC
      LIMIT ? OFFSET ?
      ''',
      variables: [
        Variable.withString(branchId),
        Variable.withString(normalizedCategory),
        Variable.withString(normalizedCategory),
        Variable.withString(normalizedSearch),
        Variable.withString(wildcardSearch),
        Variable.withString(wildcardSearch),
        Variable.withString(wildcardSearch),
        Variable.withInt(limit),
        Variable.withInt(offset),
      ],
      readsFrom: {catalogCacheItems},
    ).get();

    return rows
        .map((row) => catalogCacheItems.map(row.data))
        .toList(growable: false);
  }

  Future<int> countCatalogItems({
    required String branchId,
    String? categoryName,
    String search = '',
  }) async {
    final normalizedCategory = (categoryName ?? '').trim();
    final normalizedSearch = search.trim().toLowerCase();
    final wildcardSearch = '%$normalizedSearch%';
    final row = await customSelect(
      '''
      SELECT COUNT(*) AS total
      FROM catalog_cache_items
      WHERE branch_id = ?
        AND (? = '' OR category_name = ?)
        AND (
          ? = ''
          OR lower(name) LIKE ?
          OR lower(sku) LIKE ?
          OR lower(coalesce(barcode, '')) LIKE ?
        )
      ''',
      variables: [
        Variable.withString(branchId),
        Variable.withString(normalizedCategory),
        Variable.withString(normalizedCategory),
        Variable.withString(normalizedSearch),
        Variable.withString(wildcardSearch),
        Variable.withString(wildcardSearch),
        Variable.withString(wildcardSearch),
      ],
      readsFrom: {catalogCacheItems},
    ).getSingle();

    return row.read<int>('total');
  }

  Future<List<String>> listCatalogCategories({required String branchId}) async {
    final rows = await customSelect(
      '''
      SELECT DISTINCT category_name
      FROM catalog_cache_items
      WHERE branch_id = ?
      ORDER BY category_name ASC
      ''',
      variables: [Variable.withString(branchId)],
      readsFrom: {catalogCacheItems},
    ).get();

    return rows
        .map((row) => row.read<String>('category_name'))
        .map((category) => category.isEmpty ? 'Uncategorized' : category)
        .toList(growable: false);
  }

  Future<CatalogCacheItem?> findCatalogItemByCode({
    required String branchId,
    required String code,
  }) async {
    final normalizedCode = code.trim().toLowerCase();
    if (normalizedCode.isEmpty) {
      return null;
    }

    final rows = await customSelect(
      '''
      SELECT *
      FROM catalog_cache_items
      WHERE branch_id = ?
        AND (
          lower(coalesce(barcode, '')) = ?
          OR lower(sku) = ?
        )
      ORDER BY
        CASE
          WHEN lower(coalesce(barcode, '')) = ? THEN 0
          ELSE 1
        END ASC,
        name ASC
      LIMIT 1
      ''',
      variables: [
        Variable.withString(branchId),
        Variable.withString(normalizedCode),
        Variable.withString(normalizedCode),
        Variable.withString(normalizedCode),
      ],
      readsFrom: {catalogCacheItems},
    ).get();

    if (rows.isEmpty) {
      return null;
    }

    return catalogCacheItems.map(rows.first.data);
  }

  Stream<int> watchPendingSyncCount() {
    final pendingCountExpression = syncQueueEntries.id.count();
    final query = selectOnly(syncQueueEntries)
      ..addColumns([pendingCountExpression])
      ..where(syncQueueEntries.syncedAt.isNull());
    return query.watchSingle().map(
      (row) => row.read(pendingCountExpression) ?? 0,
    );
  }

  Stream<List<SyncQueueEntry>> watchRecentSyncQueueEntries({int limit = 120}) {
    final query = select(syncQueueEntries)
      ..orderBy([(table) => OrderingTerm.desc(table.localCreatedAt)])
      ..limit(limit);
    return query.watch();
  }

  Future<List<SyncQueueEntry>> listShiftTransactionQueueEntries() {
    return (select(syncQueueEntries)
          ..where((table) => table.targetTable.equals('transactions'))
          ..orderBy([(table) => OrderingTerm.asc(table.localCreatedAt)]))
        .get();
  }

  Future<List<SyncQueueEntry>> listTransactionQueueEntries({int limit = 40}) {
    return (select(syncQueueEntries)
          ..where((table) => table.targetTable.equals('transactions'))
          ..orderBy([(table) => OrderingTerm.desc(table.localCreatedAt)])
          ..limit(limit))
        .get();
  }

  Future<ShiftSession?> findShiftSessionById({required String shiftId}) {
    return (select(
      shiftSessions,
    )..where((table) => table.id.equals(shiftId))).getSingleOrNull();
  }

  Future<int> resolveShiftSessionOrdinal({required String shiftId}) async {
    final row = await customSelect(
      '''
      SELECT COUNT(*) AS total
      FROM shift_sessions
      WHERE opened_at <= (
        SELECT opened_at
        FROM shift_sessions
        WHERE id = ?
      )
      ''',
      variables: [Variable.withString(shiftId)],
      readsFrom: {shiftSessions},
    ).getSingleOrNull();

    return row?.read<int>('total') ?? 0;
  }

  Future<String> addShiftCashMovement({
    required String shiftId,
    required String branchId,
    required String terminalId,
    String? terminalName,
    String? cashierId,
    String? cashierName,
    required ShiftCashMovementType type,
    required int amountMinor,
    String? note,
  }) async {
    final id = _uuid.v4();
    final createdAt = DateTime.now().toUtc();
    final trimmedNote = note?.trim();

    await transaction(() async {
      await customInsert(
        '''
        INSERT INTO cash_movement_entries (
          id,
          shift_id,
          branch_id,
          terminal_id,
          terminal_name,
          cashier_id,
          cashier_name,
          movement_type,
          amount_minor,
          note,
          created_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''',
        variables: [
          Variable.withString(id),
          Variable.withString(shiftId),
          Variable.withString(branchId),
          Variable.withString(terminalId),
          Variable.withString(terminalName ?? ''),
          Variable.withString(cashierId ?? ''),
          Variable.withString(cashierName ?? ''),
          Variable.withString(type.dbValue),
          Variable.withInt(amountMinor),
          Variable.withString(trimmedNote ?? ''),
          Variable.withString(createdAt.toIso8601String()),
        ],
        updates: const {},
      );

      await enqueueTransaction(
        tableName: 'cash_movements',
        recordId: id,
        operation: 'INSERT',
        payload: {
          'id': id,
          'shift_id': shiftId,
          'branch_id': branchId,
          'terminal_id': terminalId,
          'terminal_name': terminalName,
          'cashier_id': cashierId,
          'cashier_name': cashierName,
          'movement_type': type.dbValue,
          'amount_minor': amountMinor,
          'note': trimmedNote,
          'created_at': createdAt.toIso8601String(),
        },
      );
    });

    return id;
  }

  Future<List<ShiftCashMovementRecord>> listShiftCashMovements({
    required String shiftId,
    int? limit,
  }) async {
    final rows = await customSelect(
      '''
      SELECT *
      FROM cash_movement_entries
      WHERE shift_id = ?
      ORDER BY created_at DESC
      ${limit != null ? 'LIMIT ?' : ''}
      ''',
      variables: [
        Variable.withString(shiftId),
        if (limit != null) Variable.withInt(limit),
      ],
      readsFrom: const {},
    ).get();

    return rows.map(_mapShiftCashMovementRecord).toList(growable: false);
  }

  Future<String> openShiftSession({
    required String branchId,
    required String cashierName,
    required int openingCashMinor,
  }) async {
    final id = _uuid.v4();
    await into(shiftSessions).insert(
      ShiftSessionsCompanion.insert(
        id: id,
        branchId: branchId,
        cashierName: cashierName,
        openingCashMinor: openingCashMinor,
      ),
    );
    return id;
  }

  Future<DateTime> closeShiftSession({required String shiftId}) async {
    final closedAt = DateTime.now();
    await (update(
      shiftSessions,
    )..where((table) => table.id.equals(shiftId))).write(
      ShiftSessionsCompanion(
        closedAt: Value(closedAt),
        isActive: const Value(false),
      ),
    );
    return closedAt;
  }

  Future<void> enqueueTransaction({
    required String tableName,
    required String recordId,
    required String operation,
    required Map<String, Object?> payload,
  }) async {
    await into(syncQueueEntries).insert(
      SyncQueueEntriesCompanion.insert(
        id: _uuid.v4(),
        targetTable: tableName,
        recordId: recordId,
        operation: operation,
        payload: jsonEncode(payload),
        localCreatedAt: DateTime.now(),
      ),
    );
  }

  Future<List<SyncQueueEntry>> pendingEntries() {
    return (select(syncQueueEntries)
          ..where((table) => table.syncedAt.isNull())
          ..orderBy([(table) => OrderingTerm.asc(table.localCreatedAt)]))
        .get();
  }

  Future<void> markEntriesSynced(Iterable<String> ids) async {
    final entries = ids.toList();
    if (entries.isEmpty) {
      return;
    }

    await (update(
      syncQueueEntries,
    )..where((table) => table.id.isIn(entries))).write(
      SyncQueueEntriesCompanion(
        syncedAt: Value(DateTime.now()),
        retryCount: const Value(0),
        error: const Value(null),
      ),
    );
  }

  Future<void> markEntriesFailed(Map<String, String> failures) async {
    for (final failure in failures.entries) {
      await customUpdate(
        '''
        UPDATE sync_queue_entries
        SET retry_count = retry_count + 1,
            error = ?
        WHERE id = ?
        ''',
        variables: [
          Variable.withString(failure.value),
          Variable.withString(failure.key),
        ],
        updates: {syncQueueEntries},
      );
    }
  }

  Future<void> _createCashMovementEntriesTable() async {
    await customStatement(
      '''
      CREATE TABLE IF NOT EXISTS cash_movement_entries (
        id TEXT NOT NULL PRIMARY KEY,
        shift_id TEXT NOT NULL,
        branch_id TEXT NOT NULL,
        terminal_id TEXT NOT NULL,
        terminal_name TEXT NOT NULL DEFAULT '',
        cashier_id TEXT NOT NULL DEFAULT '',
        cashier_name TEXT NOT NULL DEFAULT '',
        movement_type TEXT NOT NULL,
        amount_minor INTEGER NOT NULL,
        note TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL
      )
      ''',
    );
    await customStatement(
      '''
      CREATE INDEX IF NOT EXISTS idx_cash_movement_entries_shift_created
      ON cash_movement_entries (shift_id, created_at DESC)
      ''',
    );
  }

  ShiftCashMovementRecord _mapShiftCashMovementRecord(QueryRow row) {
    final terminalName = row.read<String>('terminal_name');
    final cashierId = row.read<String>('cashier_id');
    final cashierName = row.read<String>('cashier_name');
    final note = row.read<String>('note');

    return ShiftCashMovementRecord(
      id: row.read<String>('id'),
      shiftId: row.read<String>('shift_id'),
      branchId: row.read<String>('branch_id'),
      terminalId: row.read<String>('terminal_id'),
      terminalName: terminalName.isEmpty ? null : terminalName,
      cashierId: cashierId.isEmpty ? null : cashierId,
      cashierName: cashierName.isEmpty ? null : cashierName,
      type: shiftCashMovementTypeFromDb(row.read<String>('movement_type')),
      amountMinor: row.read<int>('amount_minor'),
      note: note.isEmpty ? null : note,
      createdAt:
          DateTime.tryParse(row.read<String>('created_at'))?.toLocal() ??
          DateTime.now(),
    );
  }
}

LazyDatabase _openConnection() {
  return LazyDatabase(() async {
    if (Platform.isAndroid) {
      await applyWorkaroundToOpenSqlite3OnOldAndroidVersions();
    }
    final directory = await getApplicationDocumentsDirectory();
    final file = File(p.join(directory.path, 'apex_pos.sqlite'));
    return NativeDatabase(file);
  });
}
