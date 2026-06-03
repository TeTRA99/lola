Pod::Spec.new do |s|
  s.name           = 'ExpoVolumeKeys'
  s.version        = '1.0.0'
  s.summary        = 'Physical volume-key press events for Lola'
  s.description    = 'Emits volume up/down key presses so the app can use a double-press as an alternative trigger.'
  s.author         = 'Lola'
  s.homepage       = 'https://docs.expo.dev/modules/'
  s.platforms      = {
    :ios => '16.4',
    :tvos => '16.4'
  }
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  # Swift/Objective-C compatibility
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
  }

  s.source_files = "**/*.{h,m,mm,swift,hpp,cpp}"
end
