const { PrismaClient } = require("@prisma/client");
const cloudinary = require("../../config/cloudinaryConfig");
const { envoyerEmail } = require("../../config/emailConfig");
const prisma = new PrismaClient();
const jwt = require("jsonwebtoken");
require("dotenv").config();
const path = require("path")
const { generateDemandePaiementPDF } = require("../../utils/pdf")
const { telechargerFichier } = require("../../config/telechargerFiles")

/**
 * ✅ Fonction pour uploader plusieurs fichiers sur Cloudinary
 */
const uploadToCloudinary = async (files) => {
  const uploadPromises = files.map(
    (file) =>
      new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          { folder: "paiements" },
          (error, result) => {
            if (error) reject(error);
            else resolve(result.secure_url);
          }
        );
        stream.end(file.buffer);
      })
  );

  return await Promise.all(uploadPromises);
};

/**
 * ✅ Effectuer un paiement (Seul le Responsable Entité Financière - DAF)
 */
// const effectuerPaiement = async (req, res) => {
//     const { demande_id } = req.params;
//     let { moyen_paiement } = req.body;
//     const word = req.headers.authorization;
//     const token = word.slice(7, -1);
//     const utilisateurs = jwt.decode(token);

//     const utilisateur = await prisma.utilisateurs.findUnique({
//         where: { id: parseInt(utilisateurs.userId) },
//         include: { agents: true },
//     });

//     try {
//         if (!utilisateur || utilisateur.agents.fonction !== "Responsable Entité Financière") {
//             return res.status(403).json({
//                 message: "Accès refusé. Seul le Responsable Entité Financière peut effectuer un paiement.",
//             });
//         }

//         const demande = await prisma.demandes_paiement.findUnique({
//             where: { id: parseInt(demande_id) },
//             include: { proformas: true },
//         });

//         if (!demande) return res.status(404).json({ message: "Demande non trouvée." });

//         if (demande.statut !== "validation_entite_finance") {
//             return res.status(400).json({
//                 message: "La demande doit être approuvée avant d'effectuer le paiement.",
//             });
//         }

//         let fichiersPreuve = [];
//         if (req.files && req.files.length > 0) {
//             fichiersPreuve = await uploadToCloudinary(req.files);
//         }

//         const paiement = await prisma.paiements.create({
//             data: {
//                 demande_id: parseInt(demande_id),
//                 moyen_paiement,
//                 fichiers_paiement: fichiersPreuve.length > 0 ? JSON.stringify(fichiersPreuve) : null,
//             },
//         });

//         await prisma.demandes_paiement.update({
//             where: { id: parseInt(demande_id) },
//             data: { statut: "paye" },
//         });

//         // ✅ Générer le PDF de la demande de paiement
//         const outputPath = path.join(__dirname, `../../public/pdfs/demande_paiement_${demande_id}.pdf`);
//         await generateDemandePaiementPDF(demande, outputPath);
//         console.log("📄 PDF généré :", outputPath);

//         // ✅ Récupérer toutes les pièces jointes (proforma + preuves de paiement)
//         let attachments = [{ filename: `demande_paiement_${demande_id}.pdf`, path: outputPath }];
        
//         if (demande.proformas.length > 0) {
//             demande.proformas.forEach(proforma => {
//                 attachments.push({ filename: "proforma.pdf", path: proforma.fichier });
//             });
//         }

//         if (fichiersPreuve.length > 0) {
//             fichiersPreuve.forEach((fichier, index) => {
//                 attachments.push({ filename: `preuve_paiement_${index + 1}.pdf`, path: fichier });
//             });
//         }

//         // ✅ Récupérer l'agent demandeur et ses responsables
//         const agent = await prisma.agents.findUnique({
//             where: { id: demande.agent_id },
//             include: {
//                 utilisateurs: true,
//                 agents: { // Superieur hiérarchique direct
//                     include: { utilisateurs: true }
//                 },
//                 sections: { // Responsable de section
//                     include: {
//                         agents: {
//                             where: { fonction: "Responsable de section" },
//                             include: { utilisateurs: true }
//                         }
//                     }
//                 },
//                 entites: { // Responsable d'entité
//                     include: {
//                         agents: {
//                             where: { fonction: "Responsable d'entité" },
//                             include: { utilisateurs: true }
//                         }
//                     }
//                 }
//             },
//         });

//         if (!agent || !agent.utilisateurs) {
//             return res.status(404).json({ message: "L'agent demandeur n'a pas été trouvé." });
//         }

//         // 📌 Liste des e-mails en copie (CC)
//         let ccEmails = [];

//         if (agent.agents && agent.agents.utilisateurs) {
//             ccEmails.push(agent.agents.utilisateurs.email); // Supérieur direct
//         }
//         if (agent.sections?.agents?.[0]?.utilisateurs?.email) {
//             ccEmails.push(agent.sections.agents[0].utilisateurs.email); // Responsable de section
//         }
//         if (agent.entites?.agents?.[0]?.utilisateurs?.email) {
//             ccEmails.push(agent.entites.agents[0].utilisateurs.email); // Responsable d'entité
//         }

//         console.log("📧 CC Emails :", ccEmails);

//         // ✅ Envoyer l'e-mail avec copies aux responsables
//         const sujet = `💰 Paiement effectué - Demande #${demande.id}`;
//         const message = `
//             <p>Bonjour ${agent.nom},</p>
//             <p>Votre demande de paiement a été traitée et payée.</p>
//             <p><strong>Moyen de paiement :</strong> ${moyen_paiement}</p>
//             <p>Vous trouverez en pièce jointe les documents relatifs à cette transaction.</p>
//             <p>Cordialement,</p>
//             <p>GreenPay CI</p>`;

//         await envoyerEmail(agent.utilisateurs.email, sujet, message, attachments, ccEmails);

//         res.status(201).json({ message: "✅ Paiement enregistré avec succès.", paiement });
//     } catch (error) {
//         console.error(error);
//         res.status(500).json({ message: "❌ Erreur serveur.", error });
//     }
// };

const effectuerPaiement = async (req, res) => {
    const { demande_id } = req.params;
    let { moyen_paiement } = req.body;
    const word = req.headers.authorization;
    const token = word.slice(7, -1);
    console.log(token);
    const utilisateurs = jwt.decode(token);

    const utilisateur = await prisma.utilisateurs.findUnique({
        where: { id: parseInt(utilisateurs.userId) },
        include: { agents: true },
    });

    try {
        if (!utilisateur || utilisateur.agents.fonction !== "Responsable Entité Financière") {
            return res.status(403).json({
                message: "Accès refusé. Seul le Responsable Entité Financière peut effectuer un paiement.",
            });
        }

        const demande = await prisma.demandes_paiement.findUnique({
            where: { id: parseInt(demande_id) },
        });

        if (!demande) return res.status(404).json({ message: "Demande non trouvée." });

        if (demande.statut !== "validation_entite_finance") {
            return res.status(400).json({
                message: "La demande doit être approuvée avant d'effectuer le paiement.",
            });
        }

        let fichiersPreuve = [];
        if (req.files && req.files.length > 0) {
            fichiersPreuve = await uploadToCloudinary(req.files);
        }

        const paiement = await prisma.paiements.create({
            data: {
                demande_id: parseInt(demande_id),
                moyen_paiement,
                fichiers_paiement: fichiersPreuve.length > 0 ? JSON.stringify(fichiersPreuve) : null,
            },
        });

        await prisma.demandes_paiement.update({
            where: { id: parseInt(demande_id) },
            data: { statut: "paye" },
        });

        // ✅ Générer le PDF de la demande de paiement
        const outputPath = path.join(__dirname, `../../public/pdfs/demande_paiement_${demande_id}.pdf`);
        await generateDemandePaiementPDF(demande, outputPath);
        console.log("📄 PDF généré :", outputPath);

        // ✅ Récupérer l'agent et ses responsables
        const agent = await prisma.agents.findUnique({
            where: { id: demande.agent_id },
            include: { utilisateurs: true },
        });

        let responsablesEmails = [];
        if (agent.superieur_id) {
            const superieur = await prisma.utilisateurs.findFirst({
                where: { agent_id: agent.superieur_id },
            });
            if (superieur) {
                responsablesEmails.push(superieur.email);
            }
        }

        // ✅ Récupérer tous les fichiers (preuve de paiement + proforma)
        const proforma = await prisma.proformas.findFirst({
            where: { demande_id: parseInt(demande_id) },
        });

        // ✅ Télécharger les fichiers localement avant de les envoyer
        const fichiersAttaches = [];

        // 📌 Ajouter le PDF de la demande de paiement
        fichiersAttaches.push({
            filename: `Demande_Paiement_${demande_id}.pdf`,
            path: outputPath,
        });

        // 📌 Ajouter les preuves de paiement
        if (paiement && paiement.fichiers_paiement) {
            const fichiersPaiement = JSON.parse(paiement.fichiers_paiement);
            for (let i = 0; i < fichiersPaiement.length; i++) {
                const filePath = await telechargerFichier(fichiersPaiement[i]); // Télécharge le fichier
                fichiersAttaches.push({
                    filename: `Preuve_Paiement_${i + 1}.jpg`, // Modifier l'extension selon le fichier
                    path: filePath,
                });
            }
        }

        // 📌 Ajouter la proforma si elle existe
        if (proforma) {
            const proformaPath = await telechargerFichier(proforma.fichier); // Télécharge le fichier
            fichiersAttaches.push({
                filename: `Proforma_${demande_id}.jpg`, // Modifier l'extension selon le fichier
                path: proformaPath,
            });
        }

        // ✅ Envoi de l'email avec les pièces jointes
        const sujet = `💰 Paiement effectué - Demande #${demande.id}`;
        const message = `
            <p>Bonjour ${agent.nom},</p>
            <p>Votre demande de paiement a été traitée et payée.</p>
            <p><strong>Moyen de paiement :</strong> ${moyen_paiement}</p>
            <p>Vous trouverez ci-joint :</p>
            <ul>
                <li>📄 La demande de paiement</li>
                ${paiement.fichiers_paiement ? "<li>📄 Les preuves de paiement</li>" : ""}
                ${proforma ? "<li>📄 La proforma</li>" : ""}
            </ul>
            <p>Cordialement,</p>
            <p>GreenPay CI</p>`;

        await envoyerEmail(
            [agent.utilisateurs.email, ...responsablesEmails], 
            sujet, 
            message, 
            fichiersAttaches
        );

        res.status(201).json({ message: "✅ Paiement enregistré avec succès.", paiement });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "❌ Erreur serveur.", error });
    }
};
  
/**
 * ✅ Modifier un paiement (Seul le DAF)
 */

const modifierPaiement = async (req, res) => {
  const { paiement_id } = req.params;
  const { moyen_paiement } = req.body;
  const utilisateur = req.user;

  try {
    if (
      !utilisateur ||
      utilisateur.agents.fonction !== "Responsable Entité Financière"
    ) {
      return res
        .status(403)
        .json({
          message:
            "Accès refusé. Seul le Responsable Entité Financière peut modifier un paiement.",
        });
    }

    const paiement = await prisma.paiements.update({
      where: { id: parseInt(paiement_id) },
      data: { moyen_paiement },
    });

    res
      .status(200)
      .json({ message: "✅ Paiement mis à jour avec succès.", paiement });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "❌ Erreur serveur.", error });
  }
};

/**
 * ✅ Supprimer un paiement (Soft Delete - Seul le DAF)
 */
const supprimerPaiement = async (req, res) => {
  const { paiement_id } = req.params;
  const utilisateur = req.user;

  try {
    if (
      !utilisateur ||
      utilisateur.agents.fonction !== "Responsable Entité Financière"
    ) {
      return res
        .status(403)
        .json({
          message:
            "Accès refusé. Seul le Responsable Entité Financière peut annuler un paiement.",
        });
    }

    await prisma.paiements.update({
      where: { id: parseInt(paiement_id) },
      data: { deleted_at: new Date() },
    });

    res
      .status(200)
      .json({ message: "✅ Paiement annulé avec succès (soft delete)." });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "❌ Erreur serveur.", error });
  }
};

/**
 * ✅ Récupérer tous les paiements visibles par l'utilisateur
 */
const getPaiements = async (req, res) => {
  const word = req.headers.authorization;
  const token = word.slice(7, -1);
  console.log(token);
  const utilisateur = jwt.decode(token);
  console.log(utilisateur);
  const utilisateurs = await prisma.utilisateurs.findUnique({
    where: { id: parseInt(utilisateur.userId) },
    include: { agents: true },
  });
  try {
    if (!utilisateurs || !utilisateurs.agents.entite_id) {
      return res
        .status(403)
        .json({ message: "Accès refusé. Vous ne pouvez voir aucun paiement." });
    } else if (
      utilisateurs.agents.fonction == "Responsable Entité Financière"
    ) {
      const paiements = await prisma.paiements.findMany({
        where: {
          demandes_paiement: { statut: "paye" },
        },
        include: {
          demandes_paiement: {
            include: {
              agents: true,
              validations: {
                include: { utilisateurs: { include: { agents: true } } },
              },
            },
          },
        },
      });

      paiements.forEach((p) => {
        p.fichiers_paiement = p.fichiers_paiement
          ? JSON.parse(p.fichiers_paiement)
          : [];
      });

      res.status(200).json(paiements);
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "❌ Erreur serveur.", error });
  }
};

/**
 * ✅ Récupérer un paiement d'une demande spécifique
 */
const getPaiementByDemande = async (req, res) => {
  const { demande_id } = req.params;

  try {
    const paiement = await prisma.paiements.findFirst({
      where: { demande_id: parseInt(demande_id), deleted_at: null },
    });

    if (!paiement)
      return res
        .status(404)
        .json({ message: "❌ Aucun paiement trouvé pour cette demande." });

    paiement.fichiers_paiement = paiement.fichiers_paiement
      ? JSON.parse(paiement.fichiers_paiement)
      : [];

    res.status(200).json(paiement);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "❌ Erreur serveur.", error });
  }
};

/**
 * ✅ Récupérer un paiement d'une demande spécifique
 */
const getDemandePaiementByDaf = async (req, res) => {
  const { validateur_id } = req.params;

  const user = await prisma.utilisateurs.findUnique({
    where: {
      id: parseInt(validateur_id),
    },
  });

  if (!user) {
    return res.status(404).json({ message: "Utilisateur non trouvé" });
  } else {
    await prisma.validations
      .findMany({
        where: {
          valideur_id: parseInt(user.id),
        },
        include: { demandes_paiement: true },
        orderBy: { date_validation: "desc" },
      })
      .then((results) => {
        if (results.length) {
          return res.status(200).json(results);
        } else {
          return res
            .status(404)
            .json({
              message: "Aucune validation trouvée pour cet utilisateur",
            });
        }
      })
      .catch((err) => {
        console.table(err);
      });
  }
};

module.exports = {
  effectuerPaiement,
  modifierPaiement,
  supprimerPaiement,
  getPaiements,
  getPaiementByDemande,
  getDemandePaiementByDaf,
};
