import React, { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { bindDialogs, type DialogRequest } from '../services/dialogs';
import { Sheet, Button } from './ui';
import { typography, spacing } from '../theme';

export function DialogHost() {
  const [queue, setQueue] = useState<DialogRequest[]>([]);
  useEffect(() => bindDialogs((request) => setQueue((value) => [...value, request])), []);
  const request = queue[0];
  const close = () => { request?.options?.onDismiss?.(); setQueue((value) => value.slice(1)); };
  if (!request) return null;
  return <Sheet visible title={request.title} onClose={close}>
    {!!request.message && <Text style={typography.body}>{request.message}</Text>}
    <View style={{ gap: spacing.sm, marginTop: spacing.md }}>
      {request.buttons.map((button, i) => <Button key={i} label={button.text ?? 'OK'} variant={button.style === 'destructive' ? 'danger' : button.style === 'cancel' ? 'secondary' : 'primary'} onPress={() => { close(); button.onPress?.(); }} />)}
    </View>
  </Sheet>;
}
