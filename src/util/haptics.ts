import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

const enabled = Platform.OS === 'ios' || Platform.OS === 'android';

export function lightTap() {
  if (enabled) void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
}

export function mediumTap() {
  if (enabled) void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
}

export function heavyTap() {
  if (enabled) void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
}

export function selectionTap() {
  if (enabled) void Haptics.selectionAsync();
}
