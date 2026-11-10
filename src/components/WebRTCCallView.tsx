import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface WebRTCCallViewProps {
  call: any;
  onEndCall: () => void;
  isVideo?: boolean;
}

export const WebRTCCallView: React.FC<WebRTCCallViewProps> = ({
  call,
  onEndCall,
  isVideo = false,
}) => {
  return (
    <View style={styles.container}>
      <View style={styles.callerInfo}>
        <Image
          source={{
            uri:
              call?.callerAvatar ||
              'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop&q=80',
          }}
          style={styles.avatar}
        />
        <Text style={styles.callerName}>{call?.callerName || 'Masti Friend'}</Text>
        <Text style={styles.callStatus}>
          {isVideo ? 'Video Call Connected' : 'Voice Call Connected'}
        </Text>
      </View>

      <View style={styles.controls}>
        <TouchableOpacity style={styles.endCallBtn} onPress={onEndCall}>
          <Ionicons name="call" size={28} color="#fff" />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#0c0d14',
    zIndex: 999999,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 80,
  },
  callerInfo: {
    alignItems: 'center',
  },
  avatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 3,
    borderColor: '#FE2C55',
    marginBottom: 20,
  },
  callerName: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  callStatus: {
    fontSize: 14,
    color: '#22c55e',
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
  },
  endCallBtn: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: '#ef4444',
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ rotate: '135deg' }],
  },
});

export default WebRTCCallView;
