import React, { useState, useRef, useEffect } from 'react';
import { ArrowLeft, FileAudio, Play, Pause, RotateCcw } from 'lucide-react';

interface SkipSilencePlayerProps {
  onBack: () => void;
}

export const SkipSilencePlayer: React.FC<SkipSilencePlayerProps> = ({ onBack }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);

  // Skip-Silence Parameters
  const [threshold, setThreshold] = useState(0.01);
  const [minSilence, setMinSilence] = useState(0.3);
  const [normalSpeed, setNormalSpeed] = useState(1.0);
  const [silenceSpeed, setSilenceSpeed] = useState(2.0);

  // Audio analysis state
  const [isSilent, setIsSilent] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  const videoRef = useRef<HTMLVideoElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const silenceStartTimeRef = useRef<number | null>(null);
  const animationIdRef = useRef<number | null>(null);

  // Time saved tracking
  const [timeSaved, setTimeSaved] = useState(0);
  const timeSavedRef = useRef(0);
  const lastUpdateTimeRef = useRef<number | null>(null);
  const lastMediaTimeRef = useRef(0);

  // Handle file selection
  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      console.log('📁 File selected:', file.name, file.type);

      // Clean up previous resources
      if (videoUrl) {
        URL.revokeObjectURL(videoUrl);
      }

      // Reset audio context for new file
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        console.log('🔇 Closing previous audio context');
        audioContextRef.current.close();
        audioContextRef.current = null;
        sourceRef.current = null;
        analyserRef.current = null;
      }

      const url = URL.createObjectURL(file);
      console.log('📎 Created blob URL:', url);
      setVideoUrl(url);

      // Reset playback state
      setIsPlaying(false);
      setCurrentTime(0);
      setDuration(0);
      setIsSilent(false);
      setTimeSaved(0);
      timeSavedRef.current = 0;
      lastUpdateTimeRef.current = null;
      lastMediaTimeRef.current = 0;
    }
  };

  // Initialize audio analysis when video loads
  const handleVideoLoaded = () => {
    console.log('🎬 Video metadata loaded');
    if (videoRef.current) {
      setDuration(videoRef.current.duration);
      console.log('📹 Video duration:', videoRef.current.duration);

      // Setup Web Audio API (only once per video element)
      if (!audioContextRef.current && !sourceRef.current) {
        try {
          console.log('🎵 Setting up Web Audio API...');
          audioContextRef.current = new AudioContext();
          analyserRef.current = audioContextRef.current.createAnalyser();
          analyserRef.current.fftSize = 2048;

          // Only create source once per video element
          sourceRef.current = audioContextRef.current.createMediaElementSource(videoRef.current);
          sourceRef.current.connect(analyserRef.current);
          analyserRef.current.connect(audioContextRef.current.destination);

          console.log('✅ Web Audio API setup complete:', {
            contextState: audioContextRef.current.state,
            sampleRate: audioContextRef.current.sampleRate,
            fftSize: analyserRef.current.fftSize
          });
        } catch (error) {
          console.error('❌ Failed to setup audio analysis:', error);
        }
      } else {
        console.log('⚠️ Web Audio API already initialized');
      }
    }
  };

  // Audio analysis loop with time saved calculation
  const analyzeAudio = () => {
    if (!analyserRef.current || !videoRef.current || !isPlaying) {
      console.log('❌ Audio analysis stopped:', {
        analyser: !!analyserRef.current,
        video: !!videoRef.current,
        isPlaying
      });
      return;
    }

    // Resume audio context if suspended (browser autoplay policy)
    if (audioContextRef.current?.state === 'suspended') {
      console.log('🔊 Resuming suspended audio context');
      audioContextRef.current.resume();
    }

    const now = performance.now();
    const currentMediaTime = videoRef.current.currentTime;

    // Calculate time saved
    if (lastUpdateTimeRef.current !== null && lastMediaTimeRef.current !== null) {
      const wallClockDelta = (now - lastUpdateTimeRef.current) / 1000; // Convert to seconds
      const mediaDelta = currentMediaTime - lastMediaTimeRef.current;

      // Expected time at normal speed vs actual wall clock time
      const expectedDelta = mediaDelta / normalSpeed;
      const savedThisFrame = expectedDelta - wallClockDelta;

      timeSavedRef.current += savedThisFrame;

      // Update state periodically (every ~500ms to avoid too many re-renders)
      if (Math.floor(now / 500) !== Math.floor((now - wallClockDelta * 1000) / 500)) {
        console.log('💾 Time saved update:', timeSavedRef.current.toFixed(2), 'seconds');
        setTimeSaved(timeSavedRef.current);
      }
    }

    lastUpdateTimeRef.current = now;
    lastMediaTimeRef.current = currentMediaTime;

    const bufferLength = analyserRef.current.fftSize;
    const dataArray = new Uint8Array(bufferLength);
    analyserRef.current.getByteTimeDomainData(dataArray);

    // Check if we're getting valid audio data
    const hasAudioData = dataArray.some(val => val !== 128);
    if (!hasAudioData && Math.random() < 0.05) {
      console.warn('⚠️ No audio data detected - all values are 128!');
    }

    // Calculate RMS amplitude
    let sum = 0;
    let min = 255;
    let max = 0;
    for (let i = 0; i < bufferLength; i++) {
      const value = (dataArray[i] - 128) / 128;
      sum += value * value;
      min = Math.min(min, dataArray[i]);
      max = Math.max(max, dataArray[i]);
    }
    const rms = Math.sqrt(sum / bufferLength);

    // Log RMS value periodically for debugging
    if (Math.random() < 0.02) { // Log ~2% of the time to avoid spam
      console.log('📊 Audio Analysis:', {
        rms: rms.toFixed(4),
        threshold: threshold,
        isSilent: rms < threshold,
        dataRange: `${min}-${max}`,
        hasData: hasAudioData,
        playbackRate: videoRef.current.playbackRate,
        currentSpeed: isSilent ? silenceSpeed : normalSpeed
      });
    }

    // Detect silence
    const currentIsSilent = rms < threshold;
    const silenceNow = Date.now();

    if (currentIsSilent) {
      // Start tracking silence duration
      if (silenceStartTimeRef.current === null) {
        silenceStartTimeRef.current = silenceNow;
        console.log('🔇 Silence detected, started tracking');
      } else {
        // Check if silence duration exceeds minimum
        const silenceDuration = (silenceNow - silenceStartTimeRef.current) / 1000;
        if (silenceDuration >= minSilence) {
          // Apply silence speed
          if (videoRef.current.playbackRate !== silenceSpeed) {
            console.log(`⏩ Applying silence speed: ${silenceSpeed}x (silence duration: ${silenceDuration.toFixed(1)}s)`);
            videoRef.current.playbackRate = silenceSpeed;
            setIsSilent(true);
          }
        }
      }
    } else {
      // Reset to normal speed when sound returns
      if (silenceStartTimeRef.current !== null) {
        console.log('🔊 Audio detected, resetting to normal speed');
      }
      silenceStartTimeRef.current = null;
      if (videoRef.current.playbackRate !== normalSpeed) {
        console.log(`⏯️ Applying normal speed: ${normalSpeed}x`);
        videoRef.current.playbackRate = normalSpeed;
        setIsSilent(false);
      }
    }

    // Continue analysis loop
    animationIdRef.current = requestAnimationFrame(analyzeAudio);
  };

  // Play/Pause control
  const togglePlayback = () => {
    console.log('🎮 Toggle playback called, current state:', isPlaying);
    if (!videoRef.current) {
      console.error('❌ No video ref!');
      return;
    }

    if (isPlaying) {
      console.log('⏸️ Pausing video...');
      videoRef.current.pause();
      setIsPlaying(false);
      if (animationIdRef.current) {
        cancelAnimationFrame(animationIdRef.current);
        animationIdRef.current = null;
      }
      // Reset time tracking on pause
      lastUpdateTimeRef.current = null;
    } else {
      console.log('▶️ Starting playback...');

      // Check audio context state
      if (audioContextRef.current) {
        console.log('🔊 Audio context state:', audioContextRef.current.state);
        if (audioContextRef.current.state === 'suspended') {
          console.log('🔊 Resuming suspended audio context');
          audioContextRef.current.resume();
        }
      } else {
        console.warn('⚠️ No audio context available!');
      }

      videoRef.current.play().then(() => {
        console.log('✅ Video playing successfully');
        setIsPlaying(true);
        // Reset time tracking on play
        lastUpdateTimeRef.current = null;
        lastMediaTimeRef.current = videoRef.current?.currentTime || 0;

        // Check if audio analysis is ready
        if (!analyserRef.current || !audioContextRef.current) {
          console.warn('⚠️ Audio analysis not ready, initializing now...');
          handleVideoLoaded();
        }

        console.log('🚀 Starting audio analysis...', {
          hasAnalyser: !!analyserRef.current,
          hasContext: !!audioContextRef.current,
          hasSource: !!sourceRef.current
        });
        analyzeAudio();
      }).catch(error => {
        console.error('❌ Error playing video:', error);
        setIsPlaying(false);
      });
    }
  };

  // Reset playback
  const resetPlayback = () => {
    if (videoRef.current) {
      videoRef.current.currentTime = 0;
      setCurrentTime(0);
      // Reset time saved
      timeSavedRef.current = 0;
      setTimeSaved(0);
      lastUpdateTimeRef.current = null;
      lastMediaTimeRef.current = 0;
      if (isPlaying) {
        togglePlayback();
      }
    }
  };

  // Update current time
  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
    }
  };

  // Handle seeking
  const handleSeeking = () => {
    // Reset tracking points without losing cumulative time saved
    lastUpdateTimeRef.current = null;
    lastMediaTimeRef.current = videoRef.current?.currentTime || 0;
  };

  const handleSeeked = () => {
    // Resume tracking from new position
    lastUpdateTimeRef.current = performance.now();
    lastMediaTimeRef.current = videoRef.current?.currentTime || 0;
  };

  // Handle scrubber click to seek
  const handleProgressClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!videoRef.current || !duration) return;

    const rect = event.currentTarget.getBoundingClientRect();
    const clickX = event.clientX - rect.left;
    const percentClicked = clickX / rect.width;
    const newTime = percentClicked * duration;

    videoRef.current.currentTime = newTime;
    setCurrentTime(newTime);
  };

  // Format time for display
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Format time saved for display
  const formatTimeSaved = (seconds: number): string => {
    const absSeconds = Math.abs(seconds);
    const mins = Math.floor(absSeconds / 60);
    const secs = Math.floor(absSeconds % 60);

    if (seconds === 0) return '0s';

    const sign = seconds < 0 ? '-' : '+';

    if (mins > 0) {
      return `${sign}${mins}m ${secs}s`;
    } else {
      return `${sign}${secs}s`;
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (animationIdRef.current) {
        cancelAnimationFrame(animationIdRef.current);
      }
      if (videoUrl) {
        URL.revokeObjectURL(videoUrl);
      }
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close();
      }
      // Reset sources
      sourceRef.current = null;
      analyserRef.current = null;
    };
  }, [videoUrl]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-white p-8">
      {/* Header */}
      <div className="max-w-7xl mx-auto">
        <button
          onClick={onBack}
          className="mb-8 flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
          style={{ fontFamily: 'Space Mono, monospace' }}
        >
          <ArrowLeft className="h-5 w-5" />
          Back to Home
        </button>

        <div className="bg-white rounded-2xl shadow-lg p-8">
          <h1
            className="text-4xl mb-2"
            style={{
              fontFamily: 'Courier Prime, monospace',
              fontWeight: 700,
              color: '#1F2937'
            }}
          >
            Skip-Silence Player
          </h1>
          <p className="text-gray-600 mb-8" style={{ fontFamily: 'Space Mono, monospace' }}>
            Play files with automatic silence skipping for faster playback
          </p>

          {/* File Input */}
          <div className="mb-8">
            <label className="block mb-4">
              <span className="text-gray-700" style={{ fontFamily: 'Space Mono, monospace' }}>
                Select Audio/Video File
              </span>
              <input
                type="file"
                accept="audio/*,video/*"
                onChange={handleFileSelect}
                className="mt-2 block w-full text-sm text-gray-500
                  file:mr-4 file:py-2 file:px-4
                  file:rounded-full file:border-0
                  file:text-sm file:font-semibold
                  file:bg-orange-50 file:text-orange-700
                  hover:file:bg-orange-100
                  file:cursor-pointer"
              />
            </label>
          </div>

          {/* Video Player */}
          {videoUrl && (
            <div className="mb-8">
              <video
                ref={videoRef}
                src={videoUrl}
                onLoadedMetadata={handleVideoLoaded}
                onTimeUpdate={handleTimeUpdate}
                onPlay={() => {
                  console.log('🎵 Video onPlay event fired');
                  setIsPlaying(true);
                }}
                onPause={() => {
                  console.log('⏸️ Video onPause event fired');
                  setIsPlaying(false);
                }}
                onEnded={() => {
                  console.log('⏹️ Video onEnded event fired');
                  setIsPlaying(false);
                  if (animationIdRef.current) {
                    cancelAnimationFrame(animationIdRef.current);
                    animationIdRef.current = null;
                  }
                }}
                onSeeking={handleSeeking}
                onSeeked={handleSeeked}
                onError={(e) => {
                  console.error('Video playback error:', e);
                  setIsPlaying(false);
                }}
                className="w-full rounded-lg bg-black"
                style={{ maxHeight: '400px' }}
              />

              {/* Playback Controls */}
              <div className="mt-4 flex items-center gap-4">
                <button
                  onClick={togglePlayback}
                  className="p-3 bg-orange-500 text-white rounded-full hover:bg-orange-600 transition-colors"
                >
                  {isPlaying ? <Pause className="h-6 w-6" /> : <Play className="h-6 w-6" />}
                </button>

                <button
                  onClick={resetPlayback}
                  className="p-3 bg-gray-200 text-gray-700 rounded-full hover:bg-gray-300 transition-colors"
                >
                  <RotateCcw className="h-6 w-6" />
                </button>

                <div className="flex-1 flex items-center gap-4">
                  <span style={{ fontFamily: 'Space Mono, monospace' }}>
                    {formatTime(currentTime)}
                  </span>
                  <div
                    className="flex-1 bg-gray-200 rounded-full h-2 cursor-pointer hover:bg-gray-300 transition-colors"
                    onClick={handleProgressClick}
                  >
                    <div
                      className="bg-orange-500 h-2 rounded-full transition-all pointer-events-none"
                      style={{ width: `${(currentTime / duration) * 100}%` }}
                    />
                  </div>
                  <span style={{ fontFamily: 'Space Mono, monospace' }}>
                    {formatTime(duration)}
                  </span>
                </div>

                {/* Silence Indicator */}
                {isPlaying && (
                  <div className={`px-3 py-1 rounded-full text-sm ${
                    isSilent ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'
                  }`} style={{ fontFamily: 'Space Mono, monospace' }}>
                    {isSilent ? `SILENT (${silenceSpeed}x)` : `AUDIO (${normalSpeed}x)`}
                  </div>
                )}
              </div>

              {/* Time Saved Display */}
              {videoUrl && (
                <div className="mt-4 p-4 bg-gradient-to-r from-green-50 to-blue-50 rounded-lg border-2 border-green-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-sm text-gray-600" style={{ fontFamily: 'Space Mono, monospace' }}>
                        Time Saved:
                      </span>
                      <span className="ml-2 text-2xl font-bold text-green-600" style={{ fontFamily: 'Courier Prime, monospace' }}>
                        {formatTimeSaved(timeSaved)}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-sm text-gray-600" style={{ fontFamily: 'Space Mono, monospace' }}>
                        Efficiency:
                      </span>
                      <span className="ml-2 text-xl font-bold text-blue-600" style={{ fontFamily: 'Courier Prime, monospace' }}>
                        {currentTime > 0 ? ((timeSaved / (currentTime / normalSpeed)) * 100).toFixed(1) : '0.0'}%
                      </span>
                    </div>
                  </div>
                  <div className="mt-2 text-xs text-gray-500" style={{ fontFamily: 'Space Mono, monospace' }}>
                    Normal: {normalSpeed}x | Silence: {silenceSpeed}x
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Skip-Silence Controls */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Volume Threshold */}
            <div className="bg-gray-50 rounded-lg p-4">
              <label className="block mb-2">
                <span className="text-gray-700 font-semibold" style={{ fontFamily: 'Space Mono, monospace' }}>
                  Volume Threshold: {threshold.toFixed(3)}
                </span>
                <span className="text-gray-500 text-sm ml-2">
                  (lower = more sensitive)
                </span>
              </label>
              <input
                type="range"
                min="0.005"
                max="0.1"
                step="0.001"
                value={threshold}
                onChange={(e) => setThreshold(parseFloat(e.target.value))}
                className="w-full"
              />
            </div>

            {/* Minimum Silence Duration */}
            <div className="bg-gray-50 rounded-lg p-4">
              <label className="block mb-2">
                <span className="text-gray-700 font-semibold" style={{ fontFamily: 'Space Mono, monospace' }}>
                  Min Silence Duration: {minSilence.toFixed(1)}s
                </span>
                <span className="text-gray-500 text-sm ml-2">
                  (skip after this duration)
                </span>
              </label>
              <input
                type="range"
                min="0.1"
                max="2"
                step="0.1"
                value={minSilence}
                onChange={(e) => setMinSilence(parseFloat(e.target.value))}
                className="w-full"
              />
            </div>

            {/* Normal Speed */}
            <div className="bg-gray-50 rounded-lg p-4">
              <label className="block mb-2">
                <span className="text-gray-700 font-semibold" style={{ fontFamily: 'Space Mono, monospace' }}>
                  Normal Speed: {normalSpeed.toFixed(1)}x
                </span>
                <span className="text-gray-500 text-sm ml-2">
                  (speed during audio)
                </span>
              </label>
              <input
                type="range"
                min="0.5"
                max="3"
                step="0.1"
                value={normalSpeed}
                onChange={(e) => setNormalSpeed(parseFloat(e.target.value))}
                className="w-full"
              />
            </div>

            {/* Silence Speed */}
            <div className="bg-gray-50 rounded-lg p-4">
              <label className="block mb-2">
                <span className="text-gray-700 font-semibold" style={{ fontFamily: 'Space Mono, monospace' }}>
                  Silence Speed: {silenceSpeed.toFixed(1)}x
                </span>
                <span className="text-gray-500 text-sm ml-2">
                  (speed during silence)
                </span>
              </label>
              <input
                type="range"
                min="1"
                max="10"
                step="0.5"
                value={silenceSpeed}
                onChange={(e) => setSilenceSpeed(parseFloat(e.target.value))}
                className="w-full"
              />
            </div>
          </div>

          {/* Info Box */}
          <div className="mt-8 p-4 bg-blue-50 rounded-lg border border-blue-200">
            <div className="flex items-start gap-3">
              <FileAudio className="h-5 w-5 text-blue-600 mt-0.5" />
              <div>
                <p className="text-blue-900 font-semibold" style={{ fontFamily: 'Space Mono, monospace' }}>
                  How It Works
                </p>
                <p className="text-blue-700 text-sm mt-1">
                  This player analyzes audio in real-time using the Web Audio API. When silence is detected
                  (volume below threshold) for the minimum duration, playback speeds up automatically.
                  All processing happens locally in your browser - no data leaves your device.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};