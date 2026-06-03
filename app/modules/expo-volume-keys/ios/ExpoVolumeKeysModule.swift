import ExpoModulesCore
import AVFoundation
import MediaPlayer
import UIKit

// iOS has no public volume-key event, so we observe AVAudioSession.outputVolume
// (KVO) and infer the press direction from the delta. A hidden MPVolumeView keeps
// the reading reliable while observing. Best-effort: no event fires at the volume
// extremes (0 or 1, where outputVolume can't change further). The OS still changes
// the volume — we only listen. This is acceptable since Lola is sideload /
// free-provisioning only (never App Store). JS does the double-press windowing.
public class ExpoVolumeKeysModule: Module {
  private var observation: NSKeyValueObservation?
  private var hiddenVolumeView: MPVolumeView?
  private var lastVolume: Float = -1

  public func definition() -> ModuleDefinition {
    Name("ExpoVolumeKeys")
    Events("onVolumeKey")

    // Only observe while JS has a listener attached (volume trigger on + Home idle).
    OnStartObserving {
      DispatchQueue.main.async { self.startObserving() }
    }
    OnStopObserving {
      DispatchQueue.main.async { self.stopObserving() }
    }
  }

  private func startObserving() {
    let session = AVAudioSession.sharedInstance()
    try? session.setActive(true)
    lastVolume = session.outputVolume

    if hiddenVolumeView == nil {
      let view = MPVolumeView(frame: CGRect(x: -3000, y: -3000, width: 1, height: 1))
      view.alpha = 0.0001
      keyWindow()?.addSubview(view)
      hiddenVolumeView = view
    }

    observation = session.observe(\.outputVolume, options: [.new]) { [weak self] session, _ in
      guard let self = self else { return }
      let newVolume = session.outputVolume
      let prev = self.lastVolume
      self.lastVolume = newVolume
      if prev < 0 { return }
      if newVolume > prev {
        self.sendEvent("onVolumeKey", ["key": "up"])
      } else if newVolume < prev {
        self.sendEvent("onVolumeKey", ["key": "down"])
      }
    }
  }

  private func stopObserving() {
    observation?.invalidate()
    observation = nil
    hiddenVolumeView?.removeFromSuperview()
    hiddenVolumeView = nil
    lastVolume = -1
  }

  private func keyWindow() -> UIWindow? {
    return UIApplication.shared.connectedScenes
      .compactMap { $0 as? UIWindowScene }
      .flatMap { $0.windows }
      .first { $0.isKeyWindow } ?? UIApplication.shared.windows.first
  }
}
