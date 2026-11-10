import React, { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { View, StyleSheet, Platform } from 'react-native';

export interface PlaybackStatus {
  isLoaded: boolean;
  isPlaying: boolean;
  durationMillis?: number;
  positionMillis?: number;
  shouldPlay?: boolean;
  isLooping?: boolean;
  isMuted?: boolean;
  didJustFinish?: boolean;
}

export interface VideoProps {
  source?: { uri?: string } | string;
  style?: any;
  resizeMode?: 'cover' | 'contain' | 'stretch';
  shouldPlay?: boolean;
  isLooping?: boolean;
  isMuted?: boolean;
  volume?: number;
  useNativeControls?: boolean;
  onPlaybackStatusUpdate?: (status: PlaybackStatus) => void;
  onReadyForDisplay?: () => void;
  onLoad?: (status: PlaybackStatus) => void;
  onLoadStart?: () => void;
  onError?: (error: any) => void;
  posterSource?: { uri: string };
  usePoster?: boolean;
  children?: React.ReactNode;
}

export interface VideoRef {
  playAsync: () => Promise<void>;
  pauseAsync: () => Promise<void>;
  stopAsync: () => Promise<void>;
  setPositionAsync: (millis: number) => Promise<void>;
  setIsMutedAsync: (muted: boolean) => Promise<void>;
  unloadAsync: () => Promise<void>;
  getStatusAsync: () => Promise<PlaybackStatus>;
}

export const Video = forwardRef<VideoRef, VideoProps>((props, ref) => {
  const videoElRef = useRef<HTMLVideoElement | null>(null);
  const uri = typeof props.source === 'string' ? props.source : props.source?.uri;

  useImperativeHandle(ref, () => ({
    playAsync: async () => {
      if (videoElRef.current) {
        try {
          await videoElRef.current.play();
        } catch {
          if (!videoElRef.current.muted) {
            videoElRef.current.muted = true;
            try {
              await videoElRef.current.play();
            } catch {}
          }
        }
      }
    },
    pauseAsync: async () => {
      if (videoElRef.current) {
        videoElRef.current.pause();
      }
    },
    stopAsync: async () => {
      if (videoElRef.current) {
        videoElRef.current.pause();
        videoElRef.current.currentTime = 0;
      }
    },
    setPositionAsync: async (millis: number) => {
      if (videoElRef.current) {
        videoElRef.current.currentTime = millis / 1000;
      }
    },
    setIsMutedAsync: async (muted: boolean) => {
      if (videoElRef.current) {
        videoElRef.current.muted = muted;
      }
    },
    unloadAsync: async () => {
      if (videoElRef.current) {
        videoElRef.current.pause();
        videoElRef.current.src = '';
      }
    },
    getStatusAsync: async (): Promise<PlaybackStatus> => {
      if (!videoElRef.current) {
        return { isLoaded: false, isPlaying: false };
      }
      return {
        isLoaded: true,
        isPlaying: !videoElRef.current.paused,
        durationMillis: (videoElRef.current.duration || 0) * 1000,
        positionMillis: (videoElRef.current.currentTime || 0) * 1000,
        isLooping: videoElRef.current.loop,
        isMuted: videoElRef.current.muted,
      };
    },
  }));

  useEffect(() => {
    const el = videoElRef.current;
    if (!el) return;

    if (props.shouldPlay) {
      const p = el.play();
      if (p !== undefined) {
        p.catch(() => {
          if (!el.muted) {
            el.muted = true;
            el.play().catch(() => {});
          }
        });
      }
    } else {
      el.pause();
    }
  }, [props.shouldPlay]);

  useEffect(() => {
    const el = videoElRef.current;
    if (!el) return;
    el.muted = !!props.isMuted;
  }, [props.isMuted]);

  useEffect(() => {
    const el = videoElRef.current;
    if (!el) return;
    if (typeof props.volume === 'number') {
      el.volume = Math.max(0, Math.min(1, props.volume));
    }
  }, [props.volume]);

  useEffect(() => {
    const el = videoElRef.current;
    if (!el) return;
    el.loop = !!props.isLooping;
  }, [props.isLooping]);

  const emitStatusUpdate = (isBuffering = false) => {
    if (!videoElRef.current || !props.onPlaybackStatusUpdate) return;
    const el = videoElRef.current;
    props.onPlaybackStatusUpdate({
      isLoaded: true,
      isPlaying: !el.paused,
      durationMillis: (el.duration || 0) * 1000,
      positionMillis: (el.currentTime || 0) * 1000,
      isLooping: el.loop,
      isMuted: el.muted,
      ...(isBuffering ? { isBuffering: true } : {}),
    });
  };

  const handleTimeUpdate = () => {
    emitStatusUpdate(false);
  };

  const handleCanPlay = () => {
    props.onReadyForDisplay?.();
    if (videoElRef.current && props.onLoad) {
      const el = videoElRef.current;
      props.onLoad({
        isLoaded: true,
        isPlaying: !el.paused,
        durationMillis: (el.duration || 0) * 1000,
        positionMillis: (el.currentTime || 0) * 1000,
        isLooping: el.loop,
        isMuted: el.muted,
      });
    }
    emitStatusUpdate(false);
  };

  const handleEnded = () => {
    if (!videoElRef.current || !props.onPlaybackStatusUpdate) return;
    const el = videoElRef.current;
    props.onPlaybackStatusUpdate({
      isLoaded: true,
      isPlaying: false,
      didJustFinish: true,
      durationMillis: (el.duration || 0) * 1000,
      positionMillis: (el.duration || 0) * 1000,
      isLooping: el.loop,
      isMuted: el.muted,
    });
  };

  const objectFit = props.resizeMode === 'contain' ? 'contain' : 'cover';

  return (
    <View style={[styles.container, props.style]}>
      {uri ? (
        <video
          ref={videoElRef}
          src={uri}
          playsInline
          autoPlay={props.shouldPlay}
          loop={props.isLooping}
          muted={props.isMuted}
          controls={props.useNativeControls}
          onTimeUpdate={handleTimeUpdate}
          onLoadedData={handleCanPlay}
          onCanPlay={handleCanPlay}
          onPlay={() => emitStatusUpdate(false)}
          onPause={() => emitStatusUpdate(false)}
          onWaiting={() => emitStatusUpdate(true)}
          onError={(e) => props.onError?.(e)}
          onLoadStart={() => props.onLoadStart?.()}
          onEnded={handleEnded}
          style={{
            width: '100%',
            height: '100%',
            objectFit,
            display: 'block',
            backgroundColor: '#000',
          }}
        />
      ) : null}
      {props.children}
    </View>
  );
});

export class LegacyAudioSound {
  private audio: HTMLAudioElement | null = null;
  private onUpdate: ((status: PlaybackStatus) => void) | null = null;

  constructor(uri?: string) {
    if (uri && typeof window !== 'undefined') {
      this.audio = new window.Audio(uri);
      this.audio.addEventListener('timeupdate', () => {
        if (this.onUpdate && this.audio) {
          this.onUpdate({
            isLoaded: true,
            isPlaying: !this.audio.paused,
            durationMillis: (this.audio.duration || 0) * 1000,
            positionMillis: (this.audio.currentTime || 0) * 1000,
          });
        }
      });
    }
  }

  async playAsync() {
    try {
      await this.audio?.play();
    } catch {}
  }

  async pauseAsync() {
    this.audio?.pause();
  }

  async stopAsync() {
    if (this.audio) {
      this.audio.pause();
      this.audio.currentTime = 0;
    }
  }

  async unloadAsync() {
    if (this.audio) {
      this.audio.pause();
      this.audio.src = '';
      this.audio = null;
    }
  }

  async setPositionAsync(millis: number) {
    if (this.audio) {
      this.audio.currentTime = millis / 1000;
    }
  }

  async setIsMutedAsync(muted: boolean) {
    if (this.audio) {
      this.audio.muted = muted;
    }
  }

  async setVolumeAsync(vol: number) {
    if (this.audio) {
      this.audio.volume = Math.max(0, Math.min(1, vol));
    }
  }

  async setIsLoopingAsync(loop: boolean) {
    if (this.audio) {
      this.audio.loop = loop;
    }
  }

  setOnPlaybackStatusUpdate(callback: (status: PlaybackStatus) => void) {
    this.onUpdate = callback;
  }
}

export const Audio = {
  Sound: {
    createAsync: async (
      source: { uri: string },
      _initialStatus?: any,
      onPlaybackStatusUpdate?: (status: PlaybackStatus) => void
    ) => {
      const sound = new LegacyAudioSound(source.uri);
      if (onPlaybackStatusUpdate) {
        sound.setOnPlaybackStatusUpdate(onPlaybackStatusUpdate);
      }
      return { sound, status: { isLoaded: true } };
    },
  },
  setAudioModeAsync: async () => {},
};

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
    backgroundColor: '#000',
  },
});

export default {
  Video,
  Audio,
  LegacyAudioSound,
};
