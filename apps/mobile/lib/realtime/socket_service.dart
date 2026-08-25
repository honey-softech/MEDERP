import 'package:flutter/foundation.dart';
import 'package:mederp_mobile/api/api_client.dart';
import 'package:mederp_mobile/session.dart';
import 'package:socket_io_client/socket_io_client.dart' as io;

class NotificationFeed extends ChangeNotifier {
  NotificationFeed({ApiClient? api}) : _api = api ?? ApiClient();

  final ApiClient _api;
  io.Socket? _socket;
  final List<StaffNotice> items = [];
  int unreadCount = 0;
  bool connected = false;
  StaffNotice? latest;

  Future<void> start() async {
    if (!SessionStore.isSignedIn) return;
    await refresh();
    _connect();
  }

  Future<void> refresh() async {
    final data = await _api.notifications();
    items
      ..clear()
      ..addAll(data.notifications);
    unreadCount = data.unreadCount;
    notifyListeners();
  }

  void _connect() {
    _socket?.dispose();
    _socket = io.io(
      _api.baseUrl,
      io.OptionBuilder()
          .setTransports(['websocket'])
          .setPath('/socket.io')
          .setAuth({'token': SessionStore.token})
          .enableForceNew()
          .enableReconnection()
          .disableAutoConnect()
          .build(),
    );
    _socket!
      ..onConnect((_) {
        connected = true;
        notifyListeners();
      })
      ..onDisconnect((_) {
        connected = false;
        notifyListeners();
      })
      ..on('notification', (data) {
        if (data is! Map) return;
        final notice = StaffNotice.fromJson(Map<String, dynamic>.from(data));
        items.removeWhere((item) => item.id == notice.id);
        items.insert(0, notice);
        if (!notice.isRead) unreadCount += 1;
        latest = notice;
        notifyListeners();
      })
      ..on('notifications:read', (data) {
        if (data is! Map) return;
        final all = data['all'] == true;
        final ids = ((data['ids'] as List<dynamic>?) ?? []).map((id) => id.toString()).toSet();
        for (var i = 0; i < items.length; i++) {
          if (all || ids.contains(items[i].id)) {
            items[i] = items[i].copyWith(isRead: true);
          }
        }
        if (all) unreadCount = 0;
        notifyListeners();
      })
      ..connect();
  }

  Future<void> markAllRead() async {
    await _api.markNotifications(all: true);
    for (var i = 0; i < items.length; i++) {
      items[i] = items[i].copyWith(isRead: true);
    }
    unreadCount = 0;
    notifyListeners();
  }

  Future<void> markRead(String id) async {
    await _api.markNotifications(ids: [id]);
    final index = items.indexWhere((item) => item.id == id);
    if (index >= 0 && !items[index].isRead) {
      items[index] = items[index].copyWith(isRead: true);
      unreadCount = unreadCount > 0 ? unreadCount - 1 : 0;
      notifyListeners();
    }
  }

  void clearLatest() {
    latest = null;
    notifyListeners();
  }

  Future<void> stop() async {
    _socket?.dispose();
    _socket = null;
    connected = false;
    items.clear();
    unreadCount = 0;
    latest = null;
    notifyListeners();
  }

  @override
  void dispose() {
    _socket?.dispose();
    super.dispose();
  }
}
