import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { ReactNode } from 'react';
import ToolClient from '@/app/tool-client';
import ToolClientWrapper from '@/app/tool-client-wrapper';
import { Canvas } from '@/tool/components/Canvas';
import { Toolbar } from '@/tool/components/Toolbar';
import { Sidebar } from '@/tool/components/Sidebar';
import { DEFAULT_STATE, type ToolState } from '@/tool/types';
import { textToMorse } from '@/tool/morse';

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock('next/dynamic', () => ({
  default: () => () => <div data-testid="dynamic-tool-client">dynamic-tool-client</div>,
}));

const mockSetData = vi.fn();
const mockToast = vi.fn();
const mockHandleExport = vi.fn();
const mockImport = vi.fn();
const mockToolbarActions = { canUndo: true, canRedo: true, onUndo: vi.fn(), onRedo: vi.fn() };

vi.mock('@itsjust/core', () => ({
  ToolShell: ({ toolbar, sidebar, canvas, statusBar }: Record<string, unknown>) => (
    <div>
      <div>{toolbar as ReactNode}</div>
      <div>{sidebar as ReactNode}</div>
      <div>{canvas as ReactNode}</div>
      <div>{statusBar as ReactNode}</div>
    </div>
  ),
  ImportExport: ({ onShare }: { onShare?: () => void }) => (
    <button type="button" onClick={onShare}>
      trigger-share
    </button>
  ),
  useTool: () => ({
    state: {
      data: { ...DEFAULT_STATE, input: 'Hi' },
      setData: mockSetData,
      isDirty: false,
      lastSaved: 'just now',
    },
    toast: mockToast,
    supportedFormats: ['json'],
    handleExport: mockHandleExport,
    importFromFile: mockImport,
    isImporting: false,
    toolbarActions: mockToolbarActions,
  }),
}));

beforeEach(() => {
  mockSetData.mockReset();
  mockToast.mockReset();
  Object.defineProperty(navigator, 'clipboard', {
    writable: true,
    value: { writeText: vi.fn().mockResolvedValue(undefined) },
  });
  Object.defineProperty(navigator, 'share', {
    writable: true,
    value: vi.fn().mockResolvedValue(undefined),
  });
  window.history.replaceState(null, '', 'http://localhost:3000/');
});

describe('tool client wiring', () => {
  it('renders dynamic tool client wrapper', () => {
    render(<ToolClientWrapper />);
    expect(screen.getByTestId('dynamic-tool-client')).toBeInTheDocument();
  });

  it('renders shell sections and status bar from ToolClient', () => {
    render(<ToolClient />);
    expect(screen.getByRole('link', { name: 'Open help page' })).toBeInTheDocument();
    expect(screen.getByText(/Direction: text-to-morse/)).toBeInTheDocument();
    expect(screen.getAllByText('15 WPM').length).toBeGreaterThan(0);
  });

  it('handles share flow', async () => {
    render(<ToolClient />);
    fireEvent.click(screen.getByText('trigger-share'));
    await vi.waitFor(() => expect(mockToast).toHaveBeenCalled());
    expect(mockToast.mock.calls.some((c) => String(c[0]).includes('Shared'))).toBe(true);
  });
});

describe('Canvas component', () => {
  const onChange = vi.fn();

  function CanvasWithState({ state }: { state: ToolState }) {
    return <Canvas state={state} onChange={onChange} />;
  }

  beforeEach(() => {
    onChange.mockReset();
  });

  it('translates text to morse in real time', () => {
    render(<CanvasWithState state={{ ...DEFAULT_STATE, input: 'hello world' }} />);
    expect(screen.getByTestId('morse-output')).toHaveTextContent(
      '.... . .-.. .-.. --- / .-- --- .-. .-.. -..'
    );
  });

  it('translates morse to text in real time', () => {
    render(
      <CanvasWithState
        state={{ ...DEFAULT_STATE, direction: 'morse-to-text', input: '.... .. / - .... . .-. .' }}
      />
    );
    expect(screen.getByTestId('morse-output')).toHaveTextContent('HI THERE');
  });

  it('updates input on typing', () => {
    render(<CanvasWithState state={{ ...DEFAULT_STATE, input: '' }} />);
    fireEvent.change(screen.getByLabelText(/Plain text/), { target: { value: 'sos' } });
    expect(onChange).toHaveBeenCalled();
    const next = onChange.mock.calls[0]?.[0] as ToolState;
    expect(next.input).toBe('sos');
  });

  it('swap direction carries output into new input', () => {
    render(<CanvasWithState state={{ ...DEFAULT_STATE, input: 'hi' }} />);
    fireEvent.click(screen.getByRole('button', { name: /Swap translation direction/ }));
    const next = onChange.mock.calls[0]?.[0] as ToolState;
    expect(next.direction).toBe('morse-to-text');
    expect(next.input).toBe(textToMorse('hi').output);
  });

  it('warns about unsupported characters without crashing', () => {
    render(<CanvasWithState state={{ ...DEFAULT_STATE, input: 'a~b' }} />);
    expect(screen.getByTestId('unsupported-chars')).toHaveTextContent(/~/);
    expect(screen.getByTestId('morse-output')).toBeInTheDocument();
  });

  it('renders play button and light without starting playback', () => {
    render(<CanvasWithState state={{ ...DEFAULT_STATE, input: '' }} />);
    expect(screen.getByTestId('play-button')).toBeInTheDocument();
    expect(screen.getByTestId('signal-light')).toBeInTheDocument();
  });

  it('renders the morse reference chart with toggle', () => {
    render(<CanvasWithState state={{ ...DEFAULT_STATE, input: '', showChart: true }} />);
    expect(screen.getByTestId('morse-chart')).toBeInTheDocument();
    expect(screen.getByText('A')).toBeInTheDocument();
  });

  it('hides chart when disabled', () => {
    render(<CanvasWithState state={{ ...DEFAULT_STATE, input: '', showChart: false }} />);
    expect(screen.queryByTestId('morse-chart')).not.toBeInTheDocument();
  });

  it('copies output to clipboard', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { writable: true, value: { writeText } });
    render(<CanvasWithState state={{ ...DEFAULT_STATE, input: 'hi' }} />);
    fireEvent.click(screen.getByRole('button', { name: 'Copy output' }));
    await vi.waitFor(() => expect(writeText).toHaveBeenCalledWith(textToMorse('hi').output));
  });
});

describe('Toolbar component', () => {
  it('switches direction and clears', () => {
    const onChange = vi.fn();
    const onClear = vi.fn();
    render(<Toolbar state={DEFAULT_STATE} onChange={onChange} onClear={onClear} />);
    fireEvent.click(screen.getByText('Morse → Text'));
    expect(onChange).toHaveBeenCalledWith({ ...DEFAULT_STATE, direction: 'morse-to-text' });
    fireEvent.click(screen.getByText('Clear'));
    expect(onClear).toHaveBeenCalled();
  });
});

describe('Sidebar component', () => {
  it('toggles chart and clamps wpm', () => {
    const onChange = vi.fn();
    render(<Sidebar state={DEFAULT_STATE} onChange={onChange} />);
    const checkbox = screen.getByRole('checkbox');
    fireEvent.click(checkbox);
    expect(onChange).toHaveBeenCalledWith({ ...DEFAULT_STATE, showChart: false });
  });
});
