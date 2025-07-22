const express = require("express");
const multer = require("multer");
const { uploadFile } = require("../../controllers/Upload/cloudinaryController");
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
    demandesCountByResponsableEntite,
    getAllDemandesPaiement
} = require("../../controllers/DemandesPaiement/demandePaiement");
const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

// ✅ Route pour créer une demande de paiement
router.post("/createDemandePaiement", upload.single("proforma"), creerDemandePaiement);

// ✅ Route pour uploader de fichier
router.post("/upload", upload.single("file"), uploadFile);

// ✅ Route pour modifier une demande de paiement
router.put("/modifyDemandePaiement/:demande_id",upload.any(), modifierDemandePaiement);

// ✅ Route pour supprimer une demande de paiement (soft delete)
router.delete("/deleteDemandePaiement/:demande_id", supprimerDemandePaiement);

// ✅ Route pour récupérer toutes les demandes de paiement
router.get("/getDemandePaiement", getDemandesPaiement);

// ✅ Route pour récupérer toutes les demandes de paiement
router.get("/getAllDemandePaiement", getAllDemandesPaiement);


// ✅ Route pour récupérer une demande spécifique
router.get("/getDemandePaiementById/:demande_id", getDemandePaiementById);

// ✅ Route pour les stats
router.get("/stats/Agent", demandesCountByUser);
router.get("/stats/Section", demandesCountByResponsableSection);
router.get("/stats/Ref", demandesCountByRef);
router.get("/stats/Reg", demandesCountByReg);
router.get("/stats/Re", demandesCountByResponsableEntite);

module.exports = router;
