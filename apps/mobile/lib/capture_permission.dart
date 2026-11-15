import 'dart:convert';
import 'dart:io';

import 'package:flutter/services.dart';

bool isMicrophoneRequest(String raw) {
  try {
    final decoded = jsonDecode(raw);
    return decoded is Map && decoded['type'] == 'microphone';
  } catch (_) {
    return false;
  }
}

const _channel = MethodChannel('mederp/capture');

/// Shows the iOS microphone or camera alert and waits for the answer.
///
/// The page must not be told it can record until this is true. Letting the
/// web view open the microphone first makes iOS quit the app.
Future<bool> requestIosCapture(String kind) async {
  if (!Platform.isIOS) return false;
  try {
    final granted = await _channel.invokeMethod<bool>('request', kind);
    return granted == true;
  } catch (_) {
    return false;
  }
}
