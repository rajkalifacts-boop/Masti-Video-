import React, { forwardRef, useEffect, useRef } from 'react';
import { View, StyleSheet } from 'react-native';

export const CameraView = forwardRef<any, any>(({ style, facing = 'back', children, ...props }, ref) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    let stream: MediaStream | null = null;
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      navigator.mediaDevices
        .getUserMedia({
          video: { facingMode: facing === 'front' ? 'user' : 'environment' },
          audio: true,
        })
        .then((s) => {
          stream = s;
          if (videoRef.current) {
            videoRef.current.srcObject = s;
            videoRef.current.play().catch(() => {});
          }
        })
        .catch((err) => {
          console.warn('Camera mediaDevices error:', err);
        });
    }

    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [facing]);

  return (
    <View ref={ref} style={[styles.camera, style]} {...props}>
      <video
        ref={videoRef}
        playsInline
        muted
        autoPlay
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          backgroundColor: '#111',
        }}
      />
      {children}
    </View>
  );
});

export const useCameraPermissions = () => {
  return [{ granted: true, canAskAgain: true, status: 'granted' }, async () => ({ granted: true, status: 'granted' })];
};

export const useMicrophonePermissions = () => {
  return [{ granted: true, canAskAgain: true, status: 'granted' }, async () => ({ granted: true, status: 'granted' })];
};

const styles = StyleSheet.create({
  camera: {
    overflow: 'hidden',
    backgroundColor: '#000',
  },
});

export default {
  CameraView,
  useCameraPermissions,
  useMicrophonePermissions,
};
