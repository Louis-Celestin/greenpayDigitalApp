// Import des modules nécessaires
const express = require('express');
const { PrismaClient } = require('@prisma/client');
const dotenv = require('dotenv');
const cors = require('cors');
const morgan = require('morgan');
const helmet = require('helmet');
const authRoutes = require('./routes/authRoutes');
// const userRoutes = require('./routes/userRoutes');
const demandeRoutes = require('./routes/demandeRoutes');
const multer = require('multer');

// Configuration de l'environnement
dotenv.config();

// Initialisation de l'application Express
const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());
app.use(morgan('dev'));
app.use(helmet());

// Initialisation de Prisma
const prisma = new PrismaClient();

// Configuration de la base de données Prisma
const setupDatabase = async () => {
    try {
        await prisma.$connect();
        console.log('Connexion à la base de données réussie.');
    } catch (error) {
        console.error('Erreur de connexion à la base de données:', error);
        process.exit(1);
    }
};
setupDatabase();

// Définition des routes
app.use('/api/auth', authRoutes);
// app.use('/api/users', userRoutes);
app.use('/api/demandes', demandeRoutes); // multer sera appliqué dans demandeRoutes.js

// Démarrage du serveur
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Serveur en cours d'exécution sur le port ${PORT}`);
});

// Fermeture propre de Prisma
process.on('SIGINT', async () => {
    await prisma.$disconnect();
    process.exit(0);
});
