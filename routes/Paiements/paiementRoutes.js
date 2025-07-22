const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs")
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const {generateDemandePaiementPDF} =  require("../../utils/pdf")
const { 
    effectuerPaiement,
    getPaiementByDemande 
} = require("../../controllers/Paiements/paiementController");

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

// ✅ Effectuer un paiement (avec preuve)
router.post("/effectuerPaiement/:demande_id", upload.array("preuvesPaiement"), effectuerPaiement);

// // ✅ Modifier un paiement
// router.put("/:paiement_id", modifierPaiement);

// // ✅ Supprimer un paiement (soft delete)
// router.delete("/:paiement_id", supprimerPaiement);

// // ✅ Récupérer tous les paiements
// router.get("/", getPaiements);

// // ✅ Récupérer un paiement d’une demande spécifique
router.get("/:demande_id", getPaiementByDemande);


router.get("/download-pdf/:demande_id", async (req, res) => {
    try {
        const { demande_id } = req.params;

        // ✅ Vérification de l'ID de la demande
        if (!demande_id || isNaN(demande_id)) {
            return res.status(400).json({ message: "ID de demande invalide." });
        }

        console.log(`🔍 Récupération de la demande #${demande_id}`);

        // 🔹 Récupération de la demande de paiement avec les relations nécessaires
        const demande = await prisma.demandes_paiement.findUnique({
            where: { id: parseInt(demande_id) },
            include: {
                agents: true,
                validations: { include: { utilisateurs: true } },
                paiements: true,
            },
        });

        if (!demande) {
            console.error("❌ Demande non trouvée.");
            return res.status(404).json({ message: "Demande introuvable." });
        }

        const nbMentionSection = await prisma.validations.findFirst({
            where : {
                demande_id : parseInt(demande.id),
                utilisateurs : {
                    email : "sidoine@greenpayci.com"
                }
            },
            select : {commentaire : true}
        })
        if (nbMentionSection === null) {
            demande.nbMentionSection = "";
        }else{
            demande.nbMentionSection = nbMentionSection.commentaire
        }

        // console.log(demande)
        // console.log(demande)

        // 🔹 Chemin sécurisé du fichier PDF
        const outputPath = path.resolve(__dirname, `../../public/pdfs/demande_paiement_${demande_id}.pdf`);
        console.log(`📄 Génération du PDF : ${outputPath}`);

        // ✅ Génération du PDF
        await generateDemandePaiementPDF(demande, outputPath);

        // 🔹 Vérification que le fichier a bien été créé
        if (!fs.existsSync(outputPath)) {
            console.error("❌ Le fichier PDF n'a pas été généré !");
            return res.status(500).json({ message: "Erreur lors de la génération du PDF." });
        }

        console.log(`✅ PDF généré avec succès : ${outputPath}`);

        // 🔹 Envoi du fichier au client
        res.download(outputPath, `demande_paiement_${demande_id}.pdf`, (err) => {
            if (err) {
                console.error("❌ Erreur lors du téléchargement du PDF :", err);
                return res.status(500).json({ message: "Erreur lors du téléchargement du fichier." });
            }
        });
    } catch (error) {
        console.error("❌ Erreur serveur :", error);
        res.status(500).json({ message: "Erreur serveur.", error });
    }
});
  

module.exports = router;

