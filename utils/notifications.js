const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient()


const envoyerNotification = async (utilisateur_id, demande_id, message) => {
    try {
        // Récupérer l'email de l'utilisateur concerné
        const utilisateur = await prisma.utilisateurs.findUnique({
            where: { id: utilisateur_id },
            select: { email: true }
        });

        if (!utilisateur) {
            console.warn("❌ Utilisateur non trouvé pour la notification.");
            return;
        }

        // Envoyer l'email
        const sujet = `Nouvelle Notification - Demande de Paiement #${demande_id}`;
        await envoyerEmail(utilisateur.email, sujet, message);
    } catch (error) {
        console.error("❌ Erreur lors de l'envoi de la notification par email :", error);
    }
};

module.exports = { envoyerNotification };




