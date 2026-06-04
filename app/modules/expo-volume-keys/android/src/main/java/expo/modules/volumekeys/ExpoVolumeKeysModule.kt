package expo.modules.volumekeys

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

// Emits one "onVolumeKey" event per physical volume-key press. The Activity owns
// the key events (it overrides onKeyDown), so it calls emitVolumeKey(...) on the
// live module instance. The Activity NEVER consumes the key, so the OS still
// changes the volume — we only observe. JS does the double-press windowing.
class ExpoVolumeKeysModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("ExpoVolumeKeys")
    Events("onVolumeKey")

    OnCreate {
      instance = this@ExpoVolumeKeysModule
    }
    OnDestroy {
      if (instance === this@ExpoVolumeKeysModule) {
        instance = null
      }
    }
  }

  companion object {
    // @Volatile: written on the module lifecycle thread (OnCreate/OnDestroy),
    // read on the UI thread (MainActivity.onKeyDown) — ensures cross-thread visibility.
    @Volatile
    private var instance: ExpoVolumeKeysModule? = null

    // Called from MainActivity.onKeyDown. `key` is "up" or "down". sendEvent only
    // delivers when JS has a listener attached, so this is a no-op otherwise.
    @JvmStatic
    fun emitVolumeKey(key: String) {
      instance?.sendEvent("onVolumeKey", mapOf("key" to key))
    }
  }
}
