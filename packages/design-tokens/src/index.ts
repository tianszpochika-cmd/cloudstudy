export const designTokens = {
  color: {
    brandPrimary: '#596BFF',
    brandSecondary: '#7C5CFC',
    surfacePage: '#F7F8FC',
    surfaceCard: '#FFFFFF',
    textPrimary: '#202332',
    textSecondary: '#666D80',
  },
  radius: {
    card: '16px',
    button: '14px',
  },
} as const

export type DesignTokens = typeof designTokens
