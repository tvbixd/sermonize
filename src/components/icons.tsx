import React from 'react';
import { Svg, Rect, Path, Circle } from 'react-native-svg';

type IconProps = { size?: number; color?: string };

export function MicIcon({ size = 24, color = '#fff' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x="9" y="3" width="6" height="12" rx="3" stroke={color} strokeWidth="1.8" />
      <Path d="M5 11a7 7 0 0 0 14 0" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
      <Path d="M12 18v3" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
    </Svg>
  );
}

export function GearIcon({ size = 24, color = '#0A84FF' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx="12" cy="12" r="3.2" stroke={color} strokeWidth="1.6" />
      <Path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.2 5.2l2.1 2.1M16.7 16.7l2.1 2.1M5.2 18.8l2.1-2.1M16.7 7.3l2.1-2.1" stroke={color} strokeWidth="1.6" strokeLinecap="round" />
    </Svg>
  );
}

type ChevronDir = 'right' | 'left' | 'up' | 'down';
export function ChevronIcon({ size = 12, color = '#C7C7CC', dir = 'right' }: IconProps & { dir?: ChevronDir }) {
  const rotate = { right: '0deg', down: '90deg', left: '180deg', up: '270deg' }[dir];
  return (
    <Svg width={size} height={size * 1.6} viewBox="0 0 10 16" fill="none" style={{ transform: [{ rotate }] }}>
      <Path d="M2 2l6 6-6 6" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function CloseIcon({ size = 16, color = '#8E8E93' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <Path d="M3 3l10 10M13 3L3 13" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
    </Svg>
  );
}

export function PlusIcon({ size = 16, color = '#0A84FF' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <Path d="M8 2.5v11M2.5 8h11" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
    </Svg>
  );
}

export function CheckIcon({ size = 16, color = '#0A84FF' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <Path d="M3 8.5l3.5 3.5L13 4.5" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function TrashIcon({ size = 18, color = '#fff' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 20 20" fill="none">
      <Path d="M3.5 5.5h13M8 3h4M5 5.5l.8 11.3a1.5 1.5 0 0 0 1.5 1.4h5.4a1.5 1.5 0 0 0 1.5-1.4L15 5.5" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M8.5 9v6M11.5 9v6" stroke={color} strokeWidth="1.6" strokeLinecap="round" />
    </Svg>
  );
}

export function ExportIcon({ size = 18, color = '#fff' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 20 20" fill="none">
      <Path d="M10 13V3M6.5 6.5L10 3l3.5 3.5" stroke={color} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M4 12.5V16a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-3.5" stroke={color} strokeWidth="1.7" strokeLinecap="round" />
    </Svg>
  );
}

export function RegenIcon({ size = 18, color = '#000' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 20 20" fill="none">
      <Path d="M16 5.5A7 7 0 1 0 17 10" stroke={color} strokeWidth="1.7" strokeLinecap="round" fill="none" />
      <Path d="M12.5 3l3.5 2.5L13.8 9" stroke={color} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </Svg>
  );
}

export function WaveformIcon({ size = 28, color = '#0A84FF' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 28 28" fill="none">
      <Path d="M3 14v0M7 10v8M11 6v16M15 9v10M19 4v20M23 11v6M27 14v0" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
    </Svg>
  );
}

export function EyeIcon({ size = 18, color = '#8E8E93' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 20 20" fill="none">
      <Path d="M1.5 10s3-5.5 8.5-5.5S18.5 10 18.5 10s-3 5.5-8.5 5.5S1.5 10 1.5 10z" stroke={color} strokeWidth="1.6" />
      <Circle cx="10" cy="10" r="2.2" stroke={color} strokeWidth="1.6" />
    </Svg>
  );
}

export function EyeOffIcon({ size = 18, color = '#8E8E93' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 20 20" fill="none">
      <Path d="M3 3l14 14M8.5 8.7a2.2 2.2 0 0 0 2.9 2.9" stroke={color} strokeWidth="1.6" strokeLinecap="round" />
      <Path d="M5.5 5.7C3.6 7 2 9 1.5 10c.8 1.5 4 5.5 8.5 5.5 1.8 0 3.4-.6 4.7-1.5M8.5 4.6C9 4.5 9.5 4.5 10 4.5c4.5 0 7.7 4 8.5 5.5-.4.8-1.1 1.8-2 2.6" stroke={color} strokeWidth="1.6" strokeLinecap="round" />
    </Svg>
  );
}

type FolderKind = 'all' | 'folder' | 'draft' | 'trash';
export function FolderIcon({ kind, color = '#0A84FF', size = 28 }: { kind: FolderKind; color?: string; size?: number }) {
  if (kind === 'all') {
    return (
      <Svg width={size} height={size} viewBox="0 0 32 32" fill="none">
        <Rect x="4" y="8" width="24" height="18" rx="3" fill={color} />
        <Path d="M4 12h24" stroke="rgba(255,255,255,0.4)" strokeWidth="0.5" />
        <Rect x="4" y="8" width="14" height="4" rx="2" fill={color} />
      </Svg>
    );
  }
  if (kind === 'folder') {
    return (
      <Svg width={size} height={size} viewBox="0 0 32 32" fill="none">
        <Path d="M4 10a2 2 0 0 1 2-2h6l2 2h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V10z" fill={color} />
      </Svg>
    );
  }
  if (kind === 'draft') {
    return (
      <Svg width={size} height={size} viewBox="0 0 32 32" fill="none">
        <Rect x="6" y="5" width="20" height="22" rx="3" fill="#8E8E93" />
        <Path d="M10 11h12M10 15h12M10 19h8" stroke="#fff" strokeWidth="1.3" strokeLinecap="round" opacity="0.85" />
      </Svg>
    );
  }
  // trash
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <Path d="M8 10h16l-1.3 16.3a2 2 0 0 1-2 1.7h-9.4a2 2 0 0 1-2-1.7L8 10z" fill="#8E8E93" />
      <Path d="M6 10h20M13 7h6" stroke="#8E8E93" strokeWidth="2" strokeLinecap="round" />
    </Svg>
  );
}

export function NewFolderIcon({ size = 22, color = '#0A84FF' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 22 22" fill="none">
      <Path d="M2.5 7a1.5 1.5 0 0 1 1.5-1.5h4l1.5 1.5h8.5A1.5 1.5 0 0 1 19.5 8.5v8A1.5 1.5 0 0 1 18 18H4a1.5 1.5 0 0 1-1.5-1.5V7z" stroke={color} strokeWidth="1.4" fill="none" />
      <Path d="M11 10v5M8.5 12.5h5" stroke={color} strokeWidth="1.4" strokeLinecap="round" />
    </Svg>
  );
}

export function BackChevronIcon({ color = '#0A84FF', size = 22 }: IconProps) {
  return (
    <Svg width={size / 2} height={size} viewBox="0 0 12 20" fill="none">
      <Path d="M10 2L2 10l8 8" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
