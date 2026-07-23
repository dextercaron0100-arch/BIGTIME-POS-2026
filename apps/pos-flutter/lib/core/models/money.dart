import 'package:intl/intl.dart';

const int moneyScale = 100;
final NumberFormat _currencyFormatter = NumberFormat.currency(
  locale: 'en_PH',
  symbol: 'PHP ',
  decimalDigits: 2,
);

int moneyFromDouble(double value) => (value * moneyScale).round();

int moneyFromText(String value) {
  final normalized = value.replaceAll(',', '').trim();
  final parsed = double.tryParse(normalized) ?? 0;
  return moneyFromDouble(parsed);
}

double moneyToDouble(int value) => value / moneyScale;

String formatMoney(int value) =>
    _currencyFormatter.format(moneyToDouble(value));
