export const THEMES = [
  { id: 'electric', name: 'Electric', description: 'Black & yellow', background: '#000000' },
  { id: 'porcelain', name: 'Porcelain', description: 'Ivory & blue', background: '#f6f3ed' },
  { id: 'burgundy', name: 'Burgundy', description: 'Wine & rose', background: '#190307' },
  { id: 'carbon', name: 'Carbon & Copper', description: 'Black & copper', background: '#0d0b0a' },
];

export const validTheme = value => THEMES.some(theme => theme.id === value) ? value : 'electric';
