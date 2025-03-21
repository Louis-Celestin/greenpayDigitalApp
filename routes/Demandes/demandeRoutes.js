const express = require("express");
const multer = require("multer");
const {
    creerDemandePaiement,
    modifierDemandePaiement,
    supprimerDemandePaiement,
    getDemandesPaiement,
    getDemandePaiementById,
    demandesCountByUser,
    demandesCountByResponsableSection,
    demandesCountByRef,
    demandesCountByReg,
    demandesCountByResponsableEntite
} = require("../../controllers/DemandesPaiement/demandePaiement");
const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

// ✅ Route pour créer une demande de paiement
router.post("/createDemandePaiement", upload.single("proforma"), creerDemandePaiement);

// ✅ Route pour modifier une demande de paiement
router.put("/modifyDemandePaiement/:demande_id", upload.single("proforma"), modifierDemandePaiement);

// ✅ Route pour supprimer une demande de paiement (soft delete)
router.delete("/deleteDemandePaiement/:demande_id", supprimerDemandePaiement);

// ✅ Route pour récupérer toutes les demandes de paiement
router.get("/getDemandePaiement", getDemandesPaiement);

// ✅ Route pour récupérer une demande spécifique
router.get("/getDemandePaiementById/:demande_id", getDemandePaiementById);

// ✅ Route pour les stats
router.get("/stats/Agent", demandesCountByUser);
router.get("/stats/Section", demandesCountByResponsableSection);
router.get("/stats/Ref", demandesCountByRef);
router.get("/stats/Reg", demandesCountByReg);
router.get("/stats/Re", demandesCountByResponsableEntite);

module.exports = router;
