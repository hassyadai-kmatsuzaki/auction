import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fireEvent, waitFor, within } from 'storybook/test';
import NumberField from './NumberField';

const meta: Meta = { title: 'Common/NumberField', tags: ['autodocs'] };
export default meta;

// AuctionForm / Settings と同じ「数値 state + parse」の使い方
const NumberStateExample = () => {
  const [value, setValue] = useState<number>(0);
  return (
    <div style={{ padding: 16 }}>
      <NumberField label="梱包資材費" value={value} onValueChange={(v) => setValue(parseFloat(v) || 0)} />
      <div data-testid="state">{String(value)}</div>
    </div>
  );
};

// WonItemManagement と同じ「文字列 state」の使い方
const StringStateExample = () => {
  const [value, setValue] = useState<string>('770');
  return (
    <div style={{ padding: 16 }}>
      <NumberField label="配送料" value={value} onValueChange={setValue} />
      <div data-testid="state">{value}</div>
    </div>
  );
};

export const 数値state: StoryObj = {
  name: '数値stateでも先頭の0が残らない',
  render: () => <NumberStateExample />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const input = canvas.getByLabelText('梱包資材費') as HTMLInputElement;

    // "0" の欄の末尾に 350 と打った状態。素の TextField だと画面が "0350" のまま残る
    input.focus();
    fireEvent.change(input, { target: { value: '0350' } });
    await expect(input.value).toBe('350');
    await expect(canvas.getByTestId('state')).toHaveTextContent('350');

    // 空欄にできる（素の TextField だと 0 が復活して消せない）
    fireEvent.change(input, { target: { value: '' } });
    await expect(input.value).toBe('');

    // フォーカスが外れたら親の値（0）に戻る
    input.blur();
    await waitFor(() => expect(input.value).toBe('0'));
  },
};

export const ゼロ二連打: StoryObj = {
  name: '"00" は "0" に正規化される',
  render: () => <NumberStateExample />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const input = canvas.getByLabelText('梱包資材費') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '00' } });
    await expect(input.value).toBe('0');
  },
};

export const 小数: StoryObj = {
  name: '小数の 0.5 は壊さない',
  render: () => <StringStateExample />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const input = canvas.getByLabelText('配送料') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '0.5' } });
    await expect(input.value).toBe('0.5');
    await expect(canvas.getByTestId('state')).toHaveTextContent('0.5');
  },
};
