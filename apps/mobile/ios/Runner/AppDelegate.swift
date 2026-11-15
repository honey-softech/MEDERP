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
/// The website prompt from the simulator does not appear on an installed iPhone.
private func askForMicrophone(_ result: @escaping FlutterResult) {
  if !Thread.isMainThread {
    DispatchQueue.main.async { askForMicrophone(result) }
    return
  }
  switch microphonePermission() {
  case .granted:
    activateRecordSession()
    result(true)
  case .denied:
    result(false)
  case .undetermined:
    microphoneWaiters.append(result)
    if microphoneAsking { return }
    microphoneAsking = true
    // The category has to be set before the alert, or a phone shows nothing.
    let session = AVAudioSession.sharedInstance()
    try? session.setCategory(
      .playAndRecord,
      mode: .default,
      options: [.defaultToSpeaker, .allowBluetoothHFP]
    )
    let finish: (Bool) -> Void = { granted in
      DispatchQueue.main.async {
        microphoneAsking = false
        if granted {
          activateRecordSession()
        }
        let waiters = microphoneWaiters
        microphoneWaiters = []
        waiters.forEach { $0(granted) }
      }
    }
    if #available(iOS 17.0, *) {
      AVAudioApplication.requestRecordPermission(completionHandler: finish)
    } else {
      session.requestRecordPermission(finish)
    }
  @unknown default:
    result(false)
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

/// WebKit opens the microphone as soon as the page is allowed to record.
/// The session has to be ready first, or iOS quits the app.
private func activateRecordSession() {
  let session = AVAudioSession.sharedInstance()
  try? session.setCategory(
    .playAndRecord,
    mode: .default,
    options: [.defaultToSpeaker, .allowBluetoothHFP]
  )
  try? session.setActive(true)
}
