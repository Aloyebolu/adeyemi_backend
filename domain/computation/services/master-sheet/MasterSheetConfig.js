const university = {
  institution: "ADEYEMI FEDERAL UNIVERSITY OF EDUCATION, ONDO",
  faculty: "SCHOOL OF SCIENCE",
  programmePrefix: "B.Sc.",
  hod: {
    name: "Dr. O. G. Iroju",
    title: "HOD",
    unit: "Department of Computer Science"
  },
  dean: {
    name: "Prof. J. O. Babajide",
    title: "Dean",
    unit: "Faculty of Science"
  },
  pageFormat: "A4",
  orientation: "landscape",
  logoUrl: 'http://localhost:3000/_next/image?url=%2Flogo.png&w=64&q=75'
};


// compute institution2 separately
university.institution2 = university.institution
  .toLowerCase()
  .split(' ')
  .map(word => word.charAt(0).toUpperCase() + word.slice(1))
  .join(' '); // full name in title case

export default university;

export const config = university