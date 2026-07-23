import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/models/money.dart';
import '../../core/providers/app_providers.dart';
import '../../core/services/back_office_client.dart';
import '../catalog/catalog_item.dart';

const _itemsHeaderStart = Color(0xFF0C1E36);
const _itemsHeaderEnd = Color(0xFF163055);
const _itemsAccent = Color(0xFF2F88FF);
const _itemsAccentSoft = Color(0xFFE8F1FF);
const _itemsAccentBorder = Color(0xFFBFD5FF);
const _itemsNavBg = Color(0xFF132742);
const _itemsNavDivider = Color(0xFF274261);
const _itemsBg = Color(0xFFF3F7FD);
const _itemsSurface = Color(0xFFFFFFFF);
const _itemsSurfaceSoft = Color(0xFFF6F9FF);
const _itemsBorder = Color(0xFFDCE5F1);
const _itemsText = Color(0xFF1A2E4A);
const _itemsMuted = Color(0xFF4E688A);
const _itemsNavText = Color(0xFFEAF2FF);
const _itemsNavMuted = Color(0xFF9FB4D1);
const _allItemsLabel = 'All items';
const _noCategoryLabel = 'No category';

enum _ItemsSection { items, categories, modifiers, discounts }

class ItemsWorkspaceScreen extends ConsumerStatefulWidget {
  const ItemsWorkspaceScreen({super.key, required this.branchId});

  final String branchId;

  @override
  ConsumerState<ItemsWorkspaceScreen> createState() =>
      _ItemsWorkspaceScreenState();
}

class _ItemsWorkspaceScreenState extends ConsumerState<ItemsWorkspaceScreen> {
  _ItemsSection _section = _ItemsSection.items;
  String _query = '';
  String _selectedCategory = _allItemsLabel;

  @override
  Widget build(BuildContext context) {
    final itemsAsync = ref.watch(catalogItemsProvider);

    return Scaffold(
      backgroundColor: _itemsBg,
      resizeToAvoidBottomInset: false,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        foregroundColor: Colors.white,
        elevation: 0,
        flexibleSpace: const DecoratedBox(
          decoration: BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: [_itemsHeaderStart, _itemsHeaderEnd],
            ),
          ),
        ),
        title: Text(_titleForSection(_section)),
      ),
      floatingActionButton: _section == _ItemsSection.items
          ? FloatingActionButton(
              backgroundColor: _itemsAccent,
              foregroundColor: Colors.white,
              onPressed: _openCreateItem,
              child: const Icon(Icons.add_rounded),
            )
          : null,
      body: itemsAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (error, _) => Center(child: Text(error.toString())),
        data: (items) {
          final branchItems = items
              .where((item) => item.branchId == widget.branchId)
              .toList(growable: false);
          final categories = <String>{
            _allItemsLabel,
            ...branchItems.map((item) => _categoryLabel(item.categoryName)),
          }.toList()..sort();
          categories
            ..remove(_allItemsLabel)
            ..insert(0, _allItemsLabel);

          final filteredItems =
              branchItems
                  .where((item) {
                    final matchesCategory =
                        _selectedCategory == _allItemsLabel ||
                        _categoryLabel(item.categoryName) == _selectedCategory;
                    if (!matchesCategory) {
                      return false;
                    }
                    final query = _query.trim().toLowerCase();
                    if (query.isEmpty) {
                      return true;
                    }
                    final haystack = <String>[
                      item.name,
                      item.sku,
                      item.barcode ?? '',
                      _categoryLabel(item.categoryName),
                    ].join(' ').toLowerCase();
                    return haystack.contains(query);
                  })
                  .toList(growable: false)
                ..sort((left, right) => left.name.compareTo(right.name));

          return LayoutBuilder(
            builder: (context, constraints) {
              final wide = constraints.maxWidth >= 960;
              return Row(
                children: [
                  Container(
                    width: wide ? 280 : 92,
                    decoration: const BoxDecoration(
                      gradient: LinearGradient(
                        begin: Alignment.topCenter,
                        end: Alignment.bottomCenter,
                        colors: [_itemsNavBg, _itemsHeaderStart],
                      ),
                      border: Border(
                        right: BorderSide(color: _itemsNavDivider),
                      ),
                    ),
                    child: _ItemsNav(
                      compact: !wide,
                      selected: _section,
                      onSelected: (section) {
                        setState(() => _section = section);
                      },
                    ),
                  ),
                  Expanded(
                    child: Padding(
                      padding: const EdgeInsets.all(20),
                      child: switch (_section) {
                        _ItemsSection.items => _ItemsListSection(
                          categories: categories,
                          selectedCategory: _selectedCategory,
                          query: _query,
                          items: filteredItems,
                          onCategoryChanged: (value) {
                            setState(() => _selectedCategory = value);
                          },
                          onQueryChanged: (value) {
                            setState(() => _query = value);
                          },
                          onItemTap: _openEditItem,
                        ),
                        _ItemsSection.categories => _CategorySection(
                          items: branchItems,
                          onOpenCategory: (category) {
                            setState(() {
                              _selectedCategory = category;
                              _section = _ItemsSection.items;
                            });
                          },
                        ),
                        _ItemsSection.modifiers => const _InfoPane(
                          title: 'Modifiers',
                          body:
                              'Modifier management can live here once the mobile catalog sync includes modifier groups.',
                        ),
                        _ItemsSection.discounts => const _InfoPane(
                          title: 'Discounts',
                          body:
                              'Cashier discounts are already handled from the Sales cart. This full page section is ready for catalog-level discount rules next.',
                        ),
                      },
                    ),
                  ),
                ],
              );
            },
          );
        },
      ),
    );
  }

  Future<void> _openCreateItem() async {
    final items = ref.read(catalogItemsProvider).value ?? const [];
    final branchItems = items
        .where((item) => item.branchId == widget.branchId)
        .toList(growable: false);
    final categories =
        branchItems
            .map((item) => _categoryLabel(item.categoryName))
            .toSet()
            .toList(growable: false)
          ..sort();
    final saved = await Navigator.of(context).push<CatalogItemModel>(
      MaterialPageRoute(
        builder: (context) => ItemEditorScreen(
          branchId: widget.branchId,
          categories: categories,
          suggestedSku: '${10001 + branchItems.length}',
        ),
      ),
    );
    if (!mounted || saved == null) {
      return;
    }
    ScaffoldMessenger.of(
      context,
    ).showSnackBar(SnackBar(content: Text('${saved.name} saved and synced.')));
  }

  Future<void> _openEditItem(CatalogItemModel item) async {
    final items = ref.read(catalogItemsProvider).value ?? const [];
    final categories =
        items
            .where((entry) => entry.branchId == widget.branchId)
            .map((entry) => _categoryLabel(entry.categoryName))
            .toSet()
            .toList(growable: false)
          ..sort();
    final saved = await Navigator.of(context).push<CatalogItemModel>(
      MaterialPageRoute(
        builder: (context) => ItemEditorScreen(
          branchId: widget.branchId,
          existingItem: item,
          categories: categories,
          suggestedSku: item.sku,
        ),
      ),
    );
    if (!mounted || saved == null) {
      return;
    }
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text('${saved.name} updated and synced.')),
    );
  }
}

class _ItemsNav extends StatelessWidget {
  const _ItemsNav({
    required this.compact,
    required this.selected,
    required this.onSelected,
  });

  final bool compact;
  final _ItemsSection selected;
  final ValueChanged<_ItemsSection> onSelected;

  @override
  Widget build(BuildContext context) {
    final items = <(_ItemsSection, IconData, String)>[
      (_ItemsSection.items, Icons.view_list_outlined, 'Items'),
      (_ItemsSection.categories, Icons.category_outlined, 'Categories'),
      (_ItemsSection.modifiers, Icons.tune_outlined, 'Modifiers'),
      (_ItemsSection.discounts, Icons.sell_outlined, 'Discounts'),
    ];
    return ListView(
      padding: const EdgeInsets.symmetric(vertical: 14),
      children: items
          .map((entry) {
            final active = selected == entry.$1;
            return Padding(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
              child: ListTile(
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(16),
                  side: BorderSide(
                    color: active ? _itemsAccentBorder : Colors.transparent,
                  ),
                ),
                tileColor: active
                    ? _itemsAccentSoft.withValues(alpha: 0.12)
                    : null,
                iconColor: active ? _itemsAccent : _itemsNavMuted,
                textColor: active ? _itemsNavText : _itemsNavMuted,
                leading: Icon(entry.$2),
                title: compact
                    ? null
                    : Text(
                        entry.$3,
                        style: TextStyle(
                          color: active ? _itemsNavText : _itemsNavMuted,
                          fontWeight: active
                              ? FontWeight.w700
                              : FontWeight.w500,
                        ),
                      ),
                onTap: () => onSelected(entry.$1),
              ),
            );
          })
          .toList(growable: false),
    );
  }
}

class _ItemsListSection extends StatelessWidget {
  const _ItemsListSection({
    required this.categories,
    required this.selectedCategory,
    required this.query,
    required this.items,
    required this.onCategoryChanged,
    required this.onQueryChanged,
    required this.onItemTap,
  });

  final List<String> categories;
  final String selectedCategory;
  final String query;
  final List<CatalogItemModel> items;
  final ValueChanged<String> onCategoryChanged;
  final ValueChanged<String> onQueryChanged;
  final ValueChanged<CatalogItemModel> onItemTap;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Wrap(
          spacing: 12,
          runSpacing: 12,
          children: [
            SizedBox(
              width: 260,
              child: DropdownButtonFormField<String>(
                initialValue: categories.contains(selectedCategory)
                    ? selectedCategory
                    : _allItemsLabel,
                decoration: const InputDecoration(
                  labelText: 'Category',
                  filled: true,
                  fillColor: _itemsSurfaceSoft,
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.all(Radius.circular(16)),
                    borderSide: BorderSide(color: _itemsBorder),
                  ),
                  enabledBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.all(Radius.circular(16)),
                    borderSide: BorderSide(color: _itemsBorder),
                  ),
                  focusedBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.all(Radius.circular(16)),
                    borderSide: BorderSide(color: _itemsAccent),
                  ),
                ),
                items: categories
                    .map(
                      (category) => DropdownMenuItem<String>(
                        value: category,
                        child: Text(category),
                      ),
                    )
                    .toList(growable: false),
                onChanged: (value) {
                  if (value != null) {
                    onCategoryChanged(value);
                  }
                },
              ),
            ),
            SizedBox(
              width: 340,
              child: TextField(
                onChanged: onQueryChanged,
                decoration: const InputDecoration(
                  labelText: 'Search',
                  prefixIcon: Icon(Icons.search_rounded, color: _itemsMuted),
                  filled: true,
                  fillColor: _itemsSurfaceSoft,
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.all(Radius.circular(16)),
                    borderSide: BorderSide(color: _itemsBorder),
                  ),
                  enabledBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.all(Radius.circular(16)),
                    borderSide: BorderSide(color: _itemsBorder),
                  ),
                  focusedBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.all(Radius.circular(16)),
                    borderSide: BorderSide(color: _itemsAccent),
                  ),
                ),
              ),
            ),
          ],
        ),
        const SizedBox(height: 18),
        Expanded(
          child: Container(
            decoration: BoxDecoration(
              color: _itemsSurface,
              borderRadius: BorderRadius.circular(24),
              border: Border.all(color: _itemsBorder),
              boxShadow: const [
                BoxShadow(
                  color: Color(0x120A1D34),
                  blurRadius: 20,
                  offset: Offset(0, 8),
                ),
              ],
            ),
            child: items.isEmpty
                ? const Center(child: Text('No items matched this filter.'))
                : ListView.separated(
                    itemCount: items.length,
                    separatorBuilder: (context, index) =>
                        const Divider(height: 1),
                    itemBuilder: (context, index) {
                      final item = items[index];
                      return ListTile(
                        contentPadding: const EdgeInsets.symmetric(
                          horizontal: 20,
                          vertical: 10,
                        ),
                        leading: CircleAvatar(
                          backgroundColor: _accentForItem(
                            item.name,
                          ).withValues(alpha: 0.14),
                          foregroundColor: _accentForItem(item.name),
                          child: const Icon(Icons.inventory_2_outlined),
                        ),
                        title: Text(
                          item.name,
                          style: const TextStyle(
                            color: _itemsText,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                        subtitle: Text(
                          '${_categoryLabel(item.categoryName)} | SKU ${item.sku}',
                        ),
                        trailing: Text(
                          formatMoney(item.priceMinor),
                          style: const TextStyle(
                            color: _itemsText,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                        onTap: () => onItemTap(item),
                      );
                    },
                  ),
          ),
        ),
      ],
    );
  }
}

class _CategorySection extends StatelessWidget {
  const _CategorySection({required this.items, required this.onOpenCategory});

  final List<CatalogItemModel> items;
  final ValueChanged<String> onOpenCategory;

  @override
  Widget build(BuildContext context) {
    final counts = <String, int>{};
    for (final item in items) {
      final category = _categoryLabel(item.categoryName);
      counts[category] = (counts[category] ?? 0) + 1;
    }
    final categories = counts.keys.toList(growable: false)..sort();
    return Container(
      decoration: BoxDecoration(
        color: _itemsSurface,
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: _itemsBorder),
        boxShadow: const [
          BoxShadow(
            color: Color(0x120A1D34),
            blurRadius: 20,
            offset: Offset(0, 8),
          ),
        ],
      ),
      child: categories.isEmpty
          ? const Center(child: Text('No categories are available yet.'))
          : ListView.separated(
              itemCount: categories.length,
              separatorBuilder: (context, index) => const Divider(height: 1),
              itemBuilder: (context, index) {
                final category = categories[index];
                return ListTile(
                  leading: const Icon(
                    Icons.category_outlined,
                    color: _itemsAccent,
                  ),
                  title: Text(category),
                  trailing: Text('${counts[category]} items'),
                  onTap: () => onOpenCategory(category),
                );
              },
            ),
    );
  }
}

class _InfoPane extends StatelessWidget {
  const _InfoPane({required this.title, required this.body});

  final String title;
  final String body;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Container(
        constraints: const BoxConstraints(maxWidth: 720),
        padding: const EdgeInsets.all(28),
        decoration: BoxDecoration(
          color: _itemsSurface,
          borderRadius: BorderRadius.circular(24),
          border: Border.all(color: _itemsBorder),
          boxShadow: const [
            BoxShadow(
              color: Color(0x120A1D34),
              blurRadius: 20,
              offset: Offset(0, 8),
            ),
          ],
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              title,
              style: const TextStyle(
                fontSize: 24,
                fontWeight: FontWeight.w700,
                color: _itemsText,
              ),
            ),
            const SizedBox(height: 12),
            Text(
              body,
              style: const TextStyle(color: _itemsMuted, height: 1.5),
              textAlign: TextAlign.center,
            ),
          ],
        ),
      ),
    );
  }
}

class ItemEditorScreen extends ConsumerStatefulWidget {
  const ItemEditorScreen({
    super.key,
    required this.branchId,
    required this.categories,
    required this.suggestedSku,
    this.existingItem,
  });

  final String branchId;
  final List<String> categories;
  final String suggestedSku;
  final CatalogItemModel? existingItem;

  @override
  ConsumerState<ItemEditorScreen> createState() => _ItemEditorScreenState();
}

class _ItemEditorScreenState extends ConsumerState<ItemEditorScreen> {
  final _formKey = GlobalKey<FormState>();
  late final TextEditingController _nameController;
  late final TextEditingController _priceController;
  late final TextEditingController _skuController;
  late final TextEditingController _barcodeController;
  late String _category;
  late bool _trackStock;
  bool _saving = false;

  @override
  void initState() {
    super.initState();
    final item = widget.existingItem;
    _nameController = TextEditingController(text: item?.name ?? '');
    _priceController = TextEditingController(
      text: item == null ? '' : (item.priceMinor / 100).toStringAsFixed(2),
    );
    _skuController = TextEditingController(
      text: item?.sku ?? widget.suggestedSku,
    );
    _barcodeController = TextEditingController(text: item?.barcode ?? '');
    _category = item == null
        ? _noCategoryLabel
        : _categoryLabel(item.categoryName);
    _trackStock = false;
  }

  @override
  void dispose() {
    _nameController.dispose();
    _priceController.dispose();
    _skuController.dispose();
    _barcodeController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final categories = <String>{_noCategoryLabel, ...widget.categories}.toList()
      ..sort();
    final keyboardInset = MediaQuery.of(context).viewInsets.bottom;
    categories
      ..remove(_noCategoryLabel)
      ..insert(0, _noCategoryLabel);

    return Scaffold(
      backgroundColor: _itemsBg,
      resizeToAvoidBottomInset: false,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        foregroundColor: Colors.white,
        elevation: 0,
        flexibleSpace: const DecoratedBox(
          decoration: BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: [_itemsHeaderStart, _itemsHeaderEnd],
            ),
          ),
        ),
        title: Text(widget.existingItem == null ? 'Create item' : 'Edit item'),
        actions: [
          TextButton(
            onPressed: _saving ? null : _saveItem,
            child: Text(
              _saving ? 'SAVING...' : 'SAVE',
              style: const TextStyle(
                color: Colors.white,
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
          const SizedBox(width: 8),
        ],
      ),
      body: Form(
        key: _formKey,
        child: SingleChildScrollView(
          keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
          padding: EdgeInsets.fromLTRB(20, 20, 20, 20 + keyboardInset),
          child: Center(
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 1040),
              child: Column(
                children: [
                  _editorCard(
                    child: LayoutBuilder(
                      builder: (context, constraints) {
                        final stacked = constraints.maxWidth < 780;
                        final priceAndBarcode = [
                          Expanded(
                            child: TextFormField(
                              controller: _priceController,
                              keyboardType:
                                  const TextInputType.numberWithOptions(
                                    decimal: true,
                                  ),
                              decoration: const InputDecoration(
                                labelText: 'Price',
                                border: UnderlineInputBorder(),
                              ),
                            ),
                          ),
                          const SizedBox(width: 28, height: 16),
                          Expanded(
                            child: TextFormField(
                              controller: _barcodeController,
                              decoration: const InputDecoration(
                                labelText: 'Barcode',
                                border: UnderlineInputBorder(),
                              ),
                            ),
                          ),
                        ];
                        return Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            TextFormField(
                              controller: _nameController,
                              validator: (value) {
                                if ((value ?? '').trim().isEmpty) {
                                  return 'Enter an item name';
                                }
                                return null;
                              },
                              decoration: const InputDecoration(
                                labelText: 'Name',
                                border: UnderlineInputBorder(),
                              ),
                            ),
                            const SizedBox(height: 24),
                            DropdownButtonFormField<String>(
                              initialValue: categories.contains(_category)
                                  ? _category
                                  : _noCategoryLabel,
                              decoration: const InputDecoration(
                                labelText: 'Category',
                                border: UnderlineInputBorder(),
                              ),
                              items: categories
                                  .map(
                                    (category) => DropdownMenuItem<String>(
                                      value: category,
                                      child: Text(category),
                                    ),
                                  )
                                  .toList(growable: false),
                              onChanged: (value) {
                                if (value != null) {
                                  setState(() => _category = value);
                                }
                              },
                            ),
                            const SizedBox(height: 24),
                            TextFormField(
                              controller: _skuController,
                              decoration: const InputDecoration(
                                labelText: 'SKU',
                                border: UnderlineInputBorder(),
                              ),
                            ),
                            const SizedBox(height: 24),
                            if (stacked)
                              Column(children: priceAndBarcode)
                            else
                              Row(children: priceAndBarcode),
                          ],
                        );
                      },
                    ),
                  ),
                  const SizedBox(height: 18),
                  _editorCard(
                    child: SwitchListTile(
                      contentPadding: EdgeInsets.zero,
                      title: const Text(
                        'Track stock',
                        style: TextStyle(
                          color: _itemsText,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                      subtitle: const Text(
                        'Prepared for the full inventory workflow.',
                        style: TextStyle(color: _itemsMuted),
                      ),
                      activeThumbColor: _itemsAccent,
                      activeTrackColor: _itemsAccent.withValues(alpha: 0.35),
                      value: _trackStock,
                      onChanged: (value) => setState(() => _trackStock = value),
                    ),
                  ),
                  const SizedBox(height: 18),
                  _editorCard(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text(
                          'Representation on POS',
                          style: TextStyle(
                            color: _itemsText,
                            fontSize: 18,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                        const SizedBox(height: 18),
                        Wrap(
                          spacing: 14,
                          runSpacing: 14,
                          children: _editorColors
                              .map(
                                (color) => Container(
                                  width: 68,
                                  height: 68,
                                  decoration: BoxDecoration(
                                    color: color,
                                    borderRadius: BorderRadius.circular(14),
                                  ),
                                ),
                              )
                              .toList(growable: false),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }

  Future<void> _saveItem() async {
    if (_saving || !_formKey.currentState!.validate()) {
      return;
    }
    final priceMinor = _parseMoney(_priceController.text);
    if (priceMinor == null) {
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(const SnackBar(content: Text('Enter a valid price.')));
      return;
    }
    setState(() => _saving = true);
    try {
      final currentBranchItems =
          (ref.read(catalogItemsProvider).value ?? const <CatalogItemModel>[])
              .where((item) => item.branchId == widget.branchId)
              .toList(growable: false);
      final saved = CatalogItemModel(
        id: widget.existingItem?.id ?? _catalogItemId(widget.branchId),
        branchId: widget.branchId,
        categoryName: _normalizedCategoryName(_category),
        name: _nameController.text.trim(),
        sku: _skuController.text.trim().isEmpty
            ? widget.suggestedSku
            : _skuController.text.trim(),
        barcode: _barcodeController.text.trim().isEmpty
            ? null
            : _barcodeController.text.trim(),
        priceMinor: priceMinor,
        vatType: _normalizeVatType(widget.existingItem?.vatType ?? 'VATABLE'),
        unit: widget.existingItem?.unit ?? 'each',
        hasVariants: widget.existingItem?.hasVariants ?? false,
      );
      final nextItems = [
        for (final item in currentBranchItems)
          if (item.id != saved.id) item,
        saved,
      ];
      final backOfficeClient = ref.read(backOfficeClientProvider);
      final snapshot = await backOfficeClient.fetchCatalogSnapshot(
        branchId: widget.branchId,
      );
      final payload = _buildCatalogSnapshotPayload(
        branchId: widget.branchId,
        snapshot: snapshot,
        items: nextItems,
        trackInventoryByItemId: {
          for (final item in snapshot.items) item.id: item.trackInventory,
          saved.id: _trackStock,
        },
      );
      await backOfficeClient.replaceCatalogSnapshot(
        branchId: widget.branchId,
        categories: payload.categories,
        items: payload.items,
        syncCursor: payload.syncCursor,
      );
      await ref
          .read(syncServiceProvider)
          .refreshCatalog(branchId: widget.branchId);
      if (!mounted) {
        return;
      }
      Navigator.of(context).pop(saved);
    } on BackOfficeException catch (error) {
      if (!mounted) {
        return;
      }
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(error.message)));
    } finally {
      if (mounted) {
        setState(() => _saving = false);
      }
    }
  }
}

Widget _editorCard({required Widget child}) {
  return Container(
    width: double.infinity,
    padding: const EdgeInsets.all(28),
    decoration: BoxDecoration(
      color: _itemsSurface,
      borderRadius: BorderRadius.circular(24),
      border: Border.all(color: _itemsBorder),
      boxShadow: const [
        BoxShadow(
          color: Color(0x12000000),
          blurRadius: 18,
          offset: Offset(0, 8),
        ),
      ],
    ),
    child: child,
  );
}

String _titleForSection(_ItemsSection section) {
  return switch (section) {
    _ItemsSection.items => 'Items',
    _ItemsSection.categories => 'Categories',
    _ItemsSection.modifiers => 'Modifiers',
    _ItemsSection.discounts => 'Discounts',
  };
}

String _categoryLabel(String category) {
  return category.trim().isEmpty ? _noCategoryLabel : category.trim();
}

Color _accentForItem(String seed) {
  const palette = <Color>[
    Color(0xFFEF4444),
    Color(0xFFF97316),
    Color(0xFFEAB308),
    Color(0xFF22C55E),
    Color(0xFF14B8A6),
    Color(0xFF3B82F6),
    Color(0xFF8B5CF6),
    Color(0xFFEC4899),
  ];
  final hash = seed.runes.fold<int>(0, (sum, rune) => sum + rune);
  return palette[hash % palette.length];
}

int? _parseMoney(String input) {
  final value = input.trim();
  if (value.isEmpty) {
    return 0;
  }
  final parsed = double.tryParse(value);
  if (parsed == null) {
    return null;
  }
  return (parsed * 100).round();
}

const _catalogCategoryPalette = <String>[
  '#2F88FF',
  '#F97316',
  '#10B981',
  '#8B5CF6',
  '#EAB308',
  '#EF4444',
];

class _CatalogSnapshotPayload {
  const _CatalogSnapshotPayload({
    required this.categories,
    required this.items,
    required this.syncCursor,
  });

  final List<Map<String, Object?>> categories;
  final List<Map<String, Object?>> items;
  final String syncCursor;
}

_CatalogSnapshotPayload _buildCatalogSnapshotPayload({
  required String branchId,
  required BackOfficeCatalogSnapshot snapshot,
  required List<CatalogItemModel> items,
  required Map<String, bool> trackInventoryByItemId,
}) {
  final categoriesByKey = <String, Map<String, Object?>>{
    for (var index = 0; index < snapshot.categories.length; index += 1)
      _categoryKey(snapshot.categories[index].name): {
        'id': snapshot.categories[index].id,
        'name': snapshot.categories[index].name,
        'color': snapshot.categories[index].color,
        'groupName': snapshot.categories[index].groupName,
      },
  };
  var nextPaletteIndex = snapshot.categories.length;

  for (final item in items) {
    final key = _categoryKey(item.categoryName);
    if (categoriesByKey.containsKey(key)) {
      continue;
    }

    categoriesByKey[key] = {
      'id': 'cat-$branchId-${_slugify(key.isEmpty ? 'general' : key)}',
      'name': _normalizedCategoryName(item.categoryName),
      'color':
          _catalogCategoryPalette[nextPaletteIndex %
              _catalogCategoryPalette.length],
      'groupName': 'General',
    };
    nextPaletteIndex += 1;
  }

  final categoryIdsByKey = {
    for (final entry in categoriesByKey.entries)
      entry.key: entry.value['id']?.toString() ?? '',
  };
  final existingItemsById = {for (final item in snapshot.items) item.id: item};

  return _CatalogSnapshotPayload(
    categories: categoriesByKey.values.toList(growable: false),
    items: items
        .map(
          (item) => {
            'id': item.id,
            'categoryId':
                categoryIdsByKey[_categoryKey(item.categoryName)] ??
                'cat-$branchId-general',
            'name': item.name.trim(),
            'sku': item.sku.trim(),
            'barcode': (item.barcode ?? '').trim(),
            'unit': existingItemsById[item.id]?.unit ?? item.unit,
            'price': item.priceMinor / 100,
            'vatType': _normalizeVatType(item.vatType),
            'trackInventory':
                trackInventoryByItemId[item.id] ??
                existingItemsById[item.id]?.trackInventory ??
                false,
            'hasVariants':
                existingItemsById[item.id]?.hasVariants ?? item.hasVariants,
          },
        )
        .toList(growable: false),
    syncCursor: DateTime.now().toUtc().toIso8601String(),
  );
}

String _catalogItemId(String branchId) {
  return 'item-$branchId-${DateTime.now().microsecondsSinceEpoch}';
}

String _categoryKey(String value) {
  return value.trim().toLowerCase();
}

String _normalizedCategoryName(String value) {
  final trimmed = value.trim();
  if (trimmed.isEmpty || trimmed == _noCategoryLabel) {
    return 'Uncategorized';
  }
  return trimmed;
}

String _slugify(String value) {
  return value
      .trim()
      .toLowerCase()
      .replaceAll(RegExp(r'[^a-z0-9]+'), '-')
      .replaceAll(RegExp(r'^-+|-+$'), '');
}

String _normalizeVatType(String value) {
  return value.trim().toUpperCase().replaceAll(' ', '_');
}

const _editorColors = <Color>[
  Color(0xFFE5E7EB),
  Color(0xFFEF4444),
  Color(0xFFE91E63),
  Color(0xFFF59E0B),
  Color(0xFFD9F01F),
  Color(0xFF4CAF50),
  Color(0xFF2196F3),
  Color(0xFF9C27B0),
];
