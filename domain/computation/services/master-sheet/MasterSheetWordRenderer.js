// MasterSheetWordSimpleRenderer.js
// PROFESSIONAL UNIVERSITY MASTER SHEET - SIMPLIFIED WORD RENDERER

import { formatDateWithOrdinal, toProfessionalAbbreviation } from "#utils/helpers.js";
import { convertToPart } from "#utils/levelConverter.js";
import { DEGREE_CLASS, STUDENT_STATUS, SUSPENSION_REASONS } from "#domain/computation/utils/computationConstants.js";
import config from "./MasterSheetConfig.js";
import { capitalizeFirstLetter } from "#utils/StringUtils.js";

class MasterSheetWordSimpleRenderer {

  normalizeSummary(summary) {
    const sortByMatric = (a, b) =>
      (a.matricNumber || "").localeCompare(b.matricNumber || "");

    if (summary.studentSummariesByLevel) {
      for (const level in summary.studentSummariesByLevel) {
        summary.studentSummariesByLevel[level]?.sort(sortByMatric);
      }
    }

    if (summary.studentListsByLevel) {
      const listKeys = [
        "probationList",
        "terminationList",
        "passList",
        "withdrawalList",
        "notRegisteredList",
        "leaveOfAbsenceList"
      ];

      for (const level in summary.studentListsByLevel) {
        const lists = summary.studentListsByLevel[level];
        listKeys.forEach(key => {
          lists[key]?.sort(sortByMatric);
        });
      }
    }

    return summary;
  }
  
  buildStudentLists(summary, level) {
    const students = summary.studentSummariesByLevel[level] || [];

    const lists = {
      passList: [],
      probationList: [],
      terminationList: [],
      withdrawalList: [],
      notRegisteredList: [],
      leaveOfAbsenceList: []
    };

    for (const s of students) {
      const carryoverCount = s.outstandingCourses?.length || 0;
      const status = s.academicStatus || s.remark;

      const base = {
        studentId: s.studentId,
        matricNumber: s.matricNumber,
        name: s.name,
        gpa: s.currentSemester?.gpa,
        level: level
      };

      if (carryoverCount === 0 && status !== STUDENT_STATUS.PROBATION && status !== STUDENT_STATUS.TERMINATED && status !== STUDENT_STATUS.WITHDRAWN && status !== SUSPENSION_REASONS.SCHOOL_APPROVED) {
        lists.passList.push(base);
      }
      else if (status === STUDENT_STATUS.PROBATION) {
        lists.probationList.push(base);
      }
      else if (status == STUDENT_STATUS.TERMINATED) {
        lists.terminationList.push(base);
      }
      else if (status === STUDENT_STATUS.WITHDRAWN) {
        lists.withdrawalList.push(base);
      }
      else if (status === SUSPENSION_REASONS.NO_REGISTRATION) {
        lists.notRegisteredList.push(base);
      }
      else if (status === SUSPENSION_REASONS.SCHOOL_APPROVED) {
        lists.leaveOfAbsenceList.push(base);
      }
    }

    Object.values(lists).forEach(list => {
      list.sort((a, b) => a.matricNumber.localeCompare(b.matricNumber));
    });

    return lists;
  }

  render({ summary, level, masterComputationId }) {
    summary = this.normalizeSummary(summary)

    const shortBatchId = masterComputationId ? masterComputationId.slice(-8) : 'N/A';
    const purpose = summary?.purpose || 'final';
    const isPreview = purpose === 'preview'

    // Build totalUnits from keyToCoursesByLevel
    const courses = summary.keyToCoursesByLevel[level] || [];
    let totalUnits = 0;
    courses.forEach(course => {
      totalUnits += course.unit || 0;
    });

    const studentSummaries = summary.studentSummariesByLevel[level] || [];
    const confirmationList = studentSummaries
      .filter(s => {
        const nameParts = (s.name || '').trim().split(/\s+/);
        return nameParts.length < 3;
      })
      .sort((a, b) => (a.matricNumber || '').localeCompare(b.matricNumber || ''))
      .map(s => ({
        regNo: s.matricNumber || '-',
        name: s.name || '-'
      }));
    
    const lists = this.buildStudentLists(summary, level);
    
    const backgroundData = {
      confirmationList,
      noRegistrationList: lists.notRegisteredList,
      leaveOfAbsenceNote: summary.leaveOfAbsenceNote || '',
      terminationList: summary.terminationList || [],
      withdrawalData: summary.withdrawalData || { note: '', students: [] }
    };
    
    const recommendationData = {
      recommendationText: `Recommendation from the Departmental Board of Examiner's meeting held on the 18th of February 2026 to the Faculty Board of Examiners.`,
      approveText: `${summary.departmentDetails?.academicYear} ${capitalizeFirstLetter(summary.departmentDetails?.semester)} Semester Examination Results ${toProfessionalAbbreviation(summary.departmentDetails?.programme?.programmeType)} (${summary.department.name}) ${convertToPart(level)}`,
      totalUnits
    };

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>MASTER SHEET – ${level} LEVEL</title>
  <style>
    /* Page setup */
    @page {
      size: A4;
      margin: 2.5cm 2cm 2cm 2cm;
    }
    
    body {
      font-family: 'Times New Roman', serif;
      font-size: 12pt;
      line-height: 1.3;
      margin: 0;
      padding: 0;
      color: #000;
    }
    
    /* Headers */
    .header {
      text-align: center;
      font-weight: bold;
      text-transform: uppercase;
      margin-bottom: 20pt;
    }
    
    .header h1 {
      font-size: 16pt;
      margin: 0 0 2pt 0;
    }
    
    .header h2 {
      font-size: 14pt;
      margin: 2pt 0;
      font-weight: bold;
    }
    
    .header h3 {
      font-size: 12pt;
      margin: 2pt 0;
      font-weight: bold;
    }
    
    .header .batch {
      position: absolute;
      top: 0;
      right: 0;
      font-size: 9pt;
      font-weight: normal;
    }
    
    /* Section titles */
    .section-title {
      font-size: 14pt;
      font-weight: bold;
      text-transform: uppercase;
      margin: 20pt 0 10pt 0;
      border-bottom: 1pt solid #000;
      padding-bottom: 3pt;
    }
    
    .section-subtitle {
      font-size: 12pt;
      font-weight: bold;
      margin: 10pt 0 5pt 0;
    }
    
    /* Tables */
    table {
      border-collapse: collapse;
      width: 100%;
      margin: 10pt 0;
    }
    
    th, td {
      border: 1px solid #000;
      padding: 6pt 4pt;
      vertical-align: top;
    }
    
    th {
      font-weight: bold;
      text-align: center;
      background-color: #f0f0f0;
    }
    
    /* Special tables */
    .no-border th,
    .no-border td {
      border: none;
    }
    
    .key-table th,
    .key-table td {
      border: none;
      border-bottom: 1px solid #000;
      padding: 4pt 0;
    }
    
    .key-table th {
      border-bottom: 1px solid #000;
      background-color: transparent;
    }
    
    /* Signatures */
    .signatures {
      margin-top: 40pt;
      width: 100%;
      display: flex;
      justify-content: space-between;
    }
    
    .signature-block {
      width: 45%;
      text-align: center;
    }
    
    .signature-line {
      border-top: 1px solid #000;
      width: 80%;
      margin: 0 auto 10pt auto;
      height: 20pt;
    }
    
    /* Utilities */
    .text-left { text-align: left; }
    .text-center { text-align: center; }
    .text-right { text-align: right; }
    .text-bold { font-weight: bold; }
    .numeric { text-align: right; }
    
    .nil-entry {
      text-align: center;
      font-style: italic;
      padding: 20pt;
    }
    
    .page-break {
      page-break-before: always;
    }
    
    .watermark {
      position: fixed;
      top: 30%;
      left: 20%;
      width: 60%;
      text-align: center;
      opacity: 0.2;
      font-size: 60pt;
      font-weight: bold;
      color: #900;
      transform: rotate(-45deg);
      z-index: 1000;
      pointer-events: none;
    }
    
    .report-list {
      margin-left: 20pt;
      padding-left: 10pt;
    }
    
    .report-list li {
      margin-bottom: 15pt;
    }
    
    /* Course header vertical text approximation */
    .vertical-text {
      writing-mode: vertical-lr;
      text-orientation: upright;
      height: 80px;
      white-space: nowrap;
    }
    
    /* Compact tables */
    .compact-table {
      font-size: 10pt;
    }
    
    .compact-table th,
    .compact-table td {
      padding: 3pt 2pt;
    }
  </style>
</head>
<body>
  ${isPreview ? '<div class="watermark">PREVIEW</div>' : ''}

  <!-- RECOMMENDATION AND BACKGROUND SECTION -->
  <div class="header">
    <h1>${config.institution}</h1>
    <h2>Faculty of ${summary.departmentDetails.faculty.name}</h2>
    <h2>Department of ${summary.departmentDetails.name}</h2>
    <h3>${summary.departmentDetails.academicYear} ${summary.departmentDetails.semester} Semester Examination Results</h3>
    <h3>${toProfessionalAbbreviation(summary.departmentDetails?.programme?.programmeType)} ${summary.department.name}</h3>
    <h3>${convertToPart(level)}</h3>
    <div class="batch">Batch: ${shortBatchId}</div>
  </div>

  <!-- BACKGROUND INFORMATION -->
  ${this.renderBackgroundInfo(backgroundData, recommendationData, summary, totalUnits)}

  <!-- PAGE BREAK BEFORE MAIN CONTENT -->
  <div style="page-break-before: always;"></div>

  <!-- MAIN HEADER (repeated) -->
  <div class="header">
    <h1>${config.institution}</h1>
    <h2>Faculty of ${summary.departmentDetails.faculty.name}</h2>
    <h2>Department of ${summary.departmentDetails.name}</h2>
    <h3>${summary.departmentDetails.academicYear} ${summary.departmentDetails.semester} Semester Examination Results</h3>
    <h3>${toProfessionalAbbreviation(summary.departmentDetails?.programme?.programmeType)} ${summary.department.name}</h3>
    <h3>${convertToPart(level)}</h3>
    <div class="batch">Batch: ${shortBatchId}</div>
  </div>

  <!-- STUDENT LISTS -->
  ${this.renderStudentLists(lists, summary, level)}

  <!-- COURSES STILL OUTSTANDING -->
  ${this.renderCoursesTillOutstanding(summary, level)}

  <!-- MASTER MARK SHEET I -->
  ${this.renderMMS1(summary, level)}

  <!-- MASTER MARK SHEET II -->
  ${this.renderMMS2(summary, level)}

  <!-- KEY TO COURSES -->
  ${this.renderKeyToCourses(summary, level)}

  <!-- SUMMARY AND SIGNATURES -->
  ${this.renderSummaryAndSignatures(summary, level)}

  <!-- FOOTER -->
  <div style="text-align: center; font-size: 9pt; margin-top: 30pt; padding-top: 10pt; border-top: 0.5pt solid #ccc;">
    Generated: ${new Date().toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })} • Batch: ${masterComputationId || 'N/A'}
  </div>

</body>
</html>`;
  }

  renderStudentLists(lists, summary, level) {
    let html = '';
    
    if (lists.passList?.length) {
      html += this.renderPassList(lists.passList);
    } else {
      html += this.renderNilSection("PASS LIST");
    }
    
    if (lists.terminationList?.length) {
      html += this.renderTerminationList(lists.terminationList, summary, level);
    } else {
      html += this.renderNilSection("TERMINATION LIST");
    }
    
    if (lists.probationList?.length) {
      html += this.renderProbationList(lists.probationList, summary, level);
    } else {
      html += this.renderNilSection("PROBATION LIST");
    }
    
    if (lists.withdrawalList?.length) {
      html += this.renderWithdrawalList(lists.withdrawalList, summary, level);
    } else {
      html += this.renderNilSection("WITHDRAWAL LIST");
    }
    
    return html;
  }

  renderNilSection(title) {
    return `
      <div class="section-title">${title}</div>
      <table>
        <tr>
          <td class="nil-entry">NIL</td>
        </tr>
      </table>
    `;
  }

  renderPassList(list) {
    const rows = list.map((s, i) => `
      <tr>
        <td class="text-center">${i + 1}</td>
        <td>${s.matricNumber || '-'}</td>
        <td>${s.name || '-'}</td>
        <td class="text-right">${s.gpa ? s.gpa.toFixed(2) : '-'}</td>
        <td>${this.getDegreeClass(s.gpa)}</td>
      </tr>
    `).join('');

    return `
      <div class="section-title">PASS LIST</div>
      <table>
        <thead>
          <tr>
            <th width="8%">S/No</th>
            <th width="20%">MATRIC. NO</th>
            <th width="40%">NAME</th>
            <th width="12%">GPA</th>
            <th width="20%">CLASS</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
    `;
  }

  renderTerminationList(list, summary, level) {
    const rows = list.map((s, i) => {
      const studentData = this.getStudentData(s.studentId?.$oid || s.studentId, summary, level);
      const failedCourses = studentData?.courseResults?.filter(cr => cr.status === 'failed') || [];
      const remarks = failedCourses.length ? failedCourses.map(c => c.courseCode).join(', ') : 'None';

      return `
        <tr>
          <td class="text-center">${i + 1}</td>
          <td>${s.matricNumber || '-'}</td>
          <td>${s.name || '-'}</td>
          <td>${remarks}</td>
        </tr>
      `;
    }).join('');

    return `
      <div class="section-title">TERMINATION LIST</div>
      <table>
        <thead>
          <tr>
            <th width="8%">S/No</th>
            <th width="20%">MATRIC. NO</th>
            <th width="40%">NAME</th>
            <th width="32%">REMARKS</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
    `;
  }

  renderProbationList(list, summary, level) {
    const rows = list.map((s, i) => {
      const studentData = this.getStudentData(s.studentId?.$oid || s.studentId, summary, level);
      const failedCourses = studentData?.outstandingCourses || [];
      const remarks = this.renderCourseList(failedCourses);

      return `
        <tr>
          <td class="text-center">${i + 1}</td>
          <td>${s.matricNumber || '-'}</td>
          <td>${s.name || '-'}</td>
          <td>${remarks}</td>
        </tr>
      `;
    }).join('');

    return `
      <div class="section-title">PROBATION LIST</div>
      <table>
        <thead>
          <tr>
            <th width="8%">S/No</th>
            <th width="20%">MATRIC. NO</th>
            <th width="40%">NAME</th>
            <th width="32%">REMARKS</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
    `;
  }

  renderWithdrawalList(list, summary, level) {
    const rows = list.map((s, i) => {
      const studentData = this.getStudentData(s.studentId?.$oid || s.studentId, summary, level);
      const failedCourses = studentData?.courseResults?.filter(cr => cr.status === 'failed') || [];
      const remarks = failedCourses.length ? failedCourses.map(c => c.courseCode).join(', ') : 'None';

      return `
        <tr>
          <td class="text-center">${i + 1}</td>
          <td>${s.matricNumber || '-'}</td>
          <td>${s.name || '-'}</td>
          <td class="text-right">${s.gpa ? s.gpa.toFixed(2) : '-'}</td>
          <td>${remarks}</td>
        </tr>
      `;
    }).join('');

    return `
      <div class="section-title">WITHDRAWAL LIST</div>
      <table>
        <thead>
          <tr>
            <th width="8%">S/No</th>
            <th width="18%">MATRIC. NO</th>
            <th width="30%">NAME</th>
            <th width="10%">GPA</th>
            <th width="34%">REMARKS</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
    `;
  }

  renderCoursesTillOutstanding(summary, level) {
    const students = summary.studentSummariesByLevel[level] || [];
    const lists = this.buildStudentLists(summary, level);
    const probationStudentIds = new Set(
      lists.probationList.map(p => String(p.studentId?.$oid || p.studentId))
    );

    const csoStudents = students.filter(s => {
      const studentId = String(s.studentId?.$oid || s.studentId);
      const hasOutstandingCourses = s.outstandingCourses && s.outstandingCourses.length > 0;
      const isOnProbation = probationStudentIds.has(studentId);
      return hasOutstandingCourses && !isOnProbation;
    });

    if (!csoStudents.length) {
      return this.renderNilSection("COURSES STILL OUTSTANDING");
    }

    const rows = csoStudents.map((s, i) => {
      const courseList = this.renderCourseList(s.outstandingCourses || []);
      return `
        <tr>
          <td class="text-center">${i + 1}</td>
          <td>${s.matricNumber || '-'}</td>
          <td>${s.name || '-'}</td>
          <td>${courseList || '-'}</td>
        </tr>
      `;
    }).join('');

    return `
      <div class="section-title">COURSES STILL OUTSTANDING</div>
      <table>
        <thead>
          <tr>
            <th width="8%">S/No</th>
            <th width="20%">MATRIC. NO</th>
            <th width="40%">NAME</th>
            <th width="32%">OUTSTANDING COURSES/REMARKS</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
    `;
  }

  renderCourseList(outstandingCourses = []) {
    return outstandingCourses
      .map(oc => {
        const code = oc.courseCode || oc.courseId?.courseCode || "N/A";
        const remark = oc.reason === "failed" ? "(R)" : "(NR)";
        return `${code}${remark}`;
      })
      .join(", ") || '-';
  }

  renderMMS1(summary, level) {
    const students = summary.studentSummariesByLevel[level] || [];
    if (!students.length) {
      return this.renderNilSection("MASTER MARK SHEET I");
    }

    const courses = summary.keyToCoursesByLevel[level] || [];
    
    // Build course headers
    const courseHeaders = courses.map(c => 
      `<th class="text-center">${c.courseCode}<br><small>(${c.unit || ''})</small></th>`
    ).join('');

    const rows = students.map((s, i) => {
      const courseCells = courses.map(c => {
        const result = s.courseResults?.find(cr => cr.courseCode === c.courseCode);
        const score = result?.score ?? '-';
        const grade = result?.grade ? ` (${result.grade})` : '';
        return `<td class="text-right">${score}${grade}</td>`;
      }).join('');

      return `
        <tr>
          <td class="text-center">${i + 1}</td>
          <td>${s.matricNumber || '-'}</td>
          ${courseCells}
          <td class="text-right">${s.currentSemester?.tcp || '-'}</td>
          <td class="text-right">${s.currentSemester?.tnu || '-'}</td>
          <td class="text-right">${s.currentSemester?.gpa?.toFixed(2) || '-'}</td>
        </tr>
      `;
    }).join('');

    return `
      <div class="section-title">MASTER MARK SHEET I</div>
      <table class="compact-table">
        <thead>
          <tr>
            <th rowspan="2" width="5%">S/No</th>
            <th rowspan="2" width="10%">MATRIC. NO</th>
            <th colspan="${courses.length}" class="text-center">COURSES</th>
            <th rowspan="2" width="6%">TCP</th>
            <th rowspan="2" width="6%">TNU</th>
            <th rowspan="2" width="6%">GPA</th>
          </tr>
          <tr>
            ${courseHeaders}
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
    `;
  }

  renderMMS2(summary, level) {
    const students = summary.studentSummariesByLevel[level] || [];
    if (!students.length) {
      return this.renderNilSection("MASTER MARK SHEET II");
    }

    const rows = students.map((s, i) => `
      <tr>
        <td class="text-center">${i + 1}</td>
        <td>${s.matricNumber || '-'}</td>
        <td class="text-right">${s.currentSemester?.tcp || '-'}</td>
        <td class="text-right">${s.currentSemester?.tnu || '-'}</td>
        <td class="text-right">${s.currentSemester?.gpa?.toFixed(2) || '-'}</td>
        <td class="text-right">${s.previousPerformance?.cumulativeTCP || '-'}</td>
        <td class="text-right">${s.previousPerformance?.cumulativeTNU || '-'}</td>
        <td class="text-right">${s.previousPerformance?.previousSemesterGPA?.toFixed(2) || '-'}</td>
        <td class="text-right">${s.cumulativePerformance?.totalTCP || '-'}</td>
        <td class="text-right">${s.cumulativePerformance?.totalTNU || '-'}</td>
        <td class="text-right">${s.cumulativePerformance?.cgpa?.toFixed(2) || '-'}</td>
      </tr>
    `).join('');

    return `
      <div class="section-title">MASTER MARK SHEET II</div>
      <table class="compact-table">
        <thead>
          <tr>
            <th rowspan="2" width="5%">S/No</th>
            <th rowspan="2" width="10%">MATRIC. NO</th>
            <th colspan="3" class="text-center">PRESENT</th>
            <th colspan="3" class="text-center">PREVIOUS</th>
            <th colspan="3" class="text-center">CUMULATIVE</th>
          </tr>
          <tr>
            <th width="6%">TCP</th>
            <th width="6%">TNU</th>
            <th width="6%">GPA</th>
            <th width="6%">TCP</th>
            <th width="6%">TNU</th>
            <th width="6%">GPA</th>
            <th width="6%">TCP</th>
            <th width="6%">TNU</th>
            <th width="6%">CGPA</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
    `;
  }

  renderKeyToCourses(summary, level) {
    const courses = summary.keyToCoursesByLevel[level] || [];
    if (!courses.length) {
      return this.renderNilSection("KEY TO COURSES");
    }

    const rows = courses.map(c => `
      <tr>
        <td class="text-bold">${c.courseCode || '-'}</td>
        <td>${c.title || '-'}</td>
        <td class="text-right">${c.unit || '0'}</td>
      </tr>
    `).join('');

    return `
      <div class="section-title">KEY TO COURSES</div>
      <table class="key-table" style="width: 70%;">
        <thead>
          <tr>
            <th>COURSE CODE</th>
            <th>COURSE TITLE</th>
            <th class="text-right">UNITS</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
    `;
  }

  renderSummaryAndSignatures(summary, level) {
    const s = summary.summaryOfResultsByLevel[level];
    
    let summaryHTML = '';
    if (s) {
      summaryHTML = `
        <table class="no-border" style="width: 50%; margin: 0 auto 20pt auto;">
          <tr>
            <td class="text-bold">First Class</td>
            <td class="text-right">${s.classDistribution?.firstClass || 0}</td>
          </tr>
          <tr>
            <td class="text-bold">Second Class Upper</td>
            <td class="text-right">${s.classDistribution?.secondClassUpper || 0}</td>
          </tr>
          <tr>
            <td class="text-bold">Second Class Lower</td>
            <td class="text-right">${s.classDistribution?.secondClassLower || 0}</td>
          </tr>
          <tr>
            <td class="text-bold">Third Class</td>
            <td class="text-right">${s.classDistribution?.thirdClass || 0}</td>
          </tr>
          <tr>
            <td class="text-bold">Fail</td>
            <td class="text-right">${s.classDistribution?.fail || 0}</td>
          </tr>
          <tr class="text-bold">
            <td></td>
            <td class="text-right">Total = <u>${s.totalStudents || 0}</u></td>
          </tr>
        </table>
      `;
    }

    return `
      <div class="section-title">SUMMARY AND SIGNATURES</div>
      ${summaryHTML || '<p class="nil-entry">No summary data available</p>'}
      
      <div class="signatures">
        <div class="signature-block">
          <div class="signature-line"></div>
          <div class="text-bold">${summary.departmentDetails.hod.name}</div>
          <div style="font-size: 10pt;">HOD, ${summary.departmentDetails.name}</div>
        </div>
        <div class="signature-block">
          <div class="signature-line"></div>
          <div class="text-bold">${summary.departmentDetails.dean.name}</div>
          <div style="font-size: 10pt;">Dean, Faculty of ${summary.departmentDetails.faculty?.name || 'N/A'}</div>
        </div>
      </div>
    `;
  }

  renderBackgroundInfo(bgData, recData, summary, totalUnits) {
    const { confirmationList, noRegistrationList, leaveOfAbsenceNote, terminationList, withdrawalData } = bgData;
    const { recommendationText, approveText } = recData;

    let html = `
      <div style="margin-top: 20pt;">
        <div class="section-title">RECOMMENDATION</div>
        <div style="margin-bottom: 15pt;">${recommendationText}</div>
        
        <div class="section-title">TO APPROVE</div>
        <div style="margin-bottom: 20pt;">${approveText}</div>
        
        <div class="section-title">BACKGROUND INFORMATION</div>
        <ol class="report-list">
    `;

    // 1. Confirmation of Candidates with Two Names
    html += `
      <li>
        <strong>Confirmation of Candidates with Two Names</strong>
        <p>The following candidates have been confirmed to have two names only.</p>
    `;

    if (confirmationList.length) {
      const rows = confirmationList.map((s, i) => `
        <tr>
          <td class="text-center">${i + 1}</td>
          <td>${s.regNo}</td>
          <td>${s.name}</td>
        </tr>
      `).join('');
      
      html += `
        <table style="width: 60%;">
          <thead>
            <tr>
              <th width="15%">S/N</th>
              <th width="35%">MATRIC. NO.</th>
              <th width="50%">NAME</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>`;
    } else {
      html += `<p>NIL</p>`;
    }
    html += `</li>`;

    // 2. No Registration Information
    html += `
      <li>
        <strong>No Registration Information</strong>
    `;

    if (noRegistrationList.length) {
      const rows = noRegistrationList.map((s, i) => `
        <tr>
          <td class="text-center">${i + 1}</td>
          <td>${s.matricNumber}</td>
          <td>${s.name}</td>
        </tr>
      `).join('');

      html += `
        <p>The following candidates did not register for courses during the ${summary.departmentDetails.academicYear} 
        ${capitalizeFirstLetter(summary.departmentDetails.semester)} Semester Examinations; hence, they were debited with ${totalUnits} units.</p>
        <table style="width: 60%;">
          <thead>
            <tr>
              <th width="15%">S/N</th>
              <th width="35%">MATRIC. NO.</th>
              <th width="50%">NAME</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>`;
    } else {
      html += `<p>NIL</p>`;
    }
    html += `</li>`;

    // 3. Leave of Absence
    html += `
      <li>
        <strong>Leave of Absence</strong>
        <p>${leaveOfAbsenceNote || 'None'}</p>
      </li>
    `;

    // 4. Termination of Studentship
    if (terminationList?.length) {
      html += `<li><strong>Termination of Studentship</strong>`;
      
      if (terminationList.length === 1) {
        const s = terminationList[0];
        html += `<p>Termination of studentship for ${s.name} (${s.regNo}) due to academic performance.</p>`;
      } else {
        html += `<p>The following students have had their studentship terminated:</p>`;
        const rows = terminationList.map((s, i) => `
          <tr>
            <td class="text-center">${i + 1}</td>
            <td>${s.regNo}</td>
            <td>${s.name}</td>
          </tr>
        `).join('');
        html += `
          <table style="width: 60%;">
            <thead>
              <tr>
                <th width="15%">S/N</th>
                <th width="35%">MATRIC. NO.</th>
                <th width="50%">NAME</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>`;
      }
      html += `</li>`;
    }

    // 5. Withdrawal of Studentship
    if (withdrawalData.students?.length) {
      html += `<li><strong>Withdrawal of Studentship</strong>`;
      
      const note = withdrawalData.note || 'Withdrawal due to academic reasons.';
      if (withdrawalData.students.length === 1) {
        const s = withdrawalData.students[0];
        html += `<p>${note} Student affected: ${s.name} (${s.regNo}).</p>`;
      } else {
        html += `<p>${note}</p>`;
        const rows = withdrawalData.students.map((s, i) => `
          <tr>
            <td class="text-center">${i + 1}</td>
            <td>${s.regNo}</td>
            <td>${s.name}</td>
          </tr>
        `).join('');
        html += `
          <table style="width: 60%;">
            <thead>
              <tr>
                <th width="15%">S/N</th>
                <th width="35%">MATRIC. NO.</th>
                <th width="50%">NAME</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>`;
      }
      html += `</li>`;
    }

    html += `</ol></div>`;
    return html;
  }

  // Helper methods
  getStudentData(studentId, summary, level) {
    const students = summary.studentSummariesByLevel[level] || [];
    return students.find(s =>
      String(s.studentId?.$oid || s.studentId) === String(studentId)
    );
  }

  getDegreeClass(gpa) {
    if (gpa == null || isNaN(gpa)) return "N/A";
    if (gpa >= 4.5) return "First Class";
    if (gpa >= 3.5) return "Second Class Upper";
    if (gpa >= 2.5) return "Second Class Lower";
    if (gpa >= 1.5) return "Third Class";
    return "Fail";
  }
}

export default new MasterSheetWordSimpleRenderer();