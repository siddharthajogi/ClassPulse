/**
 * Centralized list of Qualification options for ClassPulse teachers
 */

export const QUALIFICATION_OPTIONS = [
  'B.Tech / B.E.',
  'B.Sc.',
  'BCA',
  'B.Com.',
  'B.A.',
  'M.Tech / M.E.',
  'M.Sc.',
  'MCA',
  'M.Com.',
  'M.A.',
  'MBA',
  'Ph.D.',
  'M.Phil.',
  'Other'
];

export const STANDARD_QUALIFICATIONS = QUALIFICATION_OPTIONS.filter((q) => q !== 'Other');
