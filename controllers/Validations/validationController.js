const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const { envoyerEmail } = require("../../config/emailConfig");

/**
 * ✅ Déterminer le prochain validateur
 */
// const determinerProchainValidateur = async (demande) => {
//   let prochainStatut = demande.statut;
//   let prochainValidateur = null;

//   switch (demande.statut) {
//     case "validation_section":
//       prochainStatut = "validation_entite";
//       prochainValidateur = await prisma.agents.findFirst({
//         where: {
//           entite_id: demande.agents.entite_id,
//           fonction: { contains: "Responsable Entité" },
//         },
//       });
//       break;

//     case "validation_entite":
//       prochainStatut = "validation_entite_generale";
//       prochainValidateur = await prisma.agents.findFirst({
//         where: { fonction: { contains: "Responsable Entité Générale" } },
//       });
//       break;

//       case "validation_entite_generale":
//         prochainStatut = "validation_entite_finance";
//         prochainValidateur = await prisma.agents.findFirst({
//           where: { fonction: { contains: "Responsable Entité Financière" } },
//         });
//         break;

//     default:
//       return { prochainStatut: null, prochainValidateur: null };
//   }

//   // 📌 Cas Exceptionnels
//   if (demande.agents.fonction.includes("Responsable Entité Générale")) {
//     prochainStatut = "validation_entite_finance";
//     prochainValidateur = await prisma.agents.findFirst({
//       where: { fonction: "Responsable Entité Financière" },
//     });
//   }

//   if (demande.agents.fonction.includes("Responsable Entité Financière")) {
//     prochainStatut = "validation_entite_generale";
//     prochainValidateur = await prisma.agents.findFirst({
//       where: { fonction: "Responsable Entité Générale" },
//     });
//   }

//   return { prochainStatut, prochainValidateur };
// };


// const determinerProchainValidateur = async (demande) => {
//   let prochainStatut = demande.statut;
//   let prochainValidateur = null;

//   switch (demande.statut) {
//     case "validation_section":
//       prochainStatut = "validation_entite";
//       prochainValidateur = await prisma.agents.findFirst({
//         where: {
//           entite_id: demande.agents.entite_id,
//           fonction: { contains: "Responsable Entité" },
//         },
//       });
//       break;

//     case "validation_entite":
//       prochainStatut = "validation_entite_generale";
//       prochainValidateur = await prisma.agents.findFirst({
//         where: { fonction: { contains: "Responsable Entité Générale" } },
//       });
//       break;

//     case "validation_entite_generale":
//       prochainStatut = "validation_entite_finance";
//       prochainValidateur = await prisma.agents.findFirst({
//         where: { fonction: { contains: "Responsable Entité Financière" } },
//       });
//       break;

//     default:
//       return { prochainStatut: null, prochainValidateur: null };
//   }

//   // 📌 Cas exceptionnel : si un REG fait la demande, elle va directement en paiement
//   if (demande.agents.fonction.includes("Responsable Entité Générale")) {
//     prochainStatut = "en_attente_paiement";
//     prochainValidateur = null; // Pas besoin de validation supplémentaire
//   }

//   // 📌 Cas exceptionnel : si un REF (DAF) fait la demande, elle doit être validée par le REG
//   if (demande.agents.fonction.includes("Responsable Entité Financière")) {
//     prochainStatut = "validation_entite_generale"; // La demande va d'abord chez le REG
//     prochainValidateur = await prisma.agents.findFirst({
//       where: { fonction: "Responsable Entité Générale" },
//     });
//   }

//   return { prochainStatut, prochainValidateur };
// };

// /**
//  * ✅ Valider une demande de paiement et notifier le prochain validateur
//  */
// // const validerDemande = async (req, res) => {
// //     const { demande_id } = req.params;
// //     let { valideur_id, statut, commentaire } = req.body;

// //     try {
// //         console.log(`DEBUG: Validation de la demande ${demande_id} par le valideur ${valideur_id}`);

// //         const demande = await prisma.demandes_paiement.findUnique({
// //             where: { id: parseInt(demande_id) },
// //             include: { agents: true },
// //         });

// //         if (!demande) {
// //             return res.status(404).json({ message: "Demande non trouvée." });
// //         }

// //         const valideur = await prisma.utilisateurs.findUnique({
// //             where: { id: Number(valideur_id) },
// //             include: { agents: true },
// //         });

// //         if (!valideur) {
// //             return res.status(403).json({ message: "Validateur non autorisé." });
// //         }

// //         if (!["approuve", "rejete"].includes(statut)) {
// //             return res.status(400).json({ message: "Statut invalide. Utilisez 'approuve' ou 'rejete'." });
// //         }

// //         let { prochainStatut, prochainValidateur } = await determinerProchainValidateur(demande);

// //         if (statut === "rejete") {
// //             prochainStatut = "rejete";
// //         }

// //         await prisma.validations.create({
// //             data: {
// //                 demande_id: Number(demande_id),
// //                 valideur_id: Number(valideur_id),
// //                 statut,
// //                 commentaire,
// //             },
// //         });

// //         await prisma.demandes_paiement.update({
// //             where: { id: Number(demande_id) },
// //             data: { statut: prochainStatut },
// //         });

// //         // 🔹 Notifier par email
// //         if (statut === "approuve" && prochainValidateur) {
// //             const utilisateurValidateur = await prisma.utilisateurs.findFirst({
// //                 where: { agent_id: prochainValidateur.id },
// //                 include: { agents: true },
// //             });

// //             if (utilisateurValidateur) {
// //                 console.log(`🟢 Email envoyé à ${utilisateurValidateur.email}`);

// //                 // 🔗 URL de validation
// //                 const validationURL = `https://app.greenpayci.com/valider/${demande.id}`;

// //                 const sujet = `🔔 Nouvelle validation requise pour la demande #${demande.id}`;
// //                 const message = `
// //                     <p>Bonjour ${utilisateurValidateur.agents.nom},</p>
// //                     <p>Une demande de paiement a été approuvée et est en attente de votre validation.</p>
// //                     <p><strong>Montant :</strong> ${demande.montant} FCFA</p>
// //                     <p><strong>Motif :</strong> ${demande.motif}</p>
// //                     <p>Validez-la en cliquant ci-dessous :</p>
// //                     <p style="text-align: center;">
// //                         <a href="${validationURL}"
// //                             style="background-color: #28a745; color: white; padding: 10px 20px; text-decoration: none; font-weight: bold; border-radius: 5px;">
// //                             ✅ Valider la demande
// //                         </a>
// //                     </p>
// //                     <p>Ou copiez ce lien dans votre navigateur :</p>
// //                     <p>${validationURL}</p>
// //                     <p>Merci,</p>
// //                     <p>GreenPay CI</p>`;

// //                 await envoyerEmail(utilisateurValidateur.email, sujet, message);
// //             }
// //         }

// //         if (statut === "rejete") {
// //             const utilisateurDemandeur = await prisma.utilisateurs.findFirst({
// //                 where: { agent_id: demande.agent_id },
// //                 include: { agents: true },
// //             });

// //             if (utilisateurDemandeur) {
// //                 console.log(`🔴 Email de rejet envoyé à ${utilisateurDemandeur.email}`);

// //                 const sujet = `Votre demande de paiement #${demande.id} a été rejetée`;
// //                 const message = `
// //                     <p>Bonjour ${utilisateurDemandeur.agents.nom},</p>
// //                     <p>Votre demande de paiement a été rejetée par ${valideur.agents.nom}.</p>
// //                     <p><strong>Motif :</strong> ${demande.motif}</p>
// //                     <p><strong>Commentaire :</strong> ${commentaire}</p>
// //                     <p>Merci de contacter votre supérieur pour plus d’informations.</p>
// //                     <p>Cordialement,</p>
// //                     <p>GreenPay CI</p>`;

// //                 await envoyerEmail(utilisateurDemandeur.email, sujet, message);
// //             }
// //         }

// //         res.status(200).json({ message: `Demande ${statut} avec succès.`, prochainStatut });
// //     } catch (error) {
// //         console.error("❌ ERREUR: ", error);
// //         res.status(500).json({ message: "Erreur serveur.", error });
// //     }
// // };

// // const validerDemande = async (req, res) => {
// //   const { demande_id } = req.params;
// //   let { valideur_id, statut, commentaire, payerMaintenant } = req.body; // Ajout du choix pour le DAF

// //   try {
// //     console.log(
// //       `DEBUG: Validation de la demande ${demande_id} par le valideur ${valideur_id}`
// //     );

// //     const demande = await prisma.demandes_paiement.findUnique({
// //       where: { id: parseInt(demande_id) },
// //       include: { agents: true },
// //     });

// //     if (!demande) {
// //       return res.status(404).json({ message: "Demande non trouvée." });
// //     }

// //     const valideur = await prisma.utilisateurs.findUnique({
// //       where: { id: Number(valideur_id) },
// //       include: { agents: true },
// //     });

// //     if (!valideur) {
// //       return res.status(403).json({ message: "Validateur non autorisé." });
// //     }

// //     if (!["approuve", "rejete"].includes(statut)) {
// //       return res
// //         .status(400)
// //         .json({ message: "Statut invalide. Utilisez 'approuve' ou 'rejete'." });
// //     }

// //     let { prochainStatut, prochainValidateur } =
// //       await determinerProchainValidateur(demande);

// //     if (statut === "rejete") {
// //       prochainStatut = "rejete";
// //     }

// //     // 🔹 Vérifier si le valideur est le DAF et décider du paiement
// //     if (
// //       valideur.agents.fonction === "Responsable Entité Financière" &&
// //       statut === "approuve"
// //     ) {
// //       if (payerMaintenant) {
// //         prochainStatut = "paye"; // ✅ Paiement immédiat
// //       } else {
// //         prochainStatut = "en_attente_paiement"; // ✅ Paiement différé
// //       }
// //     }

// //     await prisma.validations.create({
// //       data: {
// //         demande_id: Number(demande_id),
// //         valideur_id: Number(valideur_id),
// //         statut,
// //         commentaire,
// //       },
// //     });

// //     await prisma.demandes_paiement.update({
// //       where: { id: Number(demande_id) },
// //       data: { statut: prochainStatut },
// //     });

// //     // 🔹 Notifier par email si la demande est approuvée et a un validateur suivant
// //     if (statut === "approuve" && prochainValidateur) {
// //       const utilisateurValidateur = await prisma.utilisateurs.findFirst({
// //         where: { agent_id: prochainValidateur.id },
// //         include: { agents: true },
// //       });

// //       if (utilisateurValidateur) {
// //         console.log(`🟢 Email envoyé à ${utilisateurValidateur.email}`);

// //         const validationURL = `https://app.greenpayci.com/valider/${demande.id}`;

// //         const sujet = `🔔 Nouvelle validation requise pour la demande #${demande.id}`;
// //         const message = `
// //                     <p>Bonjour ${utilisateurValidateur.agents.nom},</p>
// //                     <p>Une demande de paiement a été approuvée et est en attente de votre validation.</p>
// //                     <p><strong>Montant :</strong> ${demande.montant} FCFA</p>
// //                     <p><strong>Motif :</strong> ${demande.motif}</p>
// //                     <p>Validez-la en cliquant ci-dessous :</p>
// //                     <p style="text-align: center;">
// //                         <a href="${validationURL}" 
// //                             style="background-color: #28a745; color: white; padding: 10px 20px; text-decoration: none; font-weight: bold; border-radius: 5px;">
// //                             ✅ Valider la demande
// //                         </a>
// //                     </p>
// //                     <p>Ou copiez ce lien dans votre navigateur :</p>
// //                     <p>${validationURL}</p>
// //                     <p>Merci,</p>
// //                     <p>GreenPay CI</p>`;

// //         await envoyerEmail(utilisateurValidateur.email, sujet, message);
// //       }
// //     }

// //     // 🔹 Notifier le demandeur si la demande est rejetée
// //     if (statut === "rejete") {
// //       const utilisateurDemandeur = await prisma.utilisateurs.findFirst({
// //         where: { agent_id: demande.agent_id },
// //         include: { agents: true },
// //       });

// //       if (utilisateurDemandeur) {
// //         console.log(`🔴 Email de rejet envoyé à ${utilisateurDemandeur.email}`);

// //         const sujet = `Votre demande de paiement #${demande.id} a été rejetée`;
// //         const message = `
// //                     <p>Bonjour ${utilisateurDemandeur.agents.nom},</p>
// //                     <p>Votre demande de paiement a été rejetée par ${valideur.agents.nom}.</p>
// //                     <p><strong>Motif :</strong> ${demande.motif}</p>
// //                     <p><strong>Commentaire :</strong> ${commentaire}</p>
// //                     <p>Merci de contacter votre supérieur pour plus d’informations.</p>
// //                     <p>Cordialement,</p>
// //                     <p>GreenPay CI</p>`;

// //         await envoyerEmail(utilisateurDemandeur.email, sujet, message);
// //       }
// //     }

// //     res
// //       .status(200)
// //       .json({ message: `Demande ${statut} avec succès.`, prochainStatut });
// //   } catch (error) {
// //     console.error("❌ ERREUR: ", error);
// //     res.status(500).json({ message: "Erreur serveur.", error });
// //   }
// // };

// const validerDemande = async (req, res) => {
//   const { demande_id } = req.params;
//   let { valideur_id, statut, commentaire, payerMaintenant } = req.body;

//   try {
//     console.log(
//       `DEBUG: Validation de la demande ${demande_id} par le valideur ${valideur_id}`
//     );

//     const demande = await prisma.demandes_paiement.findUnique({
//       where: { id: parseInt(demande_id) },
//       include: { agents: true },
//     });

//     if (!demande) {
//       return res.status(404).json({ message: "Demande non trouvée." });
//     }

//     const valideur = await prisma.utilisateurs.findUnique({
//       where: { id: Number(valideur_id) },
//       include: { agents: true },
//     });

//     if (!valideur) {
//       return res.status(403).json({ message: "Validateur non autorisé." });
//     }

//     if (!["approuve", "rejete"].includes(statut)) {
//       return res.status(400).json({ message: "Statut invalide. Utilisez 'approuve' ou 'rejete'." });
//     }

//     let { prochainStatut, prochainValidateur } = await determinerProchainValidateur(demande);

//     if (statut === "rejete") {
//       prochainStatut = "rejete";
//     }

//     // 🔹 Vérifier si le valideur est le REF (DAF) et décider du paiement
//     if (
//       valideur.agents.fonction === "Responsable Entité Financière" &&
//       statut === "approuve"
//     ) {
//       prochainStatut = payerMaintenant ? "paye" : "en_attente_paiement";
//     }

//     await prisma.validations.create({
//       data: {
//         demande_id: Number(demande_id),
//         valideur_id: Number(valideur_id),
//         statut,
//         commentaire,
//       },
//     });

//     await prisma.demandes_paiement.update({
//       where: { id: Number(demande_id) },
//       data: { statut: prochainStatut },
//     });

//     // 🔹 Notifications par email
//     if (statut === "approuve" && prochainValidateur) {
//       const utilisateurValidateur = await prisma.utilisateurs.findFirst({
//         where: { agent_id: prochainValidateur.id },
//         include: { agents: true },
//       });

//       if (utilisateurValidateur) {
//         console.log(`🟢 Email envoyé à ${utilisateurValidateur.email}`);

//         const validationURL = `https://app.greenpayci.com/valider/${demande.id}`;

//         const sujet = `🔔 Nouvelle validation requise pour la demande #${demande.id}`;
//         const message = `
//                     <p>Bonjour ${utilisateurValidateur.agents.nom},</p>
//                     <p>Une demande de paiement a été approuvée et est en attente de votre validation.</p>
//                     <p><strong>Montant :</strong> ${demande.montant} FCFA</p>
//                     <p><strong>Motif :</strong> ${demande.motif}</p>
//                     <p>Validez-la en cliquant ci-dessous :</p>
//                     <p><a href="${validationURL}">✅ Valider la demande</a></p>
//                     <p>Merci,</p>
//                     <p>GreenPay CI</p>`;

//         await envoyerEmail(utilisateurValidateur.email, sujet, message);
//       }
//     }

//     res.status(200).json({ message: `Demande ${statut} avec succès.`, prochainStatut });
//   } catch (error) {
//     console.error("❌ ERREUR: ", error);
//     res.status(500).json({ message: "Erreur serveur.", error });
//   }
// };

// /**
//  * ✅ Récupérer les demandes en attente de validation pour un utilisateur
//  */
// const getDemandesEnAttente = async (req, res) => {
//   const { validateur_id } = req.params;

//   try {
//     // Vérifier si l'utilisateur existe et récupérer ses informations
//     const utilisateur = await prisma.utilisateurs.findUnique({
//       where: { id: Number(validateur_id) },
//       include: { agents: true },
//     });

//     if (!utilisateur)
//       return res.status(404).json({ message: "Utilisateur non trouvé." });

//     // Déterminer le statut correspondant au rôle du validateur
//     let statutRequis = null;
//     if (utilisateur.agents.fonction.includes("Responsable de section")) {
//       statutRequis = "validation_section";
//     } else if (utilisateur.agents.fonction.includes("Responsable d'entité")) {
//       statutRequis = "validation_entite";
//     } else if (
//       utilisateur.agents.fonction.includes("Responsable Entité Générale")
//     ) {
//       statutRequis = "validation_entite_generale";
//     } else if (
//       utilisateur.agents.fonction.includes("Responsable Entité Financière")
//     ) {
//       statutRequis = "validation_entite_finance";
//     } else {
//       return res.status(403).json({ message: "Vous n'êtes pas validateur." });
//     }

//     if (statutRequis == "validation_entite_generale") {
//       const demandes = await prisma.demandes_paiement.findMany({
//         where: {
//           statut: statutRequis,
//         },
//       });
//       return res.status(200).json({ demandes });
//     }
//      if (statutRequis == "validation_entite_finance") {
//       const demandes = await prisma.demandes_paiement.findMany({
//         where: {
//           statut: statutRequis,
//         },
//       });
//       return res.status(200).json({ demandes });
//     } else {
//       const demandes = await prisma.demandes_paiement.findMany({
//         where: {
//           statut: statutRequis,
//           agents: {
//             OR: [
//               { entite_id: utilisateur.agents.entite_id },
//               { section_id: utilisateur.agents.section_id },
//             ],
//           },
//         },
//         include: {
//           agents: true,
//           validations: true,
//         },
//         orderBy: { date_creation: "desc" },
//       });
//       return res.status(200).json({ demandes });
//     }
//     // Récupérer les demandes uniquement pour ce validateur
//   } catch (error) {
//     console.error(
//       "❌ Erreur lors de la récupération des demandes en attente :",
//       error
//     );
//     res.status(500).json({ message: "Erreur serveur." });
//   }
// };


// const determinerProchainValidateur = async (demande) => {
//   let prochainStatut = demande.statut;
//   let prochainValidateur = null;

//   switch (demande.statut) {
//     case "validation_section":
//       prochainStatut = "validation_entite";
//       prochainValidateur = await prisma.agents.findFirst({
//         where: {
//           entite_id: demande.agents.entite_id,
//           fonction: { contains: "Responsable Entité" },
//         },
//       });
//       break;

//     case "validation_entite":
//       prochainStatut = "validation_entite_generale";
//       prochainValidateur = await prisma.agents.findFirst({
//         where: { fonction: { contains: "Responsable Entité Générale" } },
//       });
//       break;

//     case "validation_entite_generale":
//       prochainStatut = "validation_entite_finance";
//       prochainValidateur = await prisma.agents.findFirst({
//         where: { fonction: { contains: "Responsable Entité Financière" } },
//       });
//       break;

//     default:
//       return { prochainStatut: null, prochainValidateur: null };
//   }

//   // ✅ Cas exceptionnel : si un REG fait la demande, elle passe directement en paiement
//   if (demande.agents.fonction.includes("Responsable Entité Générale")) {
//     prochainStatut = "en_attente_paiement";
//     prochainValidateur = null;
//   }

//   // ✅ Cas exceptionnel : si un REF (DAF) fait la demande, elle est validée par le REG
//   if (demande.agents.fonction.includes("Responsable Entité Financière")) {
//     prochainStatut = "validation_entite_generale";
//     prochainValidateur = await prisma.agents.findFirst({
//       where: { fonction: "Responsable Entité Générale" },
//     });
//   }

//   return { prochainStatut, prochainValidateur };
// };


// const determinerProchainValidateur = async (demande) => {
//   let prochainStatut = demande.statut;
//   let prochainValidateur = null;

//   switch (demande.statut) {
//     case "validation_section":
//       prochainStatut = "validation_entite";
//       prochainValidateur = await prisma.agents.findFirst({
//         where: {
//           entite_id: demande.agents.entite_id,
//           fonction: { contains: "Responsable Entité" },
//         },
//       });
//       break;

//     case "validation_entite":
//       prochainStatut = "validation_entite_generale";
//       prochainValidateur = await prisma.agents.findFirst({
//         where: { fonction: { contains: "Responsable Entité Générale" } },
//       });
//       break;

//     case "validation_entite_generale":
//       prochainStatut = "validation_entite_finance";
//       prochainValidateur = await prisma.agents.findFirst({
//         where: { fonction: { contains: "Responsable Entité Financière" } },
//       });
//       break;

//     default:
//       return { prochainStatut: null, prochainValidateur: null };
//   }

//   // ✅ Cas particulier : Si le demandeur est un REG, la demande passe directement en attente de paiement.
//   if (demande.agents.fonction.includes("Responsable Entité Générale")) {
//     prochainStatut = "en_attente_paiement";
//     prochainValidateur = null;
//   }

//   // ✅ Cas particulier : Si le demandeur est un REF (DAF), la demande doit être validée par le REG avant paiement.
//   if (demande.agents.fonction.includes("Responsable Entité Financière")) {
//     prochainStatut = "validation_entite_generale"; // D'abord chez le REG
//     prochainValidateur = await prisma.agents.findFirst({
//       where: { fonction: "Responsable Entité Générale" },
//     });
//   }

//   return { prochainStatut, prochainValidateur };
// };

const determinerProchainValidateur = async (demande) => {
  let prochainStatut = demande.statut;
  let prochainValidateur = null;

  switch (demande.statut) {
    case "validation_section":
      prochainStatut = "validation_entite";
      prochainValidateur = await prisma.agents.findFirst({
        where: {
          entite_id: demande.agents.entite_id,
          fonction: { contains: "Responsable Entité" },
        },
      });
      break;

    case "validation_entite":
      prochainStatut = "validation_entite_generale";
      prochainValidateur = await prisma.agents.findFirst({
        where: { fonction: { contains: "Responsable Entité Générale" } },
      });
      break;

    case "validation_entite_generale":
      // ✅ Correction ici : Si la demande vient du REF, elle passe en validation_entite_finance après validation du REG
      if (demande.agents.fonction.includes("Responsable Entité Financière")) {
        prochainStatut = "validation_entite_finance"; // Passe maintenant au REF pour paiement
        prochainValidateur = await prisma.agents.findFirst({
          where: { fonction: "Responsable Entité Financière" },
        });
      } else {
        prochainStatut = "validation_entite_finance";
        prochainValidateur = await prisma.agents.findFirst({
          where: { fonction: { contains: "Responsable Entité Financière" } },
        });
      }
      break;

    default:
      return { prochainStatut: null, prochainValidateur: null };
  }

  // ✅ Cas particulier : Si le demandeur est un REG, la demande passe directement en attente de paiement.
  if (demande.agents.fonction.includes("Responsable Entité Générale")) {
    prochainStatut = "en_attente_paiement";
    prochainValidateur = null;
  }

  // ✅ Cas particulier : Si le demandeur est un REF (DAF), la demande doit être validée par le REG avant paiement.
  if (demande.agents.fonction.includes("Responsable Entité Financière") && demande.statut !== "validation_entite_generale") {
    prochainStatut = "validation_entite_generale"; // D'abord chez le REG
    prochainValidateur = await prisma.agents.findFirst({
      where: { fonction: "Responsable Entité Générale" },
    });
  }

  return { prochainStatut, prochainValidateur };
};


/**
 * ✅ Valider une demande de paiement et notifier le prochain validateur
 */
// const validerDemande = async (req, res) => {
//   const { demande_id } = req.params;
//   let { valideur_id, statut, commentaire, payerMaintenant } = req.body;

//   try {
//     console.log(
//       `DEBUG: Validation de la demande ${demande_id} par le valideur ${valideur_id}`
//     );

//     const demande = await prisma.demandes_paiement.findUnique({
//       where: { id: parseInt(demande_id) },
//       include: { agents: true },
//     });

//     if (!demande) {
//       return res.status(404).json({ message: "Demande non trouvée." });
//     }

//     const valideur = await prisma.utilisateurs.findUnique({
//       where: { id: Number(valideur_id) },
//       include: { agents: true },
//     });

//     if (!valideur) {
//       return res.status(403).json({ message: "Validateur non autorisé." });
//     }

//     if (!["approuve", "rejete"].includes(statut)) {
//       return res.status(400).json({ message: "Statut invalide. Utilisez 'approuve' ou 'rejete'." });
//     }

//     let { prochainStatut, prochainValidateur } = await determinerProchainValidateur(demande);

//     if (statut === "rejete") {
//       prochainStatut = "rejete";
//     }

//     // ✅ Vérification pour le REF (DAF) : Payer immédiatement ou différer
//     if (
//       valideur.agents.fonction === "Responsable Entité Financière" &&
//       statut === "approuve"
//     ) {
//       prochainStatut = payerMaintenant ? "paye" : "en_attente_paiement";
//     }

//     await prisma.validations.create({
//       data: {
//         demande_id: Number(demande_id),
//         valideur_id: Number(valideur_id),
//         statut,
//         commentaire,
//       },
//     });

//     await prisma.demandes_paiement.update({
//       where: { id: Number(demande_id) },
//       data: { statut: prochainStatut },
//     });

//     // ✅ Notifications par email
//     if (statut === "approuve" && prochainValidateur) {
//       const utilisateurValidateur = await prisma.utilisateurs.findFirst({
//         where: { agent_id: prochainValidateur.id },
//         include: { agents: true },
//       });

//       if (utilisateurValidateur) {
//         console.log(`🟢 Email envoyé à ${utilisateurValidateur.email}`);

//         const validationURL = `https://app.greenpayci.com/valider/${demande.id}`;

//         const sujet = `🔔 Nouvelle validation requise pour la demande #${demande.id}`;
//         const message = `
//                     <p>Bonjour ${utilisateurValidateur.agents.nom},</p>
//                     <p>Une demande de paiement a été approuvée et est en attente de votre validation.</p>
//                     <p><strong>Montant :</strong> ${demande.montant} FCFA</p>
//                     <p><strong>Motif :</strong> ${demande.motif}</p>
//                     <p><a href="${validationURL}">✅ Valider la demande</a></p>
//                     <p>Merci,</p>
//                     <p>GreenPay CI</p>`;

//         await envoyerEmail(utilisateurValidateur.email, sujet, message);
//       }
//     }

//     res.status(200).json({ message: `Demande ${statut} avec succès.`, prochainStatut });
//   } catch (error) {
//     console.error("❌ ERREUR: ", error);
//     res.status(500).json({ message: "Erreur serveur.", error });
//   }
// };

const validerDemande = async (req, res) => {
  const { demande_id } = req.params;
  let { valideur_id, statut, commentaire, payerMaintenant } = req.body;

  try {
    console.log(`DEBUG: Validation de la demande ${demande_id} par ${valideur_id}`);

    const demande = await prisma.demandes_paiement.findUnique({
      where: { id: parseInt(demande_id) },
      include: { agents: {
        include : {utilisateurs : true}
      } },
    });

    if (!demande) {
      return res.status(404).json({ message: "Demande non trouvée." });
    }

    const valideur = await prisma.utilisateurs.findUnique({
      where: { id: Number(valideur_id) },
      include: { agents: true },
    });

    if (!valideur) {
      return res.status(403).json({ message: "Validateur non autorisé." });
    }

    if (!["approuve", "rejete"].includes(statut)) { // ✅ Suppression de "en_attente_paiement"
      return res.status(400).json({ message: "Statut invalide. Utilisez 'approuve' ou 'rejete'." });
    }

    let { prochainStatut, prochainValidateur } = await determinerProchainValidateur(demande);

    if (statut === "rejete") {
      prochainStatut = "rejete";
    }

    // ✅ Vérification si le valideur est le REF (DAF) et doit payer
    if (valideur.agents.fonction === "Responsable Entité Financière" && statut === "approuve") {
      prochainStatut = payerMaintenant ? "paye" : "en_attente_paiement"; // ✅ Correction ici
    }

    // ✅ On enregistre "approuve" ou "rejete" dans la table `validations`
    await prisma.validations.create({
      data: {
        demande_id: Number(demande_id),
        valideur_id: Number(valideur_id),
        statut, // ✅ Seuls "approuve" ou "rejete" sont acceptés ici
        commentaire,
      },
    });

    // ✅ On met à jour la table `demandes_paiement` avec le statut correct
    await prisma.demandes_paiement.update({
      where: { id: Number(demande_id) },
      data: { statut: prochainStatut }, // ✅ Mise à jour correcte du statut dans `demandes_paiement`
    });

    // ✅ Notification par email au prochain validateur
    if (statut === "approuve" && prochainValidateur) {
      const utilisateurValidateur = await prisma.utilisateurs.findFirst({
        where: { agent_id: prochainValidateur.id },
        include: { agents: true},
      });

      if (utilisateurValidateur) {
        console.log(`🟢 Email envoyé à ${utilisateurValidateur.email}`);

        const validationURL = `https://app.greenpayci.com/valider/${demande.id}`;

        const sujet = `🔔 Nouvelle validation requise pour la demande #${demande.id}`;
        const message = `
          <p>Bonjour ${utilisateurValidateur.agents.nom},</p>
          <p>Une demande de paiement a été approuvée et est en attente de votre validation.</p>
          <p><strong>Montant :</strong> ${demande.montant} FCFA</p>
          <p><strong>Motif :</strong> ${demande.motif}</p>
          <p><a href="${validationURL}">✅ Valider la demande</a></p>
          <p>Merci,</p>
          <p>GreenPay CI</p>`;

        await envoyerEmail(utilisateurValidateur.email, sujet, message);
      }
    }
    // ✅ Notification par email au DEMANDEUR si la demande est rejetée
    if (statut === "rejete" && demande.agents.utilisateurs.email) {
      console.log(`🟢 Email de rejet envoyé à ${demande.agents.utilisateurs.email}`);

      const sujetRejet = `🚨 Votre demande de paiement #${demande.id} a été rejetée`;
      const messageRejet = `
        <p>Bonjour ${demande.agents.nom},</p>
        <p>Votre demande de paiement a été rejetée par <strong>${valideur.agents.nom}</strong>.</p>
        <p><strong>Montant :</strong> ${demande.montant} FCFA</p>
        <p><strong>Motif :</strong> ${demande.motif}</p>
        <p><strong>Commentaire du validateur :</strong> ${commentaire}</p>
        <p>Merci,</p>
        <p>GreenPay CI</p>`;

      await envoyerEmail(demande.agents.utilisateurs.email, sujetRejet, messageRejet);
    }

    res.status(200).json({ message: `Demande ${statut} avec succès.`, prochainStatut });
  } catch (error) {
    console.error("❌ ERREUR: ", error);
    res.status(500).json({ message: "Erreur serveur.", error });
  }
};

/**
 * ✅ Récupérer les demandes en attente de validation pour un utilisateur
 */
const getDemandesEnAttente = async (req, res) => {
  const { validateur_id } = req.params;

  try {
    const utilisateur = await prisma.utilisateurs.findUnique({
      where: { id: Number(validateur_id) },
      include: { agents: true },
    });

    if (!utilisateur) {
      return res.status(404).json({ message: "Utilisateur non trouvé." });
    }

    let statutRequis = null;
    if (utilisateur.agents.fonction.includes("Responsable de section")) {
      statutRequis = "validation_section";
    } else if (utilisateur.agents.fonction.includes("Responsable d'entité")) {
      statutRequis = "validation_entite";
    } else if (utilisateur.agents.fonction.includes("Responsable Entité Générale")) {
      statutRequis = "validation_entite_generale";
    } else if (utilisateur.agents.fonction.includes("Responsable Entité Financière")) {
      statutRequis = "validation_entite_finance";
    }

    const demandes = await prisma.demandes_paiement.findMany({
      where: { statut: statutRequis },
      include: { agents: true, validations: true },
      orderBy: { date_creation: "desc" },
    });

    return res.status(200).json({ demandes });
  } catch (error) {
    console.error("❌ Erreur récupération demandes :", error);
    res.status(500).json({ message: "Erreur serveur." });
  }
};

const getValidationsByValidateur = async (req, res) => {
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
  validerDemande,
  getDemandesEnAttente,
  getValidationsByValidateur,
};
