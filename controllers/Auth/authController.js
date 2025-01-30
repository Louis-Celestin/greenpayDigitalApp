const bcryptjs = require("bcryptjs")
require("dotenv").config
const {PrismaClient} = require("@prisma/client")
const  jwt = require("jsonwebtoken")

const prisma = new PrismaClient()

// Enregistrement d'un utilisateur
const userRegister = async (req, res) => { 
    try {
        const { email, mot_de_passe, agent_id, role_id } = req.body;
        // console.log(req.body)
        // Vérifier si l'email est déjà utilisé
        const existingUser = await prisma.utilisateurs.findUnique({ where: { email } });
        if (existingUser) return res.status(400).json({ message: "Cet email est déjà utilisé." });

        // Vérifier si l'agent existe
        const agent = await prisma.agents.findUnique({ where: { id: Number(agent_id) } });
        if (!agent) return res.status(404).json({ message: "Agent non trouvé." });

        // Hachage du mot de passe
        const hashedPassword = await bcryptjs.hash(mot_de_passe, 10);

        // Création de l'utilisateur
        const utilisateur = await prisma.utilisateurs.create({
            data: {
                email,
                mot_de_passe: hashedPassword,
                agent_id: Number(agent_id)
            }
        });

        // Assigner un rôle à l'utilisateur
        await prisma.utilisateur_roles.create({
            data: {
                utilisateur_id: utilisateur.id,
                role_id : Number(role_id)
            }
        });

        res.status(201).json({ message: "Utilisateur enregistré avec succès.", utilisateur });
    } catch (error) {
        console.log(error)
        res.status(500).json({ message: "Erreur serveur.", error });
    }
}

// Fonction de connexion
const userLogin = async (req, res) => {
    try {
        const { email, mot_de_passe } = req.body;

        // Vérification de l'utilisateur
        const utilisateur = await prisma.utilisateurs.findUnique({ where: { email },include:{agents:true} });
        if (!utilisateur) return res.status(400).json({ message: 'Identifiants incorrects' });

        // Vérification du mot de passe
        const isMatch = await bcryptjs.compare(mot_de_passe, utilisateur.mot_de_passe);
        if (!isMatch) return res.status(400).json({ message: 'Identifiants incorrects' });

        // Récupération du rôle de l'utilisateur
        const roles = await prisma.utilisateur_roles.findMany({
            where: { utilisateur_id: Number(utilisateur.id) },
            include: { roles: true }
        });

        // Création du token
        const token = jwt.sign(
            { id: utilisateur.id, roles: roles.map(r => r.roles.nom) },
            process.env.JWT_SECRET,
            { expiresIn: '1d' }
        );
        const role = roles.map(role=>role.roles.nom)
        res.json({ message: 'Connexion réussie', token, role, utilisateur });
    } catch (error) {
        console.log(error)
        res.status(500).json({ message: 'Erreur serveur', error });
    }
};

// Fonction de réinitialisation du mot de passe
const userResetPassword = async (req, res) => {
    try {
        const { email, newPassword } = req.body;

        const utilisateur = await prisma.utilisateurs.findUnique({ where: { email } });
        if (!utilisateur) return res.status(400).json({ message: 'Utilisateur non trouvé' });

        const hashedPassword = await bcryptjs.hash(newPassword, 10);

        await prisma.utilisateurs.update({
            where: { email },
            data: { mot_de_passe: hashedPassword },
        });

        res.json({ message: 'Mot de passe réinitialisé avec succès' });
    } catch (error) {
        res.status(500).json({ message: 'Erreur serveur', error });
    }
};





module.exports = { userRegister, userLogin , userResetPassword}
