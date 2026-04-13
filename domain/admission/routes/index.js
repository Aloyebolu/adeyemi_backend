import { applicantAdmissionRoutes } from "./admission.routes.js";
import { adminAdmissionRoutes } from "./admissionAdmin.routes.js";
import express from "express";

const combinedRoutes = express.Router();

// Mount both routers
combinedRoutes.use("/applicant", applicantAdmissionRoutes);
combinedRoutes.use("/admin", adminAdmissionRoutes);

export default combinedRoutes;
export {applicantAdmissionRoutes, adminAdmissionRoutes}
