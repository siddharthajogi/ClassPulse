/**
 * Centralized list of Qualification options for ClassPulse teachers
 */

const QUALIFICATION_OPTIONS = [
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

const STANDARD_QUALIFICATIONS = QUALIFICATION_OPTIONS.filter((q) => q !== 'Other');

const TEACHER_QUALIFICATION_OPTIONS = [
  'Diploma',
  'B.Tech',
  'B.E.',
  'M.Tech',
  'M.E.',
  'M.Sc.',
  'MCA',
  'MBA',
  'Ph.D.',
  'Other'
];

const STANDARD_TEACHER_QUALIFICATIONS = TEACHER_QUALIFICATION_OPTIONS.filter((q) => q !== 'Other');

const ADMIN_QUALIFICATION_OPTIONS = [
  'Diploma',
  'B.Tech',
  'B.E.',
  'B.Sc.',
  'BCA',
  'M.Tech',
  'M.E.',
  'M.Sc.',
  'MCA',
  'MBA',
  'Ph.D.',
  'Other'
];

const STANDARD_ADMIN_QUALIFICATIONS = ADMIN_QUALIFICATION_OPTIONS.filter((q) => q !== 'Other');

module.exports = {
  QUALIFICATION_OPTIONS,
  STANDARD_QUALIFICATIONS,
  TEACHER_QUALIFICATION_OPTIONS,
  STANDARD_TEACHER_QUALIFICATIONS,
  ADMIN_QUALIFICATION_OPTIONS,
  STANDARD_ADMIN_QUALIFICATIONS
};


