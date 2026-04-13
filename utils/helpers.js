export const buildProgrammeFullName = (programmeType, programmeName) => {
  const typeMap = {
    BSC: "Bachelor of Science in",
    BA: "Bachelor of Arts in",
    BED: "Bachelor of Education in",
    BSCED: "Bachelor of Science Education in",
    BTECH: "Bachelor of Technology in",
    BENG: "Bachelor of Engineering in",
    MSC: "Master of Science in",
    MA: "Master of Arts in",
    MBA: "Master of Business Administration in",
    PHD: "Doctor of Philosophy in",
    PGD: "Postgraduate Diploma in",
    CERT: "Certificate in",
  };

  const prefix = typeMap[programmeType] || "";

  return `${prefix} ${programmeName}`.trim();
};
export const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
const programmeAbbreviationMap = {
  // Bachelor Degrees
  BSC: 'B.Sc.',
  BA: 'B.A.',
  BED: 'B.Ed.',
  BSCED: 'B.Sc.Ed.',
  BTECH: 'B.Tech.',
  BENG: 'B.Eng.',
  LLB: 'LL.B.',
  MBBS: 'MBBS',
  BDS: 'BDS',

  // Master Degrees
  MSC: 'M.Sc.',
  MA: 'M.A.',
  MBA: 'MBA',
  MPH: 'MPH',
  MPHIL: 'M.Phil.',
  LLM: 'LL.M.',
  MENG: 'M.Eng.',

  // Doctorate
  PHD: 'Ph.D.',
  DPHIL: 'D.Phil.',

  // Diplomas
  PGD: 'PGD',
  DIP: 'Dip.',
  ADV_DIP: 'Adv. Dip.',

  // Certificates
  CERT: 'Cert.',
  PG_CERT: 'PG Cert.'
};
function toProfessionalAbbreviation(code) {
  return programmeAbbreviationMap[code] || code;
}

toProfessionalAbbreviation('BSCED');
// B.Sc.(Ed.)
export { toProfessionalAbbreviation };

export function formatDateWithOrdinal(date) {
  const day = date.getDate();
  const month = date.toLocaleString('default', { month: 'long' }); // January, February...
  const year = date.getFullYear();

  // Determine the ordinal suffix
  const j = day % 10,
        k = day % 100;
  let suffix = "th";
  if (j === 1 && k !== 11) suffix = "st";
  else if (j === 2 && k !== 12) suffix = "nd";
  else if (j === 3 && k !== 13) suffix = "rd";

  return `${day}<sup>${suffix}</sup> of ${month}, ${year}`;
}

// Example usage
const myDate = new Date('2023-01-23');
// Output: 23rd of January, 2023

export function semesterNameToSeason(semester) {
  if (semester === "first") return "rain";
  if (semester === "second") return "harmattan";
  throw new Error("Invalid semester. Must be 'first' or 'second'.");
}