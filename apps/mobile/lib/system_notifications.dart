import 'dart:convert';
import 'dart:io';

import 'package:flutter/foundation.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';

typedef NoticeOpener = void Function(String href);

/// Phone status-bar notifications. Shown only after the app notification permission is granted.
class SystemNotifications {
  SystemNotifications._();

  static final FlutterLocalNotificationsPlugin _plugin = FlutterLocalNotificationsPlugin();
  static NoticeOpener? onOpen;
  static bool _ready = false;

  static Future<void> ensureReady() async {
    if (_ready || kIsWeb) return;
    const android = AndroidInitializationSettings('ic_stat_mederp');
    const ios = DarwinInitializationSettings(
      requestAlertPermission: false,
      requestBadgePermission: false,
      requestSoundPermission: false,
    );
    await _plugin.initialize(
      settings: const InitializationSettings(android: android, iOS: ios),
      onDidReceiveNotificationResponse: (response) {
        final href = response.payload;
        if (href != null && href.isNotEmpty) onOpen?.call(href);
      },
    );
    _ready = true;
    await _requestPermission();
  }

  static Future<void> _requestPermission() async {
    if (Platform.isAndroid) {
      final android = _plugin.resolvePlatformSpecificImplementation<AndroidFlutterLocalNotificationsPlugin>();
      await android?.requestNotificationsPermission();
      return;
    }
    if (Platform.isIOS) {
      final ios = _plugin.resolvePlatformSpecificImplementation<IOSFlutterLocalNotificationsPlugin>();
      await ios?.requestPermissions(alert: true, badge: true, sound: true);
    }
  }

  static Future<bool> _allowed() async {
    if (Platform.isAndroid) {
      final android = _plugin.resolvePlatformSpecificImplementation<AndroidFlutterLocalNotificationsPlugin>();
      return await android?.areNotificationsEnabled() ?? false;
    }
    if (Platform.isIOS) {
      final ios = _plugin.resolvePlatformSpecificImplementation<IOSFlutterLocalNotificationsPlugin>();
      final permissions = await ios?.checkPermissions();
      return permissions?.isEnabled ?? false;
    }
    return false;
  }

  static Future<void> showFromBridge(String raw) async {
    if (!_ready) await ensureReady();
    if (!await _allowed()) return;

    final data = _decode(raw);
    if (data == null) return;
    final title = (data['title'] as String?)?.trim() ?? '';
    final body = (data['body'] as String?)?.trim() ?? '';
    if (title.isEmpty) return;
    final href = (data['href'] as String?)?.trim() ?? '';
    final id = _notificationId((data['id'] as String?)?.trim().isNotEmpty == true ? data['id'] as String : title);

    const details = NotificationDetails(
      android: AndroidNotificationDetails(
        'mederp_alerts',
        'MedERP alerts',
        channelDescription: 'Hospital alerts for appointments, messages, and tasks',
        importance: Importance.max,
        priority: Priority.high,
      ),
      iOS: DarwinNotificationDetails(
        presentAlert: true,
        presentBanner: true,
        presentList: true,
        presentSound: true,
      ),
    );
    await _plugin.show(
      id: id,
      title: title,
      body: body,
      notificationDetails: details,
      payload: href,
    );
  }

  static Map<String, dynamic>? _decode(String raw) {
    try {
      final decoded = jsonDecode(raw);
      if (decoded is! Map) return null;
      return Map<String, dynamic>.from(decoded);
    } catch (_) {
      return null;
    }
  }

  static int _notificationId(String value) {
    var hash = 0;
    for (final code in value.codeUnits) {
      hash = (hash * 31 + code) & 0x7fffffff;
    }
    return hash == 0 ? 1 : hash;
  }
}

/// Appended to the WebView user agent so the site can skip its in-app popup.
const String medErpMobileToken = 'MedERPMobile';

String mobileUserAgent(String? current) {
  if (current != null && current.contains(medErpMobileToken)) return current;
  if (current != null && current.trim().isNotEmpty) return '$current $medErpMobileToken';
  return 'Mozilla/5.0 (Linux; Android 14; Mobile) AppleWebKit/537.36 '
      '(KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36 $medErpMobileToken';
}

/// Removes the website's in-page alert and forwards it to the phone notification shade.
const String inAppToastGuardScript = r'''
(function () {
  if (window.__mederpNativeToastGuard) return;
  window.__mederpNativeToastGuard = true;
  function lift(node) {
    if (!(node instanceof HTMLElement)) return;
    if (node.dataset.mederpLifted === '1') return;
    if (!node.classList.contains('fixed')) return;
    var label = node.querySelector('p');
    if (!label || (label.textContent || '').trim() !== 'MedERP') return;
    var paragraphs = node.querySelectorAll('p');
    if (paragraphs.length < 2) return;
    node.dataset.mederpLifted = '1';
    var title = (paragraphs[1].textContent || '').trim();
    var body = paragraphs[2] ? (paragraphs[2].textContent || '').trim() : '';
    node.remove();
    if (window.MedErpNative && title) {
      window.MedErpNative.postMessage(JSON.stringify({
        id: 'toast-' + Date.now(),
        title: title,
        body: body,
        href: ''
      }));
    }
  }
  function scan() {
    document.querySelectorAll('button').forEach(lift);
  }
  new MutationObserver(scan).observe(document.documentElement, { childList: true, subtree: true });
  scan();
})();
''';
