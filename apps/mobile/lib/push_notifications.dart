import 'dart:convert';
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

/// FCM alerts when the WebView socket is suspended or the app is closed.
/// Android uses a local notification while the app is open. iOS presents the
/// system banner itself, including in the foreground.
class PushNotifications {
  PushNotifications._();

  static bool _started = false;
  static bool _signedOut = false;
  static int _epoch = 0;
  static Future<void> _tail = Future<void>.value();
  static String? _token;
  static WebViewController? _webView;

  static bool get _supported => Platform.isAndroid || Platform.isIOS;

  static String get _platform => Platform.isIOS ? 'IOS' : 'ANDROID';

  static Future<void> start({required WebViewController webView}) async {
    _webView = webView;
    if (_started || kIsWeb || !_supported) return;
    try {
      await Firebase.initializeApp();
    } catch (error) {
      debugPrint(
        'Firebase not configured yet '
        '(add android/app/google-services.json or ios/Runner/GoogleService-Info.plist): $error',
      );
      return;
    }
    _started = true;

    FirebaseMessaging.onBackgroundMessage(firebaseMessagingBackgroundHandler);

    final messaging = FirebaseMessaging.instance;
    await messaging.requestPermission(alert: true, badge: true, sound: true);
    if (Platform.isIOS) {
      await messaging.setForegroundNotificationPresentationOptions(
        alert: true,
        badge: true,
        sound: true,
      );
    }
    await SystemNotifications.ensureReady();

    // Android does not shade-display FCM "notification" payloads while the app
    // is open. Post one ourselves so Samsung / Xiaomi / Oppo styles can apply.
    // iOS shows that banner through the presentation options above.
    FirebaseMessaging.onMessage.listen((message) {
      if (_signedOut || !Platform.isAndroid) return;
      final title = message.notification?.title ?? message.data['title']?.toString() ?? 'MedERP';
      final body = message.notification?.body ?? message.data['body']?.toString() ?? '';
      final href = message.data['href']?.toString() ?? '';
      final id = message.data['notificationId']?.toString() ?? message.messageId ?? title;
      // ignore: unawaited_futures
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
      if (_signedOut) return;
      _token = token;
      registerTokenOnSite(token);
    });

    if (_signedOut) return;
    if (Platform.isIOS) await _waitForApnsToken(messaging);
    _token = await messaging.getToken();
    if (_signedOut || _token == null) return;
    await registerTokenOnSite(_token!);
  }

  /// Sign-out. Drops the FCM registration so iOS/Android cannot keep alerting
  /// this phone, and ignores token refreshes until the next sign-in.
  static Future<void> stopForSignOut() {
    return _enqueue(() async {
      final epoch = ++_epoch;
      _signedOut = true;
      _token = null;
      final messaging = FirebaseMessaging.instance;
      try {
        await messaging.setAutoInitEnabled(false);
      } catch (_) {}
      if (epoch != _epoch) return;
      if (Platform.isIOS) {
        try {
          await messaging.setForegroundNotificationPresentationOptions(
            alert: false,
            badge: false,
            sound: false,
          );
        } catch (_) {}
      }
      if (epoch != _epoch) return;
      try {
        await messaging.deleteToken();
      } catch (_) {}
      if (epoch != _epoch) return;
      await SystemNotifications.clearAll();
    });
  }

  /// Next sign-in. A new FCM token is issued and registered only after this.
  static Future<void> resumeAfterSignIn() {
    return _enqueue(() async {
      final epoch = ++_epoch;
      _signedOut = false;
      try {
        final messaging = FirebaseMessaging.instance;
        await messaging.setAutoInitEnabled(true);
        if (epoch != _epoch) return;
        if (Platform.isIOS) {
          await messaging.setForegroundNotificationPresentationOptions(
            alert: true,
            badge: true,
            sound: true,
          );
          await _waitForApnsToken(messaging);
        }
        if (epoch != _epoch) return;
        _token = await messaging.getToken();
        if (epoch != _epoch || _token == null) return;
        await registerTokenOnSite(_token!);
      } catch (_) {}
    });
  }

  static Future<void> _enqueue(Future<void> Function() action) {
    final run = _tail.catchError((_) {}).then((_) => action());
    _tail = run;
    return run;
  }

  /// getToken() on iOS needs the APNs device token first. It can arrive a moment
  /// after permission is granted.
  static Future<void> _waitForApnsToken(FirebaseMessaging messaging) async {
    for (var attempt = 0; attempt < 5; attempt++) {
      final apns = await messaging.getAPNSToken();
      if (apns != null && apns.isNotEmpty) return;
      await Future<void>.delayed(const Duration(seconds: 1));
    }
  }

  /// Re-run after each page load so a late sign-in still binds the token.
  static Future<void> registerTokenOnSite([String? token]) async {
    if (_signedOut) return;
    final value = (token ?? _token)?.trim();
    final controller = _webView;
    if (value == null || value.isEmpty || controller == null) return;
    final escaped = value.replaceAll(r'\', r'\\').replaceAll("'", r"\'");
    await controller.runJavaScript('''
(function () {
  var token = '$escaped';
  try { sessionStorage.setItem('mederp.devicePushToken', token); } catch (e) {}
  fetch('/api/device-tokens', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: token, platform: '$_platform' })
  }).catch(function () {});
})();
''');
  }
}

/// `signed-out` or `signed-in` when the site posts a session change. Null otherwise.
String? nativeSessionAction(String raw) {
  try {
    final decoded = jsonDecode(raw);
    if (decoded is! Map) return null;
    final type = decoded['type'];
    if (type == 'signed-out' || type == 'signed-in') return type as String;
    return null;
  } catch (_) {
    return null;
  }
}
