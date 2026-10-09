  tailwind.config = {
    theme: {
      extend: {
        colors: {
          bg: '#1E1E1E',
          panel: '#2C2C2C',
          input: '#383838',
          hover: 'rgba(255, 255, 255, 0.08)',
          line: {
            DEFAULT: '#444444',
            strong: '#5A5A5A',
          },
          ink: '#FFFFFF',
          mute: '#B3B3B3',
          dim: '#8C8C8C',
          accent: {
            DEFAULT: '#0D99FF',
            soft: 'rgba(13, 153, 255, 0.22)',
          },
          success: '#14AE5C',
          danger: '#F24822',
        },
        fontFamily: {
          sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
          mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace'],
        },
      },
    },
  };