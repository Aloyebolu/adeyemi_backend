// MasterSheetHtmlRenderer.js
// PROFESSIONAL UNIVERSITY MASTER SHEET - ENHANCED VERSION WITH WORD EXPORT

import { formatDateWithOrdinal, semesterNameToSeason, toProfessionalAbbreviation } from "../../../../utils/helpers.js";
import { convertToPart } from "../../../../utils/levelConverter.js";
import { DEGREE_CLASS, STUDENT_STATUS, SUSPENSION_REASONS } from "../../utils/computationConstants.js";
import config from "./MasterSheetConfig.js";
import { capitalizeFirstLetter } from "../../../../utils/StringUtils.js";
import { formatMatricNumber, resolveUserName, splitName } from "../../../../utils/resolveUserName.js";
import AppError from "#shared/errors/AppError.js";
// import AppError from "../../../errors/AppError.js";

class MasterSheetHtmlRenderer {
  // Format a date to "18th February 2026"
  focrmatDateWithOrdinal(dateInput) {
    if (!dateInput) return "";

    const date = new Date(dateInput);

    if (isNaN(date.getTime())) return ""; // invalid date

    const day = date.getDate();
    const month = date.toLocaleString("en-US", { month: "long" });
    const year = date.getFullYear();

    // Function to get ordinal suffix
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
    str ? str.charAt(0).toUpperCase() + str.slice(1).toLowerCase() : str; // introduced

  isTerminated(lists, studentId) {
    return lists.terminationList?.some(s => s.studentId == studentId) || false;
  }

  isWithdrawn(lists, studentId) {
    return lists.withdrawalList?.some(s => s.studentId == studentId) || false;
  }
  normalizeSummary(summary) {
    const sortByMatric = (a, b) =>
      (a.matricNumber || "").localeCompare(b.matricNumber || "");

    // Helper: capitalize first letter

    // Sort main student summaries
    if (summary.studentSummariesByLevel) {
      for (const level in summary.studentSummariesByLevel) {
        const students = summary.studentSummariesByLevel[level];

        // Capitalize first names
        students.forEach(student => {
          if (student.name) {
            const parts = student.name.split(' ');

            if (parts[0]) parts[0] = parts[0].toUpperCase();
            if (parts[1]) parts[1] = parts[1].charAt(0).toUpperCase() + parts[1].slice(1).toLowerCase();
            if (parts[2]) parts[2] = parts[2].charAt(0).toUpperCase() + parts[2].slice(1).toLowerCase();

            student.name = parts.join(' ');
          }
        });

        students.sort(sortByMatric);
      }
    }

    // Sort categorized student lists
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
          const students = lists[key];

          // Capitalize first names
          students?.forEach(student => {
            if (student.firstName) student.firstName = this.capitalizeFirst(student.firstName); 
          });

          students?.sort(sortByMatric);
        });
      }
    }

    return summary;
  }
  generateRecommendationText(stage, summary) {

    const stageDates = {
      departmental_board: summary?.approval_dates?.departmental_board,
      faculty_board: summary?.approval_dates?.faculty_board,
      senate_committee: summary?.approval_dates?.senate_committee,
      senate: summary?.approval_dates?.senate
    };

    const rawDate = stageDates[stage];

    const date = rawDate
      ? formatDateWithOrdinal(rawDate)
      : "an unspecified date";

    const templates = {

      departmental_board:
        `Recommendation from the Departmental Board of Examiners' meeting held on the ${date} to the Faculty Board of Examiners.`,

      faculty_board:
        `Recommendation from the Faculty of ${summary.departmentDetails.faculty.name} Board of Examiners' meeting held on the ${date} to Committee of Deans' Meeting.`,

      senate_committee:
        `Recommendation from the Senate Business Committee meeting held on the ${date} to the Senate.`,

      senate:
        `Approval of results by the Senate meeting held on the ${date}.`

    };

    return templates[stage] || templates.departmental_board;
  }
  buildStudentLists(summary, level) {
    const students = summary.studentSummariesByLevel[level] || [];

    const lists = {
      passList: [],
      csoList: [], // Added CSO list
      probationList: [],
      withdrawalList: [],
      terminationList: [],
      leaveOfAbsenceList: [],
      // Additional lists that can overlap
      notRegisteredList: [],
      permissionExceedList: [],
      permissionBelowList: [],
    };

    for (const s of students) {
      const carryoverCount = s.outstandingCourses?.length || 0;
      // const hasNewCarryover = s.outstandingCourses.some((c, i)=>c.status=)
      const status = s.academicStatus || s.remark;
      const suspensionStatus = s.academicStanding?.suspensionStatus;

      const base = {
        studentId: s.studentId,
        matricNumber: s.matricNumber,
        name: s.name,
        gpa: s.currentSemester?.gpa,
        level: level,
        academicStanding: s.academicStanding,
        ...s
      };

      // Determine primary status (mutually exclusive)
      let primaryStatus = null;

      // Check termination first (highest priority)
      if (status === STUDENT_STATUS.TERMINATED ) {
        primaryStatus = 'termination';
        lists.terminationList.push(base);
      }
      // Check withdrawal
      else if (status === STUDENT_STATUS.WITHDRAWN) {
      // else if (status === STUDENT_STATUS.WITHDRAWN || (String(s._id) == "696dfbc9f32a0a1546cd066c" )) {
        primaryStatus = 'withdrawal';
        lists.withdrawalList.push(base);
      }
      // Check probation
      else if (status === STUDENT_STATUS.PROBATION) {
        primaryStatus = 'probation';
        lists.probationList.push(base);
      }
      // Check leave of absence
      else if (status === SUSPENSION_REASONS.SCHOOL_APPROVED ||
        suspensionStatus === SUSPENSION_REASONS.SCHOOL_APPROVED || String(s._id) == "696dfbb8f32a0a1546cd022a") {
        primaryStatus = 'leaveOfAbsence';
        lists.leaveOfAbsenceList.push(base);
      }
      // Check CSO (assuming this is a specific status)
      else if (carryoverCount > 0) {
        primaryStatus = 'cso';
        lists.csoList.push(base);
      }
      // Pass list - only if no other status and no carryovers
      else if (carryoverCount === 0) {
        primaryStatus = 'pass';
        lists.passList.push(base);
      }
      // If none of the above, student might be in some other state (not in any primary list)

      // Secondary lists that CAN overlap with primary lists
      // No registration check (can overlap with any primary status)
      if (status === SUSPENSION_REASONS.NO_REGISTRATION ||
        suspensionStatus === SUSPENSION_REASONS.NO_REGISTRATION) {
        lists.notRegisteredList.push(base);
      }

      // Permission to exceed max units (can overlap)
      if (s.exceededMaxUnits) {
        lists.permissionExceedList.push(base);
      }

      // Permission for below min units (can overlap)
      if (s.belowMinUnits) {
        lists.permissionBelowList.push(base);
      }
    }

    // Sort all lists by matric number
    Object.values(lists).forEach(list => {
      if (list && list.length > 0) {
        list.sort((a, b) => a.matricNumber?.localeCompare(b.matricNumber));
      }
    });

    // Optional: Add validation to ensure no intersections
    const mutuallyExclusiveLists = ['passList', 'csoList', 'probationList', 'withdrawalList', 'terminationList', 'leaveOfAbsenceList'];

    for (let i = 0; i < mutuallyExclusiveLists.length; i++) {
      for (let j = i + 1; j < mutuallyExclusiveLists.length; j++) {
        const listA = lists[mutuallyExclusiveLists[i]];
        const listB = lists[mutuallyExclusiveLists[j]];

        const intersection = listA.filter(studentA =>
          listB.some(studentB => studentA.matricNumber === studentB.matricNumber)
        );

        if (intersection.length > 0) {
          throw new AppError(`⚠️ Intersection detected between ${mutuallyExclusiveLists[i]} and ${mutuallyExclusiveLists[j]}:`,
            intersection.map(s => s.matricNumber));

        }
      }
    }

    return lists;
  }

  render({ summary, level, masterComputationId }) {
    if (summary.status == 'failed') {
      return `<p color='red'>Mastersheet generation failed</p>`
    }
    summary = this.normalizeSummary(summary)

    const levelSettings = summary.departmentDetails.levelSettings?.find(
      (i) => String(i.level) == String(level)
    );

    const students = summary.studentSummariesByLevel[level];
    const shortBatchId = masterComputationId ? masterComputationId.slice(-8) : 'N/A';
    const purpose = summary?.purpose || 'final';
    const isPreview = purpose === 'preview'

    // Build totalUnits from keyToCoursesByLevel
    const courses = summary.keyToCoursesByLevel[level];
    let totalUnits = 0;
    for (const course in courses) {
      totalUnits += courses[course].unit
    }
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
    // 18th of february 2026 
    // --- Enhanced background data: include termination and withdrawal ---
    const lists = this.buildStudentLists(summary, level);
    summary.lists = lists
    const backgroundData = {
      confirmationList,
      permissionExceedList: lists.permissionExceedList,
      permissionBelowList: lists.permissionBelowsList,
      noRegistrationList: lists.notRegisteredList,
      leaveOfAbsenceList: lists.leaveOfAbsenceList,
      ...lists,
      leaveOfAbsenceNote: summary.leaveOfAbsenceNote || '',
      terminationList: summary.terminationList || [],          // added
      withdrawalData: summary.withdrawalData || { note: '', students: [] } // added
    };
    const stage = summary.currentApprovalStage || "departmental_board";

    const recommendationData = {

      stage,

      recommendationText: this.generateRecommendationText(stage, summary),

      approveText: `${summary.departmentDetails?.academicYear} ${capitalizeFirstLetter(summary.departmentDetails?.semester)} Semester Examination Results ${toProfessionalAbbreviation(summary.departmentDetails?.programme?.programmeType)} (${summary.department.name}) ${convertToPart(level)}`,

      totalUnits
    };

    // Separate header for recommendation & background
    const separateHeader = this.renderSeparateHeader(summary, level, shortBatchId, isPreview);
    // --- Combined tbody to keep recommendation and background together on print ---
    const separateSection = `
<table class="separate-table ">
  <thead>${separateHeader}</thead>
  <tbody class="force-page-break">
  <tr>
    <!-- ${this.renderRecommendation(recommendationData)} -->
    ${this.renderBackgroundInfo(backgroundData, recommendationData, summary, levelSettings)}
    ${this.renderSummaryAndSignatures(summary, level, 'signatures')}  <!-- moved immediately after student lists -->
  </tbody>
  </tr>
</table>
`;

    // Main master table with reordered sections (signatures moved earlier)
    const mainTable = `
<table class="master-table">
  ${this.renderHeaderRow(summary, level, shortBatchId, isPreview)}
    <tr>
    <td>
      ${this.renderStudentLists(summary, level)}
    </td>
  </tr>
  <!--${this.renderWithdrawalListAlt(summary.withdrawalData)} -->
  <!--${this.renderTerminationListAlt(summary.terminationList)}-->
  <!--${this.renderSummaryCounts(summary.summaryCounts)} -->
  ${this.renderMMS3(summary, level, lists)}
  ${this.renderSummaryAndSignatures(summary, level)}  <!-- moved immediately after student lists -->
  ${this.renderKeyToCourses(summary, level)}
  ${this.renderFooter(masterComputationId)}
</table>
`;

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>MASTER SHEET – ${level} LEVEL</title>
  <style>
    /* ================= BASE PRINT STYLING ================= */
    @page {
      size: A4 portrait;
      margin: 10mm 10mm 10mm 10mm;


    }
    @top-right {
        content: "Page " counter(page);
        font-size: 9pt;
      }
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    
    body {
      font-family: "Times New Roman", serif;
      font-size: 12pt;
      line-height: 1.3;
      color: #000;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
      margin: 0;
      padding: 0;
      position: relative;
      counter-reset: page 1;
    }
    
    /* ================= WATERMARK (unchanged) ================= */
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
    .flex-box{
    display: flex;
    flex-direction: column;
    }
    .flex-row{
        display: flex;
    flex-direction: row;
    gap: 3px
    }
    .preview-watermark {
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='300' viewBox='0 0 400 300'%3E%3Ctext x='50%25' y='50%25' font-family='Arial' font-size='40' font-weight='bold' fill='%23990000' text-anchor='middle' dominant-baseline='middle' transform='rotate(-45 200 150)' opacity='0.7'%3EPREVIEW%3C/text%3E%3Ctext x='50%25' y='60%25' font-family='Arial' font-size='20' fill='%23990000' text-anchor='middle' dominant-baseline='middle' transform='rotate(-45 200 150)' opacity='0.7'%3ENOT FOR OFFICIAL USE%3C/text%3E%3C/svg%3E");
      background-repeat: no-repeat;
      background-position: center;
      background-size: 60% auto;
      opacity: 0.2;
    }
    
    .final-watermark {
      background-image: url('${config.logoUrl || 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgdmlld0JveD0iMCAwIDEwMCAxMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxjaXJjbGUgY3g9IjUwIiBjeT0iNTAiIHI9IjQ1IiBzdHJva2U9IiMwMDAiIHN0cm9rZS13aWR0aD0iMiIvPgo8dGV4dCB4PSI1MCIgeT0iNTUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxNCIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZmlsbD0iIzAwMCI+VU5JVkVSU0lUWTwvdGV4dD4KPC9zdmc+'}');
      background-repeat: no-repeat;
      background-position: center;
      background-size: 200px 200px;
    }
    
    /* ================= MASTER TABLE CONTAINER ================= */
    .master-container {
      width: 100%;
      position: relative;
      z-index: 1;
    }
    
    /* ================= SEPARATE TABLE ================= */
    .separate-table {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
      margin-bottom: 10mm;
      page-break-after: always;
    }
    
    /* ================= MASTER TABLE ================= */
    .master-table {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
    }
    
    /* ================= HEADER ROW (unchanged) ================= */
    .header-row {
      page-break-before: always;
      page-break-after: avoid;
      page-break-inside: avoid;
    }
    
    .header-cell {
      padding: 4mm 0 3mm 0;
      border-bottom: 1.5pt solid rgba(255, 255, 255, 1);
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
      text-transform: uppercase;
      margin-bottom: 1mm;
    }
    
    .header-faculty {
      font-size: 12pt;
      font-weight: bold;
      margin-bottom: 1mm;
    }
    
    .header-programme {
      font-size: 11pt;
      margin-bottom: 1mm;
    }
    
    .header-session {
      font-size: 11pt;
      font-weight: bold;
      text-transform: uppercase;
      margin-bottom: 1mm;
    }
    
    .header-level {
      font-size: 10pt;
      font-weight: bold;
    }
    
    .header-meta {
      position: absolute;
      right: 0;
      top: 0;
      font-size: 9pt;
      text-align: right;
      line-height: 1.2;
    }
    
    /* ================= CONTENT SECTIONS ================= */
    .section-title-row {
      height: 8mm;
      page-break-after: avoid;
      page-break-inside: avoid;
    }
      
    .section-title-cell {
      padding: 2mm 0 1mm 0;
      text-align: left;
      vertical-align: bottom;
      border-bottom: 0.00pt solid #000;
    }
    
    .underline {
      padding: 2mm 0 1mm 0;
      border-bottom: 0.07pt solid #000;
    }
    
    .section-title {
      font-size: 12pt;
      font-weight: bold;
      text-transform: uppercase;
    }
    
    .section-subtitle {
      font-size: 10pt;
      font-style: normal;
      font-weight: bold;
      margin: 2mm 0;
      text-align: left;
    }
    
    /* ================= DATA TABLES - now full width ================= */
    .data-table {
      border-collapse: collapse;
      margin: 3mm 0 5mm 0;
      font-size: 10pt;
      table-layout: auto;
      width: 100%;               /* force table to full container width */
      max-width: 100%;
    }
    
    .data-table th {
      font-weight: bold;
      text-align: left;
      vertical-align: middle;
      padding: 2mm 1.5mm;
      border: 0.75pt solid #000;
      font-size: 9pt;
      background-color: #fff;
    }
    
    .data-table td {
      padding: 1.5mm 1.5mm;
      border: 0.75pt solid #000;
      text-align: left;
      vertical-align: middle;
      min-height: 6mm;
    }
    
    .data-table thead {
      display: table-header-group;
    }
    
    .table-margin {
      margin-bottom: 8mm;
    }
    
    .no-border td{
    border: none;
    } 
    .no-border th{
    border: none;
    } 

    /* ================= PAGE HEADER ROW (for repeating section titles) ================= */
    .page-header-row th {
      border: none;
      border-bottom: 1px solid #000;
      background: none;
      padding: 2mm 0 1mm 0;
      text-align: center;        /* center the title across full width */
      font-size: 12pt;
      font-weight: bold;
    }
    .page-header-row .header-programme {
      font-size: 10pt;
      font-weight: normal;
      text-align: left;          /* keep programme left-aligned if desired */
    }
    
    /* ================= COURSE HEADER TABLE ================= */
    .course-header-table {
      width: 100%;
      border-collapse: collapse;
      margin: 3mm 0 5mm 0;
      font-size: 9pt;
      table-layout: fixed;
    }
    
    .course-header-table th {
      font-weight: bold;
      text-align: center;
      vertical-align: middle;
      padding: 1mm;
      border: 0.75pt solid #000;
    }
    
    .course-header-table .course-code {
      border-bottom: none;
    }
    
    .course-header-table .course-title {
      border-top: none;
      font-weight: normal;
      font-size: 8pt;
      font-style: italic;
    }
    
    /* ================= UTILITY CLASSES ================= */
    .text-left {
      text-align: left;
      padding-left: 1.5mm;
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
    
    .numeric {
      font-family: "Courier New", monospace;
      text-align: right;
      padding-right: 1.5mm;
    }
    
    .compact {
      font-size: 9pt;
    }
    
    .no-data {
      color: #666;
      font-style: italic;
      text-align: center;
      padding: 4mm;
    }
    
    /* ================= SUMMARY AND SIGNATURES CONTAINER ================= */
    .summary-signatures-container {
      margin-top: 5mm;
    }
    
    .summary-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 10mm;
    }
    
    .summary-table td {
      padding: 2mm 1.5mm;
      border: 0.75pt solid #ffffffff;
      text-align: center;
    }
    
    .summary-table .numeric {
      text-align: center;
      padding-right: 1.5mm;
    }
    
    /* ================= SIGNATURES ================= */
    .signatures-container { 
      display: flex;
      justify-content: space-between;
      margin-top: 15mm;
    }
    
    .signature-block {
      width: 45%;
      text-align: center;
    }
    
    .signature-line {
      border-top: 0.75pt solid #000;
      width: 100%;
      max-width: 70mm;
      margin: 0 auto;
      height: 10mm;
    }
    
    .signature-name {
      font-weight: bold;
      margin-top: 2mm;
    }
    
    .signature-title {
      font-size: 9pt;
      margin-top: 1mm;
    }
    
    /* ================= KEY TO COURSES TABLE ================= */
    .key-table {
      width: 100%;
      border-collapse: collapse;
      margin: 3mm 0 5mm 0;
      font-size: 12pt;
    }
    
    .key-table th {
      font-weight: bold;
      text-align: left;
      vertical-align: middle;
      padding: 1.5mm 1.5mm;
      border-bottom: 1pt solid #000;
      border-top: none;
      border-left: none;
      border-right: none;
      font-size: 12pt;
      text-decoration: underline;
    }
    
    .key-table td {
      padding: 1.5mm 1.5mm;
      border: none;
      text-align: left;
      vertical-align: middle;
      font-size: 12pt;
    }
    
    .key-table tr:last-child td {
      border-bottom: none;
    }
    
    /* ================= FOOTER ================= */
    .footer-row {
      height: 6mm;
      page-break-inside: avoid;
      margin-top: 5mm;
    }
    
    .footer-cell {
      padding-top: 3mm;
      border-top: 0.5pt solid #ccc;
      font-size: 8pt;
      text-align: center;
      vertical-align: top;
    }
    
    /* ================= PAGE BREAK CONTROL ================= */
    .force-page-break {
      page-break-before: always;
    }
    
    .avoid-break {
      page-break-inside: avoid;
    }
    
    /* ================= PRINT OPTIMIZATION ================= */
    @media print {
      tr {
        page-break-inside: avoid;
        page-break-after: auto;
      }
      
      .header-row {
        display: table-header-group;
      }
      
      .data-table {
        page-break-inside: auto;
      }
      
      .data-table tr {
        page-break-inside: avoid;
        page-break-after: auto;
      }
      
      .watermark {
        position: fixed;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
    }
    
    /* ================= EMPTY CELL STYLING ================= */
    .empty-cell {
      color: #666;
      font-style: italic;
    }
    
    .list-nil {
      color: #666;
      font-style: italic;
      text-align: center;
      padding: 2mm;
      border: 0.75pt solid #000;
    }
    .report-list {
      counter-reset: item;
      padding-left: 0;
    }

    .report-list li {
      display: block;
      margin-left: 20px;
    }

    .report-list li::before {
      counter-increment: item;
      content: counter(item) ". ";
      font-weight: bold;
      margin-left: -20px;
    }

    /* ======= MMS 2 AREA ======== */
    
  </style>
</head>
<body>
  <!-- Force page break BEFORE main table -->
  <div style="page-break-before: always;"></div>
  <!-- Hidden data for JS processing -->
  <div id="programme-data" style="display:none">
    ${this.formatMasterSheetKey(summary, level)}
  </div>

  <!-- Watermark overlay (absolute ok) -->
  ${isPreview
        ? '<div class="watermark preview-watermark"></div>'
        : '<div class="watermark final-watermark"></div>'}

  <!-- Section 1 -->
  <div class="section">
    ${separateSection}
  </div>



  <!-- Section 2 -->
  <div class="section">
    ${mainTable}
  </div>
</body>
</html>`;
  }
  formatMasterSheetKey(summary, level) {
    const dept = summary.departmentDetails.code.toLowerCase();

    const programme = toProfessionalAbbreviation(
      summary.departmentDetails?.programme?.programmeType
    ).toLowerCase();

    const semester = String(summary.departmentDetails.semester)
      .toLowerCase()
      .replace("first", "first")
      .replace("second", "second")
      .trim();

    const session = summary.departmentDetails.academicYear
      .replace("/", "-")
      .trim();

    return `${dept}-${programme}-l${level}-${semester}-${session}`;
    return `${dept}-${programme}-AllLevel-${semester}-${session}`;

  }

  /* ================= SEPARATE HEADER ================= */
  renderSeparateHeader(summary, level, shortBatchId, isPreview = false) {
    return `
<tr>
  <td class="header-cell ">
    <div class="header-content" style="position: relative; min-height: 15mm;">
      <div class="header-text-container text-bold" style="margin: 0; text-align: center;">
        <div class="">${config.institution}</div>
        <div class="">Faculty of ${summary.departmentDetails.faculty.name}</div>
        <div class="">Department of ${summary.departmentDetails.name}</div>
        <div class="">${summary.departmentDetails.academicYear} ${summary.departmentDetails.semester} semester examination results</div>
        <div class="">${toProfessionalAbbreviation(summary.departmentDetails?.programme?.programmeType)} ${summary.department.name} <br> ${convertToPart(level)}</div>
      </div>
      <div class="header-meta" style="position: absolute; right: 0; top: 0;">
        <div>Batch: ${shortBatchId}</div>
        ${isPreview ? '<div style="color: red; font-weight: bold;">PREVIEW</div>' : ''}
      </div>
    </div>
  </td>
</tr>`;
  }

  /* ================= HEADER ROW ================= */
  renderHeaderRow(summary, level, shortBatchId, isPreview = false) {
    const purposeText = isPreview ? "PREVIEW - NOT FOR OFFICIAL USE" : "OFFICIAL";

    return `
<thead class="header-row">
  <tr>
    <td class="header-cell">
      <div class="header-content">
        <div class="header-logo-container">
          <img src="${config.logoUrl || 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgdmlld0JveD0iMCAwIDEwMCAxMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxjaXJjbGUgY3g9IjUwIiBjeT0iNTAiIHI9IjQ1IiBzdHJva2U9IiMwMDAiIHN0cm9rZS13aWR0aD0iMiIvPgo8dGV4dCB4PSI1MCIgeT0iNTUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxNCIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZmlsbD0iIzAwMCI+VU5JVkVSU0lUWTwvdGV4dD4KPC9zdmc+'}" 
               alt="University Logo" class="header-logo" />
        </div>
        
        <div class="header-text-container text-bold">
          <div class="">${config.institution}</div>
          <div class="">Faculty of ${summary.departmentDetails.faculty.name}</div>
          <div class="">Department of ${summary.departmentDetails.name}</div>
          <div class="">${summary.departmentDetails.academicYear} ${summary.departmentDetails.semester} semester examination results</div>
          <div id="programme-data" class="">${toProfessionalAbbreviation(summary.departmentDetails?.programme?.programmeType)} ${summary.department.name} </div>
          <div> ${convertToPart(level)}</div>
          <!--${isPreview ? `<div class="header-level" style="color: red; font-style: italic;">${purposeText}</div>` : ''}-->
        </div>
        
        <div class="header-meta">
          <div>Batch: ${shortBatchId}</div>
          ${isPreview ? '<div style="color: red; font-weight: bold;">PREVIEW</div>' : ''}
        </div>
      </div>
    </td>
  </tr>
</thead>`;
  }

  /**
   * Renders a header row that will repeat at the top of each page when the table spans multiple pages.
   * Styled to look like a document section title, not a table row.
   * @param {Object} summary - Summary data object.
   * @param {string} level - Academic level.
   * @param {string} headerText - The title to display (e.g., "PASS LIST").
   * @param {number} colspan - Number of columns the header should span.
   * @returns {string} HTML for the header row.
   */
  renderPerPageHeader(
    summary,
    level,
    headerText,
    colspan = 20,
    options = { departmentDetails: true, headerText: true }
  ) {
    if (!options) return "";

    return `
  <tr class="page-header-row">
    <th colspan="${colspan}" class="section-title-cell">
      <div>

        ${options.headerText && headerText?.trim()
        ? `<p class="text-center text-bold">${headerText}</p>`
        : ""
      }

        ${options.departmentDetails
        ? `<p class="header-programme" style="text-align: left;">
                ${toProfessionalAbbreviation(
          summary.departmentDetails?.programme?.programmeType
        )} 
                ${summary.department.name} - ${convertToPart(level)}
              </p>`
        : ""
      }

      </div>
    </th>
  </tr>
  `;
  }

  /* ================= STUDENT LISTS ================= */
  renderStudentLists(summary, level) {
    // const lists = summary.studentListsByLevel[level];
    const lists = this.buildStudentLists(summary, level);

    return `
    <table style="width: 100%" class="seperate-table">
  <thead>
    <tr>
      <th>
        ${this.renderPerPageHeader(summary, level)}
      </th>
    </tr>
  </thead>
  
  <tbody>
    <tr>
      <td>
        ${this.renderPassListWithCourses(lists?.passList, summary, level)}
        ${this.renderCoursesTillOutstanding(lists?.csoList, summary, level)}
        ${this.renderProbationListWithCourses(lists?.probationList, summary, level)}
        ${this.renderWithdrawalListWithCourses(lists?.withdrawalList, summary, level)}
        ${this.renderTerminationListWithCourses(lists?.terminationList, summary, level)}
        ${this.renderSummaryAndSignatures(summary, level)}
      </td>
    </tr>
  </tbody>
  </table>
  `;
  }

  renderPassListWithCourses(list = [], summary, level) {
    if (!list || list.length === 0) {
      return `
        <div class="table-margin">
          <div class="section-subtitle text-center">PASS LIST</div>
          <div class="list-nil">NIL</div>
        </div>`;
    }

    const rowsHTML = list.map((s, i) => {
      const degreeClass = s.gpa ? this.getDegreeClass(s.gpa) : '-';
      return `
        <tr>
          <td class="numeric">${i + 1}</td>
          <td class="text-left">${s.matricNumber || '-'}</td>
          <td class="text-left">${s.name || '-'}</td>
          <!--<td class="numeric ">${s.gpa ? s.gpa.toFixed(2) : '-'}</td>
          <td class="text-left">Pass</td>
          <!--<td class="text-left">${degreeClass}</td>-->
        </tr>
      `;
    }).join('');
    const colspan = 5; // Number of columns in this table

    return `
        <div class="table-margin">
          <table class="data-table">
            <thead>
              ${this.renderPerPageHeader(summary, level, "PASS LIST", colspan, { departmentDetails: false, headerText: true })}
              <tr>
                <th>S/No</th>
                <th>MATRIC. NO</th>
                <th>NAME</th>
                <!--<th>CGPA</th>
                <th>Remark</th>
                <th>CLASS</th>-->
              </tr>
            </thead>
            <tbody>
              ${rowsHTML}
            </tbody>
          </table>
        </div>`;
  }

  renderTerminationListWithCourses(list = [], summary, level) {
    if (!list || list.length === 0) {
      return `
        <div class="table-margin">
          <div class="section-subtitle text-center">TERMINATION LIST</div>
          <div class="list-nil">NIL</div>
        </div>`;
    }

    const rowsHTML = list.map((s, i) => {
      const studentData = this.getStudentData(s.studentId?.$oid || s.studentId, summary, level);
      const failedCourses = studentData?.outstandingCourses || [];
      const remarks = failedCourses.length > 0 ? failedCourses.map(c => c.courseCode).join(', ') : 'None';

      return `
      <tr>
        <td class="numeric">${i + 1}</td>
        <td class="text-bold text-left">${s.matricNumber || '-'}</td>
        <td class="text-left">${s.name || '-'}</td>
        <td>${remarks}</td>
      </tr>
    `}).join('');
    const colspan = 4;

    return `
        <div class="table-margin">
          <table class="data-table">
            <thead>
              ${this.renderPerPageHeader(summary, level, "TERMINATION LIST", colspan, { departmentDetails: false, headerText: true })}
              <tr>
                <th>S/No</th>
                <th>MATRIC. NO</th>
                <th>NAME</th>
                <th>REMARKS</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHTML}
            </tbody>
          </table>
        </div>`;
  }

  renderProbationListWithCourses(list = [], summary, level) {
    if (!list || list.length === 0) {
      return `
        <div class="table-margin">
          <div class="section-subtitle text-center">PROBATION LIST</div>
          <div class="list-nil">NIL</div>
        </div>`;
    }

    const rowsHTML = list.map((s, i) => {
      const studentData = this.getStudentData(s.studentId?.$oid || s.studentId, summary, level);
      const failedCourses = studentData?.outstandingCourses || [];
      const remarks = this.renderCourseList(failedCourses);

      return `
      <tr>
        <td class="numeric">${i + 1}</td>
        <td class="text-bold text-left">${s.matricNumber || '-'}</td>
        <td class="text-left">${s.name || '-'}</td>
        <td class="text-left">${remarks}</td>
      </tr>
    `}).join('');
    const colspan = 4;

    return `
        <div class="table-margin">
          <table class="data-table">
            <thead>
            ${this.renderPerPageHeader(summary, level, "PROBATION LIST", colspan, { departmentDetails: false, headerText: true })}
              <tr>
                <th>S/No</th>
                <th>MATRIC. NO</th>
                <th>NAME</th>
                <th>REMARKS</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHTML}
            </tbody>
          </table>
        </div>`;
  }

  renderWithdrawalListWithCourses(list = [], summary, level) {
    if (!list || list.length === 0) {
      return `
        <div class="table-margin">
          <div class="section-subtitle text-center">WITHDRAWAL LIST</div>
          <div class="list-nil">NIL</div>
        </div>`;
    }

    const rowsHTML = list.map((s, i) => {
      const studentData = this.getStudentData(s.studentId?.$oid || s.studentId, summary, level);
      const failedCourses = studentData?.courseResults?.filter(cr => cr.status === 'failed') || [];
      const remarks = failedCourses.length > 0 ? failedCourses.map(c => c.courseCode).join(', ') : 'None';

      return `
      <tr>
        <td class="numeric">${i + 1}</td>
        <td class="text-bold text-left">${s.matricNumber || '-'}</td>
        <td class="text-left">${s.name || '-'}</td>
        <td class="numeric text-bold">${s.gpa ? s.gpa.toFixed(2) : '-'}</td>
        <td class="text-left">${remarks}</td>
      </tr>
    `}).join('');
    const colspan = 5;

    return `
        <div class="table-margin">
          <table class="data-table">
            <thead>
              ${this.renderPerPageHeader(summary, level, "WITHDRAWAL LIST", colspan, { departmentDetails: false, headerText: true })}
              <tr>
                <th>S/No</th>
                <th>MATRIC. NO</th>
                <th>NAME</th>
<th>GPA</th>
                <th>REMARKS</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHTML}
            </tbody>
          </table>
        </div>`;
  }

  renderCourseRemark(reason) {
    if (reason == 'failed') {
      return 'R'
    }
    else if (reason == 'not_registered') {
      return 'NR'
    } else if (reason == 'carryover') {
      return 'R'
    } else if (reason == 'passed') {
      return 'P'
    } else return 'F'
  }
  renderCourseList(outstandingCourses = []) {
    const courseList = outstandingCourses
      ?.map(oc => {
        if (!oc.courseCode && !oc.courseId?.courseCode) {
        }
        const code = oc.courseCode || oc.courseId?.courseCode || "N/A";
        const remark = `(${this.renderCourseRemark(oc.reason)})`;
        return `${code}${remark}`;
      })
      .join(", ");
    return courseList || '-';
  }
  renderCoursesTillOutstanding(lists, summary, level) {
    const csoStudents = lists

    if (csoStudents.length === 0) {
      return `
      <div class="table-margin">
        <div class="section-subtitle text-center">COURSES STILL OUTSTANDING</div>
        <div class="list-nil">NIL</div>
      </div>`;
    }

    const rowsHTML = csoStudents.map((s, i) => {
      const outstandingCourses = s.outstandingCourses || [];
      const courseList = this.renderCourseList(outstandingCourses);

      return `
      <tr>
        <td class="numeric">${i + 1}</td>
        <td class="text-bold text-left">${s.matricNumber || '-'}</td>
        <td class="text-left">${s.name || '-'}</td>
        <td>${courseList || '-'}</td>
      </tr>
    `;
    }).join('');

    const colspan = 4;

    return `
    <div class="table-margin">
      <table class="data-table">
        <thead>
          ${this.renderPerPageHeader(summary, level, "COURSES STILL OUTSTANDING", colspan, { departmentDetails: false, headerText: true })}
          <tr>
            <th>S/No</th>
            <th>MATRIC. NO</th>
            <th>NAME</th>
            <th style="width: 45%">OUTSTANDING COURSES/REMARKS</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHTML}
        </tbody>
      </table>
    </div>
  `;
  }

  /* ================= MMS I ================= */
  renderMMS1(summary, level) {
    const students = summary.studentSummariesByLevel[level] || [];
    if (students.length === 0) return this.renderEmptySection("MASTER MARK SHEET I", "No student data available");

    const courseResults = summary.keyToCoursesByLevel[level] || [];
    const courseColspan = courseResults.length;
    const totalCols = 2 + courseColspan + 3; // S/No, Reg No, (courses), TCP, TNU, GPA

    const courseHeaderHTML = this.renderCourseHeader(courseResults);

    const studentsHTML = students.map((s, i) => {
      const studentResults = s.courseResults || [];
      const courseCells = courseResults.map(r => {
        let score = studentResults.find(cr => cr.courseCode === r.courseCode);
        let scoreText = score ? (score.score !== null && score.score !== undefined ? `${score.score}` : '-') : '-';
        const grade = studentResults.find(cr => cr.courseCode === r.courseCode);
        const gradeText = grade && grade.grade ? ` (${grade.grade})` : '';
        return `<td class="numeric">${scoreText}${gradeText}</td>`;
      }).join('');

      return `
      <tr>
        <td class="numeric">${i + 1}</td>
        <td class=" text-left">${s.matricNumber || '-'}</td>
        ${courseCells}
        <td class="numeric ">${s.currentSemester?.tcp || '-'}</td>
        <td class="numeric">${s.currentSemester?.tnu || '-'}</td>
        <td class="numeric ">${s.currentSemester?.gpa ? s.currentSemester.gpa.toFixed(2) : '-'}</td>
      </tr>`;
    }).join('');

    return `
  <tbody class="force-page-break">
    <tr>
      <td>
        <table class="data-table table-margin">
          <thead>
            ${this.renderPerPageHeader(summary, level, "MASTER MARK SHEET I", totalCols)}
            <tr>
              <th rowspan="2">S/No</th>
              <th rowspan="2">MATRIC. NO</th>
              <th colspan="${courseColspan}">Courses</th>
              <th rowspan="2">TCP</th>
              <th rowspan="2">TNU</th>
              <th rowspan="2">GPA</th>
            </tr>
            ${courseHeaderHTML}
          </thead>
          <tbody>
            ${studentsHTML}
          </tbody>
        </table>
      </td>
    </tr>
  </tbody>`;
  }

  renderCourseHeader(courses = []) {
    if (courses.length === 0) return '';

    const courseCells = courses.map(course => {
      const courseCode = course.courseCode || 'N/A';
      const courseTitle = course.courseTitle || course.title || '';
      const courseUnit = course.courseUnit ?? course.unit ?? '';
      return `
        <th class="compact">
          <div>${courseCode}</div>
          <!--<div style="font-size: 7pt; font-weight: normal; font-style: italic; margin-top: 0.5mm;">${courseTitle.substring(0, 15)}${courseTitle.length > 15 ? '...' : ''}</div>-->
          <div>(${courseUnit})</div>
        </th>
      `;
    }).join('');

    return `<tr>${courseCells}</tr>`;
  }

  /* ================= MMS II ================= */
  renderMMS2(summary, level) {
    const students = summary.studentSummariesByLevel[level] || [];
    if (students.length === 0) return this.renderEmptySection("MASTER MARK SHEET II", "No student data available");

    const totalCols = 11; // S/No, Reg No, (present) TCP, TNU, GPA, (previous) TCP, TNU, GPA, (cumulative) TCP, TNU, CGPA

    const studentsHTML = students.map((s, i) => `
      <tr>
        <td class="numeric">${i + 1}</td>
        <td class="text-bold text-left">${s.matricNumber || '-'}</td>
        <td class="numeric">${s.currentSemester?.tcp || '-'}</td>
        <td class="numeric">${s.currentSemester?.tnu || '-'}</td>
        <td class="numeric text-bold">${s.currentSemester?.gpa ? s.currentSemester.gpa.toFixed(2) : '-'}</td>
        <td class="numeric">${s.previousPerformance?.cumulativeTCP || '-'}</td>
        <td class="numeric">${s.previousPerformance?.cumulativeTNU || '-'}</td>
        <td class="numeric">${s.previousPerformance?.cumulativeGPA.toFixed(2) ?? '-'}</td>
        <!--<td class="numeric">-</td>-->
        <td class="numeric text-bold">${s.cumulativePerformance?.totalTCP || '-'}</td>
        <td class="numeric">${s.cumulativePerformance?.totalTNU || '-'}</td>
        <td class="numeric text-bold">${s.cumulativePerformance?.cgpa ? s.cumulativePerformance.cgpa.toFixed(2) : '-'}</td>
      </tr>
    `).join('');

    return `
  <tbody class="force-page-break">
    <tr>
      <td>
        <table class="data-table table-margin">
          <thead>
            ${this.renderPerPageHeader(summary, level, "MASTER MARK SHEET II", totalCols)}
            <tr>
              <th rowspan="2">S/No</th>
              <th rowspan="2">MATRIC. NO</th>
              <th colspan="3">PRESENT</th>
              <th colspan="3">PREVIOUS</th>
              <th colspan="3">CUMULATIVE</th>
            </tr>
            <tr>
              <th>TCP</th>
              <th>TNU</th>
              <th>GPA</th>
              <th>TCP</th>
              <th>TNU</th>
              <th>GPA</th>
              <th>TCP</th>
              <th>TNU</th>
              <th>CGPA</th>
            </tr>
          </thead>
          <tbody>
            ${studentsHTML}
          </tbody>
        </table>
      </td>
    </tr>
  </tbody>`;
  }

  /* ================= MMS III (Non-Graduating Students Format) ================= */
  renderMMS3(summary, level, lists) {
    const students = summary.studentSummariesByLevel[level] || [];
    if (students.length === 0) return this.renderEmptySection("MASTER MARK SHEET", "No student data available");

    const totalCols = 14; // REG NO, SEM RMK, OUTSTANDING COURSES, (present) TCP, TNU, GPA, (previous) TCP, TNU, GPA, (cumulative) TCP, TNU, CGPA, CUM RMK, REG NO (duplicate)

    const studentsHTML = students.map((s, i) => {
      // Parse outstanding courses - this would need to come from your data structure
      // For now, creating a placeholder based on the image format

      const studentId = String(s.studentId?.$oid || s.studentId);

      const noRegStudentIds = new Set(
        (lists.notRegisteredList || []).map(st => String(st.studentId?.$oid || st.studentId))
      );

      let semesterRemark;

      const hasNewCarryover = s.outstandingCourses?.some(c => c.status === "new");
      const hasOldCarryover = s.outstandingCourses?.some(c => c.status === "old");
      // const isTerminated = s.

      if (noRegStudentIds.has(studentId)) {
        semesterRemark = 'NRI';
      } else if (hasNewCarryover) {
        // semesterRemark = 'CSO';
        semesterRemark = 'REP';
      } 
      // else if(s._id == String("696dfbc9f32a0a1546cd066c")){
      //   semesterRemark = "REP"
      // }
      else {
        semesterRemark = 'PASS';
      } 
      const outstandingCourses = this.renderCourses(s.outstandingCourses || [], "carryover", semesterRemark);
      const semesterCourses = this.renderCourses(s.courseResults || [], "courses", semesterRemark)

      let cumulativeRemark;

      if (this.isTerminated(lists, studentId)) {
        cumulativeRemark = 'TOS'
      }
      else if (hasNewCarryover || hasOldCarryover) {
        cumulativeRemark = 'CSO';
      } else {
        cumulativeRemark = 'PASS';
      }
      // Get the semester remark - you'll need to map this from your data

      // Get the used semester ratio
      const usedSemesterRatio = s.usedSemesterRatio || '13/12';

      // Get cumulative remark (TOS, CSO, etc.)

      return `
      <tr>
        <td class="numeric" style="vertical-align: top;">${i + 1}</td>
        <td class="text-bold text-left" style="vertical-align: top;">${s.matricNumber || '-'}</td>
        <td style="vertical-align: top;">${semesterCourses}</td>
        <td class="text-left" style="vertical-align: top;">${semesterRemark}</td>
        <td class="text-left outstanding-cell" style="vertical-align: top;">
          ${outstandingCourses}
          <!--<div class="ratio-text">Used Semester Ratio: ${usedSemesterRatio}</div>-->
        </td>
        <td class="numeric" style="vertical-align: top;">${s.currentSemester?.tcp || '-'}</td>
        <td class="numeric" style="vertical-align: top;">${s.currentSemester?.tnu || '-'}</td>
        <td class="numeric" style="vertical-align: top;">${s.currentSemester?.gpa ? s.currentSemester.gpa.toFixed(2) : '-'}</td>
        <td class="numeric" style="vertical-align: top;">${s.previousPerformance?.cumulativeTCP || '-'}</td>
        <td class="numeric" style="vertical-align: top;">${s.previousPerformance?.cumulativeTNU || '-'}</td>
        <td class="numeric" style="vertical-align: top;">${s.previousPerformance?.cumulativeGPA ? s.previousPerformance.cumulativeGPA.toFixed(2) : (s.previousPerformance?.previousSemesterGPA ? s.previousPerformance.previousSemesterGPA.toFixed(2) : '-')}</td>
        <td class="numeric" style="vertical-align: top;">${s.cumulativePerformance?.totalTCP || '-'}</td>
        <td class="numeric" style="vertical-align: top;">${s.cumulativePerformance?.totalTNU || '-'}</td>
        <td class="numeric" style="vertical-align: top;">${s.cumulativePerformance?.cgpa ? s.cumulativePerformance.cgpa.toFixed(2) : '-'}</td>
        <td class="" style="vertical-align: top;">${cumulativeRemark}</td>
        <td class="text-left" style="vertical-align: top;">${s.matricNumber || '-'}</td>
      </tr>
    `;
    }).join('');

    return `
  <tbody class="force-page-break" style="font-size: 12px" data="mms3">
    <tr>
      <td>
        <div style="display: flex; justify-content: space-between; margin-bottom: 15px; gap: 10px;">
          <!-- CLASSIFICATION OF DEGREE TABLE (LEFT) -->
          <table class="classification-table" style="width: 48%;">
            <tr>
              <th colspan="2" style="text-align: left">CLASSIFICATION OF DEGREE</th>
            </tr>
            <tr>
              <td>4.50 - 5.00</td>
              <td>First Class</td>
            </tr>
            <tr>
              <td>3.50 - 4.49</td>
              <td>Second Class Upper</td>
            </tr>
            <tr>
              <td>2.40 - 3.49</td>
              <td>Second Class Lower</td>
            </tr>
            <tr>
              <td>1.50 - 2.39</td>
              <td>Third Class</td>
            </tr>
            <tr>
              <td>1.00 - 1.49</td>
              <td>Pass</td>
            </tr>
            <tr>
              <td>0.00 - 0.99</td>
              <td>Fail</td>
            </tr>
          </table>
<!-- INTERPRETATION OF GRADES TABLE -->
<table style="width:48%; border-collapse:collapse; ">
  
  <tr>
    <th colspan="4" style="text-align:left; padding-bottom:6px;">
      INTERPRETATION OF GRADES
    </th>
  </tr>
  <tr>
    <td style="padding:2px 6px;"></td>
    <td style="padding:2px 3px; font-weight:bold;"></td>
    <td style="padding:2px 3px; font-size: 7px" ><u>PTS</u></td>
    <td style="padding-left:25px; white-space:nowrap;"></td>
  </tr>
  <tr>
    <td style="padding:2px 6px;">70% - 100%</td>
    <td style="padding:2px 3px; font-weight:bold;">= A</td>
    <td style="padding:2px 3px;">= 5</td>
    <td style="padding-left:25px; white-space:nowrap;">I - Incomplete</td>
    </tr>
    
    <tr>
    <td style="padding:2px 6px;">60% - 69%</td>
    <td style="padding:2px 3px; font-weight:bold;">= B</td>
    <td style="padding:2px 3px;">= 4</td>
    <td style="padding-left:25px; white-space:nowrap;">S - Sick</td>
  </tr>

  <tr>
    <td style="padding:2px 6px;">50% - 59%</td>
    <td style="padding:2px 3px; font-weight:bold;">= C</td>
    <td style="padding:2px 3px;">= 3</td>
    <td style="padding-left:25px; white-space:nowrap;">R - Repeat</td>
  </tr>

  <tr>
    <td style="padding:2px 6px;">45% - 49%</td>
    <td style="padding:2px 3px; font-weight:bold;">= D</td>
    <td style="padding:2px 3px;">= 2</td>
    <td style="padding-left:25px; white-space:nowrap;">SC - Sessional Course</td>
  </tr>
    
  <tr>
    <td style="padding:2px 6px;">40% - 44%</td>
    <td style="padding:2px 3px; font-weight:bold;">= E</td>
    <td style="padding:2px 3px;">= 1</td>
    <td style="padding-left:25px; white-space:nowrap;">AR - Awaiting Result</td>
    <td></td>
  </tr>
  <tr>
    <td style="padding:2px 6px;">0% - 39%</td>
    <td style="padding:2px 3px; font-weight:bold;">= F</td>
    <td style="padding:2px 3px;">= 0</td>
    <td style="padding-left:25px; white-space:nowrap;">CE - Compulsory Elective</td>
    <td></td>
    </tr>
    <tr>
    <td style="padding:2px 6px;"></td>
    <td style="padding:2px 3px; font-weight:bold;"></td>
    <td style="padding:2px 3px;"></td>
    <td style="padding-left:25px; white-space:nowrap;">NRI - No Registration Information</td>
    <td></td>
  </tr>

</table>
        </div>
        
        
        <table style="font-size: 12px" class="mms3-table data-table table-margin">
          <thead>
            ${this.renderPerPageHeader(summary, level, "MASTER MARK SHEET", totalCols)}
            <tr>
              <th rowspan="2">S/n</th>
              <th rowspan="2">MATRIC. NO</th>
              <th rowspan="2">CURRENT SEMESTER</th>
              <th rowspan="2">SEM RMK</th>
              <th rowspan="2">OUTSTANDING COURSES</th>
              <th colspan="3">PRESENT</th>
              <th colspan="3">PREVIOUS</th>
              <th colspan="3">CUMULATIVE</th>
              <th rowspan="2">CUM RMK</th>
              <th rowspan="2">MATRIC. NO</th>
            </tr>
            <tr>
              <th>TCP</th>
              <th>TNU</th>
              <th>GPA</th>
              <th>TCP</th>
              <th>TNU</th>
              <th>GPA</th>
              <th>TCP</th>
              <th>TNU</th>
              <th>CGPA</th>
            </tr>
          </thead>
          <tbody>
            ${studentsHTML}
          </tbody>
        </table>
      </td>
    </tr>
  </tbody>`;
  }

  /* Helper function to render outstanding courses */
  renderCourses(courses = [], type, semesterRemark) {
    if (courses.length === 0) {

      let emptyMessage;
      if (type == "courses") {
        emptyMessage = "No Registration Information";
      } else if (type == "carryover") {
        emptyMessage = "";
      }

      return `
      <div class="outstanding-row">
        ${emptyMessage}
      </div>
    `;
    }

    // Group courses by rows (4 per row)
    const rows = [];
    for (let i = 0; i < courses.length; i += 4) {
      rows.push(courses.slice(i, i + 4));
    }

    return rows
      .map((row) => {
        const courseElements = row
          .map((course) => {
            const grade = course.grade || "R";
            let courseCode = course.courseCode || "N/A";

            let partA, partB;
            //  Decide where the remark comes from
            const remarkSource =
              type === "courses" ? course.status : course.reason;

            const cleanCode = courseCode.replace(/\s+/g, "");
            const codeMatch = cleanCode.match(/^([A-Za-z]+)(\d+)$/);

            if (codeMatch) {
              partA = codeMatch[1]
              partB = codeMatch[2]
            } else {
              if (courseCode.includes(" ")) {
                const parts = courseCode.split(" ");
                partA = parts[0]
                partB = parts[1] || ""
              } else {
                partA = courseCode
                partB = ""
              }
            }
            return `
              <div class="flex-box">
                <span class="course-code">${partA} </span>
                <span>${partB}</span>
                <span class="course-unit">(${course.unitLoad ?? course.unit ?? "-"})</span>
                ${type == "courses" || semesterRemark == 'NRI' ? `` : `<span class="course-unit">${this.renderCourseRemark(remarkSource)}</span>`}
${(course.score && type == "courses") ? `
  <span class="course-unit">
    <span 
      data-editable="true" 
      data-id="${course.courseCode}" 
      data-for="score"
      data-type=
      contenteditable="false"
      class="editable-score"
    >${course.score}</span>
    <span class="grade-display">(${course.grade})</span>
  </span>
` : ''}

              </div>
            `;
          })
          .join("");

        return `<div class="flex-row center text-center">${courseElements}</div>`;
      })
      .join("");
  }

  /* Add this CSS to your styles */
  addMMS3Styles() {
    return `
    <style>
    
    </style>
  `;
  }
  /* ================= SUMMARY AND SIGNATURES (with type control) ================= */

  /**
   * Renders the summary table and/or signatures based on the specified type.
   *
   * @param {Object} summary - The summary data object.
   * @param {string} level - The academic level (e.g., "100", "200").
   * @param {string} type - Which part to render: "both" (default), "summary", or "signatures".
   * @param {string|null} customTitle - Optional custom section title. If provided, it overrides the default.
   * @returns {string} HTML for the section.
   */
  renderSummaryAndSignatures(summary, level, type = "both", customTitle = null) {
    const showTitle = (type === "both") || (customTitle !== null);
    const titleText = customTitle || "SUMMARY AND SIGNATURES";

    // Build content based on type
    let content = '';
    if (type === "both" || type === "summary") {
      content += this.renderSummaryTable(summary);
    }
    if (type === "both" || type === "signatures") {
      content += this.renderSignatures(summary);
    }

    return `
<tbody class="avoid-break">
  ${showTitle ? `
  <tr class="section-title-row">
    <td class="section-title-cell">
      <div class="section-title">${titleText}</div>
    </td>
  </tr>` : ''}
  <tr>
    <td>
      <div class="summary-signatures-container">
        ${content}
      </div>
    </td>
  </tr>
</tbody>`;
  }

  /**
   * Renders only the summary table (GPA distribution, statistics, etc.)
   */
  renderSummaryTable(summary) {
    const lists = summary.lists || {};
    if (!lists || Object.keys(lists).length === 0) {
      return `<div class="no-data table-margin">No summary data available</div>`;
    }

    // These are the mutually exclusive primary lists
    const primaryLists = {
      passList: lists.passList?.length || 0,
      csoList: lists.csoList?.length || 0,
      probationList: lists.probationList?.length || 0,
      withdrawalList: lists.withdrawalList?.length || 0,
      terminationList: lists.terminationList?.length || 0,
      leaveOfAbsenceList: lists.leaveOfAbsenceList?.length || 0
    };

    // Calculate total students from mutually exclusive lists only
    const totalStudents = Object.values(primaryLists).reduce((sum, count) => sum + count, 0);

    // Optional overlapping lists (not included in total)
    // const overlappingLists = {
    //   notRegisteredList: lists.notRegisteredList?.length || 0,
    //   permissionExceedList: lists.permissionExceedList?.length || 0,
    //   permissionBelowList: lists.permissionBelowList?.length || 0
    // };
    const overlappingLists = {};

    return `
    <table class="data-table no-border table-margin">
      <tbody>
        <tr>
          <td class="text-bold">Pass List</td>
          <td class="text-right">${primaryLists.passList}</td>
        </tr>
        <tr>
          <td class="text-bold">CSO</td>
          <td class="text-right">${primaryLists.csoList}</td>
        </tr>
        <tr>
          <td class="text-bold">Probation</td>
          <td class="text-right">${primaryLists.probationList}</td>
        </tr>
        <tr>
          <td class="text-bold">Withdrawal</td>
          <td class="text-right">${primaryLists.withdrawalList}</td>
        </tr>
        <tr>
          <td class="text-bold">Termination</td>
          <td class="text-right">${primaryLists.terminationList}</td>
        </tr>
        <tr>
          <td class="text-bold">Leave of Absence</td>
          <td class="text-right">${primaryLists.leaveOfAbsenceList}</td>
        </tr>
        ${overlappingLists.notRegisteredList > 0 ? `
        <tr>
          <td class="text-bold text-muted">Not Registered (Overlap)</td>
          <td class="text-right text-muted">${overlappingLists.notRegisteredList}</td>
        </tr>
        ` : ''}
        ${overlappingLists.permissionExceedList > 0 ? `
        <tr>
          <td class="text-bold text-muted">Permission Exceed (Overlap)</td>
          <td class="text-right text-muted">${overlappingLists.permissionExceedList}</td>
        </tr>
        ` : ''}
        ${overlappingLists.permissionBelowList > 0 ? `
        <tr>
          <td class="text-bold text-muted">Permission Below (Overlap)</td>
          <td class="text-right text-muted">${overlappingLists.permissionBelowList}</td>
        </tr>
        ` : ''}
        <tr class="text-right">
          <td class="text-bold">Total Students</td>
          <td class="text-right"><strong><u>${totalStudents}</u></strong></td>
        </tr>
      </tbody>
    </table>
  `;
  }

  /**
   * Renders only the signature blocks (HOD and Dean)
   */
  renderSignatures(summary) {
    const deanName = resolveUserName(summary.departmentDetails.dean, "MastersheetHtmlrender.renderSignatures", { initials: true })
    const hodName = resolveUserName(summary.departmentDetails.hod, "MastersheetHtmlrender.renderSignatures", { initials: true })
    return `
<div class="signatures-container">
  <div class="signature-block">
    <div class="signature-line"></div>
    <div class="signature-name">${hodName}</div>
    <!--<div class="signature-title">${config.hod.title}</div>-->
    <div class="signature-title">HOD, ${summary.departmentDetails.name}</div>
  </div>
  <div class="signature-block">
    <div class="signature-line"></div>
    <div class="signature-name">${deanName}</div>
    <div class="signature-title">Dean, Faculty of ${summary.departmentDetails.faculty?.name || 'N/A'}</div>
  </div>
</div>`;
  }

  /* ================= KEY TO COURSES ================= */
  renderKeyToCourses(summary, level) {
    const courses = summary.keyToCoursesByLevel[level] || [];
    if (courses.length === 0) return this.renderEmptySection("KEY TO COURSES", "No courses available");

    const coursesHTML = courses.map(c => `
      <tr>
        <td class="text-bold text-left">${c.courseCode || '-'}</td>
        <td class="text-left">${c.title || '-'}</td>
        <td class="numeric">${c.unit || '0'}</td>
      </tr>
    `).join('');

    return `
  <tbody class="force-page-break">
    <tr class="section-title-row">
      <td class="section-title-cell text-center">
        <div class="section-title underline">KEY TO COURSES</div>
      </td>
    </tr>
    
    <tr>
      <td>
        <table class="key-table">
          <thead>
            <tr>
              <th>COURSE CODE</th>
              <th>COURSE TITLE</th>
              <th>UNITS</th>
            </tr>
          </thead>
          <tbody>
            ${coursesHTML}
          </tbody>
        </table>
      </td>
    </tr>
  </tbody>`;
  }

  /* ================= FOOTER ================= */
  renderFooter(masterComputationId) {
    return `
  <tbody>
    <tr class="footer-row">
      <td class="footer-cell">
        Generated: ${new Date().toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })} • Batch: ${masterComputationId || 'N/A'}
      </td>
    </tr>
  </tbody>`;
  }

  /* ================= HELPER METHODS ================= */
  renderEmptySection(title, message) {
    return `
  <tbody>
    <tr class="section-title-row">
      <td class="section-title-cell">
        <div class="section-subtitle">${title}</div>
      </td>
    </tr>
    
    <tr>
      <td>
        <div class="list-nil">${message || 'NIL'}</div>
      </td>
    </tr>
  </tbody>
  `;
  }

  getStudentData(studentId, summary, level) {
    const students = summary.studentSummariesByLevel[level] || [];
    return students.find(s =>
      String(s.studentId?.$oid || s.studentId) === String(studentId)
    );
  }

  getDegreeClass(gpa) {
    if (gpa == null || isNaN(gpa)) return "N/A";
    if (gpa >= DEGREE_CLASS.FIRST_CLASS.min_gpa) return DEGREE_CLASS.FIRST_CLASS.label;
    if (gpa >= DEGREE_CLASS.SECOND_CLASS_UPPER.min_gpa) return DEGREE_CLASS.SECOND_CLASS_UPPER.label;
    if (gpa >= DEGREE_CLASS.SECOND_CLASS_LOWER.min_gpa) return DEGREE_CLASS.SECOND_CLASS_LOWER.label;
    if (gpa >= DEGREE_CLASS.THIRD_CLASS.min_gpa) return DEGREE_CLASS.THIRD_CLASS.label;
    return DEGREE_CLASS.FAIL.label;
  }

  // ================= WITHDRAWAL LIST ALTERNATE (kept for compatibility) =================
  renderWithdrawalListAlt(withdrawalData) {
    const note = withdrawalData?.note || '';
    const list = withdrawalData?.students || [];

    if (!list || list.length === 0) {
      return `
      <tbody>
        <tr>
          <td>
            <div class="table-margin">
              <div class="section-subtitle">WITHDRAWAL LIST</div>
              <div class="list-nil">NIL</div>
            </div>
          </td>
        </tr>
      </tbody>`;
    }

    const rowsHTML = list.map((s, i) => `
    <tr>
      <td class="numeric">${i + 1}</td>
      <td class="text-bold text-left">${s.regNo || '-'}</td>
      <td class="text-left">${s.name || '-'}</td>
    </tr>
  `).join('');

    return `
    <tbody>
      <tr>
        <td>
          <div class="table-margin">
            <div class="section-subtitle">WITHDRAWAL LIST</div>
            ${note ? `<p style="margin: 2mm 0 3mm 0; font-size: 10pt;">${note}</p>` : ''}
            <table class="data-table">
              <thead>
                <tr>
                  <th>S/N</th>
                  <th>MATRIC. NO.</th>
                  <th>NAME</th>
                </tr>
              </thead>
              <tbody>
                ${rowsHTML}
              </tbody>
            </table>
          </div>
        </td>
      </tr>
    </tbody>`;
  }

  // ================= TERMINATION LIST ALTERNATE =================
  renderTerminationListAlt(terminationList) {
    const list = terminationList || [];

    if (list.length === 0) {
      return `
      <tbody>
        <tr>
          <td>
            <div class="table-margin">
              <div class="section-subtitle">TERMINATION OF STUDENTSHIP</div>
              <div class="list-nil">NIL</div>
            </div>
          </td>
        </tr>
      </tbody>`;
    }

    const rowsHTML = list.map((s, i) => `
    <tr>
      <td class="numeric">${i + 1}</td>
      <td class="text-bold text-left">${s.regNo || '-'}</td>
      <td class="text-left">${s.name || '-'}</td>
    </tr>
  `).join('');

    return `
    <tbody>
      <tr>
        <td>
          <div class="table-margin">
            <div class="section-subtitle">TERMINATION OF STUDENTSHIP</div>
            <table class="data-table">
              <thead>
                <tr>
                  <th>S/N</th>
                  <th>MATRIC. NO.</th>
                  <th>NAME</th>
                </tr>
              </thead>
              <tbody>
                ${rowsHTML}
              </tbody>
            </table>
          </div>
        </td>
      </tr>
    </tbody>`;
  }

  // ================= SUMMARY COUNTS =================
  renderSummaryCounts(counts) {
    const defaultCounts = { pass: 0, cso: 0, prob: 0, wd: 0, tos: 0, total: 0 };
    const c = { ...defaultCounts, ...counts };

    return `
    <tbody>
      <tr>
        <td>
          <div class="table-margin">
            <div class="section-subtitle">SUMMARY OF RESULT</div>
            <div style="font-size: 12pt; margin: 2mm 0 5mm 0; display: flex; flex-wrap: wrap; gap: 10mm;">
              <span><strong>Pass (Pass) :</strong> ${c.pass}</span>
              <span><strong>Courses Still Outstanding (CSO) :</strong> ${c.cso}</span>
              <span><strong>Probation (Prob) :</strong> ${c.prob}</span>
              <span><strong>Withdrawal (WD) :</strong> ${c.wd}</span>
              <span><strong>Termination of Studentship (TOS) :</strong> ${c.tos}</span>
              <span><strong>Total =</strong> ${c.total}</span>
            </div>
          </div>
        </td>
      </tr>
    </tbody>`;
  }

  // ================= RECOMMENDATION SECTION =================
  renderRecommendation(data) {
    const {
      recommendationText,
      approveText
    } = data;
    return `
<tr>
  <td style="padding: 2mm 0;">
    <div style="font-weight: bold; font-size: 12pt; margin-bottom: 1mm;">RECOMMENDATION</div>
    <div style="margin-bottom: 3mm;">${recommendationText}</div>
    <div style="font-weight: bold; font-size: 12pt; margin-bottom: 1mm;">TO APPROVE</div>
    <div>${approveText}</div>
  </td>
</tr>`;
  }

  // ================= BACKGROUND INFORMATION (enhanced) =================
  renderBackgroundInfo(bgData, data, summary, levelSettings) {
    const confirmationList = bgData?.confirmationList || [];
    const noRegList = bgData?.noRegistrationList || [];
    const terminationList = bgData?.terminationList || [];
    const permissionExceedList = bgData?.permissionExceedList || [];
    const permissionBelowList = bgData?.permissionBelowList || [];
    const leaveOfAbsenceList = bgData?.leaveOfAbsenceList || [];


    const leaveNote = bgData?.leaveOfAbsenceNote || '';
    const withdrawalData = bgData?.withdrawalData || { note: '', students: [] };

    const {
      recommendationText,
      approveText,
      totalUnits
    } = data;

    const year = summary.departmentDetails.academicYear;
    const semester = capitalizeFirstLetter(summary.departmentDetails.semester);

    const renderStudentTable = (list) => {
      const rows = list.map((s, i) => `
      <tr>
        <td class="numeric">${i + 1}</td>
        <td class="text-bold text-left">${s.matricNumber || s.regNo || '-'}</td>
        <td class="text-left">${s.name || '-'}</td>
      </tr>
    `).join('');

      return `
      <table class="data-table" style="width:auto; min-width:50%;">
        <thead>
          <tr>
            <th>S/N</th>
            <th>MATRIC. NO.</th>
            <th>NAME</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    `;
    };

    const renderStudentSection = (title, list, paragraph, singleFormatter) => {

      let html = `
      <li>
        <span style="margin:3mm 0 1mm 0; font-weight:bold;">
          ${title}
        </span>
    `;

      if (!list || list.length === 0) {
        html += `<p>Nil</p>`;
      }

      else if (list.length === 1) {
        const s = list[0];
        html += `<p style="font-size:10pt;">${singleFormatter(s)}</p>`;
      }

      else {
        if (paragraph) {
          html += `<p style="font-size:10pt; margin-bottom:2mm;">${paragraph}</p>`;
        }
        html += renderStudentTable(list);
      }

      html += `</li>`;
      return html;
    };


    let content = `
  <div class="table-margin">
    <div style="padding: 2mm 0;">
      <div style="font-weight:bold; font-size:12pt; margin-bottom:1mm;">RECOMMENDATION</div>
      <div style="margin-bottom:3mm;">${recommendationText}</div>

      <div style="font-weight:bold; font-size:12pt; margin-bottom:1mm;">TO APPROVE</div>
      <div>${approveText}</div>
    </div>

    <div class="section-subtitle">BACKGROUND INFORMATION</div>

    <ol class="report-list">
  `;

    // 1 Confirmation
    content += renderStudentSection(
      "Confirmation of Candidates with Two Names",
      confirmationList,
      "The following candidates have been confirmed to have two names only.",
      (s) => `${s.name} (${s.regNo}) has been confirmed to have two names only.`
    );


    // 2 No Registration
    content += renderStudentSection(
      "No Registration Information",
      noRegList,
      `The following candidates did not register for courses during the ${year} ${semester} Semester; hence, they were debited with ${totalUnits} units.`,
      (s) => `${s.name} (${s.matricNumber}) did not register for courses during the ${year} ${semester} Semester; hence, the student was debited with ${totalUnits} units.`
    );


    // 3 Leave of Absence
    // 3 Leave of Absence
    content += renderStudentSection(
      "Leave of Absence",
      leaveOfAbsenceList,
      `The following candidates were on approved leave of absence during the ${year} ${semester} Semester.`,
      (s) => `Candidate ${s.name} ${s.matricNumber} sought for and got approval for Leave of Absence in ${year} Academic Session.`
    );


    // 4 Termination
    // content += renderStudentSection(
    //   "Termination of Studentship",
    //   terminationList,
    //   "The following students have had their studentship terminated due to academic performance.",
    //   (s) => `Termination of studentship for ${s.name} (${s.regNo}) due to academic performance.`
    // );


    // // 5 Withdrawal
    // content += renderStudentSection(
    //   "Withdrawal of Studentship",
    //   withdrawalData.students,
    //   withdrawalData.note || "Withdrawal due to academic reasons.",
    //   (s) => `${withdrawalData.note || "Withdrawal due to academic reasons."} Student affected: ${s.name} (${s.regNo}).`
    // );


    // 6 Permission to exceed units
    // content += renderStudentSection(
    //   "Students Granted Permission to Exceed Maximum Units",
    //   permissionExceedList,
    //   "The following students were granted permission to register more than the maximum units.",
    //   (s) => `${s.name} (${s.matricNumber}) was allowed by the HOD to register more than the maximum allowed units for this semester.`
    // );

    // Permission to register below minimum units
    content += renderStudentSection(
      `Permission to Register less than ${levelSettings?.minUnits} Units`,
      permissionBelowList,
      `The following students were granted permission to register for less than ${levelSettings?.minUnits} units.`,
      (s) => {
        const reason =
          `were granted permission to register for less than ${levelSettings?.minUnits} units.`;

        return `${s.name} (${s.matricNumber}) ${reason}`;
      }
    );

    content += `
    </ol>
  </div>
  `;

    return `
<tr>
  <td style="padding:0;">
    ${content}
  </td>
</tr>`;
  }

}

export default new MasterSheetHtmlRenderer();