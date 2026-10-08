import React, { useRef, useEffect, ReactNode } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, Modal, Animated,
  ScrollView, Pressable, StyleSheet, useWindowDimensions,
} from 'react-native';
import { THEME, AccentType, accentFor } from '../theme';
import { Icon } from './Icon';

const T = THEME;

// ── Press ─────────────────────────────────────────────────────
type PressProps = {
  children: ReactNode;
  onPress?: () => void;
  style?: object | object[];
  disabled?: boolean;
};

export function Press({ children, onPress, style, disabled }: PressProps) {
  return (
    <TouchableOpacity
      onPress={disabled ? undefined : onPress}
      activeOpacity={disabled ? 1 : 0.65}
      disabled={disabled}
      style={style as any}
    >
      {children}
    </TouchableOpacity>
  );
}

// ── Dot ──────────────────────────────────────────────────────
export function Dot({ color, size = 8, glow = false }: { color: string; size?: number; glow?: boolean }) {
  return (
    <View style={{
      width: size, height: size, borderRadius: size / 2, backgroundColor: color,
      shadowColor: glow ? color : 'transparent',
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: glow ? 0.6 : 0,
      shadowRadius: 4,
      elevation: glow ? 3 : 0,
    }} />
  );
}

// ── Spinner ───────────────────────────────────────────────────
export function Spinner({ size = 16, color = T.tx1 }: { size?: number; color?: string }) {
  const rot = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const anim = Animated.loop(
      Animated.timing(rot, { toValue: 1, duration: 700, useNativeDriver: true })
    );
    anim.start();
    return () => anim.stop();
  }, []);
  const spin = rot.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  return (
    <Animated.View style={{
      width: size, height: size, borderRadius: size / 2,
      borderWidth: 1.5, borderColor: color + '33', borderTopColor: color,
      transform: [{ rotate: spin }],
    }} />
  );
}

// ── Sheet ─────────────────────────────────────────────────────
type SheetProps = {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  height?: string | number;
  pad?: boolean;
};

export function Sheet({ open, onClose, children, height = 'auto', pad = true }: SheetProps) {
  const { height: screenH } = useWindowDimensions();
  const slideAnim = useRef(new Animated.Value(600)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (open) {
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 180, useNativeDriver: true }),
        Animated.spring(slideAnim, { toValue: 0, damping: 20, stiffness: 200, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 0, duration: 180, useNativeDriver: true }),
        Animated.timing(slideAnim, { toValue: 600, duration: 200, useNativeDriver: true }),
      ]).start();
    }
  }, [open]);

  const sheetHeight: number | undefined =
    typeof height === 'string' && height.endsWith('%')
      ? screenH * parseFloat(height) / 100
      : height === 'auto' ? undefined : (height as number);

  return (
    <Modal visible={open} transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <Animated.View style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(0,0,0,0.55)', opacity: fadeAnim, justifyContent: 'flex-end' }]}>
        <TouchableOpacity style={StyleSheet.absoluteFillObject} activeOpacity={1} onPress={onClose} />
        <Animated.View style={{
          backgroundColor: T.bg1,
          borderTopLeftRadius: 18, borderTopRightRadius: 18,
          maxHeight: '88%',
          height: sheetHeight,
          borderTopWidth: 1, borderColor: T.border,
          transform: [{ translateY: slideAnim }],
          overflow: 'hidden',
        }}>
          <View style={{ alignItems: 'center', paddingVertical: 10 }}>
            <View style={{ width: 38, height: 4, borderRadius: 2, backgroundColor: T.bg4 }} />
          </View>
          {/* With height 'auto' the container has no fixed height, so flex:1
              collapses the ScrollView to zero — size to content instead and
              let the parent's maxHeight cap it. */}
          <ScrollView style={sheetHeight === undefined ? { flexGrow: 0 } : { flex: 1 }} contentContainerStyle={pad ? { paddingTop: 8 } : undefined} showsVerticalScrollIndicator={false}>
            {children}
          </ScrollView>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

// ── EmptyHint ─────────────────────────────────────────────────
export function EmptyHint({ icon, title, sub }: { icon?: string; title: string; sub?: string }) {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 48 }}>
      {icon && (
        <View style={{ width: 52, height: 52, borderRadius: 14, backgroundColor: T.bg2, borderWidth: 1, borderColor: T.border, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name={icon} size={24} color={T.tx2} />
        </View>
      )}
      <Text style={{ fontFamily: T.uiFontSemiBold, fontSize: 14.5, color: T.tx1, textAlign: 'center' }}>{title}</Text>
      {sub && <Text style={{ fontFamily: T.uiFont, fontSize: 12.5, color: T.tx2, textAlign: 'center', lineHeight: 19, maxWidth: 240 }}>{sub}</Text>}
    </View>
  );
}

// ── TopBar ────────────────────────────────────────────────────
type TopBarProps = {
  title: string;
  sub?: string;
  onBack?: () => void;
  right?: ReactNode;
  accent?: AccentType;
};

export function TopBar({ title, sub, onBack, right }: TopBarProps) {
  return (
    <View style={{ flexShrink: 0, height: 52, flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 6, backgroundColor: T.bg1, borderBottomWidth: 1, borderColor: T.borderSoft }}>
      {onBack && (
        <Press onPress={onBack} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 12 }}>
          <Icon name="back" size={22} color={T.tx1} />
        </Press>
      )}
      <View style={{ flex: 1, minWidth: 0, paddingLeft: onBack ? 0 : 10 }}>
        <Text style={{ fontFamily: T.uiFontSemiBold, fontSize: 16, color: T.tx0, letterSpacing: -0.16 }} numberOfLines={1}>{title}</Text>
        {sub && <Text style={{ fontFamily: T.monoFont, fontSize: 11, color: T.tx2, marginTop: 1 }} numberOfLines={1}>{sub}</Text>}
      </View>
      {right}
    </View>
  );
}

// ── Btn ───────────────────────────────────────────────────────
type BtnKind = 'primary' | 'soft' | 'ghost' | 'danger' | 'fill';
type BtnProps = {
  children: ReactNode;
  onPress?: () => void;
  kind?: BtnKind;
  size?: 'sm' | 'md' | 'lg';
  icon?: string;
  accent?: AccentType;
  full?: boolean;
  disabled?: boolean;
  style?: object;
};

export function Btn({ children, onPress, kind = 'primary', size = 'md', icon, accent, full, disabled, style }: BtnProps) {
  const a = accent || accentFor('blue');
  const h = size === 'sm' ? 36 : size === 'lg' ? 50 : 44;
  const kinds: Record<BtnKind, object> = {
    primary: { backgroundColor: a.hue, borderColor: 'transparent' },
    soft: { backgroundColor: a.dim, borderColor: a.hue + '33' },
    ghost: { backgroundColor: 'transparent', borderColor: T.border },
    danger: { backgroundColor: 'transparent', borderColor: T.red + '44' },
    fill: { backgroundColor: T.bg3, borderColor: T.border },
  };
  const textColors: Record<BtnKind, string> = {
    primary: a.on, soft: a.hue, ghost: T.tx1, danger: T.red, fill: T.tx0,
  };
  return (
    <Press onPress={onPress} disabled={disabled} style={[{
      height: h, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7,
      paddingHorizontal: 16, borderRadius: 12, borderWidth: 1,
      width: full ? '100%' : 'auto', opacity: disabled ? 0.45 : 1,
      ...kinds[kind],
    }, style]}>
      {icon && <Icon name={icon} size={size === 'sm' ? 16 : 18} color={textColors[kind]} />}
      <Text style={{ fontFamily: kind === 'primary' || kind === 'soft' ? T.uiFontSemiBold : T.uiFontMedium, fontSize: size === 'sm' ? 13 : 14.5, color: textColors[kind] }}>{children}</Text>
    </Press>
  );
}

// ── Field ─────────────────────────────────────────────────────
type FieldProps = {
  label?: string;
  value: string;
  onChange?: (v: string) => void;
  placeholder?: string;
  mono?: boolean;
  hint?: string;
  type?: string;
  right?: ReactNode;
  readOnly?: boolean;
  secure?: boolean;
  accent?: AccentType;
};

export function Field({ label, value, onChange, placeholder, mono, hint, right, readOnly, secure, accent }: FieldProps) {
  const [focused, setFocused] = React.useState(false);
  const a = accent || accentFor('blue');
  return (
    <View>
      {label && <Text style={{ fontFamily: T.uiFontMedium, fontSize: 12, color: T.tx1, marginBottom: 7 }}>{label}</Text>}
      <View style={{
        flexDirection: 'row', alignItems: 'center', gap: 8, height: 46, paddingHorizontal: 12,
        backgroundColor: T.bg2, borderWidth: 1, borderColor: focused ? a.hue : T.border, borderRadius: 11,
      }}>
        <TextInput
          value={value}
          placeholder={placeholder}
          placeholderTextColor={T.tx2}
          onChangeText={onChange}
          editable={!readOnly}
          secureTextEntry={secure}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={{ flex: 1, color: T.tx0, fontSize: 14.5, fontFamily: mono ? T.monoFont : T.uiFont, padding: 0 }}
        />
        {right}
      </View>
      {hint && <Text style={{ fontFamily: T.uiFont, fontSize: 11.5, color: T.tx2, marginTop: 6, lineHeight: 17 }}>{hint}</Text>}
    </View>
  );
}

// ── Seg ───────────────────────────────────────────────────────
type SegOption = { value: string; label: string; icon?: string };
type SegProps = { options: SegOption[]; value: string; onChange: (v: string) => void; accent?: AccentType };

export function Seg({ options, value, onChange, accent }: SegProps) {
  return (
    <View style={{ flexDirection: 'row', gap: 3, padding: 3, backgroundColor: T.bg2, borderWidth: 1, borderColor: T.borderSoft, borderRadius: 12 }}>
      {options.map(o => {
        const on = o.value === value;
        return (
          <Press key={o.value} onPress={() => onChange(o.value)} style={{
            flex: 1, height: 38, borderRadius: 9, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
            backgroundColor: on ? T.bg4 : 'transparent',
          }}>
            {o.icon && <Icon name={o.icon} size={16} color={on ? T.tx0 : T.tx2} />}
            <Text style={{ fontFamily: on ? T.uiFontSemiBold : T.uiFontMedium, fontSize: 13.5, color: on ? T.tx0 : T.tx2 }}>{o.label}</Text>
          </Press>
        );
      })}
    </View>
  );
}
