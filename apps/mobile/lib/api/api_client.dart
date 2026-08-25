import 'dart:convert';
import 'dart:io';

import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;

class ApiClient {
  ApiClient({String? baseUrl}) : baseUrl = baseUrl ?? defaultBaseUrl;

  final String baseUrl;

  static String get defaultBaseUrl {
    if (!kIsWeb && Platform.isAndroid) {
      return 'http://10.0.2.2:3000';
    }
    return 'http://localhost:3000';
  }

  Future<Map<String, dynamic>> health() async {
    final response = await http.get(Uri.parse('$baseUrl/api/health'));
    return jsonDecode(response.body) as Map<String, dynamic>;
  }

  Future<List<dynamic>> patients() async {
    final response = await http.get(Uri.parse('$baseUrl/api/patients'));
    final body = jsonDecode(response.body) as Map<String, dynamic>;
    return (body['patients'] as List<dynamic>?) ?? [];
  }
}
