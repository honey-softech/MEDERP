import 'package:flutter_test/flutter_test.dart';
import 'package:mederp_mobile/main.dart';

void main() {
  test('mobile app opens the live MedERP site', () {
    expect(medErpSiteUrl, 'https://mederp.co.in');
  });
}
