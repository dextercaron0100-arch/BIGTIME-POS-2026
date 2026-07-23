import 'package:flutter_test/flutter_test.dart';
import 'package:pos_flutter/core/models/money.dart';

void main() {
  test('money helpers preserve centavo precision', () {
    expect(moneyFromText('135.50'), 13550);
    expect(formatMoney(13550), 'PHP 135.50');
  });
}
