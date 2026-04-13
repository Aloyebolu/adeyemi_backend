export function normalizeCourse(course) {
    if (Array.isArray(course)) {
        return course.map(normalizeCourse);
    }
    if (!course) return course;

    const base = course.borrowedId;

    return {
        ...course,

        // copy academic fields from base if missing
        courseCode: course?.courseCode ?? base?.courseCode,
        code: course?.courseCode ?? base?.courseCode,
        title: course?.title ?? base?.title,
        description: course?.description ?? base?.description,
        unit: course?.unit ?? base?.unit,
        level: course?.level ?? base?.level,
        semester: course?.semester ?? base?.semester,
        type: course?.type ?? base?.type,
        elective_category: course?.elective_category ?? base?.elective_category,
        lecture_hours: course?.lecture_hours ?? base?.lecture_hours,
        practical_hours: course?.practical_hours ?? base?.practical_hours,

        // IMPORTANT: revert borrowedId back to ObjectId only
        borrowedId: base?._id,
    };
    return normalized
}

export function normalizeCourses(courses) {
    return courses.map(normalizeCourse);
}

export const isBorrowedDoc = (course) => {
    return (
        course?.borrowedId &&
        typeof course.borrowedId === "object" &&
        course.borrowedId._id
    );
};