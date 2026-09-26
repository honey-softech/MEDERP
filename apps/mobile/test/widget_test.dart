import 'package:flutter_test/flutter_test.dart';
import 'package:mederp_mobile/main.dart';
import 'package:mederp_mobile/system_notifications.dart';

void main() {
  test('mobile app opens the live MedERP site', () {
    expect(medErpSiteUrl, 'https://mederp.co.in');
  });

  test('webview user agent marks the installed app', () {
    expect(mobileUserAgent(null), contains(medErpMobileToken));
    expect(mobileUserAgent('Mozilla/5.0'), 'Mozilla/5.0 $medErpMobileToken');
    expect(mobileUserAgent('Mozilla/5.0 $medErpMobileToken'), 'Mozilla/5.0 $medErpMobileToken');
  });
}
