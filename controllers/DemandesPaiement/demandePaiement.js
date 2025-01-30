const { PrismaClient } = require("@prisma/client");
const cloudinary = require("../../config/cloudinaryConfig");
const prisma = new PrismaClient()

// Demande de paiement
const creerDemandePaiement = async (req, res) => {
    const { agent_id, montant, motif, moyen_paiement_id, requiert_proforma } = req.body;
    console.log(req.body)
    try {
        // Vérifier si l'agent existe
        const agent = await prisma.agents.findUnique({ where: { id: parseInt(agent_id) } });
        if (!agent) return res.status(404).json({ message: "Agent non trouvé." });

        // Vérifier si le moyen de paiement est valide
        const moyenPaiement = await prisma.moyens_paiement.findUnique({ where: { id: parseInt(moyen_paiement_id) } });
        if (!moyenPaiement) return res.status(400).json({ message: "Moyen de paiement invalide." });

        let proformaUrl = null;
        // Gestion de la proforma si nécessaire
        if (requiert_proforma === "true") {
            if (!req.file) return res.status(400).json({ message: "Une proforma est requise." });
            const result = await cloudinary.uploader.upload(req.file.path, { folder: "proformas" });
            proformaUrl = result.secure_url;
        }

        // Transaction Prisma pour assurer la cohérence des données
        const transactionResult = await prisma.$transaction(async (tx) => {
            const demande = await tx.demandes_paiement.create({
                data: {
                    agent_id: parseInt(agent_id),
                    montant: parseFloat(montant),
                    motif,
                    moyen_paiement_id: parseInt(moyen_paiement_id),
                    statut: "en_attente",
                    requiert_proforma: requiert_proforma
                }
            });
            // console.log(typeof requiert_proforma)
            if (requiert_proforma === "true") {
                await tx.proformas.create({ data: { demande_id: demande.id, fichier: proformaUrl } });
            }

            return demande;
        });

        res.status(201).json({ message: "Demande créée avec succès.", demande: transactionResult });

    } catch (error) {
        console.log(error)
        res.status(500).json({ message: "Erreur serveur.", error });
    }
};

module.exports = { creerDemandePaiement };
