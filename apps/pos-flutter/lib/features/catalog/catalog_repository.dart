import '../../core/database/app_database.dart';
import 'catalog_item.dart';

class CatalogRepository {
  const CatalogRepository(this.database);

  final AppDatabase database;

  Future<void> seedInitialData() {
    return database.seedCatalogIfEmpty();
  }

  Stream<List<CatalogItemModel>> watchItems() {
    return database.watchCatalogItems().map(
      (rows) => rows.map(_toModel).toList(growable: false),
    );
  }

  Future<List<CatalogItemModel>> fetchItemsPage({
    required String branchId,
    required int limit,
    required int offset,
    String? categoryName,
    String search = '',
  }) async {
    final rows = await database.listCatalogItemsPage(
      branchId: branchId,
      categoryName: categoryName,
      search: search,
      limit: limit,
      offset: offset,
    );
    return rows.map(_toModel).toList(growable: false);
  }

  Future<int> countItems({
    required String branchId,
    String? categoryName,
    String search = '',
  }) {
    return database.countCatalogItems(
      branchId: branchId,
      categoryName: categoryName,
      search: search,
    );
  }

  Future<List<String>> fetchCategories({required String branchId}) {
    return database.listCatalogCategories(branchId: branchId);
  }

  Future<CatalogItemModel?> findItemByScanCode({
    required String branchId,
    required String code,
  }) async {
    final row = await database.findCatalogItemByCode(
      branchId: branchId,
      code: code,
    );
    if (row == null) {
      return null;
    }
    return _toModel(row);
  }

  Future<CatalogItemModel> saveLocalItem({
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
    final row = await database.saveCatalogItem(
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
    );
    return _toModel(row);
  }

  CatalogItemModel _toModel(CatalogCacheItem row) {
    return CatalogItemModel(
      id: row.id,
      branchId: row.branchId,
      categoryName: row.categoryName,
      name: row.name,
      sku: row.sku,
      barcode: row.barcode,
      priceMinor: row.priceMinor,
      vatType: row.vatType,
      unit: row.unit,
      hasVariants: row.hasVariants,
    );
  }
}
