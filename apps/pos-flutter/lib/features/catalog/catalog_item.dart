class CatalogItemModel {
  const CatalogItemModel({
    required this.id,
    required this.branchId,
    required this.categoryName,
    required this.name,
    required this.sku,
    required this.barcode,
    required this.priceMinor,
    required this.vatType,
    required this.unit,
    required this.hasVariants,
  });

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
}
