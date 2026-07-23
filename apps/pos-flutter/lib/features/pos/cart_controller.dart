import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../features/catalog/catalog_item.dart';

const Object _discountUnchanged = Object();

enum CartDiscountType { amount, percentage }

class CartDiscount {
  const CartDiscount.amount({required this.amountMinor, this.discountLabel})
    : type = CartDiscountType.amount,
      percentage = 0;

  const CartDiscount.percentage({required this.percentage, this.discountLabel})
    : type = CartDiscountType.percentage,
      amountMinor = 0;

  final CartDiscountType type;
  final int amountMinor;
  final double percentage;
  final String? discountLabel;

  int resolveMinor(int subtotalMinor) {
    if (subtotalMinor <= 0) {
      return 0;
    }

    return switch (type) {
      CartDiscountType.amount => amountMinor.clamp(0, subtotalMinor).toInt(),
      CartDiscountType.percentage =>
        ((subtotalMinor * percentage.clamp(0, 100)) / 100)
            .round()
            .clamp(0, subtotalMinor)
            .toInt(),
    };
  }

  CartDiscount normalizedFor(int subtotalMinor) {
    return switch (type) {
      CartDiscountType.amount => CartDiscount.amount(
        amountMinor: resolveMinor(subtotalMinor),
        discountLabel: discountLabel,
      ),
      CartDiscountType.percentage => CartDiscount.percentage(
        percentage: percentage.clamp(0, 100).toDouble(),
        discountLabel: discountLabel,
      ),
    };
  }

  String get displayLabel {
    return switch (type) {
      CartDiscountType.amount => 'Amount',
      CartDiscountType.percentage => '${_formatPercentage(percentage)}%',
    };
  }

  String get editorValue {
    return switch (type) {
      CartDiscountType.amount => (amountMinor / 100).toStringAsFixed(
        amountMinor % 100 == 0 ? 0 : 2,
      ),
      CartDiscountType.percentage => _formatPercentage(percentage),
    };
  }

  static String _formatPercentage(double value) {
    if (value == value.roundToDouble()) {
      return value.toStringAsFixed(0);
    }
    return value.toStringAsFixed(1);
  }
}

class CartLine {
  const CartLine({
    required this.item,
    required this.quantity,
  });

  final CatalogItemModel item;
  final int quantity;

  int get lineTotalMinor => item.priceMinor * quantity;

  CartLine copyWith({int? quantity}) {
    return CartLine(
      item: item,
      quantity: quantity ?? this.quantity,
    );
  }
}

class CartState {
  const CartState({this.lines = const [], this.discount});

  final List<CartLine> lines;
  final CartDiscount? discount;

  int get subtotalMinor =>
      lines.fold(0, (total, line) => total + line.lineTotalMinor);

  bool get isScPwdDiscount =>
      discount?.discountLabel == 'SC DISCOUNT' ||
      discount?.discountLabel == 'PWD DISCOUNT';

  // VAT-exclusive subtotal used for RA 9994/9442 statutory discount base
  int get _vatExclusiveSubtotalMinor => (subtotalMinor / 1.12).round();

  int get _scPwdDiscountMinor => (_vatExclusiveSubtotalMinor * 0.20).round();

  int get discountMinor =>
      isScPwdDiscount
          ? _scPwdDiscountMinor
          : (discount?.resolveMinor(subtotalMinor) ?? 0);

  bool get hasDiscount => discountMinor > 0;

  int get vatMinor => isScPwdDiscount ? 0 : (totalMinor * 12 / 112).round();

  int get totalMinor =>
      isScPwdDiscount
          ? (_vatExclusiveSubtotalMinor - _scPwdDiscountMinor)
                .clamp(0, subtotalMinor)
                .toInt()
          : (subtotalMinor - discountMinor).clamp(0, subtotalMinor).toInt();

  int get itemCount =>
      lines.fold(0, (total, line) => total + line.quantity);

  CartState copyWith({
    List<CartLine>? lines,
    Object? discount = _discountUnchanged,
  }) {
    return CartState(
      lines: lines ?? this.lines,
      discount: identical(discount, _discountUnchanged)
          ? this.discount
          : discount as CartDiscount?,
    );
  }
}

class CartController extends StateNotifier<CartState> {
  CartController() : super(const CartState());

  void addItem(CatalogItemModel item) {
    final index = state.lines.indexWhere((line) => line.item.id == item.id);
    if (index == -1) {
      _setLines([...state.lines, CartLine(item: item, quantity: 1)]);
      return;
    }

    final updated = [...state.lines];
    final line = updated[index];
    updated[index] = line.copyWith(quantity: line.quantity + 1);
    _setLines(updated);
  }

  void updateQuantity(String itemId, int quantity) {
    if (quantity <= 0) {
      removeItem(itemId);
      return;
    }

    final updated = state.lines
        .map(
          (line) => line.item.id == itemId
              ? line.copyWith(quantity: quantity)
              : line,
        )
        .toList(growable: false);
    _setLines(updated);
  }

  void removeItem(String itemId) {
    _setLines(state.lines.where((line) => line.item.id != itemId).toList());
  }

  void applyDiscount(CartDiscount discount) {
    if (state.lines.isEmpty) {
      return;
    }

    final normalized = discount.normalizedFor(state.subtotalMinor);
    if (normalized.resolveMinor(state.subtotalMinor) <= 0) {
      clearDiscount();
      return;
    }

    state = state.copyWith(discount: normalized);
  }

  void clearDiscount() {
    if (state.discount == null) {
      return;
    }
    state = state.copyWith(discount: null);
  }

  void clear() {
    state = const CartState();
  }

  void _setLines(List<CartLine> lines) {
    if (lines.isEmpty) {
      state = const CartState();
      return;
    }

    final subtotalMinor = lines.fold<int>(
      0,
      (total, line) => total + line.lineTotalMinor,
    );
    final normalizedDiscount = state.discount?.normalizedFor(subtotalMinor);
    state = CartState(lines: lines, discount: normalizedDiscount);
  }
}

final cartControllerProvider =
    StateNotifierProvider<CartController, CartState>(
  (ref) => CartController(),
);
