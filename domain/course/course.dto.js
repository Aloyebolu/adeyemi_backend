import { resolveUserName } from "#utils/resolveUserName.js";

export const mapResults = (input) => {
    // Condider making sure to send document that has course.borrowedId well populated for borrowed courses and then call the normalizeCourse functino to normalize the course
    // Normalize to array
    const docs = Array.isArray(input) ? input : [input];

    const mapped = docs.map((doc) => ({
        student_id: doc.student._id,
        name: resolveUserName(doc.user),
        level: doc.student.level,
        matric_no: doc.student.matricNumber,
        department: doc.department.name,

        _id: doc.result?._id,
        course_id: doc.course?._id,
        code: doc.course?.code,
        title: doc.course?.title,

        score: doc.result?.score ?? null,
        grade: doc.result?.grade ?? null,
        remark: doc.result?.remark ?? null,

        is_uploaded: !!doc.result,
    }));

    // Return single object if input was single
    return Array.isArray(input) ? mapped : mapped[0];
};