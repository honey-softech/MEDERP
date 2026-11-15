import AVFoundation
import Flutter
import UIKit

@main
@objc class AppDelegate: FlutterAppDelegate, FlutterImplicitEngineDelegate {
  override func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?
  ) -> Bool {
    return super.application(application, didFinishLaunchingWithOptions: launchOptions)
  }

  func didInitializeImplicitFlutterEngine(_ engineBridge: FlutterImplicitEngineBridge) {
    GeneratedPluginRegistrant.register(with: engineBridge.pluginRegistry)
    let channel = FlutterMethodChannel(
      name: "mederp/capture",
      binaryMessenger: engineBridge.applicationRegistrar.messenger()
    )
    channel.setMethodCallHandler { call, result in
      guard call.method == "request" else {
        result(FlutterMethodNotImplemented)
        return
      }
      let kind = call.arguments as? String ?? ""
      if kind == "open-settings" {
        result(true)
        if let url = URL(string: UIApplication.openSettingsURLString) {
          DispatchQueue.main.async {
            UIApplication.shared.open(url)
          }
        }
        return
      }
      if kind != "camera" {
        askForMicrophone(result)
        return
      }
      switch AVCaptureDevice.authorizationStatus(for: .video) {
      case .authorized:
        result(true)
      case .notDetermined:
        AVCaptureDevice.requestAccess(for: .video) { granted in
          DispatchQueue.main.async { result(granted) }
        }
      default:
        result(false)
      }
    }
  }
}

private var microphoneWaiters: [FlutterResult] = []
private var microphoneAsking = false

/// One system alert, shared by the page and the web view.
/// WebKit owns the audio session once capture starts. Setting it here as well
/// makes iOS quit the app.
private func askForMicrophone(_ result: @escaping FlutterResult) {
  if !Thread.isMainThread {
    DispatchQueue.main.async { askForMicrophone(result) }
    return
  }
  let answer = answerOnce(result)
  switch microphonePermission() {
  case .granted:
    answer(true)
  case .denied:
    answer(false)
  case .undetermined:
    microphoneWaiters.append(answer)
    if microphoneAsking { return }
    microphoneAsking = true
    let finish: (Bool) -> Void = { granted in
      DispatchQueue.main.async {
        microphoneAsking = false
        let waiters = microphoneWaiters
        microphoneWaiters = []
        waiters.forEach { $0(granted) }
      }
    }
    if #available(iOS 17.0, *) {
      AVAudioApplication.requestRecordPermission(completionHandler: finish)
    } else {
      AVAudioSession.sharedInstance().requestRecordPermission(finish)
    }
  @unknown default:
    answer(false)
  }
}

/// Flutter ends the app if a permission result is delivered twice.
private func answerOnce(_ result: @escaping FlutterResult) -> FlutterResult {
  var answered = false
  return { value in
    if answered { return }
    answered = true
    result(value)
  }
}

private func microphonePermission() -> AVAudioSession.RecordPermission {
  if #available(iOS 17.0, *) {
    switch AVAudioApplication.shared.recordPermission {
    case .granted:
      return .granted
    case .denied:
      return .denied
    default:
      return .undetermined
    }
  }
  return AVAudioSession.sharedInstance().recordPermission
}
