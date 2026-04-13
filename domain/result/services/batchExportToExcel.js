import XLSX from "xlsx";
import fs from "fs";
import path from "path";
import { normalizeCourse } from "../../course/course.normallizer.js";
import Result from "../result.model.js";
import programmeModel from "../../programme/programme.model.js";
import { resolveUserName } from "../../../utils/resolveUserName.js";
import SemesterService from "../../semester/semester.service.js";

export async function exportCourseResultsToExcel(semesterId = null) {
    const semester = await SemesterService.getAcademicSemesterById(semesterId)

    const query = { deletedAt: null };

    if (semesterId) {
        query.semester = semesterId;
    }

    const exportFolder = "./domain/result/services/course_result_exports";

    if (!fs.existsSync(exportFolder)) {
        fs.mkdirSync(exportFolder, { recursive: true });
    }

    const programmes = await programmeModel.find({ deletedAt: null }).lean();

    for (const programme of programmes) {

        const results = await Result.find(query)
            .populate({
                path: "studentId",
                select: "programmeId level matricNumber",
                populate: {
                    path: "user",                  // <-- populate the virtual
                    select: "first_name last_name middle_name"
                }
            })
            .populate({
                path: "courseId",
                select: "courseCode unit level borrowedId",
                populate: {
                    path: "borrowedId",
                    select: "courseCode unit level"
                }
            })
            .lean();

        // FILTER BY PROGRAMME AFTER POPULATE
        const filtered = results.filter(
            r =>
                r.studentId &&
                r.studentId.user &&                   // <-- make sure user exists
                r.studentId.programmeId?.toString() === programme._id.toString()
        );

        if (!filtered.length) continue;

        const levelGroups = {};

        // GROUP BY LEVEL
        for (const r of filtered) {
            r.courseId = normalizeCourse(r.courseId);

            const level = r.studentId?.level || r.courseId?.level || "unknown";

            if (!levelGroups[level]) {
                levelGroups[level] = [];
            }

            levelGroups[level].push(r);
        }

        // PROCESS EACH LEVEL
        for (const level in levelGroups) {

            const levelResults = levelGroups[level];

            const students = {};
            const courses = {};

            for (const r of levelResults) {

                const studentId = r.studentId._id.toString();
                const courseCode = r.courseId?.courseCode;
                const courseId = r.courseId?._id?.toString();

                if (!courseCode) continue;

                if (!courses[courseCode]) {
                    courses[courseCode] = courseId;
                }

                if (!students[studentId]) {

                    const s = r.studentId;
                    const user = s.user;

                    students[studentId] = {
                        matric_number: s.matricNumber,
                        name: resolveUserName(user)
                    };
                }

                students[studentId][courseCode] = r.score;
            }

            const courseCodes = Object.keys(courses);

            const headerRow = [
                "Matric Number",
                "Name",
                ...courseCodes
            ];

            const courseIdRow = [
                "",
                "",
                ...courseCodes.map(c => courses[c])
            ];

            const studentRows = [];

            for (const studentId in students) {

                const s = students[studentId];

                const row = [
                    s.matric_number,
                    s.name,
                    ...courseCodes.map(code => s[code] ?? "")
                ];

                studentRows.push(row);
            }

            const sheetData = [
                headerRow,
                courseIdRow,
                ...studentRows
            ];

            const worksheet = XLSX.utils.aoa_to_sheet(sheetData);

            const workbook = XLSX.utils.book_new();

            XLSX.utils.book_append_sheet(workbook, worksheet, "Results");

            const programmeName = programme.programmeType.replace(/\s+/g, "_");
            const session = semester.session.replace(/\//g, "-");

            const filePath = path.join(
                exportFolder,
                `${programmeName}_level_${level}_${semester.name}_${session}.xlsx`
            );

            XLSX.writeFile(workbook, filePath);

            console.log(`Exported ${programme.programmeType} Level ${level} → ${filePath}`);
        }
    }
}