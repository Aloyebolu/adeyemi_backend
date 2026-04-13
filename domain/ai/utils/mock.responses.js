// src/modules/ai/utils/mock.responses.js

export const MOCK_RESPONSES = {
    general: "I'll help you with that. Let me process your request...",

    student_search: `I found 3 students matching your search:

| # | Name | Matric Number | Department |
|---|------|---------------|------------|
| 1 | Damilola Michael | CS2023/001 | Computer Science |
| 2 | Brandon Damilola | ENG2023/045 | Engineering |
| 3 | Daniel Damilola | BUS2023/023 | Business Administration |

Please specify which student you'd like to work with.`,

    student_terminated: `✅ **Student Terminated Successfully**

**Name:** Daniel Damilola
**Matric:** BUS2023/023
**Department:** Business Administration
**Terminated At:** ${new Date().toLocaleString()}

The student has been removed from the system and can no longer access the portal.

What would you like to do next?`,

    analysis_complete: `📊 **Analysis Complete**

**Key Insights:**
- Computer Science department has the highest enrollment (342 students)
- Student retention rate is 94% overall
- Performance drops by 15% in second semester courses

**Recommendations:**
1. Increase support for second semester courses
2. Implement peer tutoring program
3. Schedule early intervention meetings for at-risk students`,
};

export const MOCK_QUERIES = {
    searchStudentsByName: {
        collection: 'User',
        operation: 'aggregate', // use aggregate instead of find to handle populate + projection
        pipeline: [
            // Match students by name
            {
                $match: {
                    role: 'student',
                    $or: [
                        { first_name: { $regex: new RegExp('damilola', 'i') } },
                        { last_name: { $regex: new RegExp('damilola', 'i') } },
                    ],
                },
            },
            // Lookup the student document linked by _id
            {
                $lookup: {
                    from: 'students',           // Student collection
                    localField: '_id',          // User _id
                    foreignField: '_id',     // Student.userId
                    as: 'studentData',
                },
            },
            // Unwind the array to get single student document
            { $unwind: { path: '$studentData', preserveNullAndEmptyArrays: true } },
            // Lookup the department name from departmentId
            {
                $lookup: {
                    from: 'departments',         // Department collection
                    localField: 'studentData.departmentId',
                    foreignField: '_id',
                    as: 'departmentData',
                },
            },
            { $unwind: { path: '$departmentData', preserveNullAndEmptyArrays: true } },
            // Project the fields you want
            {
                $project: {
                    first_name: 1,
                    last_name: 1,
                    email: 1,
                    matricNo: 1,
                    department: '$departmentData.name', // Map department name
                },
            },
            // Limit results
            { $limit: 10 },
        ],
    },

    studentsByDepartment: {
        collection: 'User',
        operation: 'find',
        query: {
            role: 'student',
            department: { $regex: new RegExp('computer science', 'i') },
        },
        projection: {
            first_name: 1,
            last_name: 1,
            email: 1,
            matricNo: 1,
        },
        limit: 100,
    },

    listLecturers: {
        collection: 'User',
        operation: 'find',
        query: {
            role: { $in: ['lecturer', 'hod', 'dean'] },
        },
        projection: {
            first_name: 1,
            last_name: 1,
            email: 1,
            staffId: 1,
            department: 1,
        },
        limit: 50,
    },

    default: {
        collection: 'User',
        operation: 'find',
        query: {},
        limit: 100,
    },
};

export const MOCK_ACTIONS = {
    terminateStudent: {
        endpoint: '/api/students/terminate',
        method: 'POST',
        payload: {
            student_id: 'mock_student_id',
            reason: 'Terminated by admin',
        },
        description: 'Terminate student',
        confirmation: {
            required: true,
            message: 'This action will permanently remove the student from the system. This cannot be undone.',
        },
    },

    updateStudent: {
        endpoint: '/api/students/update',
        method: 'PUT',
        payload: {
            student_id: 'mock_student_id',
            updates: {},
        },
        description: 'Update student information',
        confirmation: {
            required: false,
        },
    },

    default: {
        endpoint: '/api/actions/execute',
        method: 'POST',
        payload: {},
        description: 'Execute action',
        confirmation: {
            required: true,
            message: 'Please confirm this action.',
        },
    },
};

export const getMockResponse = (key, replacements = {}) => {
    let response = MOCK_RESPONSES[key] || MOCK_RESPONSES.general;

    Object.entries(replacements).forEach(([key, value]) => {
        response = response.replace(new RegExp(`{{${key}}}`, 'g'), value);
    });

    return response;
};