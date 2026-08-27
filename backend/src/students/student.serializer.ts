import { Student } from "../database/models/student.model.js";

const submissionFields = (submissions: any[] = []) => Object.fromEntries(
  Array.from({ length: 7 }, (_, index) => {
    const number = index + 1;
    const match = submissions.find((item) => item.submissionNumber === number);
    return [`submission${number}`, match?.fileName || "NA"];
  }),
);

export const serializeStudent = (model: Student) => {
  const value: any = model.get({ plain: true });
  const { id, password, passwordResetToken, passwordResetExpires, submissions, approvalState, accountType, dateOfRegistration, dateOfLastSubmission, websiteUrl, ...safe } = value;
  return {
    _id: id,
    ...safe,
    state: approvalState,
    kind: accountType === "registered" ? "Registered" : "Prospective",
    DOR: dateOfRegistration,
    dateofLastSubmission: dateOfLastSubmission,
    URLtoWebsite: websiteUrl,
    ...submissionFields(submissions),
  };
};
