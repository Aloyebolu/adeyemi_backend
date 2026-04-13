// MasterSheetHtmlRenderer.js
// PROFESSIONAL UNIVERSITY MASTER SHEET - ENHANCED VERSION WITH WORD EXPORT

import { formatDateWithOrdinal, semesterNameToSeason, toProfessionalAbbreviation } from "../../../../utils/helpers.js";
import { convertToPart } from "../../../../utils/levelConverter.js";
import { DEGREE_CLASS, STUDENT_STATUS, SUSPENSION_REASONS } from "../../utils/computationConstants.js";
import config from "./MasterSheetConfig.js";
import { processPreviewDepartmentJob } from "../../workers/previewComputation.controller.js";
import { capitalizeFirstLetter } from "../../../../utils/StringUtils.js";

class MasterSheetHtmlRenderer {
  capitalizeFirst = str =>
    str ? str.charAt(0).toUpperCase() + str.slice(1).toLowerCase() : str; // introduced

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
          if (student.firstName) student.firstName = this.capitalizeFirst(student.firstName); // introduced
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
            if (student.firstName) student.firstName = capitalizeFirst(student.firstName); // introduced
          });

          students?.sort(sortByMatric);
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
      leaveOfAbsenceList: [],
      permissionExceedList: []
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

      // Permission Granted to carry more than the maximum units
      if(s.exceededMaxUnits){
        lists.permissionExceedList.push(base)
      }
    }

    // sort all lists by matric number
    Object.values(lists).forEach(list => {
      list.sort((a, b) => a.matricNumber.localeCompare(b.matricNumber));
    });

    return lists;
  }

  render({ summary, level, masterComputationId }) {
    if (summary.status == 'failed') {
      return `<p color='red'>Mastersheet generation failed</p>`
    }
    summary = this.normalizeSummary(summary)

    const students = summary.studentSummariesByLevel[level];
    const shortBatchId = masterComputationId ? masterComputationId.slice(-8) : 'N/A';
    const purpose = summary?.purpose || 'final';
    const isPreview = purpose === 'preview'

    // Build totalUnits from keyToCoursesByLevel
    const courses = summary.keyToCoursesByLevel[level];
    let totalUnits = 0;
    for (const course in courses) {
      console.log(courses[course].unit)
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
    const backgroundData = {
      confirmationList,
      permissionExceedList: lists.permissionExceedList,
      noRegistrationList: lists.notRegisteredList,
      leaveOfAbsenceNote: summary.leaveOfAbsenceNote || '',
      terminationList: summary.terminationList || [],          // added
      withdrawalData: summary.withdrawalData || { note: '', students: [] } // added
    };
    const recommendationData = {
      // BYPASS: Currently using a hardcoded date for the recommendation text.
      // recommendationText: `Recommendation from the Departmental Board of Studies held on the ${focrmatDateWithOrdinal(summary.academicBoardDate)} to the Faculty Board of Examiners.`,
      recommendationText: `Recommendation from the Departmental Board of Examiner's meeting held on the 18<sup>th</sup> of February 2026 to the Faculty Board of Examiners.`,

      approveText: `${summary.departmentDetails?.academicYear} ${capitalizeFirstLetter(summary.departmentDetails?.semester)} Semester Examination Results  ${toProfessionalAbbreviation(summary.departmentDetails?.programme?.programmeType)} (${summary.department.name}) ${convertToPart(level)}`
      , totalUnits
    };

    // Separate header for recommendation & background
    const separateHeader = this.renderSeparateHeader(summary, level, shortBatchId, isPreview);
    // --- Combined tbody to keep recommendation and background together on print ---
    const separateSection = `
      <table class="separate-table">
        <thead>${separateHeader}</thead>
        <tbody>
        <tr>
          <!-- ${this.renderRecommendation(recommendationData)} -->
          ${this.renderBackgroundInfo(backgroundData, recommendationData, summary)}
          ${this.renderSummaryAndSignatures(summary, level, 'signatures')}  <!-- moved immediately after student lists -->
        </tbody>
        </tr>
      </table>
    `;

    // Main master table with reordered sections (signatures moved earlier)
    const mainTable = `
      <table class="master-table">
        ${this.renderHeaderRow(summary, level, shortBatchId, isPreview)}
        ${this.renderStudentLists(summary, level)}
        <!--${this.renderWithdrawalListAlt(summary.withdrawalData)} -->
        <!--${this.renderTerminationListAlt(summary.terminationList)}-->
        <!--${this.renderSummaryCounts(summary.summaryCounts)} -->
        ${this.renderMMS1(summary, level)}
        ${this.renderMMS2(summary, level)}
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

            @top-right {
              content: "Page " counter(page);
              font-size: 9pt;
            }
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
        </style>
      </head>
      <body>
        <div id="programme-data" style="display:none">
        ${this.formatMasterSheetKey(summary, level)}
      </div>
        ${isPreview ? '<div class="watermark preview-watermark"></div>' : '<div class="watermark final-watermark"></div>'}

        ${separateSection}
        ${mainTable}

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
  }

  /* ================= SEPARATE HEADER ================= */
  renderSeparateHeader(summary, level, shortBatchId, isPreview = false) {
    return `
<tr>
  <td class="header-cell">
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
  renderPerPageHeader(summary, level, headerText, colspan = 20) {
    return `
    <tr class="page-header-row">
      <th colspan="${colspan}" class="section-title-cell">
        <div>
          <p class="text-center text-bold">${headerText}</p>
          <p class="header-programme" style="text-align: left;">
            ${toProfessionalAbbreviation(summary.departmentDetails?.programme?.programmeType)} 
            ${summary.department.name} - ${convertToPart(level)}
          </p>
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
  <tbody>
    <tr>
      <td>
        ${this.renderPassListWithCourses(lists?.passList, summary, level)}
        ${this.renderCoursesTillOutstanding(summary, level)}
        ${this.renderTerminationListWithCourses(lists?.terminationList, summary, level)}
        ${this.renderProbationListWithCourses(lists?.probationList, summary, level)}
        ${this.renderWithdrawalListWithCourses(lists?.withdrawalList, summary, level)}
        ${this.renderSummaryAndSignatures(summary, level)}
      </td>
    </tr>
  </tbody>`;
  }

  renderPassListWithCourses(list = [], summary, level) {
    if (!list || list.length === 0) {
      return `
        <div class="table-margin">
          <div class="section-subtitle">PASS LIST</div>
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
          <td class="numeric ">${s.gpa ? s.gpa.toFixed(2) : '-'}</td>
          <td class="text-left">${degreeClass}</td>
        </tr>
      `;
    }).join('');
    const colspan = 5; // Number of columns in this table

    return `
        <div class="table-margin">
          <table class="data-table">
            <thead>
              ${this.renderPerPageHeader(summary, level, "PASS LIST", colspan)}
              <tr>
                <th>S/No</th>
                <th>MATRIC. NO</th>
                <th>NAME</th>
                <th>GPA</th>
                <th>CLASS</th>
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
          <div class="section-subtitle">TERMINATION LIST</div>
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
        <td>${remarks}</td>
      </tr>
    `}).join('');
    const colspan = 4;

    return `
        <div class="table-margin">
          <table class="data-table">
            <thead>
              ${this.renderPerPageHeader(summary, level, "TERMINATION LIST", colspan)}
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
          <div class="section-subtitle">PROBATION LIST</div>
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
              ${this.renderPerPageHeader(summary, level, "PROBATION LIST", colspan)}
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
          <div class="section-subtitle">WITHDRAWAL LIST</div>
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
              ${this.renderPerPageHeader(summary, level, "WITHDRAWAL LIST", colspan)}
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

  renderCourseList(outstandingCourses = []) {
    const courseList = outstandingCourses
      .map(oc => {
        if (!oc.courseCode && !oc.courseId?.courseCode) {
          console.log(oc)
        }
        const code = oc.courseCode || oc.courseId?.courseCode || "N/A";
        const remark = oc.reason === "failed" ? "(R)" : "(NR)";
        return `${code}${remark}`;
      })
      .join(", ");
    return courseList || '-';
  }

  /* ================= COURSES TILL OUTSTANDING ================= */
  //   renderCoursesTillOutstanding(summary, level) {
  //     const students = summary.studentSummariesByLevel[level] || [];

  //     const lists = this.buildStudentLists(summary, level);
  //     const probationList = lists.probationList;
  //     const probationStudentIds = new Set(
  //       probationList.map(p => String(p.studentId?.$oid || p.studentId))
  //     );

  //     const csoStudents = students.filter(s => {
  //       const studentId = String(s.studentId?.$oid || s.studentId);
  //       const hasOutstandingCourses = s.outstandingCourses && s.outstandingCourses.length > 0;
  //       const isOnProbation = probationStudentIds.has(studentId);
  //       return hasOutstandingCourses && !isOnProbation;
  //     });

  //     if (csoStudents.length === 0) {
  //       return this.renderEmptySection("Courses Still Outstanding");
  //     }

  //     const rowsHTML = csoStudents.map((s, i) => {
  //       const outstandingCourses = s.outstandingCourses || [];

  //       const courseList = this.renderCourseList(outstandingCourses);

  //       return `
  //     <tr>
  //       <td class="numeric">${i + 1}</td>
  //       <td class="text-bold text-left">${s.matricNumber || '-'}</td>
  //       <td class="text-left">${s.name || '-'}</td>
  //       <td class="text-left">${courseList || '-'}</td>
  //     </tr>
  //   `}).join('');

  //     return `
  // <tbody class="force-page-break">
  //   <tr class="section-title-row">
  //     <td class="section-title-cell">
  //       <div class="section-title">Courses Still Outstanding</div>
  //     </td>
  //   </tr>

  //   <tr>
  //     <td>
  //       <table class="data-table table-margin">
  //         <thead>
  //           <tr>
  //             <th>S/No</th>
  //             <th>MATRIC. NO</th>
  //             <th>NAME</th>
  //             <th>OUTSTANDING COURSES/REMARKS</th>
  //           </tr>
  //         </thead>
  //         <tbody>
  //           ${rowsHTML}
  //         </tbody>
  //       </table>
  //     </td>
  //   </tr>
  // </tbody>`;
  //   }
  renderCoursesTillOutstanding(summary, level) {
    const students = summary.studentSummariesByLevel[level] || [];
    const lists = this.buildStudentLists(summary, level);
    const probationList = lists.probationList;
    const probationStudentIds = new Set(
      probationList.map(p => String(p.studentId?.$oid || p.studentId))
    );

    const csoStudents = students.filter(s => {
      const studentId = String(s.studentId?.$oid || s.studentId);
      const hasOutstandingCourses = s.outstandingCourses && s.outstandingCourses.length > 0;
      const isOnProbation = probationStudentIds.has(studentId);
      return hasOutstandingCourses && !isOnProbation;
    });

    if (csoStudents.length === 0) {
      return `
      <div class="table-margin">
        <div class="section-subtitle">COURSES STILL OUTSTANDING</div>
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
          ${this.renderPerPageHeader(summary, level, "COURSES STILL OUTSTANDING", colspan)}
          <tr>
            <th>S/No</th>
            <th>MATRIC. NO</th>
            <th>NAME</th>
            <th>OUTSTANDING COURSES/REMARKS</th>
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

    // console.log("Summary data for MMS2:", students[0]);
    const studentsHTML = students.map((s, i) => `
      <tr>
        <td class="numeric">${i + 1}</td>
        <td class="text-bold text-left">${s.matricNumber || '-'}</td>
        <td class="numeric">${s.currentSemester?.tcp || '-'}</td>
        <td class="numeric">${s.currentSemester?.tnu || '-'}</td>
        <td class="numeric text-bold">${s.currentSemester?.gpa ? s.currentSemester.gpa.toFixed(2) : '-'}</td>
        <td class="numeric">${s.previousPerformance?.cumulativeTCP || '-'}</td>
        <td class="numeric">${s.previousPerformance?.cumulativeTNU || '-'}</td>
        <td class="numeric">${s.previousPerformance?.previousSemesterGPA ? s.previousPerformance.previousSemesterGPA.toFixed(2) : '-'}</td>
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
    const s = summary.summaryOfResultsByLevel[level];
    const showTitle = (type === "both") || (customTitle !== null);
    const titleText = customTitle || "SUMMARY AND SIGNATURES";

    // Build content based on type
    let content = '';
    if (type === "both" || type === "summary") {
      content += this.renderSummaryTable(s);
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
  renderSummaryTable(s) {
    if (!s) {
      return `<div class="no-data table-margin">No summary data available</div>`;
    }

    const stats = s.gpaStatistics || {};
    const passCount = (s.classDistribution?.firstClass || 0) +
      (s.classDistribution?.secondClassUpper || 0) +
      (s.classDistribution?.secondClassLower || 0) +
      (s.classDistribution?.thirdClass || 0);
    const totalStudents = s.totalStudents || 0;
    const passRate = totalStudents > 0 ? (passCount / totalStudents * 100).toFixed(1) : '0.0';

    return `
<table class="data-table no-border table-margin">
  <tbody>
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
      <td class="text-">${s.classDistribution?.thirdClass || 0}</td>
    </tr>
    <tr>
      <td class="text-bold">Fail</td>
      <td class="text-right">${s.classDistribution?.fail || 0}</td>
    </tr>
    <tr class="text-right">
      <td class="text-bold"></td>
      <td class="text-right ">Total = <u>${totalStudents}</u></td>
    </tr>
  </tbody>
</table>`;
  }

  /**
   * Renders only the signature blocks (HOD and Dean)
   */
  renderSignatures(summary) {
    return `
<div class="signatures-container">
  <div class="signature-block">
    <div class="signature-line"></div>
    <div class="signature-name">${summary.departmentDetails.hod.name}</div>
    <!--<div class="signature-title">${config.hod.title}</div>-->
    <div class="signature-title">HOD, ${summary.departmentDetails.name}</div>
  </div>
  <div class="signature-block">
    <div class="signature-line"></div>
    <div class="signature-name">${summary.departmentDetails.dean.name}</div>
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
  <tbody>
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
  renderBackgroundInfo(bgData, data, summary) {
    const confirmationList = bgData?.confirmationList || [];
    const noRegList = bgData?.noRegistrationList || [];
    const leaveNote = bgData?.leaveOfAbsenceNote || '';
    const terminationList = bgData?.terminationList || [];
    const withdrawalData = bgData?.withdrawalData || { note: '', students: [] };

    const {
      recommendationText,
      approveText,
      totalUnits
    } = data;


    let content = `
    <div class="table-margin">
      <div style="padding: 2mm 0;">
    <div style="font-weight: bold; font-size: 12pt; margin-bottom: 1mm;">RECOMMENDATION</div>
    <div style="margin-bottom: 3mm;">${recommendationText}</div>
    <div style="font-weight: bold; font-size: 12pt; margin-bottom: 1mm;">TO APPROVE</div>
    <div>${approveText}</div>
  </div>
      <div class="section-subtitle">BACKGROUND INFORMATION</div>
      <ol class="report-list">
  `;

    // 1. Confirmation of Candidates with Two Names
    content += `
    <li>
      <span style="margin: 2mm 0 1mm 0; font-weight: bold;">
        Confirmation of Candidates with Two Names
      </span>
      <p style="font-size:10pt; margin-bottom:2mm;">
        The following candidates have been confirmed to have two names only.
      </p>
  `;

    if (confirmationList.length > 0) {
      const rows = confirmationList.map((s, i) => `
      <tr>
        <td class="numeric">${i + 1}</td>
        <td class=" text-left">${s.regNo || '-'}</td>
        <td class="text-left">${s.name || '-'}</td>
      </tr>
    `).join('');

      content += `
      <table class="data-table" style="width:auto; min-width:50%;">
        <thead>
          <tr>
            <th>S/N</th>
            <th>MATRIC. NO.</th>
            <th>NAME</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>`;
    } else {
      content += `<p style="margin:2mm 0;">NIL</p>`;
    }

    content += `</li>`;

    // 2. No Registration Information
    content += `
    <li>
      <span style="margin:3mm 0 1mm 0; font-weight:bold;">
        No Registration Information
      </span>
  `;

    if (noRegList.length > 0) {
      const rows = noRegList.map((s, i) => `
      <tr>
        <td class="numeric">${i + 1}</td>
        <td class="text-bold text-left">${s.matricNumber || '-'}</td>
        <td class="text-left">${s.name || '-'}</td>
      </tr>
    `).join('');

      content += `
      <p style="font-size:10pt; margin-bottom:2mm;">
        The following candidates did not register for courses during the ${summary.departmentDetails.academicYear} ${capitalizeFirstLetter(summary.departmentDetails.semester)}  Semester Examinations; hence, they were debited with ${totalUnits} units.
      </p>
      <table class="data-table" style="width:auto; min-width:50%;">
        <thead>
          <tr>
            <th>S/N</th>
            <th>MATRIC. NO.</th>
            <th>NAME</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>`;
    } else {
      content += `<p>NIL</p>`;
    }

    content += `</li>`;

    // 3. Leave of Absence
    content += `
    <li>
      <span style="margin:3mm 0 1mm 0; font-weight:bold;">
        Leave of Absence
      </span>
  `;

    if (leaveNote) {
      content += `<p style="font-size:10pt;">${leaveNote}</p>`;
    } else {
      content += `<p>None</p>`;
    }

    content += `</li>`;

    // 4. Termination of Studentship (new)
    if (terminationList.length > 0) {
      content += `
    <li>
      <span style="margin:3mm 0 1mm 0; font-weight:bold;">
        Termination of Studentship
      </span>
    `;
      if (terminationList.length === 1) {
        // Single student: show explanatory paragraph
        const s = terminationList[0];
        content += `<p style="font-size:10pt;">Termination of studentship for ${s.name} (${s.regNo}) due to academic performance.</p>`;
      } else {
        // Multiple students: show note + list
        content += `<p style="font-size:10pt; margin-bottom:2mm;">The following students have had their studentship terminated:</p>`;
        const rows = terminationList.map((s, i) => `
        <tr>
          <td class="numeric">${i + 1}</td>
          <td class="text-bold text-left">${s.regNo || '-'}</td>
          <td class="text-left">${s.name || '-'}</td>
        </tr>
      `).join('');
        content += `
        <table class="data-table" style="width:auto; min-width:50%;">
          <thead>
            <tr>
              <th>S/N</th>
              <th>MATRIC. NO.</th>
              <th>NAME</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>`;
      }
      content += `</li>`;
    }

    // 5. Withdrawal of Studentship (new)
    if (withdrawalData.students.length > 0) {
      content += `
    <li>
      <span style="margin:3mm 0 1mm 0; font-weight:bold;">
        Withdrawal of Studentship
      </span>
    `;
      const note = withdrawalData.note || 'Withdrawal due to academic reasons.';
      if (withdrawalData.students.length === 1) {
        // Single student: embed student info into note
        const s = withdrawalData.students[0];
        content += `<p style="font-size:10pt;">${note} Student affected: ${s.name} (${s.regNo}).</p>`;
      } else {
        // Multiple students: show note + list
        content += `<p style="font-size:10pt; margin-bottom:2mm;">${note}</p>`;
        const rows = withdrawalData.students.map((s, i) => `
        <tr>
          <td class="numeric">${i + 1}</td>
          <td class="text-bold text-left">${s.regNo || '-'}</td>
          <td class="text-left">${s.name || '-'}</td>
        </tr>
      `).join('');
        content += `
        <table class="data-table" style="width:auto; min-width:50%;">
          <thead>
            <tr>
              <th>S/N</th>
              <th>MATRIC. NO.</th>
              <th>NAME</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>`;
      }
      content += `</li>`;
    }



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