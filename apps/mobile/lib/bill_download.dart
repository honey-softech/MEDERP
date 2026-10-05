import 'dart:convert';
import 'dart:typed_data';

import 'package:file_picker/file_picker.dart';

class NativeBillDownload {
  const NativeBillDownload({required this.filename, required this.bytes});

  final String filename;
  final Uint8List bytes;
}

bool isNativeDownloadMessage(String raw) {
  try {
    final decoded = jsonDecode(raw);
    return decoded is Map && decoded['type'] == 'download';
  } catch (_) {
    return false;
  }
}

String safeBillFilename(String filename) {
  final cleaned = filename.trim().replaceAll(RegExp(r'[^\w.\-]+'), '_');
  if (cleaned.isEmpty) return 'bill.pdf';
  if (cleaned.toLowerCase().endsWith('.pdf')) return cleaned;
  return '$cleaned.pdf';
}

NativeBillDownload? parseNativeBillDownload(String raw) {
  try {
    final decoded = jsonDecode(raw);
    if (decoded is! Map || decoded['type'] != 'download') return null;
    final filename = decoded['filename'];
    final base64 = decoded['base64'];
    if (filename is! String || base64 is! String || base64.isEmpty) return null;
    final bytes = base64Decode(base64);
    if (bytes.isEmpty) return null;
    return NativeBillDownload(filename: safeBillFilename(filename), bytes: bytes);
  } catch (_) {
    return null;
  }
}

Future<void> saveNativeBill(NativeBillDownload download) async {
  try {
    await FilePicker.platform.saveFile(
      dialogTitle: 'Save bill',
      fileName: download.filename,
      type: FileType.custom,
      allowedExtensions: const ['pdf'],
      bytes: download.bytes,
    );
  } catch (_) {
    // The system dialog can be dismissed or unavailable. The bill page stays open.
  }
}
