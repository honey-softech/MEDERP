import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:mederp_mobile/bill_download.dart';
import 'package:mederp_mobile/main.dart';
import 'package:mederp_mobile/push_notifications.dart';
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

  test('parses a bill download posted from the site', () {
    final message = jsonEncode({
      'type': 'download',
      'filename': 'bill INV/1.pdf',
      'base64': base64Encode(utf8.encode('%PDF')),
    });
    expect(isNativeDownloadMessage(message), isTrue);
    final download = parseNativeBillDownload(message);
    expect(download?.filename, 'bill_INV_1.pdf');
    expect(download?.bytes, utf8.encode('%PDF'));
    expect(isNativeDownloadMessage('{"title":"MedERP","body":"Saved"}'), isFalse);
    expect(nativeSessionAction('{"type":"signed-out"}'), 'signed-out');
    expect(nativeSessionAction('{"type":"signed-in"}'), 'signed-in');
    expect(nativeSessionAction('{"title":"MedERP","body":"Saved"}'), isNull);
    expect(parseNativeBillDownload('{"type":"download","filename":"bill.pdf","base64":""}'), isNull);
  });
}
