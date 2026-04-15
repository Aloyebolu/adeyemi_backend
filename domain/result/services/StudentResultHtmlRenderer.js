// StudentResultHtmlRenderer.js
// INDIVIDUAL STUDENT SEMESTER RESULT - ENHANCED VERSION

import { formatDateWithOrdinal, semesterNameToSeason, toProfessionalAbbreviation } from "../../../utils/helpers.js";
import { convertToPart } from "../../../utils/levelConverter.js";
// import { DEGREE_CLASS, STUDENT_STATUS } from "../../utils/computationConstants.js";
import { capitalizeFirstLetter } from "../../../utils/StringUtils.js";
import { formatMatricNumber, resolveUserName, splitName } from "../../../utils/resolveUserName.js";
import AppError from "../../errors/AppError.js";
import { config } from "../../computation/services/master-sheet/MasterSheetConfig.js";
import { normalizeCourses } from "../../course/course.normallizer.js";

class StudentResultHtmlRenderer {
  
  formatDateWithOrdinal(dateInput) {
    if (!dateInput) return "";
    const date = new Date(dateInput);
    if (isNaN(date.getTime())) return "";
    
    const day = date.getDate();
    const month = date.toLocaleString("en-US", { month: "long" });
    const year = date.getFullYear();
    
    const getOrdinal = (n) => {
      if (n >= 11 && n <= 13) return "th";
      switch (n % 10) {
        case 1: return "st";
        case 2: return "nd";
        case 3: return "rd";
        default: return "th";
      }
    };
    
    return `${day}<sup>${getOrdinal(day)}</sup> ${month} ${year}`;
  }

  capitalizeFirst = str =>
    str ? str.charAt(0).toUpperCase() + str.slice(1).toLowerCase() : str;

  /**
   * Calculate degree class based on CGPA
   */
  getDegreeClass(cgpa) {
    if (cgpa == null || isNaN(cgpa)) return "N/A";
    if (cgpa >= 4.50) return "First Class Honours";
    if (cgpa >= 3.50) return "Second Class Honours (Upper Division)";
    if (cgpa >= 2.40) return "Second Class Honours (Lower Division)";
    if (cgpa >= 1.50) return "Third Class Honours";
    if (cgpa >= 1.00) return "Pass";
    return "Fail";
  }

  /**
   * Get remark based on academic status
   */
  getAcademicRemark(status) {
    const remarks = {
      good: "Good Academic Standing",
      probation: "Probation - Academic Performance Warning",
      withdrawal: "Withdrawn from Programme",
      terminated: "Studentship Terminated",
      leave_of_absence: "Leave of Absence",
      not_registered: "No Registration Information"
    };
    return remarks[status] || status;
  }

  /**
   * Main render method
   */
  render({ studentResult, departmentDetails, isPreview = false }) {
    if (!studentResult) {
      return `<p style="color: red;">No student result data available</p>`;
    }

    const shortId = studentResult._id ? studentResult._id.toString().slice(-8) : 'N/A';
    const purpose = isPreview ? 'preview' : 'final';
    
    // Build course data
    const courses = studentResult.courses || [];
    const coreCourses = courses.filter(c => c.isCoreCourse);
    const electiveCourses = courses.filter(c => !c.isCoreCourse);
    
    // Calculate statistics
    const passedCourses = courses.filter(c => c.status === 'passed');
    const failedCourses = courses.filter(c => c.status === 'failed');
    const carryoverCourses = courses.filter(c => c.isCarryover);
    
    const mainTable = `
<table class="result-table">
  ${this.renderHeader(studentResult, departmentDetails, shortId, isPreview)}
  ${this.renderStudentInfo(studentResult, departmentDetails)}
  ${this.renderCourseResults(courses, studentResult)}
  ${this.renderSemesterSummary(studentResult)}
  ${this.renderCumulativeSummary(studentResult)}
  ${this.renderAcademicStanding(studentResult)}
  ${this.renderSignatures(departmentDetails)}
  ${this.renderFooter(shortId)}
</table>
`;

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>STUDENT RESULT - ${studentResult.matricNumber} - ${studentResult.level} LEVEL</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 15mm 10mm 15mm 10mm;
    }
    
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    
    body {
      font-family: "Times New Roman", serif;
      font-size: 12pt;
      line-height: 1.4;
      color: #000;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
      margin: 0;
      padding: 0;
    }
    
    .watermark {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      z-index: 1000;
      opacity: 0.15;
    }
    
    .preview-watermark {
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='300' viewBox='0 0 400 300'%3E%3Ctext x='50%25' y='50%25' font-family='Arial' font-size='40' font-weight='bold' fill='%23990000' text-anchor='middle' dominant-baseline='middle' transform='rotate(-45 200 150)' opacity='0.7'%3EPREVIEW%3C/text%3E%3Ctext x='50%25' y='60%25' font-family='Arial' font-size='20' fill='%23990000' text-anchor='middle' dominant-baseline='middle' transform='rotate(-45 200 150)' opacity='0.7'%3ENOT FOR OFFICIAL USE%3C/text%3E%3C/svg%3E");
      background-repeat: no-repeat;
      background-position: center;
      background-size: 60% auto;
      opacity: 0.2;
    }
    
    .final-watermark {
      background-image: url('${config.logoUrl || ''}');
      background-repeat: no-repeat;
      background-position: center;
      background-size: 200px 200px;
    }
    
    .result-table {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
      position: relative;
      z-index: 1;
    }
    
    /* Header Styles */
    .header-cell {
      padding: 5mm 0 3mm 0;
      border-bottom: 2pt solid #000;
      text-align: center;
      vertical-align: top;
    }
    
    .header-content {
      position: relative;
      min-height: 25mm;
    }
    
    .header-logo-container {
      position: absolute;
      left: 0;
      top: 0;
      width: 25mm;
      height: 25mm;
    }
    
    .header-logo {
      max-width: 100%;
      max-height: 100%;
      object-fit: contain;
    }
    
    .header-text-container {
      margin: 0 30mm;
      text-align: center;
      text-transform: uppercase;
    }
    
    .header-institution {
      font-size: 14pt;
      font-weight: bold;
      margin-bottom: 1mm;
    }
    
    .header-title {
      font-size: 12pt;
      font-weight: bold;
      margin: 2mm 0;
      text-decoration: underline;
    }
    
    .header-meta {
      position: absolute;
      right: 0;
      top: 0;
      font-size: 9pt;
      text-align: right;
      line-height: 1.2;
    }
    
    /* Student Info Styles */
    .student-info-cell {
      padding: 4mm 0 2mm 0;
    }
    
    .info-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 2mm 5mm;
      padding: 2mm;
      border: 1pt solid #000;
      background-color: #f9f9f9;
    }
    
    .info-item {
      display: flex;
    }
    
    .info-label {
      font-weight: bold;
      min-width: 100px;
    }
    
    .info-value {
      font-weight: normal;
    }
    
    /* Course Table Styles */
    .section-title-row {
      background-color: #e0e0e0;
    }
    
    .section-title {
      font-size: 11pt;
      font-weight: bold;
      padding: 2mm;
      text-align: left;
    }
    
    .course-table {
      width: 100%;
      border-collapse: collapse;
      margin: 2mm 0;
      font-size: 10pt;
    }
    
    .course-table th {
      background-color: #f0f0f0;
      font-weight: bold;
      text-align: center;
      padding: 1.5mm;
      border: 0.75pt solid #000;
    }
    
    .course-table td {
      padding: 1.5mm;
      border: 0.75pt solid #000;
    }
    
    .text-left {
      text-align: left;
    }
    
    .text-center {
      text-align: center;
    }
    
    .text-right {
      text-align: right;
    }
    
    .text-bold {
      font-weight: bold;
    }
    
    /* Summary Styles */
    .summary-box {
      margin: 3mm 0;
      padding: 2mm;
      border: 1pt solid #000;
      background-color: #f9f9f9;
    }
    
    .summary-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 2mm;
    }
    
    .summary-item {
      text-align: center;
    }
    
    .summary-label {
      font-weight: bold;
      font-size: 9pt;
    }
    
    .summary-value {
      font-size: 14pt;
      font-weight: bold;
      margin-top: 1mm;
    }
    
    /* Academic Standing */
    .standing-box {
      margin: 3mm 0;
      padding: 2mm;
      border: 1.5pt solid #000;
      text-align: center;
    }
    
    .standing-label {
      font-size: 10pt;
      font-weight: bold;
    }
    
    .standing-value {
      font-size: 12pt;
      margin-top: 1mm;
    }
    
    .standing-good {
      color: #006600;
    }
    
    .standing-warning {
      color: #cc6600;
    }
    
    .standing-critical {
      color: #cc0000;
    }
    
    /* Signatures */
    .signatures-container {
      display: flex;
      justify-content: space-between;
      margin-top: 10mm;
    }
    
    .signature-block {
      width: 45%;
      text-align: center;
    }
    
    .signature-line {
      border-top: 0.75pt solid #000;
      width: 100%;
      margin: 0 auto;
      height: 8mm;
    }
    
    .signature-name {
      font-weight: bold;
      margin-top: 1mm;
    }
    
    .signature-title {
      font-size: 9pt;
      margin-top: 0.5mm;
    }
    
    /* Footer */
    .footer-cell {
      padding-top: 5mm;
      border-top: 0.5pt solid #ccc;
      font-size: 8pt;
      text-align: center;
    }
    
    /* Status Badges */
    .badge {
      display: inline-block;
      padding: 1px 5px;
      border-radius: 3px;
      font-size: 8pt;
      font-weight: bold;
    }
    
    .badge-pass {
      background-color: #d4edda;
      color: #155724;
    }
    
    .badge-fail {
      background-color: #f8d7da;
      color: #721c24;
    }
    
    .badge-carryover {
      background-color: #fff3cd;
      color: #856404;
    }
    
    @media print {
      .page-break {
        page-break-before: always;
      }
      
      .watermark {
        position: fixed;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
    }
  </style>
</head>
<body>
  ${isPreview
    ? '<div class="watermark preview-watermark"></div>'
    : '<div class="watermark final-watermark"></div>'}
  
  ${mainTable}
</body>
</html>`;
  }

  /**
   * Render header with institution details
   */
  renderHeader(studentResult, departmentDetails, shortId, isPreview) {
    return `
<thead>
  <tr>
    <td class="header-cell">
      <div class="header-content">
        <div class="header-logo-container">
          <img src="${config.logoUrl || ''}" alt="University Logo" class="header-logo" />
        </div>
        
        <div class="header-text-container">
          <div class="header-institution">${config.institution}</div>
          <div>Faculty of ${departmentDetails?.faculty?.name || 'N/A'}</div>
          <div>Department of ${departmentDetails?.name || 'N/A'}</div>
          <div class="header-title">SEMESTER EXAMINATION RESULT</div>
          <div>${studentResult.session} Session - ${capitalizeFirstLetter(studentResult.semester || '')} Semester</div>
          <div>${toProfessionalAbbreviation(departmentDetails?.programme?.programmeType)} ${departmentDetails?.name || ''}</div>
          <div>${convertToPart(studentResult.level)} Level</div>
        </div>
        
        <div class="header-meta">
          <div>Ref: ${shortId}</div>
          ${isPreview ? '<div style="color: red; font-weight: bold;">PREVIEW</div>' : ''}
        </div>
      </div>
    </td>
  </tr>
</thead>`;
  }

  /**
   * Render student information section
   */
  renderStudentInfo(studentResult, departmentDetails) {
    return `
<tbody>
  <tr>
    <td class="student-info-cell">
      <div class="info-grid">
        <div class="info-item">
          <span class="info-label">Name:</span>
          <span class="info-value text-bold">${studentResult.name || '-'}</span>
        </div>
        <div class="info-item">
          <span class="info-label">Matric Number:</span>
          <span class="info-value text-bold">${studentResult.matricNumber || '-'}</span>
        </div>
        <div class="info-item">
          <span class="info-label">Department:</span>
          <span class="info-value">${departmentDetails?.name || '-'}</span>
        </div>
        <div class="info-item">
          <span class="info-label">Programme:</span>
          <span class="info-value">${toProfessionalAbbreviation(departmentDetails?.programme?.programmeType)}</span>
        </div>
        <div class="info-item">
          <span class="info-label">Level:</span>
          <span class="info-value">${convertToPart(studentResult.level)}</span>
        </div>
        <div class="info-item">
          <span class="info-label">Semester:</span>
          <span class="info-value">${capitalizeFirstLetter(studentResult.semester || '-')}</span>
        </div>
      </div>
    </td>
  </tr>
</tbody>`;
  }

  /**
   * Render course results table
   */
  renderCourseResults(courses, studentResult) {

    courses.map((v, i)=> courses[i] = {...v, ...v.courseId, status: v.status})
    courses = normalizeCourses(courses)
    console.log(courses)
    if (!courses || courses.length === 0) {
      return `
<tbody>
  <tr>
    <td>
      <div style="text-align: center; padding: 5mm;">No course results available</div>
    </td>
  </tr>
</tbody>`;
    }

    const courseRows = courses.map((course, index) => {
      const statusBadge = course.status === 'passed' 
        ? '<span class="badge badge-pass">PASS</span>'
        : '<span class="badge badge-fail">FAIL</span>';
      
      const carryoverBadge = course.isCarryover 
        ? '<span class="badge badge-carryover">CO</span>' 
        : '';
      
      return `
      <tr>
        <td class="text-center">${index + 1}</td>
        <td class="text-left text-bold">${course.courseCode || '-'}</td>
        <td class="text-left">${course.title || '-'}</td>
        <td class="text-center">${course.unit || 0}</td>
        <td class="text-center">${course.score != null ? course.score.toFixed(0) : '-'}</td>
        <td class="text-center text-bold">${course.grade || '-'}</td>
        <td class="text-center">${course.gradePoint != null ? course.gradePoint.toFixed(0) : '-'}</td>
        <td class="text-center">
  ${
    course.unit != null && course.gradePoint != null
      ? (course.unit * course.gradePoint).toFixed(0)
      : '-'
  }
</td>
        <td class="text-center">
          ${statusBadge}
          ${carryoverBadge}
        </td>
      </tr>
    `;
    }).join('');

    return `
<tbody>
  <tr class="section-title-row">
    <td class="section-title">COURSE RESULTS</td>
  </tr>
  <tr>
    <td>
      <table class="course-table">
        <thead>
          <tr>
            <th>S/N</th>
            <th>Course Code</th>
            <th>Course Title</th>
            <th>Units</th>
            <th>Score</th>
            <th>Grade</th>
            <th>Grade Point</th>
            <th>Credit Point</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          ${courseRows}
        </tbody>
      </table>
    </td>
  </tr>
</tbody>`;
  }

  /**
   * Render semester summary
   */
  renderSemesterSummary(studentResult) {
    const gpa = studentResult.gpa || 0;
    const totalUnits = studentResult.totalUnits || 0;
    const totalPoints = studentResult.totalPoints || 0;
    
    return `
<tbody>
  <tr class="section-title-row">
    <td class="section-title">SEMESTER SUMMARY</td>
  </tr>
  <tr>
    <td>
      <div class="summary-box">
        <div class="summary-grid">
          <div class="summary-item">
            <div class="summary-label">Total Units (TNU)</div>
            <div class="summary-value">${totalUnits}</div>
          </div>
          <div class="summary-item">
            <div class="summary-label">Total Points (TCP)</div>
            <div class="summary-value">${totalPoints.toFixed(0)}</div>
          </div>
          <div class="summary-item">
            <div class="summary-label">Semester GPA</div>
            <div class="summary-value">${gpa.toFixed(2)}</div>
          </div>
        </div>
      </div>
    </td>
  </tr>
</tbody>`;
  }

  /**
   * Render cumulative summary
   */
  renderCumulativeSummary(studentResult) {
    const cgpa = studentResult.cgpa || 0;
    const cumulativeTNU = studentResult.cumulativeTNU || 0;
    const cumulativeTCP = studentResult.cumulativeTCP || 0;
    
    return `
<tbody>
  <tr class="section-title-row">
    <td class="section-title">CUMULATIVE SUMMARY</td>
  </tr>
  <tr>
    <td>
      <div class="summary-box">
        <div class="summary-grid">
          <div class="summary-item">
            <div class="summary-label">Cumulative Units</div>
            <div class="summary-value">${cumulativeTNU}</div>
          </div>
          <div class="summary-item">
            <div class="summary-label">Cumulative Points</div>
            <div class="summary-value">${cumulativeTCP.toFixed(0)}</div>
          </div>
          <div class="summary-item">
            <div class="summary-label">CGPA</div>
            <div class="summary-value">${cgpa.toFixed(2)}</div>
          </div>
        </div>
      </div>
    </td>
  </tr>
</tbody>`;
  }

  /**
   * Render academic standing
   */
  renderAcademicStanding(studentResult) {
    const status = studentResult.academicStatus || 'good';
    const remark = this.getAcademicRemark(status);
    const degreeClass = this.getDegreeClass(studentResult.cgpa);
    
    let standingClass = 'standing-good';
    if (status === 'probation') standingClass = 'standing-warning';
    if (status === 'withdrawal' || status === 'terminated') standingClass = 'standing-critical';
    
    return `
<tbody>
  <tr class="section-title-row">
    <td class="section-title">ACADEMIC STANDING</td>
  </tr>
  <tr>
    <td>
      <div class="standing-box ${standingClass}">
        <div class="standing-label">Current Academic Status</div>
        <div class="standing-value text-bold">${remark}</div>
        ${studentResult.cgpa >= 1.0 ? `
        <div style="margin-top: 3mm;">
          <div class="standing-label">Current Classification</div>
          <div class="standing-value">${degreeClass}</div>
        </div>
        ` : ''}
        ${studentResult.carryoverCount > 0 ? `
        <div style="margin-top: 2mm; font-size: 9pt; color: #cc6600;">
          Outstanding Courses: ${studentResult.carryoverCount}
        </div>
        ` : ''}
      </div>
    </td>
  </tr>
</tbody>`;
  }

  /**
   * Render signatures
   */
  renderSignatures(departmentDetails) {
    const hodName = resolveUserName(departmentDetails?.hod, "StudentResultHtmlRenderer.renderSignatures", { initials: true });
    const deanName = resolveUserName(departmentDetails?.dean, "StudentResultHtmlRenderer.renderSignatures", { initials: true });
    
    return `
<tbody>
  <tr>
    <td>
      <div class="signatures-container">
        <div class="signature-block">
          <div class="signature-line"></div>
          <div class="signature-name">${hodName}</div>
          <div class="signature-title">Head of Department</div>
          <div class="signature-title" style="font-size: 8pt;">${departmentDetails?.name || ''}</div>
        </div>
        <div class="signature-block">
          <div class="signature-line"></div>
          <div class="signature-name">${deanName}</div>
          <div class="signature-title">Dean</div>
          <div class="signature-title" style="font-size: 8pt;">Faculty of ${departmentDetails?.faculty?.name || 'N/A'}</div>
        </div>
      </div>
    </td>
  </tr>
</tbody>`;
  }

  /**
   * Render footer
   */
  renderFooter(resultId) {
    return `
<tbody>
  <tr>
    <td class="footer-cell">
      Generated: ${new Date().toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })} • Result ID: ${resultId || 'N/A'}
    </td>
  </tr>
</tbody>`;
  }
}

export default new StudentResultHtmlRenderer();