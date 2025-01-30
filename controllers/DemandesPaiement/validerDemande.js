const prisma = new PrismaClient()
const { PrismaClient } = require("@prisma/client");

const validerDemande = async (req, res) => {
    const { demande_id, valideur_id, statut, commentaire } = req.body;

    try {
        const demande = await prisma.demandes_paiement.findUnique({ where: { id: parseInt(demande_id) } });
        if (!demande) return res.status(404).json({ message: "Demande non trouvée." });

        await prisma.validations.create({
            data: { demande_id, valideur_id, role_valideur: 2, statut, commentaire }
        });

        if (statut === "rejeté") {
            await prisma.demandes_paiement.update({ where: { id: demande_id }, data: { statut: "rejeté" } });
        }

        res.status(200).json({ message: `Demande ${statut} avec succès.` });

    } catch (error) {
        res.status(500).json({ message: "Erreur serveur.", error });
    }
};


module.exports = {validerDemande}
