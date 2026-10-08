import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Pressable } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';

const mocks = vi.hoisted(() => ({
  platform: { OS: 'android' },
  open: vi.fn(),
  dismiss: vi.fn().mockResolvedValue(true),
  keyboardDismiss: vi.fn(),
}));
vi.mock('react-native', () => ({
  Platform: mocks.platform,
  Keyboard: { dismiss: mocks.keyboardDismiss },
  StyleSheet: { create: (styles: unknown) => styles },
  View: 'View', Text: 'Text', Pressable: 'Pressable',
}));
vi.mock('@react-native-community/datetimepicker', () => ({
  default: 'NativePicker',
  DateTimePickerAndroid: { open: mocks.open, dismiss: mocks.dismiss },
}));
vi.mock('@/components/ui', () => ({ Button: 'Button', Icon: 'Icon', Row: 'Row' }));
vi.mock('@/hooks/useT', () => ({ useTr: () => (text: string) => text }));
vi.mock('@/store/hooks', () => ({
  useAppSelector: (selector: (state: { settings: { language: 'uk' } }) => unknown) => selector({ settings: { language: 'uk' } }),
}));

import { DateTimeField } from '@/components/DateTimeField';
import { DateTimeField as WebDateTimeField } from '@/components/DateTimeField.web';
import { BirthDatePicker } from '@/components/BirthDatePicker';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let mounted: ReactTestRenderer;
const mount = (element: React.ReactElement) => { act(() => { mounted = create(element); }); };
const show = () => act(() => mounted.root.findByType(Pressable).props.onPress());

beforeEach(() => { vi.clearAllMocks(); mocks.platform.OS = 'android'; });
afterEach(() => { if (mounted) act(() => mounted.unmount()); });

describe('native date and time fields', () => {
  it('commits an Android date only on confirmation and ignores dismissals', () => {
    const onChange = vi.fn();
    mount(<DateTimeField label="Date" value="08.10.2026" onChange={onChange} />);
    show();
    expect(mocks.keyboardDismiss).toHaveBeenCalledOnce();
    let options = mocks.open.mock.calls[0][0];
    act(() => options.onDismiss());
    expect(onChange).not.toHaveBeenCalled();
    show();
    options = mocks.open.mock.calls[1][0];
    act(() => options.onValueChange({}, new Date(2026, 9, 12)));
    expect(onChange).toHaveBeenCalledExactlyOnceWith('12.10.2026');
  });

  it('opens an Android clock in 24-hour mode', () => {
    const onChange = vi.fn();
    mount(<DateTimeField label="Time" mode="time" value="19:30" onChange={onChange} />);
    show();
    const options = mocks.open.mock.calls[0][0];
    expect(options).toMatchObject({ mode: 'time', is24Hour: true });
    expect([options.value.getHours(), options.value.getMinutes()]).toEqual([19, 30]);
    act(() => options.onValueChange({}, new Date(2026, 9, 8, 0, 5)));
    expect(onChange).toHaveBeenCalledWith('00:05');
  });

  it('dismisses an open Android dialog when the field becomes disabled', () => {
    const onChange = vi.fn();
    mount(<DateTimeField label="Date" value="" onChange={onChange} />);
    show();
    const options = mocks.open.mock.calls[0][0];
    act(() => mounted.update(<DateTimeField label="Date" value="" onChange={onChange} disabled />));
    expect(mocks.dismiss).toHaveBeenCalledWith('date');
    act(() => options.onValueChange({}, new Date(2026, 9, 12)));
    expect(onChange).not.toHaveBeenCalled();
    show();
    expect(mocks.open).toHaveBeenCalledOnce();
  });

  it('dismisses Android dialogs when leaving the form', () => {
    mount(<DateTimeField label="Time" mode="time" value="19:30" onChange={vi.fn()} />);
    show();
    act(() => mounted.unmount());
    expect(mocks.dismiss).toHaveBeenCalledWith('time');
  });

  it('keeps iOS changes as a draft until Done and discards cancelled drafts', () => {
    mocks.platform.OS = 'ios';
    const onChange = vi.fn();
    mount(<DateTimeField label="Date" value="08.10.2026" onChange={onChange} />);
    show();
    act(() => mounted.root.findByType(DateTimePicker).props.onValueChange({}, new Date(2026, 9, 12)));
    expect(onChange).not.toHaveBeenCalled();
    act(() => mounted.root.findByProps({ label: 'Скасувати' }).props.onPress());
    show();
    expect(mounted.root.findByType(DateTimePicker).props.value).toEqual(new Date(2026, 9, 8));
    act(() => mounted.root.findByType(DateTimePicker).props.onValueChange({}, new Date(2026, 9, 15)));
    act(() => mounted.root.findByProps({ label: 'Готово' }).props.onPress());
    expect(onChange).toHaveBeenCalledExactlyOnceWith('15.10.2026');
  });

  it('preserves a prefilled birthday and limits selection to today', () => {
    mount(<BirthDatePicker value="29.02.2000" onChange={vi.fn()} />);
    show();
    const options = mocks.open.mock.calls[0][0];
    expect(options.value).toEqual(new Date(2000, 1, 29));
    const today = new Date();
    expect(options.maximumDate).toEqual(new Date(today.getFullYear(), today.getMonth(), today.getDate()));
  });
});

describe('browser date and time fields', () => {
  it('uses calendar dates without UTC conversion and checks the browser validity', () => {
    const onChange = vi.fn();
    mount(<WebDateTimeField label="Birthday" value="29.02.2000" onChange={onChange} maximumDate={new Date(2026, 9, 8)} />);
    const input = mounted.root.findByType('input');
    expect(input.props).toMatchObject({ type: 'date', value: '2000-02-29', max: '2026-10-08', 'aria-label': 'Birthday' });
    act(() => input.props.onChange({ target: { value: '2027-01-01', validity: { valid: false } } }));
    expect(onChange).not.toHaveBeenCalled();
    act(() => input.props.onChange({ target: { value: '2000-03-01', validity: { valid: true } } }));
    expect(onChange).toHaveBeenCalledExactlyOnceWith('01.03.2000');
    act(() => input.props.onChange({ target: { value: '', validity: { valid: true } } }));
    expect(onChange).toHaveBeenLastCalledWith('');
  });

  it('uses a time input and prevents changes while disabled', () => {
    const onChange = vi.fn();
    mount(<WebDateTimeField label="Time" mode="time" value="20:30" onChange={onChange} disabled />);
    const input = mounted.root.findByType('input');
    expect(input.props).toMatchObject({ type: 'time', value: '20:30', disabled: true });
    act(() => input.props.onChange({ target: { value: '21:00', validity: { valid: true } } }));
    expect(onChange).not.toHaveBeenCalled();
  });
});
