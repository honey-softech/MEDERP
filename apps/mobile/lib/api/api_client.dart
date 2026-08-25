import 'dart:convert';
import 'dart:io';

import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import 'package:mederp_mobile/session.dart';

class StaffNotice {
  StaffNotice({
    required this.id,
    required this.title,
    required this.body,
    this.href,
    required this.isRead,
    required this.createdAt,
  });

  final String id;
  final String title;
  final String body;
  final String? href;
  final bool isRead;
  final String createdAt;

  factory StaffNotice.fromJson(Map<String, dynamic> json) {
    return StaffNotice(
      id: json['id'] as String,
      title: json['title'] as String? ?? '',
      body: json['body'] as String? ?? '',
      href: json['href'] as String?,
      isRead: json['isRead'] == true,
      createdAt: json['createdAt']?.toString() ?? '',
    );
  }

  StaffNotice copyWith({bool? isRead}) {
    return StaffNotice(
      id: id,
      title: title,
      body: body,
      href: href,
      isRead: isRead ?? this.isRead,
      createdAt: createdAt,
    );
  }
}

class ApiClient {
  ApiClient({String? baseUrl}) : baseUrl = baseUrl ?? defaultBaseUrl;

  final String baseUrl;

  static String get defaultBaseUrl {
    if (!kIsWeb && Platform.isAndroid) {
      return 'http://10.0.2.2:3000';
    }
    return 'http://localhost:3000';
  }

  Map<String, String> _headers({bool jsonBody = false}) {
    return {
      if (jsonBody) 'Content-Type': 'application/json',
      if (SessionStore.token != null) 'Authorization': 'Bearer ${SessionStore.token}',
    };
  }

  Future<Map<String, dynamic>> _json(http.Response response) async {
    final body = response.body.isEmpty ? <String, dynamic>{} : jsonDecode(response.body);
    if (body is Map<String, dynamic>) return body;
    return {'error': 'Unexpected response.'};
  }

  Future<Map<String, dynamic>> health() async {
    final response = await http.get(Uri.parse('$baseUrl/api/health'));
    return _json(response);
  }

  Future<Map<String, dynamic>> login({required String identifier, required String password}) async {
    final response = await http.post(
      Uri.parse('$baseUrl/api/auth/login'),
      headers: _headers(jsonBody: true),
      body: jsonEncode({'identifier': identifier, 'password': password}),
    );
    return _json(response);
  }

  Future<void> logout() async {
    await http.post(Uri.parse('$baseUrl/api/auth/logout'), headers: _headers(jsonBody: true));
  }

  Future<({List<StaffNotice> notifications, int unreadCount})> notifications() async {
    final response = await http.get(Uri.parse('$baseUrl/api/notifications'), headers: _headers());
    final body = await _json(response);
    final rows = (body['notifications'] as List<dynamic>? ?? [])
        .whereType<Map>()
        .map((row) => StaffNotice.fromJson(Map<String, dynamic>.from(row)))
        .toList();
    return (notifications: rows, unreadCount: (body['unreadCount'] as num?)?.toInt() ?? 0);
  }

  Future<void> markNotifications({List<String>? ids, bool all = false}) async {
    await http.patch(
      Uri.parse('$baseUrl/api/notifications'),
      headers: _headers(jsonBody: true),
      body: jsonEncode(all ? {'all': true} : {'ids': ids ?? []}),
    );
  }

  Future<List<dynamic>> patients() async {
    final response = await http.get(Uri.parse('$baseUrl/api/patients'), headers: _headers());
    final body = await _json(response);
    return (body['patients'] as List<dynamic>?) ?? [];
  }
}
