import type { ToolConfig } from '@itsjust/core';

export const toolConfig: ToolConfig & { category: string } = {
  id: 'tool-1795255487',
  name: 'Morse Code Translator',
  category: 'Utility' as const,
  description:
    'Translate text to Morse code and Morse code back to text with audio playback, flashing signal light, encoding charts, and copy/share support.',
  version: '1.0.0',
  exportFormats: ['png', 'jpeg', 'webp', 'pdf'],
  theme: {
    accent: '#f59e0b',
    accentHover: '#d97706',
    accentSubtle: 'rgba(245, 158, 11, 0.12)',
    brand: 'Morse Code Translator',
    icon: '\u{1F4F6}',
  },
  features: {
    export: true,
    autoSave: true,
    undoRedo: true,
    sidebar: true,
    statusBar: true,
    darkMode: true,
  },
};

export default toolConfig;
