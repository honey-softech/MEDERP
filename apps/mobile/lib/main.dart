import 'dart:async';
import 'dart:io';

import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:mederp_mobile/bill_download.dart';
import 'package:mederp_mobile/pulse_loader.dart';
import 'package:mederp_mobile/push_notifications.dart';
import 'package:mederp_mobile/system_notifications.dart';
import 'package:mederp_mobile/viewport_lock.dart';
import 'package:webview_flutter/webview_flutter.dart';
import 'package:webview_flutter_android/webview_flutter_android.dart';

/// iOS sends these when a redirect, or a second load, stops the navigation
/// already in flight. The page that replaces it still opens.
bool isBenignWebViewError(int errorCode) {
  return errorCode == -999 || errorCode == 102;
}

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
  int _progress = 0;
  bool _failed = false;
  bool _firstPaintDone = false;
  int _openAttempts = 0;
  Timer? _retryTimer;

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
          final sessionAction = nativeSessionAction(raw);
          if (sessionAction == 'signed-out') {
            PushNotifications.stopForSignOut();
            return;
          }
          if (sessionAction == 'signed-in') {
            PushNotifications.resumeAfterSignIn();
            return;
          }
          SystemNotifications.showFromBridge(raw);
        },
      )
      ..setNavigationDelegate(
        NavigationDelegate(
          onProgress: (progress) {
            if (!mounted) return;
            setState(() => _progress = progress);
          },
          onPageStarted: (_) {
            if (!mounted) return;
            setState(() => _failed = false);
          },
          onPageFinished: (_) {
            _retryTimer?.cancel();
            _controller.runJavaScript(viewportLockScript);
            _controller.runJavaScript(inAppToastGuardScript);
            PushNotifications.registerTokenOnSite();
            if (!mounted || (_firstPaintDone && !_failed)) return;
            setState(() {
              _firstPaintDone = true;
              _failed = false;
            });
          },
          onWebResourceError: (error) {
            if (error.isForMainFrame != true || !mounted) return;
            if (isBenignWebViewError(error.errorCode)) return;
            _handleOpenFailure();
          },
        ),
      );
    // The iOS view has to be on screen before the first load. Reading the
    // user agent earlier throws, which was shown as a connection error.
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      _openSite();
    });
    SystemNotifications.ensureReady().catchError((_) {});
    PushNotifications.start(webView: _controller).catchError((_) {});
  }

  @override
  void dispose() {
    _retryTimer?.cancel();
    super.dispose();
  }

  Future<void> _openSite() async {
    _openAttempts += 1;
    try {
      final current = Platform.isIOS ? iosWebViewUserAgent : await _controller.getUserAgent();
      await _controller.setUserAgent(mobileUserAgent(current));
      // iOS adds a user script for this; Android turns off the zoom gesture.
      await _controller.enableZoom(false);
      await _configureAndroid();
      if (!mounted) return;
      await _controller.loadRequest(Uri.parse(medErpSiteUrl));
    } catch (_) {
      _handleOpenFailure();
    }
  }

  /// The first iOS navigation often fails once while the WebView process
  /// starts, then succeeds. Retry that once before asking the user.
  void _handleOpenFailure() {
    if (!mounted) return;
    if (!_firstPaintDone && _openAttempts < 2) {
      _retryTimer?.cancel();
      _retryTimer = Timer(const Duration(milliseconds: 400), () {
        if (!mounted || _firstPaintDone) return;
        _openSite();
      });
      return;
    }
    setState(() => _failed = true);
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
    // The system font-size setting otherwise rescales the page text and the
    // layout reflows as if the user had zoomed in.
    await platform.setTextZoom(100);
    // No glow / rubber-band at the edges — browser behaviour, not app behaviour.
    await platform.setOverScrollMode(WebViewOverScrollMode.never);
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
        body: SafeArea(
          child: Stack(
            children: [
              WebViewWidget(controller: _controller),
              // The site paints its own pulse loader once it is up. Until then
              // the WebView is blank, so the app shows the same loader itself.
              if (!_firstPaintDone && !_failed)
                const Positioned.fill(child: PulseScreen())
              else if (_progress < 100 && !_failed)
                const Align(
                  alignment: Alignment.topCenter,
                  child: SizedBox(
                    height: 36,
                    child: Center(child: PulseDots(size: 7)),
                  ),
                ),
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
                              setState(() => _failed = false);
                              _openAttempts = 0;
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
