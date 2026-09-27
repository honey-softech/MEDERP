import 'dart:io';

import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';
import 'package:mederp_mobile/system_notifications.dart';
import 'package:webview_flutter/webview_flutter.dart';

@pragma('vm:entry-point')
Future<void> firebaseMessagingBackgroundHandler(RemoteMessage message) async {
  // Notification payloads are displayed by the OS while backgrounded.
  try {
    await Firebase.initializeApp();
  } catch (_) {}
}

/// Android FCM — alerts when the WebView socket is suspended or the app is closed.
class PushNotifications {
  PushNotifications._();

  static bool _started = false;
  static String? _token;
  static WebViewController? _webView;

  static Future<void> start({required WebViewController webView}) async {
    _webView = webView;
    if (_started || kIsWeb || !Platform.isAndroid) return;
    try {
      await Firebase.initializeApp();
    } catch (error) {
      debugPrint('Firebase not configured yet (add android/app/google-services.json): $error');
      return;
    }
    _started = true;

    FirebaseMessaging.onBackgroundMessage(firebaseMessagingBackgroundHandler);

    final messaging = FirebaseMessaging.instance;
    await messaging.requestPermission(alert: true, badge: true, sound: true);
    await SystemNotifications.ensureReady();

    FirebaseMessaging.onMessage.listen((message) {
      final title = message.notification?.title ?? message.data['title']?.toString() ?? 'MedERP';
      final body = message.notification?.body ?? message.data['body']?.toString() ?? '';
      final href = message.data['href']?.toString() ?? '';
      final id = message.data['notificationId']?.toString() ?? message.messageId ?? title;
      SystemNotifications.showLocal(id: id, title: title, body: body, href: href);
    });

    FirebaseMessaging.onMessageOpenedApp.listen((message) {
      final href = message.data['href']?.toString() ?? '';
      if (href.isNotEmpty) SystemNotifications.onOpen?.call(href);
    });

    final initial = await messaging.getInitialMessage();
    if (initial != null) {
      final href = initial.data['href']?.toString() ?? '';
      if (href.isNotEmpty) {
        Future<void>.delayed(const Duration(milliseconds: 800), () {
          SystemNotifications.onOpen?.call(href);
        });
      }
    }

    messaging.onTokenRefresh.listen((token) {
      _token = token;
      registerTokenOnSite(token);
    });

    _token = await messaging.getToken();
    if (_token != null) await registerTokenOnSite(_token!);
  }

  /// Re-run after each page load so a late sign-in still binds the token.
  static Future<void> registerTokenOnSite([String? token]) async {
    final value = (token ?? _token)?.trim();
    final controller = _webView;
    if (value == null || value.isEmpty || controller == null) return;
    final escaped = value.replaceAll(r'\', r'\\').replaceAll("'", r"\'");
    await controller.runJavaScript('''
(function () {
  var token = '$escaped';
  fetch('/api/device-tokens', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: token, platform: 'ANDROID' })
  }).catch(function () {});
})();
''');
  }
}
