import React, { useRef } from 'react';
import { Animated, Dimensions, PanResponder, StyleSheet, Text, View } from 'react-native';

type Props = {
  children: React.ReactNode;
  onDelete: () => void;
  deleteColor: string;
};

const SCREEN_W = Dimensions.get('window').width;
const TRIGGER = -80;

export function SwipeableRow({ children, onDelete, deleteColor }: Props) {
  const translateX = useRef(new Animated.Value(0)).current;
  const rowHeight = useRef(new Animated.Value(1)).current;
  const removing = useRef(false);

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gs) =>
        !removing.current && Math.abs(gs.dx) > 12 && Math.abs(gs.dx) > Math.abs(gs.dy) * 1.5,
      onPanResponderGrant: () => {
        translateX.stopAnimation();
      },
      onPanResponderMove: (_, gs) => {
        if (gs.dx < 0) {
          translateX.setValue(Math.max(gs.dx, -SCREEN_W));
        } else {
          translateX.setValue(gs.dx * 0.3);
        }
      },
      onPanResponderRelease: (_, gs) => {
        if (gs.dx < TRIGGER || gs.vx < -0.5) {
          removing.current = true;
          Animated.timing(translateX, {
            toValue: -SCREEN_W,
            duration: 250,
            useNativeDriver: false,
          }).start(() => {
            Animated.timing(rowHeight, {
              toValue: 0,
              duration: 200,
              useNativeDriver: false,
            }).start(() => onDelete());
          });
        } else {
          Animated.spring(translateX, {
            toValue: 0,
            useNativeDriver: false,
            tension: 40,
            friction: 8,
          }).start();
        }
      },
    }),
  ).current;

  const animatedHeight = rowHeight.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 62],
  });

  return (
    <Animated.View style={[styles.container, { maxHeight: rowHeight.interpolate({ inputRange: [0, 1], outputRange: [0, 200] }), opacity: rowHeight }]}>
      <View style={[StyleSheet.absoluteFill, styles.action, { backgroundColor: deleteColor }]}>
        <Text style={styles.actionText}>Delete</Text>
      </View>
      <Animated.View
        style={{ transform: [{ translateX }], backgroundColor: 'transparent' }}
        {...panResponder.panHandlers}
      >
        {children}
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: { overflow: 'hidden' },
  action: {
    alignItems: 'flex-end',
    justifyContent: 'center',
    paddingRight: 24,
  },
  actionText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 15,
  },
});
