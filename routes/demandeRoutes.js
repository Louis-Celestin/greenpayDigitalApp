const express = require("express");
const { creerDemandePaiement } = require("../controllers/DemandesPaiement/demandePaiement");
const multer = require("multer");
const router = express.Router()
const upload = multer({Storage:multer.memoryStorage()})


router.post("/demandePaiement",upload.single("proforma"),creerDemandePaiement)


module.exports = router