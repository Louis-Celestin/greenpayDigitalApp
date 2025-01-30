const {prisma} = require("@prisma/client")
const agentRegister = async (req, res) => {
    try {
        const { nom, fonction_id, departement_id, direction_id, superieur_id } = req.body;

        // Vérifier si l'agent existe déjà
        const existingAgent = await prisma.agents.findFirst({ where: { nom } });
        if (existingAgent) return res.status(400).json({ message: "Cet agent existe déjà." });

        // Création de l'agent
        const agent = await prisma.agents.create({
            data: {
                nom,
                fonction_id,
                departement_id,
                direction_id,
                superieur_id
            }
        });

        res.status(201).json({ message: "Agent enregistré avec succès.", agent });
    } catch (error) {
        res.status(500).json({ message: "Erreur serveur.", error });
    }
};

module.exports = { agentRegister };
