import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mederp_mobile/bill_download.dart';
import 'package:mederp_mobile/healthcare_loader.dart';
import 'package:mederp_mobile/main.dart';
import 'package:mederp_mobile/system_notifications.dart';
import 'package:mederp_mobile/web_load_error.dart';
import 'package:webview_flutter/webview_flutter.dart';

void main() {
  test('mobile app opens the live MedERP site', () {
    expect(medErpSiteUrl, 'https://mederp.co.in');
  });

  test('field text stays at 16px so iOS does not zoom the page', () {
    expect(keepFieldScaleScript, contains('font-size:16px'));
    expect(keepFieldScaleScript.contains('user-scalable'), isFalse);
    expect(keepFieldScaleScript.contains('maximum-scale'), isFalse);
  });

  test('a cancelled first iOS load is not treated as offline', () {
    expect(
      isIgnoredWebLoadError(
        WebResourceError(errorCode: -999, description: 'cancelled', isForMainFrame: true),
      ),
      isTrue,
    );
    expect(
      isIgnoredWebLoadError(
        WebResourceError(errorCode: -2, description: 'net::ERR_INTERNET_DISCONNECTED', isForMainFrame: true),
      ),
      isFalse,
    );
  });

  testWidgets('clinic loader is shown while the app opens', (tester) async {
    await tester.pumpWidget(const MaterialApp(home: HealthcareLoader()));
    expect(find.text('MedERP'), findsOneWidget);
    expect(find.byIcon(Icons.monitor_heart), findsOneWidget);
    await tester.pumpWidget(const SizedBox.shrink());
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
    expect(parseNativeBillDownload('{"type":"download","filename":"bill.pdf","base64":""}'), isNull);
  });
}
