import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/providers/app_providers.dart';

const int catalogPageSize = 80;

final posSearchProvider = StateProvider.autoDispose<String>((ref) => '');

final posCategoryProvider = StateProvider.autoDispose<String>((ref) => 'All');

final posCatalogCategoriesProvider = FutureProvider.autoDispose
    .family<List<String>, String>((ref, branchId) async {
      await ref.watch(databaseBootstrapProvider.future);
      final categories = await ref
          .watch(catalogRepositoryProvider)
          .fetchCategories(branchId: branchId);
      return <String>[
        'All',
        ...categories.where((category) => category != 'All'),
      ];
    });
