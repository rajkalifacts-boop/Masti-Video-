import React from 'react';
import { View, StyleSheet } from 'react-native';
import * as LucideIcons from 'lucide-react';

interface IconProps {
  name: string;
  size?: number;
  color?: string;
  style?: any;
}

const ICON_MAP: Record<string, string> = {
  // Navigation & Core
  'home': 'Home',
  'home-outline': 'Home',
  'search': 'Search',
  'search-outline': 'Search',
  'menu': 'Menu',
  'menu-outline': 'Menu',
  'reorder-three': 'Menu',
  'reorder-three-outline': 'Menu',
  'settings': 'Settings',
  'settings-outline': 'Settings',
  'more-vertical': 'MoreVertical',
  'more-horizontal': 'MoreHorizontal',
  'ellipsis-vertical': 'MoreVertical',
  'ellipsis-horizontal': 'MoreHorizontal',
  'ellipsis-horizontal-circle-outline': 'MoreHorizontal',
  'arrow-back': 'ArrowLeft',
  'arrow-forward': 'ArrowRight',
  'chevron-back': 'ChevronLeft',
  'chevron-forward': 'ChevronRight',
  'close': 'X',
  'close-circle': 'XCircle',
  'checkmark': 'Check',
  'checkmark-circle': 'CheckCircle2',
  'checkmark-done': 'CheckCheck',
  'add': 'Plus',
  'add-circle': 'PlusCircle',
  'add-circle-outline': 'PlusCircle',
  'remove-circle-outline': 'MinusCircle',

  // Camera & Recording Tools
  'camera': 'Camera',
  'camera-outline': 'Camera',
  'camera-reverse': 'SwitchCamera',
  'camera-reverse-outline': 'SwitchCamera',
  'flip': 'SwitchCamera',
  'speedometer': 'Gauge',
  'speedometer-outline': 'Gauge',
  'color-filter': 'Palette',
  'color-filter-outline': 'Palette',
  'color-palette': 'Palette',
  'wand': 'Wand2',
  'wand-outline': 'Wand2',
  'magic': 'Wand2',
  'enhance': 'Wand2',
  'timer': 'Timer',
  'timer-outline': 'Timer',
  'time': 'Clock',
  'time-outline': 'Clock',
  'flash': 'Zap',
  'flash-off': 'ZapOff',
  'sparkles': 'Sparkles',
  'sparkles-outline': 'Sparkles',
  'images': 'Upload',
  'images-outline': 'Upload',
  'albums': 'Layers',
  'albums-outline': 'Layers',
  'cloud-upload': 'Upload',
  'cloud-upload-outline': 'Upload',
  'upload': 'Upload',

  // Media & Playback
  'play': 'Play',
  'play-circle': 'PlayCircle',
  'play-circle-outline': 'PlayCircle',
  'pause': 'Pause',
  'musical-notes': 'Music',
  'musical-note': 'Music',
  'videocam': 'Video',
  'videocam-outline': 'Video',
  'videocam-off': 'VideoOff',
  'volume-high': 'Volume2',
  'volume-medium': 'Volume2',
  'volume-mute': 'VolumeX',
  'volume-off': 'VolumeX',
  'mic': 'Mic',
  'mic-off': 'MicOff',
  'cut': 'Scissors',
  'cut-outline': 'Scissors',
  'crop': 'Crop',
  'download': 'Download',
  'download-outline': 'Download',
  'arrow-undo': 'Undo2',
  'arrow-redo': 'Redo2',

  // Social & Actions
  'heart': 'Heart',
  'heart-outline': 'Heart',
  'chatbubble': 'MessageCircleMore',
  'chatbubble-outline': 'MessageCircleMore',
  'chatbubble-ellipses': 'MessageCircleMore',
  'chatbubble-ellipses-outline': 'MessageCircleMore',
  'share-social': 'Share2',
  'share-social-outline': 'Share2',
  'bookmark': 'Bookmark',
  'bookmark-outline': 'Bookmark',
  'person': 'User',
  'person-outline': 'User',
  'people': 'Users',
  'people-outline': 'Users',
  'person-add': 'UserPlus',
  'person-add-outline': 'UserPlus',
  'call': 'Phone',
  'call-outline': 'Phone',
  'notifications': 'Bell',
  'notifications-outline': 'Bell',
  'send': 'Send',
  'paper-plane': 'Send',
  'paper-plane-outline': 'Send',
  'flag': 'Flag',
  'flag-outline': 'Flag',
  'happy': 'Smile',
  'happy-outline': 'Smile',
  'megaphone': 'Megaphone',
  'megaphone-outline': 'Megaphone',

  // Settings & System
  'cellular': 'Signal',
  'wifi': 'Wifi',
  'wifi-outline': 'Wifi',
  'swap-vertical': 'ArrowUpDown',
  'ban': 'Ban',
  'ban-outline': 'Ban',
  'alert-circle': 'AlertCircle',
  'alert-circle-outline': 'AlertCircle',
  'information-circle': 'Info',
  'information-circle-outline': 'Info',
  'help-circle': 'HelpCircle',
  'help-circle-outline': 'HelpCircle',
  'log-out': 'LogOut',
  'log-out-outline': 'LogOut',
  'lock-closed': 'Lock',
  'star': 'Star',
  'star-outline': 'Star',
  'star-sharp': 'Star',
  'ribbon': 'Award',
  'ribbon-outline': 'Award',
  'medal': 'Medal',
  'medal-outline': 'Medal',
  'award': 'Award',
  'award-outline': 'Award',
  'badge': 'Award',
  'crown': 'Crown',
  'crown-outline': 'Crown',
  'repeat': 'Repeat',
  'repeat-outline': 'Repeat',
  'eye': 'Eye',
  'eye-off': 'EyeOff',
  'eye-outline': 'Eye',
  'trash': 'Trash2',
  'trash-outline': 'Trash2',
  'copy': 'Copy',
  'link': 'Link',
  'link-outline': 'Link',
  'globe': 'Globe',
  'wallet': 'Wallet',
  'wallet-outline': 'Wallet',
  'cash': 'CircleDollarSign',
  'cash-outline': 'CircleDollarSign',
  'card': 'CreditCard',
  'card-outline': 'CreditCard',
  'headset': 'Headphones',
  'headset-outline': 'Headphones',
  'headphones': 'Headphones',
  'headphones-outline': 'Headphones',
  'help-buoy': 'LifeBuoy',
  'help-buoy-outline': 'LifeBuoy',
  'lifebuoy': 'LifeBuoy',
  'diamond': 'Gem',
  'diamond-outline': 'Gem',
  'pencil': 'Pencil',
  'pencil-outline': 'Pencil',
  'image': 'Image',
  'image-outline': 'Image',
  'cloud-offline-outline': 'CloudOff',
  'sync': 'RotateCcw',
  'refresh': 'RefreshCw',

  // Brand icons
  'logo-whatsapp': 'MessageCircle',
  'logo-instagram': 'Instagram',
  'logo-facebook': 'Facebook',
  'logo-youtube': 'Youtube',
  'logo-google': 'Chrome',
  'facebook-square': 'Facebook',
  'youtube-play': 'Youtube',
  'instagram': 'Instagram',
};

// Smart fallback resolver
const resolveLucideName = (name: string): string => {
  if (!name) return 'Circle';
  if (ICON_MAP[name]) return ICON_MAP[name];
  
  const clean = name.replace(/-outline$/, '').replace(/-sharp$/, '').toLowerCase();
  if (ICON_MAP[clean]) return ICON_MAP[clean];

  // Smart heuristic matching
  if (clean.includes('monetiz') || clean.includes('wallet') || clean.includes('cash') || clean.includes('coin') || clean.includes('dollar')) return 'CircleDollarSign';
  if (clean.includes('headset') || clean.includes('headphone') || clean.includes('support')) return 'Headphones';
  if (clean.includes('lifebuoy') || clean.includes('buoy')) return 'LifeBuoy';
  if (clean.includes('help')) return 'HelpCircle';
  if (clean.includes('ribbon') || clean.includes('badge') || clean.includes('medal') || clean.includes('award')) return 'Award';
  if (clean.includes('star')) return 'Star';
  if (clean.includes('crown')) return 'Crown';
  if (clean.includes('repeat')) return 'Repeat';
  if (clean.includes('subscri') || clean.includes('people') || clean.includes('users') || clean.includes('member')) return 'Users';
  if (clean.includes('flip') || clean.includes('reverse')) return 'SwitchCamera';
  if (clean.includes('speed') || clean.includes('gauge')) return 'Gauge';
  if (clean.includes('filter') || clean.includes('palette')) return 'Palette';
  if (clean.includes('wand') || clean.includes('magic') || clean.includes('enhance')) return 'Wand2';
  if (clean.includes('timer') || clean.includes('stopwatch')) return 'Timer';
  if (clean.includes('time') || clean.includes('clock')) return 'Clock';
  if (clean.includes('flash') || clean.includes('lightning') || clean.includes('zap')) return 'Zap';
  if (clean.includes('upload')) return 'Upload';
  if (clean.includes('download')) return 'Download';
  if (clean.includes('image') || clean.includes('photo') || clean.includes('album')) return 'Image';
  if (clean.includes('video') || clean.includes('cam')) return 'Video';
  if (clean.includes('cellular') || clean.includes('signal')) return 'Signal';
  if (clean.includes('wifi')) return 'Wifi';
  if (clean.includes('ban') || clean.includes('block')) return 'Ban';
  if (clean.includes('alert') || clean.includes('warn')) return 'AlertCircle';
  if (clean.includes('info')) return 'Info';
  if (clean.includes('logout') || clean.includes('exit')) return 'LogOut';
  if (clean.includes('cut') || clean.includes('scissors')) return 'Scissors';
  if (clean.includes('diamond') || clean.includes('gem')) return 'Gem';
  if (clean.includes('sound') || clean.includes('volume') || clean.includes('audio')) return 'Volume2';
  if (clean.includes('music') || clean.includes('song')) return 'Music';
  if (clean.includes('trash') || clean.includes('delete')) return 'Trash2';
  if (clean.includes('pencil') || clean.includes('edit')) return 'Pencil';
  if (clean.includes('check')) return 'Check';
  if (clean.includes('close') || clean.includes('cancel')) return 'X';
  if (clean.includes('user') || clean.includes('person')) return 'User';
  if (clean.includes('heart') || clean.includes('like')) return 'Heart';
  if (clean.includes('chat') || clean.includes('msg')) return 'MessageCircle';
  if (clean.includes('lock')) return 'Lock';
  if (clean.includes('menu')) return 'Menu';
  if (clean.includes('setting') || clean.includes('gear')) return 'Settings';

  return 'Circle';
};

const createIconComponent = (_family: string) => {
  const IconComponent: React.FC<IconProps> & { font?: Record<string, string> } = ({
    name,
    size = 24,
    color = '#fff',
    style,
  }) => {
    const lucideName = resolveLucideName(name);
    const LucideComp = (LucideIcons as any)[lucideName] || LucideIcons.Circle;

    const isHeartFilled = lucideName === 'Heart' && !name.includes('outline') && !name.includes('off');
    const isBookmarkFilled = lucideName === 'Bookmark' && !name.includes('outline');
    const isStarFilled = lucideName === 'Star' && !name.includes('outline');
    const shouldFill = isHeartFilled || isBookmarkFilled || isStarFilled;

    return (
      <View style={[styles.iconWrapper, style]}>
        <LucideComp
          size={size}
          color={color}
          strokeWidth={shouldFill ? 1 : 2}
          fill={shouldFill ? color : 'none'}
          style={shouldFill ? { fill: color } : { fill: 'none' }}
        />
      </View>
    );
  };

  IconComponent.font = {};
  return IconComponent;
};

export const Ionicons = createIconComponent('Ionicons');
export const Feather = createIconComponent('Feather');
export const FontAwesome = createIconComponent('FontAwesome');
export const MaterialIcons = createIconComponent('MaterialIcons');
export const AntDesign = createIconComponent('AntDesign');

const styles = StyleSheet.create({
  iconWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default {
  Ionicons,
  Feather,
  FontAwesome,
  MaterialIcons,
  AntDesign,
};
