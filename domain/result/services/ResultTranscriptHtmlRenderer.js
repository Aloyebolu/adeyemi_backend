// ResultTranscriptHtmlRenderer.js
// STUDENT ACADEMIC TRANSCRIPT - COMPREHENSIVE VERSION

import { formatDateWithOrdinal, semesterNameToSeason, toProfessionalAbbreviation } from "#utils/helpers.js";
import { convertToPart } from "#utils/levelConverter.js";
import { capitalizeFirstLetter } from "#utils/StringUtils.js";
import { formatMatricNumber, resolveUserName } from "#utils/resolveUserName.js";
import { config } from "#domain/computation/services/master-sheet/MasterSheetConfig.js";
import { normalizeCourses } from "#domain/course/course.normallizer.js";

class ResultTranscriptHtmlRenderer {
  
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
   * Calculate grade letter from score
   */
  getGradeLetter(score) {
    if (score == null || isNaN(score)) return '-';
    if (score >= 70) return 'A';
    if (score >= 60) return 'B';
    if (score >= 50) return 'C';
    if (score >= 45) return 'D';
    if (score >= 40) return 'E';
    return 'F';
  }

  /**
   * Calculate grade point from score
   */
  getGradePoint(score) {
    if (score == null || isNaN(score)) return 0;
    if (score >= 70) return 5.0;
    if (score >= 60) return 4.0;
    if (score >= 50) return 3.0;
    if (score >= 45) return 2.0;
    if (score >= 40) return 1.0;
    return 0.0;
  }

  /**
   * Calculate degree class based on final CGPA
   */
  getDegreeClass(cgpa) {
    if (cgpa == null || isNaN(cgpa)) return "Not Classified";
    if (cgpa >= 4.50) return "First Class";
    if (cgpa >= 3.50) return "Second Class Upper ";
    if (cgpa >= 2.40) return "Second Class Lower ";
    if (cgpa >= 1.50) return "Third Class";
    if (cgpa >= 1.00) return "Pass";
    return "Fail";
  }

  /**
   * Group academic history by session and level
   */
  groupAcademicHistory(academicHistory) {
    if (!academicHistory || academicHistory.length === 0) return {};
    
    const grouped = {};
    
    academicHistory.forEach(semester => {
      const key = `${semester.session}-${semester.level}`;
      if (!grouped[key]) {
        grouped[key] = {
          session: semester.session,
          level: semester.level,
          semesters: []
        };
      }
      grouped[key].semesters.push(semester);
    });
    
    return grouped;
  }

  /**
   * Main render method
   */
  render({ studentInfo, academicHistory, departmentDetails, graduationInfo, isPreview = false }) {
    if (!studentInfo) {
      return `<p style="color: red;">No student transcript data available</p>`;
    }

    const transcriptId = studentInfo._id ? studentInfo._id.toString().slice(-8) : 'N/A';
    const groupedHistory = this.groupAcademicHistory(academicHistory);
    
    // Calculate final statistics
    const finalCGPA = graduationInfo?.finalCGPA || studentInfo.cgpa || 0;
    const totalCredits = graduationInfo?.totalCredits || studentInfo.cumulativeTNU || 0;
    const degreeClass = this.getDegreeClass(finalCGPA);
    const graduationDate = graduationInfo?.graduationDate || null;
    
    const mainTable = `
<table class="transcript-table">
  ${this.renderHeader(studentInfo, departmentDetails, transcriptId, isPreview)}
  ${this.renderStudentProfile(studentInfo, departmentDetails)}
  ${this.renderCompactSummary(finalCGPA, totalCredits, degreeClass, studentInfo)}
  ${this.renderAcademicHistory(groupedHistory, departmentDetails)}
  ${this.renderGraduationInfo(graduationInfo, degreeClass, graduationDate)}
  ${this.renderTranscriptKey()}
  ${this.renderCertification(departmentDetails, graduationDate)}
  ${this.renderFooter(transcriptId)}
</table>
`;

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>ACADEMIC TRANSCRIPT - ${studentInfo.matricNumber}</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 8mm 10mm 8mm 10mm;
    }
    
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    
    body {
      font-family: "Times New Roman", serif;
      font-size: 10pt;
      line-height: 1.3;
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
      opacity: 0.08;
    }
    
    .preview-watermark {
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='300' viewBox='0 0 400 300'%3E%3Ctext x='50%25' y='50%25' font-family='Arial' font-size='50' font-weight='bold' fill='%23990000' text-anchor='middle' dominant-baseline='middle' transform='rotate(-45 200 150)'%3EPREVIEW - NOT OFFICIAL%3C/text%3E%3C/svg%3E");
      background-repeat: no-repeat;
      background-position: center;
      background-size: 70% auto;
    }
    
    .final-watermark {
      background-image: url('${config.logoUrl || ''}');
      background-repeat: no-repeat;
      background-position: center;
      background-size: 200px 200px;
    }
    
    .transcript-table {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
      position: relative;
      z-index: 1;
    }
    
    /* Prevent unwanted page breaks */
    tr, td, div, .profile-grid, .compact-summary, .level-header, 
    .semester-header, .courses-table, .summary-table, .graduation-box,
    .key-box, .certification-box {
      page-break-inside: avoid;
      break-inside: avoid;
    }
    
    /* Allow natural flow - no forced page breaks */
    .academic-history-section {
      page-break-before: avoid;
      break-before: avoid;
    }
    
    /* Header Styles */
    .header-cell {
      padding: 2mm 0 1mm 0;
      border-bottom: 2pt solid #1a3a5c;
      text-align: center;
      vertical-align: top;
    }
    
    .header-content {
      position: relative;
      min-height: 20mm;
    }
    
    .header-logo-container {
      position: absolute;
      left: 0;
      top: 0;
      width: 20mm;
      height: 20mm;
    }
    
    .header-logo {
      max-width: 100%;
      max-height: 100%;
      object-fit: contain;
    }
    
    .header-text-container {
      margin: 0 25mm;
      text-align: center;
      text-transform: uppercase;
    }
    
    .header-institution {
      font-size: 14pt;
      font-weight: bold;
      color: #1a3a5c;
      margin-bottom: 1mm;
    }
    
    .header-title {
      font-size: 12pt;
      font-weight: bold;
      margin: 1mm 0;
      color: #1a3a5c;
      letter-spacing: 2px;
    }
    
    .header-meta {
      position: absolute;
      right: 0;
      top: 0;
      font-size: 7pt;
      text-align: right;
      line-height: 1.2;
    }
    
    /* Student Profile */
    .profile-cell {
    }
    
    .profile-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 0.5mm;
      padding: 1mm;
      border: 0.5pt solid #1a3a5c;
      background: #f8f9fa;
    }
    
    .profile-item {
      display: flex;
      flex-direction: column;
    }
    
    .profile-label {
      font-size: 7pt;
      font-weight: bold;
      color: #1a3a5c;
      text-transform: uppercase;
    }
    
    .profile-value {
      font-size: 9pt;
      font-weight: bold;
      margin-top: 0.3mm;
    }
    
    /* Compact Summary */
    .compact-summary {
      margin: 1mm 0 2mm 0;
      padding: 1.5mm;
      border: 0.5pt solid #1a3a5c;
      background: #f0f4f8;
      display: flex;
      justify-content: space-around;
      align-items: center;
    }
    
    .summary-stat {
      text-align: center;
    }
    
    .summary-stat-label {
      font-size: 7pt;
      font-weight: bold;
      color: #555;
    }
    
    .summary-stat-value {
      font-size: 11pt;
      font-weight: bold;
      color: #1a3a5c;
    }
    
    /* Academic History */
    .section-header {
      background-color: #1a3a5c;
      color: white;
      padding: 1.5mm;
      font-weight: bold;
      text-align: left;
      margin: 2mm 0 1mm 0;
    }
    
    .level-header {
      background-color: #2a5a8c;
      color: white;
      font-weight: bold;
      padding: 1.5mm;
      margin: 2mm 0 1mm 0;
    }
    
    .semester-header {
      background-color: #d0e0f0;
      font-weight: bold;
      padding: 1mm 2mm;
      margin: 1.5mm 0 1mm 0;
    }
    
    .courses-table {
      width: 100%;
      border-collapse: collapse;
      margin: 1mm 0;
      font-size: 8pt;
    }
    
    .courses-table th {
      background-color: #e8f0fe;
      color: #1a3a5c;
      font-weight: bold;
      text-align: center;
      padding: 1mm;
      border: 0.5pt solid #1a3a5c;
    }
    
    .courses-table td {
      padding: 0.8mm;
      border: 0.5pt solid #999;
      text-align: center;
    }
    
    .summary-table {
      width: 100%;
      border-collapse: collapse;
      margin: 1mm 0 2mm 0;
      font-size: 8pt;
      background-color: #f8f9fa;
    }
    
    .summary-table th {
      background-color: #2a5a8c;
      color: white;
      font-weight: bold;
      text-align: center;
      padding: 1mm;
      border: 0.5pt solid #1a3a5c;
    }
    
    .summary-table td {
      padding: 1mm;
      border: 0.5pt solid #999;
      text-align: center;
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
    
    /* Graduation Section */
    .graduation-box {
      margin: 3mm 0 2mm 0;
      padding: 2mm;
      border: 1.5pt solid #1a3a5c;
      background: #f0f8ff;
      text-align: center;
    }
    
    .graduation-title {
      font-size: 10pt;
      font-weight: bold;
      color: #1a3a5c;
      margin-bottom: 1.5mm;
    }
    
    .graduation-details {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 2mm;
      margin-top: 1mm;
    }
    
    .graduation-item {
      text-align: center;
    }
    
    /* Key Section */
    .key-box {
      margin: 2mm 0;
      padding: 1.5mm;
      border: 0.5pt solid #999;
      background-color: #f9f9f9;
      font-size: 7pt;
    }
    
    .key-title {
      font-weight: bold;
      margin-bottom: 0.5mm;
    }
    
    .key-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 0.5mm;
    }
    
    /* Certification */
    .certification-box {
      margin: 3mm 0;
      padding: 2mm;
      border-top: 0.5pt solid #1a3a5c;
      border-bottom: 0.5pt solid #1a3a5c;
    }
    
    .certification-text {
      text-align: justify;
      font-size: 8pt;
      line-height: 1.4;
      margin-bottom: 3mm;
    }
    
    .signatures-container {
      display: flex;
      justify-content: space-between;
      margin-top: 3mm;
    }
    
    .signature-block {
      width: 30%;
      text-align: center;
    }
    
    .signature-line {
      border-top: 0.5pt solid #000;
      width: 100%;
      margin: 0 auto;
      height: 5mm;
    }
    
    .signature-name {
      font-weight: bold;
      font-size: 8pt;
      margin-top: 0.5mm;
    }
    
    .signature-title {
      font-size: 7pt;
    }
    
    /* Footer */
    .footer-cell {
      padding-top: 2mm;
      border-top: 0.5pt solid #ccc;
      font-size: 6pt;
      text-align: center;
      color: #666;
    }
    
    @media print {
      body {
        margin: 0;
        padding: 0;
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
   * Render header
   */
  renderHeader(studentInfo, departmentDetails, transcriptId, isPreview) {
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
          <div class="header-title">ACADEMIC TRANSCRIPT</div>
        </div>
        
        <div class="header-meta">
          <div>Transcript No: ${transcriptId}</div>
          <div>Date: ${this.formatDateWithOrdinal(new Date())}</div>
          ${isPreview ? '<div style="color: red; font-weight: bold;">PREVIEW COPY</div>' : ''}
        </div>
      </div>
    </td>
  </tr>
</thead>`;
  }

  /**
   * Render student profile
   */
  renderStudentProfile(studentInfo, departmentDetails) {
    return `
<tbody>
  <tr>
    <td class="profile-cell">
      <div class="profile-grid">
        <div class="profile-item">
          <span class="profile-label">Full Name</span>
          <span class="profile-value">${studentInfo.name || '-'}</span>
        </div>
        <div class="profile-item">
          <span class="profile-label">Matriculation Number</span>
          <span class="profile-value">${studentInfo.matricNumber || '-'}</span>
        </div>
        <div class="profile-item">
          <span class="profile-label">Date of Birth</span>
          <span class="profile-value">${studentInfo.dateOfBirth ? this.formatDateWithOrdinal(studentInfo.dateOfBirth) : '-'}</span>
        </div>
        <div class="profile-item">
          <span class="profile-label">Programme</span>
          <span class="profile-value">${toProfessionalAbbreviation(departmentDetails?.programme?.programmeType)}</span>
        </div>
        <div class="profile-item">
          <span class="profile-label">Department</span>
          <span class="profile-value">${departmentDetails?.name || '-'}</span>
        </div>
        <div class="profile-item">
          <span class="profile-label">Faculty</span>
          <span class="profile-value">${departmentDetails?.faculty?.name || '-'}</span>
        </div>
        <div class="profile-item">
          <span class="profile-label">Year of Admission</span>
          <span class="profile-value">${studentInfo.admissionYear || '-'}</span>
        </div>
        <div class="profile-item">
          <span class="profile-label">Year of Graduation</span>
          <span class="profile-value">${studentInfo.graduationYear || 'In Progress'}</span>
        </div>
        <div class="profile-item">
          <span class="profile-label">Mode of Entry</span>
          <span class="profile-value">${studentInfo.modeOfEntry || 'UTME'}</span>
        </div>
      </div>
    </td>
  </tr>
</tbody>`;
  }

  /**
   * Render compact summary (replaces the old academic summary)
   */
  renderCompactSummary(finalCGPA, totalCredits, degreeClass, studentInfo) {
    return
    return `
<tbody>
  <tr>
    <td>
      <div class="compact-summary">
        <div class="summary-stat">
          <div class="summary-stat-label">Final CGPA</div>
          <div class="summary-stat-value">${finalCGPA.toFixed(2)}</div>
        </div>
        <div class="summary-stat">
          <div class="summary-stat-label">Total Credits</div>
          <div class="summary-stat-value">${totalCredits}</div>
        </div>
        <div class="summary-stat">
          <div class="summary-stat-label">Classification</div>
          <div class="summary-stat-value" style="font-size: 9pt;">${degreeClass}</div>
        </div>
        <div class="summary-stat">
          <div class="summary-stat-label">Status</div>
          <div class="summary-stat-value" style="font-size: 9pt;">${studentInfo.academicStatus || 'Active'}</div>
        </div>
      </div>
    </td>
  </tr>
</tbody>`;
  }

  /**
   * Render courses table for a semester
   */
  renderCoursesTable(courses) {
    if (!courses || courses.length === 0) {
      return '<tr><td colspan="7" style="text-align: center; padding: 1.5mm;">No courses available for this semester</td></tr>';
    }

    return courses.map((course, index) => {
      const score = course.score || course.totalScore || 0;
      const gradeLetter = this.getGradeLetter(score);
      const gradePoint = this.getGradePoint(score);
      const creditUnits = course.unit || course.creditUnits || course.creditHours || course.units || 0;
      const creditPoints = gradePoint * creditUnits;
      
      return `
        <tr>
          <td class="text-center">${index + 1}</td>
          <td class="text-left">${course.courseCode || '-'}</td>
          <td class="text-left">${course.title || course.courseName || '-'}</td>
          <td class="text-center">${creditUnits}</td>
          <td class="text-center">${score}${gradeLetter !== '-' ? '%' : ''}</td>
          <td class="text-center text-bold">${gradeLetter}</td>
          <td class="text-center">${gradePoint.toFixed(1)}</td>
          <td class="text-center">${creditPoints.toFixed(1)}</td>
        </tr>
      `;
    }).join('');
  }

  /**
   * Render semester summary table
   */
  renderSemesterSummary(semester) {
    return `
      <table class="summary-table">
        <thead>
          <tr>
            <th>Semester</th>
            <th>TCP</th>
            <th>TNU</th>
            <th>GPA</th>
            <th>CGPA</th>
            <th>Remark</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td class="text-center">${capitalizeFirstLetter(semester.semester || '-')}</td>
            <td class="text-center">${semester.tcp || 0}</td>
            <td class="text-center">${semester.tnu || 0}</td>
            <td class="text-center text-bold">${semester.gpa ? semester.gpa.toFixed(2) : '0.00'}</td>
            <td class="text-center text-bold">${semester.cgpa ? semester.cgpa.toFixed(2) : '0.00'}</td>
            <td class="text-left">${semester.remark || '-'}</td>
          </tr>
        </tbody>
      </table>
    `;
  }

  /**
   * Render academic history by session and level - NO PAGE BREAKS
   */
  renderAcademicHistory(groupedHistory, departmentDetails) {
    if (!groupedHistory || Object.keys(groupedHistory).length === 0) {
      return `
<tbody>
  <tr>
    <td>
      <div style="text-align: center; padding: 3mm;">No academic history available</div>
    </td>
  </tr>
</tbody>`;
    }

    let historyHTML = '<div class="academic-history-section">';
    
    Object.values(groupedHistory).forEach((group) => {
      const semesterContent = group.semesters.map((sem) => {
            // Process courses
            if (sem.courses && sem.courses.length) {
              sem.courses = sem.courses.map((v, i) => ({ ...v, ...v.courseId, status: v.status }));
              sem.courses = normalizeCourses(sem.courses);
            }
        return `
          <div>
            <div class="semester-header">
              ${capitalizeFirstLetter(sem.semester)} Semester
            </div>
            
            <table class="courses-table">
              <thead>
                <tr>
                  <th>S/N</th>
                  <th>Course Code</th>
                  <th>Course Title</th>
                  <th>Units</th>
                  <th>Score</th>
                  <th>Grade</th>
                  <th>Grade Point</th>
                  <th>Credit Points</th>
                </tr>
              </thead>
              <tbody>
                ${this.renderCoursesTable(sem.courses)}
              </tbody>
            </table>
            
            ${this.renderSemesterSummary(sem)}
          </div>
        `;
      }).join('');
      
      historyHTML += `
        <div class="level-header">
          ${group.session} Session - ${convertToPart(group.level)} Level
        </div>
        ${semesterContent}
      `;
    });
    
    historyHTML += '</div>';

    return `
<tbody>
  <tr>
    <td>
      <div class="section-header">ACADEMIC HISTORY</div>
      ${historyHTML}
    </td>
  </tr>
</tbody>`;
  }

  /**
   * Render graduation information
   */
  renderGraduationInfo(graduationInfo, degreeClass, graduationDate) {
    if (!graduationInfo || !graduationInfo.eligibleForGraduation) {
      return '';
    }
    
    return `
<tbody>
  <tr>
    <td>
      <div class="graduation-box">
        <div class="graduation-title">GRADUATION INFORMATION</div>
        <div class="graduation-details">
          <div class="graduation-item">
            <div class="profile-label">Degree Awarded</div>
            <div style="font-weight: bold; margin-top: 0.5mm;">${graduationInfo.degreeAwarded || 'Bachelor of Science'}</div>
          </div>
          <div class="graduation-item">
            <div class="profile-label">Classification</div>
            <div style="font-weight: bold; margin-top: 0.5mm;">${degreeClass}</div>
          </div>
          <div class="graduation-item">
            <div class="profile-label">Graduation Date</div>
            <div style="font-weight: bold; margin-top: 0.5mm;">${graduationDate ? this.formatDateWithOrdinal(graduationDate) : 'To be determined'}</div>
          </div>
          <div class="graduation-item">
            <div class="profile-label">Convocation</div>
            <div style="font-weight: bold; margin-top: 0.5mm;">${graduationInfo.convocationYear || 'TBD'}</div>
          </div>
        </div>
      </div>
    </td>
  </tr>
</tbody>`;
  }

  /**
   * Render transcript key/legend
   */
  renderTranscriptKey() {
    return `
<tbody>
  <tr>
    <td>
      <div class="key-box">
        <div class="key-title">KEY TO GRADING SYSTEM</div>
        <div class="key-grid">
          <div><strong>A</strong> (70-100%) = 5.0 pts</div>
          <div><strong>B</strong> (60-69%) = 4.0 pts</div>
          <div><strong>C</strong> (50-59%) = 3.0 pts</div>
          <div><strong>D</strong> (45-49%) = 2.0 pts</div>
          <div><strong>E</strong> (40-44%) = 1.0 pts</div>
          <div><strong>F</strong> (0-39%) = 0.0 pts</div>
        </div>
        <div style="margin-top: 1mm;">
          <strong>GPA:</strong> Grade Point Average | <strong>CGPA:</strong> Cumulative Grade Point Average | 
          <strong>TCP:</strong> Total Credit Points | <strong>TNU:</strong> Total Number of Units
        </div>
      </div>
    </td>
  </tr>
</tbody>`;
  }

  /**
   * Render certification and signatures
   */
  renderCertification(departmentDetails, graduationDate) {
    const registrarName = config.registrar?.name || 'Registrar';
    const deanName = resolveUserName(departmentDetails?.dean, "ResultTranscriptHtmlRenderer.renderCertification", { initials: true });
    const hodName = resolveUserName(departmentDetails?.hod, "ResultTranscriptHtmlRenderer.renderCertification", { initials: true });
    
    return `
<tbody>
  <tr>
    <td>
      <div class="certification-box">
        <div class="certification-text">
          This is to certify that the bearer has completed an approved programme of study 
          in ${departmentDetails?.name || 'the specified department'}, Faculty of ${departmentDetails?.faculty?.name || 'N/A'}, 
          ${config.institution}. The programme was pursued during the period stated and the 
          examination results are as recorded in this transcript.
        </div>
        
        <div class="signatures-container">
          <div class="signature-block">
            <div class="signature-line"></div>
            <div class="signature-name">${hodName}</div>
            <div class="signature-title">Head of Department</div>
          </div>
          <div class="signature-block">
            <div class="signature-line"></div>
            <div class="signature-name">${deanName}</div>
            <div class="signature-title">Dean of Faculty</div>
          </div>
          <div class="signature-block">
            <div class="signature-line"></div>
            <div class="signature-name">${registrarName}</div>
            <div class="signature-title">Registrar</div>
          </div>
        </div>
        
        <div style="text-align: center; margin-top: 3mm; font-size: 6.5pt; color: #666;">
          This transcript is official only when it bears the University seal and authorized signature.
          ${graduationDate ? `<br>Issued: ${this.formatDateWithOrdinal(new Date())}` : ''}
        </div>
      </div>
    </td>
  </tr>
</tbody>`;
  }

  /**
   * Render footer
   */
  renderFooter(transcriptId) {
    return `
<tbody>
  <tr>
    <td class="footer-cell">
      Transcript ID: ${transcriptId} • Generated: ${new Date().toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })} • ${config.institution} - Office of the Registrar
    </td>
  </tr>
</tbody>`;
  }
}

export default new ResultTranscriptHtmlRenderer();