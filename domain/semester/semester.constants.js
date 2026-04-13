export const defaultLevelSettings = [
    { level: 100, minUnits: 12, maxUnits: 24 },
    { level: 200, minUnits: 12, maxUnits: 24 },
    { level: 300, minUnits: 12, maxUnits: 24 },
    { level: 400, minUnits: 12, maxUnits: 24 }
];
export const registrationDeadline = () => {
    const deadline = new Date();
    deadline.setDate(deadline.getMonth() + 1); // Default to 7 days from now
    return deadline;
}
export const lateRegistrationDate = () => {
    const lateDate = new Date();
    lateDate.setMonth(lateDate.getMonth() + 1);
    return lateDate;
}
