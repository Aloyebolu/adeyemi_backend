/**
 * Delete Registry Configuration
 * Defines models and their dependencies for safe deletion operations.
 * Any change to model schemas affecting relationships MUST be reflected here.
 */

export const deleteRegistry = {
  course: {
    model: "Course",
    dependencies: [
      // {
      //   model: "Enrollment",
      //   foreignKey: "courseId",
      //   severity: "block"
      // },
      {
        model: "Course",
        foreignKey: "borrowedId",
      },
      {
        model: "Resultf",
        foreignKey: "courseId",
        severity: "block" 
      }
    ]
  },

  Student: {
    model: "Student",
    dependencies: [
      {
        model: "Enrollment",
        foreignKey: "studentId",
        severity: "block"
      }
    ]
  }
};