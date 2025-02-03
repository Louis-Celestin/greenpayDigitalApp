const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient()



const envoyerNotification = async (utilisateur_id, demande_id, message) => {

    console.log("Les données pour envoyer")
    console.log(utilisateur_id,demande_id,message)
    try {
        await prisma.notifications.create({
            data: {
                utilisateur_id,
                demande_id,
                message
            }
        });
    } catch (error) {
        console.error("Erreur lors de l'envoi de la notification:", error);
    }
};


module.exports = {envoyerNotification}



