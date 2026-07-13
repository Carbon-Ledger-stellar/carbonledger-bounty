/**
 * CarbonLedger Design System
 * Emerald/Charcoal glassmorphism theme
 */

export const colors = {
  primary: {
    50: '#f0fdf4',
    100: '#dcfce7',
    500: '#10b981',
    600: '#059669',
    700: '#047857',
  },
  accent: {
    50: '#f0fdfa',
    500: '#06b6d4',
    600: '#0891b2',
  },
  neutral: {
    50: '#fafafa',
    100: '#f3f4f6',
    200: '#e5e7eb',
    500: '#6b7280',
    700: '#374151',
    900: '#1f2937',
  },
  semantic: {
    error: '#ef4444',
    warning: '#f59e0b',
    success: '#10b981',
    info: '#3b82f6',
  },
};

export const spacing = {
  xs: '0.5rem',
  sm: '1rem',
  md: '1.5rem',
  lg: '2rem',
  xl: '3rem',
  '2xl': '4rem',
};

export const shadows = {
  sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
  md: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
  lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
  xl: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
};

export const borderRadius = {
  sm: '0.375rem',
  md: '0.5rem',
  lg: '0.75rem',
  xl: '1rem',
};

export const fonts = {
  display: '"Inter", sans-serif',
  body: '"Inter", sans-serif',
  mono: '"Courier New", monospace',
};

export const transitions = {
  fast: '150ms ease-in-out',
  base: '200ms ease-in-out',
  slow: '300ms ease-in-out',
};

/**
 * Common style recipes
 */
export const flexCenter = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

export const glass = {
  backgroundColor: 'rgba(255, 255, 255, 0.1)',
  backdropFilter: 'blur(10px)',
  border: `1px solid rgba(255, 255, 255, 0.2)`,
};

export const card = {
  backgroundColor: colors.neutral[50],
  borderRadius: borderRadius.lg,
  padding: spacing.lg,
  boxShadow: shadows.md,
  border: `1px solid ${colors.neutral[200]}`,
};

export const button = (variant: 'primary' | 'secondary' | 'tertiary' = 'primary') => {
  const variants = {
    primary: {
      backgroundColor: colors.primary[500],
      color: 'white',
      ':hover': { backgroundColor: colors.primary[600] },
    },
    secondary: {
      backgroundColor: colors.neutral[200],
      color: colors.neutral[900],
      ':hover': { backgroundColor: colors.neutral[300] },
    },
    tertiary: {
      backgroundColor: 'transparent',
      color: colors.primary[600],
      border: `1px solid ${colors.primary[500]}`,
      ':hover': { backgroundColor: colors.primary[50] },
    },
  };

  return {
    ...variants[variant],
    padding: `${spacing.sm} ${spacing.md}`,
    borderRadius: borderRadius.md,
    fontWeight: 600,
    cursor: 'pointer',
    transition: `all ${transitions.base}`,
    border: 'none',
  };
};
