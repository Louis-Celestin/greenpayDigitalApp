const express = require("express");
const { creerDemandePaiement } = require("../controllers/DemandesPaiement/demandePaiement");
const router = express.Router()



router.post("/demandePaiement",creerDemandePaiement)


module.exports = router