import 'dart:async';

import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:mederp_mobile/bill_download.dart';
import 'package:mederp_mobile/healthcare_loader.dart';
import 'package:mederp_mobile/push_notifications.dart';
import 'package:mederp_mobile/system_notifications.dart';
import 'package:mederp_mobile/web_load_error.dart';
import 'package:webview_flutter/webview_flutter.dart';
import 'package:webview_flutter_android/webview_flutter_android.dart';

/// The installed app opens the same MedERP site used in the browser.
const String medErpSiteUrl = 'https://mederp.co.in';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(const MedErpApp());
}

class MedErpApp extends StatelessWidget {
  const MedErpApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'MedERP',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(seedColor: const Color(0xFFDC2626)),
        useMaterial3: true,
      ),
      home: const MedErpWebPage(),
    );
  }
}

class MedErpWebPage extends StatefulWidget {
  const MedErpWebPage({super.key});

  @override
  State<MedErpWebPage> createState() => _MedErpWebPageState();
}

class _MedErpWebPageState extends State<MedErpWebPage> {
  late final WebViewController _controller;
  bool _failed = false;
  bool _opened = false;
  int _startupAttempts = 0;
  Timer? _startupRetry;

  @override
  void initState() {
    super.initState();
    SystemNotifications.onOpen = _openNotice;
    _controller = WebViewController()
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..setBackgroundColor(Colors.white)
      ..addJavaScriptChannel(
        'MedErpNative',
        onMessageReceived: (message) {
          final raw = message.message;
          if (isNativeDownloadMessage(raw)) {
            final download = parseNativeBillDownload(raw);
            if (download != null) saveNativeBill(download);
            return;
          }
          SystemNotifications.showFromBridge(raw);
        },
      )
      ..setNavigationDelegate(
        NavigationDelegate(
          onPageStarted: (_) {
            if (!mounted) return;
            setState(() => _failed = false);
          },
          onPageFinished: (_) {
            _startupRetry?.cancel();
            _startupAttempts = 0;
            if (mounted) {
              setState(() {
                _opened = true;
                _failed = false;
              });
            } else {
              _opened = true;
            }
            _controller.runJavaScript(keepFieldScaleScript);
            _controller.runJavaScript(inAppToastGuardScript);
            PushNotifications.registerTokenOnSite();
          },
          onWebResourceError: (error) {
            if (error.isForMainFrame != true || !mounted) return;
            if (isIgnoredWebLoadError(error)) return;
            _failOrRetryStartup();
          },
        ),
      );
    // Wait until the iOS web view exists. Loading in initState reports a
    // cancelled first navigation as "no internet", then Try again succeeds.
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) _openSite();
    });
    SystemNotifications.ensureReady().catchError((_) {});
    PushNotifications.start(webView: _controller).catchError((_) {});
  }

  @override
  void dispose() {
    _startupRetry?.cancel();
    super.dispose();
  }

  void _failOrRetryStartup() {
    if (_opened || _startupAttempts >= 2) {
      if (mounted) setState(() => _failed = true);
      return;
    }
    _startupAttempts += 1;
    _startupRetry?.cancel();
    _startupRetry = Timer(Duration(milliseconds: 400 * _startupAttempts), () {
      if (!mounted || _opened) return;
      _controller.loadRequest(Uri.parse(medErpSiteUrl));
    });
  }

  Future<void> _openSite() async {
    try {
      final current = await _controller.getUserAgent();
      await _controller.setUserAgent(mobileUserAgent(current));
      await _configureAndroid();
      if (!mounted) return;
      await _controller.loadRequest(Uri.parse(medErpSiteUrl));
    } catch (_) {
      if (!mounted) return;
      _failOrRetryStartup();
    }
  }

  void _openNotice(String href) {
    final trimmed = href.trim();
    if (trimmed.isEmpty) return;
    final site = Uri.parse(medErpSiteUrl);
    final target = trimmed.startsWith('http') ? Uri.tryParse(trimmed) : site.resolve(trimmed);
    if (target == null) return;
    if (target.host.isNotEmpty && target.host != site.host) return;
    _controller.loadRequest(target);
  }

  Future<void> _configureAndroid() async {
    final platform = _controller.platform;
    if (platform is! AndroidWebViewController) return;
    await platform.setUseWideViewPort(true);
    await platform.setOnShowFileSelector(_pickAndroidFiles);
  }

  Future<List<String>> _pickAndroidFiles(FileSelectorParams params) async {
    final result = await FilePicker.platform.pickFiles(
      allowMultiple: params.mode == FileSelectorMode.openMultiple,
      type: FileType.any,
    );
    if (result == null) return const [];
    return [
      for (final file in result.files)
        if (file.path != null) Uri.file(file.path!).toString(),
    ];
  }

  Future<void> _goBackOrExit() async {
    if (await _controller.canGoBack()) {
      await _controller.goBack();
      return;
    }
    await SystemNavigator.pop();
  }

  @override
  Widget build(BuildContext context) {
    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop) _goBackOrExit();
      },
      child: Scaffold(
        backgroundColor: Colors.white,
        // The web page already moves for the keyboard. Shrinking the WebView
        // as well leaves gray bars and a shifted page on iOS.
        resizeToAvoidBottomInset: false,
        body: SafeArea(
          child: Stack(
            children: [
              WebViewWidget(controller: _controller),
              if (!_opened && !_failed) const HealthcareLoader(),
              if (_failed)
                ColoredBox(
                  color: Colors.white,
                  child: Center(
                    child: Padding(
                      padding: const EdgeInsets.all(24),
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          const Text('Could not open MedERP. Check the internet connection and try again.'),
                          const SizedBox(height: 16),
                          FilledButton(
                            onPressed: () {
                              _startupAttempts = 0;
                              setState(() => _failed = false);
                              _openSite();
                            },
                            child: const Text('Try again'),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}
