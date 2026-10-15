import 'package:webview_flutter/webview_flutter.dart';

/// iOS often reports the first WebView navigation as cancelled (-999) while the
/// real page is still opening. Android does the same with ERR_ABORTED.
/// Those are not a missing connection.
bool isIgnoredWebLoadError(WebResourceError error) {
  if (error.errorCode == -999) return true;
  final description = error.description.toLowerCase();
  if (description.contains('err_aborted')) return true;
  if (description.contains('nsurlerrorcancelled')) return true;
  if (description.contains('cancelled') || description.contains('canceled')) return true;
  final url = error.url?.trim() ?? '';
  return url == 'about:blank';
}
