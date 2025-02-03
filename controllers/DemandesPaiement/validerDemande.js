const { PrismaClient } = require("@prisma/client");
const { envoyerNotification } = require("../../utils/notifications");
const prisma = new PrismaClient();

const validerDemande = async (req, res) => {
    const { demande_id, valideur_id, statut, commentaire } = req.body;

    try {
        // Vérifier si la demande existe
        const demande = await prisma.demandes_paiement.findUnique({
            where: { id: parseInt(demande_id) },
            include: { agent: true } // Pour récupérer l'agent demandeur
        });

        if (!demande) return res.status(404).json({ message: "Demande non trouvée." });

        // Vérifier si le valideur est un utilisateur existant
        const valideur = await prisma.utilisateurs.findUnique({
            where: { id: parseInt(valideur_id) },
            include: { agent: true } // Récupérer l'agent lié au valideur
        });

        if (!valideur) return res.status(403).json({ message: "Validateur non autorisé." });

        let nouveauStatut = demande.statut;
        let prochainValidateur = null;

        // Déterminer le prochain statut
        if (statut === "approuvé") {
            switch (demande.statut) {
                case "validation_superieur_hierarchique":
                    nouveauStatut = "validation_directeur_hierarchique";
                    prochainValidateur = await prisma.agents.findFirst({
                        where: { direction_id: demande.agent.direction_id },
                        include: { utilisateur: true }
                    });
                    break;
                case "validation_directeur_hierarchique":
                    nouveauStatut = "validation_DG";
                    prochainValidateur = await prisma.agents.findFirst({
                        where: { fonction_id: 3 }, // DG
                        include: { utilisateur: true }
                    });
                    break;
                case "validation_DG":
                    nouveauStatut = "validation_DAF";
                    prochainValidateur = await prisma.agents.findFirst({
                        where: { fonction_id: 4 }, // DAF
                        include: { utilisateur: true }
                    });
                    break;
                case "validation_DAF":
                    nouveauStatut = "payé"; // Dernière étape
                    break;
                default:
                    return res.status(400).json({ message: "Statut de demande invalide." });
            }
        } else if (statut === "rejeté") {
            nouveauStatut = "rejeté";
        }

        // Enregistrer la validation
        await prisma.validations.create({
            data: {
                demande_id: parseInt(demande_id),
                valideur_id: parseInt(valideur_id),
                role_valideur: valideur.agent.fonction_id, // Stocker le rôle du valideur
                statut,
                commentaire
            }
        });

        // Mettre à jour le statut de la demande
        await prisma.demandes_paiement.update({
            where: { id: parseInt(demande_id) },
            data: { statut: nouveauStatut }
        });

        // Envoyer une notification au prochain validateur ou au demandeur si rejeté
        if (statut === "rejeté") {
            await envoyerNotification(demande.agent.utilisateur_id, demande.id, `Votre demande #${demande.id} a été rejetée.`);
        } else if (prochainValidateur) {
            await envoyerNotification(prochainValidateur.utilisateur.id, demande.id, "Une demande de paiement est en attente de votre validation.");
        }

        res.status(200).json({ message: `Demande ${statut} avec succès.`, nouveauStatut });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Erreur serveur.", error });
    }
};

module.exports = { validerDemande };
