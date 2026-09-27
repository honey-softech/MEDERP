import 'dart:convert';
import 'dart:io';
import 'dart:ui' show Color;

import 'package:flutter/foundation.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';

typedef NoticeOpener = void Function(String href);

/// High-importance channel so OEMs (Samsung Edge Lighting, MIUI pop-up, etc.)
/// can apply their own heads-up / lighting styles. Channel id bumped when
/// importance/sound settings change — Android never upgrades an existing channel.
const String medErpAlertChannelId = 'mederp_alerts_v2';
const String medErpAlertChannelName = 'MedERP alerts';
const String medErpAlertChannelDesc = 'Hospital alerts for appointments, messages, and tasks';

/// Phone status-bar notifications. Shown only after the app notification permission is granted.
class SystemNotifications {
  SystemNotifications._();

  static final FlutterLocalNotificationsPlugin _plugin = FlutterLocalNotificationsPlugin();
  static NoticeOpener? onOpen;
  static bool _ready = false;
  static final Map<String, DateTime> _recentIds = {};

  static Future<void> ensureReady() async {
    if (_ready || kIsWeb) return;
    try {
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
      final androidPlugin = _plugin.resolvePlatformSpecificImplementation<AndroidFlutterLocalNotificationsPlugin>();
      await androidPlugin?.createNotificationChannel(
        AndroidNotificationChannel(
          medErpAlertChannelId,
          medErpAlertChannelName,
          description: medErpAlertChannelDesc,
          importance: Importance.high,
          playSound: true,
          enableVibration: true,
          enableLights: true,
          ledColor: const Color(0xFFDC2626),
          showBadge: true,
        ),
      );
      _ready = true;
      // Never await a long permission prompt on the critical path of opening the app.
      // ignore: unawaited_futures
      _requestPermission();
    } catch (_) {
      // App must still open the hospital site even if notifications fail to init.
    }
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

  /// Socket + FCM often deliver the same notice within a second — show once.
  static bool _alreadyShown(String id) {
    final key = id.trim();
    if (key.isEmpty) return false;
    final now = DateTime.now();
    _recentIds.removeWhere((_, at) => now.difference(at).inSeconds > 8);
    if (_recentIds.containsKey(key)) return true;
    _recentIds[key] = now;
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
    final id = (data['id'] as String?)?.trim().isNotEmpty == true ? data['id'] as String : title;
    await showLocal(id: id, title: title, body: body, href: href);
  }

  static Future<void> showLocal({
    required String id,
    required String title,
    required String body,
    String href = '',
  }) async {
    if (!_ready) await ensureReady();
    if (!await _allowed()) {
      await _requestPermission();
      if (!await _allowed()) return;
    }
    if (title.trim().isEmpty) return;
    if (_alreadyShown(id)) return;

    final trimmedTitle = title.trim();
    final trimmedBody = body.trim();

    final details = NotificationDetails(
      android: AndroidNotificationDetails(
        medErpAlertChannelId,
        medErpAlertChannelName,
        channelDescription: medErpAlertChannelDesc,
        importance: Importance.high,
        priority: Priority.high,
        category: AndroidNotificationCategory.message,
        visibility: NotificationVisibility.public,
        playSound: true,
        enableVibration: true,
        enableLights: true,
        color: const Color(0xFFDC2626),
        ledColor: const Color(0xFFDC2626),
        ledOnMs: 800,
        ledOffMs: 400,
        vibrationPattern: Int64List.fromList([0, 280, 120, 280]),
        ticker: trimmedTitle,
        icon: 'ic_stat_mederp',
        channelShowBadge: true,
        autoCancel: true,
        // Heads-up / OEM edge-lighting hooks when the shade is allowed to peek.
        styleInformation: BigTextStyleInformation(
          trimmedBody.isEmpty ? trimmedTitle : trimmedBody,
          contentTitle: trimmedTitle,
          summaryText: 'MedERP',
        ),
      ),
      iOS: const DarwinNotificationDetails(
        presentAlert: true,
        presentBanner: true,
        presentList: true,
        presentSound: true,
      ),
    );
    await _plugin.show(
      id: _notificationId(id),
      title: trimmedTitle,
      body: trimmedBody,
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
