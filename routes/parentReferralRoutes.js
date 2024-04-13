import express from "express";
import { updateParentReferralArray } from "../controller/parentReferralController.js";


//router object
const router = express.Router();  

// GET ALL USERS || GET
router.get("/parentReferralUpdate/:id", updateParentReferralArray);
// router.post("/parentReferralUpdate", updateParentReferralArray);
// router.get("/parentReferralUpdate", updateParentReferralArrayFunc);

export default router;
