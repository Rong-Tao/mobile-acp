// TerminalTab：project 目录里的远端 shell 面板（线性终端,无 PTY）。
// 输出区 mono 滚动,输入行回车发送;shell 退出后可一键重启。

import React, { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { View, Text, TextInput, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { THEME, AccentType } from '../theme';
import { Btn } from '../components/Primitives';
import type { TerminalSession } from '../core/terminal';

const T = THEME;

export function TerminalTab({ term, accent }: { term: TerminalSession; accent: AccentType }) {
  const out = useSyncExternalStore(term.subscribe, term.getBuffer);
  const [input, setInput] = useState('');
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: false }), 30);
  }, [out]);

  const send = () => {
    const line = input;
    setInput('');
    if (line.trim()) term.send(line);
    else term.send('');
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        ref={scrollRef}
        style={{ flex: 1, backgroundColor: '#0a0b0e' }}
        contentContainerStyle={{ padding: 12, paddingBottom: 16 }}
        showsVerticalScrollIndicator={false}
      >
        <Text selectable style={{ fontFamily: T.monoFont, fontSize: 11.5, lineHeight: 16.5, color: T.tx1 }}>
          {out || `# shell in ${term.cwd}\n`}
        </Text>
        {term.exited && (
          <View style={{ alignItems: 'flex-start', marginTop: 10 }}>
            <Btn accent={accent} icon="refresh" size="sm" onPress={() => { term.restart().catch(() => {}); }}>
              Restart shell
            </Btn>
          </View>
        )}
      </ScrollView>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, borderTopWidth: 1, borderColor: T.borderSoft, backgroundColor: T.bg1, paddingHorizontal: 12, paddingVertical: 8 }}>
        <Text style={{ fontFamily: T.monoFontMedium, fontSize: 13, color: accent.hue }}>$</Text>
        <TextInput
          value={input}
          onChangeText={setInput}
          placeholder="command"
          placeholderTextColor={T.tx2}
          autoCapitalize="none"
          autoCorrect={false}
          onSubmitEditing={send}
          blurOnSubmit={false}
          returnKeyType="send"
          style={{ flex: 1, color: T.tx0, fontFamily: T.monoFont, fontSize: 13, paddingVertical: 6, padding: 0 }}
        />
      </View>
    </KeyboardAvoidingView>
  );
}
