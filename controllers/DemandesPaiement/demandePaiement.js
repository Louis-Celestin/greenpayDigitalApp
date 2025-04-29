const { PrismaClient } = require("@prisma/client");
const cloudinary = require("../../config/cloudinaryConfig");
const prisma = new PrismaClient();
const { envoyerEmail } = require("../../config/emailConfig");
const jwt = require("jsonwebtoken");
/**
 * ✅ Fonction pour uploader un fichier sur Cloudinary
 */
const uploadToCloudinary = (fileBuffer) => {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: "proformas" },
      (error, result) => {
        if (error) reject(error);
        else resolve(result.secure_url);
      }
    );
    stream.end(fileBuffer);
  });
};

/**
 * ✅ Déterminer le validateur initial
 */
// const determinerValidateurInitial = async (agent) => {
//     let statutInitial = "validation_section";
//     let validateurInitial = null;

//     // 🔹 Si l'agent a un responsable direct, ce responsable est le validateur
//     if (agent.superieur_id) {
//         validateurInitial = await prisma.agents.findUnique({
//             where: { id: agent.superieur_id },
//         });

//         // 🔹 On adapte le statut en fonction du niveau hiérarchique
//         if (validateurInitial && validateurInitial.fonction.includes("Responsable d'entité")) {
//             statutInitial = "validation_entite";
//         } else if (validateurInitial && validateurInitial.fonction.includes("Responsable Entité Générale")) {
//             statutInitial = "validation_entite_generale";
//         } else if (validateurInitial && validateurInitial.fonction.includes("Responsable Financier")) {
//             statutInitial = "validation_entite_finance";
//         } else if (validateurInitial && validateurInitial.fonction.includes("Directeur Général")) {
//             statutInitial = "validation_DG";
//         }
//     } else {
//         // 🔹 Si aucun supérieur n'est trouvé, on laisse la demande en statut initial
//         statutInitial = "validation_section";
//     }

//     return { statutInitial, validateurInitial };
// };

// const determinerValidateurInitial = async (agent) => {
//     let statutInitial = "validation_section"; // 🔹 Par défaut, on commence au niveau section
//     let validateurInitial = null;

//     if (agent.fonction.includes("Agent")) {
//         // 🔹 Un agent est validé par son Responsable de Section
//         validateurInitial = await prisma.agents.findFirst({
//             where: { section_id: agent.section_id, fonction: "Responsable de section" },
//         });
//     } else if (agent.fonction.includes("Responsable de section")) {
//         // 🔹 Un Responsable de Section est validé par son Responsable d'Entité
//         statutInitial = "validation_entite";
//         validateurInitial = await prisma.agents.findFirst({
//             where: { entite_id: agent.entite_id, fonction: "Responsable d'entité" },
//         });
//     } else if (agent.fonction.includes("Responsable d'entité")) {
//         // 🔹 Un Responsable d'Entité est validé par le DG (Responsable Entité Générale)
//         statutInitial = "validation_entite_generale";
//         validateurInitial = await prisma.agents.findFirst({
//             where: { fonction: "Responsable Entité Générale" },
//         });
//     } else if (agent.fonction.includes("Responsable Entité Générale")) {
//         // 🔹 Le DG (Responsable Entité Générale) est validé par le DAF (Responsable Entité Financière)
//         statutInitial = "validation_entite_finance";
//         validateurInitial = await prisma.agents.findFirst({
//             where: { fonction: "Responsable Entité Financière" },
//         });
//     }

//     return { statutInitial, validateurInitial };
// };

// const determinerValidateurInitial = async (agent) => {
//     let statutInitial = "validation_section";
//     let validateurInitial = null;

//     if (agent.fonction.includes("Agent")) {
//         // ✅ Un Agent est validé par son Responsable de Section
//         validateurInitial = await prisma.agents.findFirst({
//             where: { section_id: agent.section_id, fonction: "Responsable de section" },
//         });
//     } else if (agent.fonction.includes("Responsable de section")) {
//         // ✅ Un Responsable de Section est validé par son Responsable d'Entité
//         statutInitial = "validation_entite";
//         validateurInitial = await prisma.agents.findFirst({
//             where: { entite_id: agent.entite_id, fonction: "Responsable d'entité" },
//         });
//     } else if (agent.fonction.includes("Responsable d'entité")) {
//         // ✅ Un Responsable d'Entité est validé par le DG
//         statutInitial = "validation_entite_generale";
//         validateurInitial = await prisma.agents.findFirst({
//             where: { fonction: "Responsable Entité Générale" },
//         });
//     } else if (agent.fonction.includes("Responsable Entité Générale")) {
//         // 🚨 Exception #1 : Le DG est validé par le DAF
//         statutInitial = "validation_entite_finance";
//         validateurInitial = await prisma.agents.findFirst({
//             where: { fonction: "Responsable Entité Financière" },
//         });
//     } else if (agent.fonction.includes("Responsable Entité Financière")) {
//         // 🚨 Exception #2 : Le DAF est validé par le DG
//         statutInitial = "validation_entite_generale";
//         validateurInitial = await prisma.agents.findFirst({
//             where: { fonction: "Responsable Entité Générale" },
//         });
//     }

//     return { statutInitial, validateurInitial };
// };

// const creerDemandePaiement = async (req, res) => {
//     console.log(req.file)
//     let { agent_id, montant, motif, requiert_proforma, beneficiaire } = req.body;

//     try {
//         const agent = await prisma.agents.findUnique({ where: { id: parseInt(agent_id) } });
//         if (!agent) return res.status(404).json({ message: "Agent non trouvé." });

//         const { statutInitial, validateurInitial } = await determinerValidateurInitial(agent);

//         if (!validateurInitial) {
//             return res.status(400).json({ message: "Aucun validateur initial trouvé pour cette demande. Vérifiez les responsables." });
//         }

//         let proformaUrl = null;
//         if (requiert_proforma === "true" && req.file) {
//             proformaUrl = await uploadToCloudinary(req.file.buffer);
//         }

//         const transactionResult = await prisma.$transaction(async (tx) => {
//             const demande = await tx.demandes_paiement.create({
//                 data: {
//                     agent_id: parseInt(agent_id),
//                     montant: parseFloat(montant),
//                     motif,
//                     beneficiaire,
//                     statut: statutInitial,
//                     requiert_proforma: Boolean(requiert_proforma),
//                 },
//             });

//             if (proformaUrl) {
//                 await tx.proformas.create({ data: { demande_id: demande.id, fichier: proformaUrl } });
//             }

//             // ✅ Notifier le validateur initial par e-mail avec un bouton de validation
//             const validateur = await tx.utilisateurs.findFirst({
//                 where: { agent_id: validateurInitial.id },
//                 include: { agents: true },
//             });

//             if (validateur) {
//                 console.log(`🟢 Email envoyé à ${validateur.email}`);

//                 // 🔗 URL du bouton de validation (MODIFIER SELON TON FRONTEND)
//                 const validationURL = ``;

//                 const sujet = `Nouvelle demande de paiement #${demande.id} en attente`;
//                 const message = `
//                     <p>Bonjour ${validateur.agents.nom},</p>
//                     <p>Une nouvelle demande de paiement a été créée par <strong>${agent.nom}</strong>.</p>
//                     <p><strong>Montant :</strong> ${montant} FCFA</p>
//                     <p><strong>Motif :</strong> ${motif}</p>
//                     <p>Merci de la valider en cliquant sur le bouton ci-dessous :</p>
//                     <p style="text-align: center;">
//                         <a href="${validationURL}"
//                             style="background-color: #28a745; color: white; padding: 10px 20px; text-decoration: none; font-weight: bold; border-radius: 5px;">
//                             ✅ Valider la demande
//                         </a>
//                     </p>
//                     <p>Ou copiez ce lien dans votre navigateur :</p>
//                     <p>${validationURL}</p>
//                     <p>Cordialement,</p>
//                     <p>GreenPay CI</p>`;

//                 await envoyerEmail(validateur.email, sujet, message);
//             } else {
//                 console.log("⚠️ Aucun utilisateur trouvé pour ce validateur.");
//             }

//             return demande;
//         });

//         res.status(201).json({ message: "Demande créée avec succès.", demande: transactionResult });
//     } catch (error) {
//         console.error("❌ Erreur :", error);
//         res.status(500).json({ message: "Erreur serveur.", error });
//     }
// };

// /**
//  * ✅ Modifier une demande de paiement
//  */
// const modifierDemandePaiement = async (req, res) => {
//     const { demande_id } = req.params;
//     const { montant, motif, requiert_proforma, beneficiaire } = req.body;
//     let proformaUrl = null;

//     try {
//         const demande = await prisma.demandes_paiement.findUnique({
//             where: { id: parseInt(demande_id) },
//             include: { proformas: true },
//         });

//         if (!demande) return res.status(404).json({ message: "Demande non trouvée." });

//         if (demande.statut !== "validation_section") {
//             return res.status(400).json({ message: "Modification impossible après validation." });
//         }

//         if (requiert_proforma === "true" && req.file) {
//             proformaUrl = await uploadToCloudinary(req.file.buffer);
//             if (demande.proformas.length > 0) {
//                 await prisma.proformas.deleteMany({ where: { demande_id: parseInt(demande_id) } });
//             }
//             await prisma.proformas.create({ data: { demande_id: parseInt(demande_id), fichier: proformaUrl } });
//         }

//         const demandeModifiee = await prisma.demandes_paiement.update({
//             where: { id: parseInt(demande_id) },
//             data: { montant, motif, beneficiaire, requiert_proforma: requiert_proforma === "true" },
//         });

//         res.status(200).json({ message: "Demande mise à jour avec succès.", demande: demandeModifiee });
//     } catch (error) {
//         console.error("Erreur :", error);
//         res.status(500).json({ message: "Erreur serveur.", error });
//     }
// };

// /**
//  * ✅ Supprimer une demande (soft delete)
//  */
// const supprimerDemandePaiement = async (req, res) => {
//     const { demande_id } = req.params;

//     try {
//         const demande = await prisma.demandes_paiement.findUnique({
//             where: { id: parseInt(demande_id) },
//         });

//         if (!demande) return res.status(404).json({ message: "Demande non trouvée." });

//         await prisma.demandes_paiement.update({
//             where: { id: parseInt(demande_id) },
//             data: { deleted_at: new Date() },
//         });

//         res.status(200).json({ message: "Demande supprimée avec succès (soft delete)." });
//     } catch (error) {
//         console.error("Erreur :", error);
//         res.status(500).json({ message: "Erreur serveur.", error });
//     }
// };

/**
 * ✅ Récupérer les demandes de paiement en fonction du rôle de l'utilisateur connecté
 */

const determinerValidateurInitial = async (agent) => {
  let statutInitial = "validation_section";
  let validateurInitial = null;

  if (agent.fonction.includes("Agent")) {
    validateurInitial = await prisma.agents.findFirst({
      where: {
        section_id: agent.section_id,
        fonction: "Responsable de section",
      },
    });
  } else if (agent.fonction.includes("Responsable de section")) {
    statutInitial = "validation_entite";
    validateurInitial = await prisma.agents.findFirst({
      where: { entite_id: agent.entite_id, fonction: "Responsable d'entité" },
    });
  } else if (agent.fonction.includes("Responsable d'entité")) {
    statutInitial = "validation_entite_generale";
    validateurInitial = await prisma.agents.findFirst({
      where: { fonction: "Responsable Entité Générale" },
    });
  } else if (agent.fonction.includes("Responsable Entité Générale")) {
    // 🚨 Le REG fait une demande => Validation_entite_finance pour paiement direct
    statutInitial = "validation_entite_finance";
    validateurInitial = await prisma.agents.findFirst({
      where: { fonction: "Responsable Entité Financière" },
    });
  } else if (agent.fonction.includes("Responsable Entité Financière")) {
    // 🚨 Le REF fait une demande => Validation par le REG
    statutInitial = "validation_entite_generale";
    validateurInitial = await prisma.agents.findFirst({
      where: { fonction: "Responsable Entité Générale" },
    });
  }

  return { statutInitial, validateurInitial };
};

/**
 * ✅ Créer une demande de paiement
 */
const creerDemandePaiement = async (req, res) => {
  let { agent_id, montant, motif, requiert_proforma, beneficiaire } = req.body;

  try {
    const agent = await prisma.agents.findUnique({
      where: { id: parseInt(agent_id) },
    });
    if (!agent) return res.status(404).json({ message: "Agent non trouvé." });

    const { statutInitial, validateurInitial } =
      await determinerValidateurInitial(agent);

    if (!validateurInitial) {
      return res.status(400).json({
        message: "Aucun validateur initial trouvé pour cette demande.",
      });
    }

    let proformaUrl = null;
    if (requiert_proforma === "true" && req.file) {
      proformaUrl = await uploadToCloudinary(req.file.buffer);
    }

    const transactionResult = await prisma.$transaction(async (tx) => {
      const demande = await tx.demandes_paiement.create({
        data: {
          agent_id: parseInt(agent_id),
          montant: parseFloat(montant),
          motif,
          beneficiaire,
          statut: statutInitial,
          requiert_proforma: Boolean(requiert_proforma),
        },
      });

      if (proformaUrl) {
        await tx.proformas.create({
          data: { demande_id: demande.id, fichier: proformaUrl },
        });
      }

      const validateur = await tx.utilisateurs.findFirst({
        where: { agent_id: validateurInitial.id },
        include: { agents: true },
      });

      if (validateur) {
        const validationURL = ``; // 🔗 Modifier l'URL en fonction de ton frontend

        const sujet = `Nouvelle demande de paiement #${demande.id} en attente`;
        const message = `
                    <p>Bonjour ${validateur.agents.nom},</p>
                    <p>Une nouvelle demande de paiement a été créée par <strong>${agent.nom}</strong>.</p>
                    <p><strong>Montant :</strong> ${montant} FCFA</p>
                    <p><strong>Motif :</strong> ${motif}</p>
                    <p>Merci de la valider en cliquant sur le bouton ci-dessous :</p>
                    <p style="text-align: center;">
                        <a href="${validationURL}" 
                            style="background-color: #28a745; color: white; padding: 10px 20px; text-decoration: none; font-weight: bold; border-radius: 5px;">
                            ✅ Valider la demande
                        </a>
                    </p>
                `;

        await envoyerEmail(validateur.email, sujet, message);
      }

      return demande;
    });

    res.status(201).json({
      message: "Demande créée avec succès.",
      demande: transactionResult,
    });
  } catch (error) {
    console.error("❌ Erreur :", error);
    res.status(500).json({ message: "Erreur serveur.", error });
  }
};

/**
 * ✅ Modifier une demande de paiement
 */
const modifierDemandePaiement = async (req, res) => {
  const { demande_id } = req.params;
  const { montant, motif, requiert_proforma, beneficiaire, statut } = req.body;


  try {
    const demande = await prisma.demandes_paiement.findUnique({
      where: { id: parseInt(demande_id) },
      include: { proformas: true },
    });

    if (!demande)
      return res.status(404).json({ message: "Demande non trouvée." });

    if(demande.statut === "validation_entite_generale" && statut == "paye"){
      const demandeModifiee = await prisma.demandes_paiement.update({
        where: { id: parseInt(demande_id) },
        data: {
          statut : statut
        },
      });
      return res.status(200).json({
        message: "Demande mise à jour avec succès.",
        demande: demandeModifiee,
      });
    }

    if (demande.statut !== "validation_section") {
      return res
        .status(400)
        .json({ message: "Modification impossible après validation." });
    }

    let proformaUrl = null;
    if (requiert_proforma === "true" && req.file) {
      proformaUrl = await uploadToCloudinary(req.file.buffer);
      if (demande.proformas.length > 0) {
        await prisma.proformas.deleteMany({
          where: { demande_id: parseInt(demande_id) },
        });
      }
      await prisma.proformas.create({
        data: { demande_id: parseInt(demande_id), fichier: proformaUrl },
      });
    }

    const demandeModifiee = await prisma.demandes_paiement.update({
      where: { id: parseInt(demande_id) },
      data: {
        montant,
        motif,
        beneficiaire,
        requiert_proforma: requiert_proforma === "true",
      },
    });

    return res.status(200).json({
      message: "Demande mise à jour avec succès.",
      demande: demandeModifiee,
    });
  } catch (error) {
    console.error("Erreur :", error);
    res.status(500).json({ message: "Erreur serveur.", error });
  }
};

/**
 * ✅ Supprimer une demande (soft delete)
 */
const supprimerDemandePaiement = async (req, res) => {
  const { demande_id } = req.params;

  try {
    const demande = await prisma.demandes_paiement.findUnique({
      where: { id: parseInt(demande_id) },
      include : {
        validations : true
      }
    });

    if (!demande)
      return res.status(404).json({ message: "Demande non trouvée." });

    if(demande.validations.length > 0) {
      return res.status(400).json({ message: "Demande déjà validée." });
    }

    await prisma.demandes_paiement.update({
      where: { id: parseInt(demande_id) },
      data: { deleted_at: new Date() },
    });

    res
      .status(200)
      .json({ message: "Demande supprimée avec succès (soft delete)." });
  } catch (error) {
    console.error("Erreur :", error);
    res.status(500).json({ message: "Erreur serveur.", error });
  }
};

const getDemandesPaiement = async (req, res) => {
  const { page = 1, limit = 10, utilisateur_id } = req.query;
  const offset = (page - 1) * limit;

  try {
    const utilisateur = await prisma.utilisateurs.findUnique({
      where: { id: Number(utilisateur_id) },
      include: { agents: true },
    });

    if (!utilisateur)
      return res.status(404).json({ message: "Utilisateur non trouvé." });

    const demandes = await prisma.demandes_paiement.findMany({
      skip: Number(offset),
      take: Number(limit),
      orderBy: { date_creation: "desc" },
      where: {
        agent_id: parseInt(utilisateur.agent_id),
        deleted_at: null,
      },
      //     OR: [
      //         { statut: "validation_section", agents: { section_id: utilisateur.agents.section_id } },
      //         { statut: "validation_entite", agents: { entite_id: utilisateur.agents.entite_id } },
      //         { statut: "validation_entite_finance" },
      //         { statut: "validation_entite_generale" },
      //     ],
      // },
      include: { agents: true, proformas: true, validations: true },
    });

    const totalDemandes = await prisma.demandes_paiement.count();
    const totalPages = Math.ceil(totalDemandes / limit);

    res.json({ demandes, totalPages });
  } catch (error) {
    res.status(500).json({ message: "Erreur serveur", error });
  }
};
/**
 * ✅ Récupérer une demande spécifique par ID
 */
const getDemandePaiementById = async (req, res) => {
  const { demande_id } = req.params;
  try {
    const demande = await prisma.demandes_paiement.findUnique({
      where: { id: parseInt(demande_id) },
      include: {
        agents: true,
        proformas: true,
        validations: {
          include: { utilisateurs: { include: { agents: true } } },
        },
      },
    });

    if (!demande)
      return res.status(404).json({ message: "Demande non trouvée." });

    res.status(200).json({ demande });
  } catch (error) {
    res.status(500).json({ message: "Erreur serveur.", error });
  }
};

/**
 * ✅ Stats par agent
 */
const demandesCountByUser = async (req, res) => {
  try {
    const word = req.headers.authorization;
    if (!word) {
      return res.status(401).json({ error: "Token manquant" });
    }

    const token = word.split(" ")[1];
    const utilisateurs = jwt.decode(token);

    if (!utilisateurs || !utilisateurs.userId) {
      return res.status(401).json({ error: "Token invalide" });
    }

    // 📌 Récupérer l'utilisateur et son agent associé
    const user = await prisma.utilisateurs.findUnique({
      where: { id: utilisateurs.userId },
      include: { agents: true },
    });

    if (!user || !user.agents) {
      return res.status(404).json({ error: "Agent non trouvé" });
    }
    
    const agentId = parseInt(user.agents.id);

    // 📌 Récupération des statistiques en une seule requête groupée
    const [
      nbDemandes,
      montantTotalDemandes,
      nbDemandesPending,
      montantTotalDemandesPending,
      nbDemandesApprouvees,
      nbDemandesRejetees,
      nbPaiementsRecus,
      montantTotalPaiementsRecus
    ] = await Promise.all([
      prisma.demandes_paiement.count({ where: { agent_id: agentId } }),
      prisma.demandes_paiement.aggregate({
        _sum: { montant: true },
        where: { agent_id: agentId },
      }),
      prisma.demandes_paiement.count({
        where: {
          agent_id: agentId,
          validations: { none: {} }, // Aucune validation associée
        },
      }),
      prisma.demandes_paiement.aggregate({
        _sum: { montant: true },
        where: {
          agent_id: agentId,
          validations: { none: {} },
        },
      }),
      prisma.demandes_paiement.count({
        where: {
          statut: { notIn: ["rejete", "validation_section"] },
          agent_id: agentId,
        },
      }),
      prisma.demandes_paiement.count({
        where: { statut: "rejete", agent_id: agentId },
      }),
      prisma.demandes_paiement.count({
        where: { statut: "paye", agent_id: agentId },
      }),
      prisma.demandes_paiement.aggregate({
        _sum: { montant: true },
        where: {
          statut: "paye",
          agent_id: agentId,
        },
      }),
    ]);

    // 📌 Construction de la réponse
    const statsAgent = {
      nbDemandes,
      montantTotalDemandes: montantTotalDemandes._sum.montant || 0,
      nbDemandesPending,
      montantTotalDemandesPending: montantTotalDemandesPending._sum.montant || 0,
      nbDemandesApprouvees,
      nbDemandesRejetees,
      nbPaiementsRecus,
      montantTotalPaiementsRecus: montantTotalPaiementsRecus._sum.montant || 0,
    };

    console.log(statsAgent);
    return res.json(statsAgent);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Erreur serveur" });
  }
};
/**
 * ✅ Stats par section
 */
const demandesCountByResponsableSection = async (req, res) => {
  try {
    const word = req.headers.authorization;
    if (!word) {
      return res.status(401).json({ error: "Token manquant" });
    }

    const token = word.split(" ")[1]; // Découpe correctement le token
    const utilisateurs = jwt.decode(token);

    if (!utilisateurs || !utilisateurs.userId) {
      return res.status(401).json({ error: "Token invalide" });
    }

    // Récupérer l'utilisateur et son agent associé
    const user = await prisma.utilisateurs.findUnique({
      where: { id: utilisateurs.userId },
      include: { agents: true },
    });

    if (!user || !user.agents) {
      return res.status(404).json({ error: "Agent non trouvé" });
    }

    const agentId = parseInt(user.agents.id);
    const sectionId = parseInt(user.agents.section_id);

    // 📌 Filtrage du mois en cours
    const today = new Date();
    const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const lastDayOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);

    // 📌 Récupération des statistiques en une seule requête groupée
    const [
      nbDemandes,
      montantTotalDemandes,
      nbDemandesPending,
      nbDemandesApprouvees,
      nbDemandesRejetees,
      nbDemandesENAttentePaiement,
      nbDemandesENAttenteValidation,
      montantDemandesENAttenteValidation,
      nbDemandesApprouveesCeMois,
      nbDemandesRejeteesCeMois,
      nbDemandeValidéesEtAuPaiement,
      montantDemandeValidées,
      montantTotalPaiementsRecus
    ] = await Promise.all([
      prisma.demandes_paiement.count({ where: { agent_id: agentId } }),
      prisma.demandes_paiement.aggregate({
        _sum: { montant: true },
        where: { agent_id: agentId },
      }),
      prisma.demandes_paiement.count({ where: { agent_id: agentId, validations: { none: {} } } }),
      prisma.demandes_paiement.count({ where: { statut: { notIn: ["rejete", "validation_entite"] }, agent_id: agentId } }),
      prisma.demandes_paiement.count({ where: { statut: "rejete", agent_id: agentId } }),
      prisma.demandes_paiement.count({ where: { statut: "validation_entite_finance", agent_id: agentId } }),
      prisma.demandes_paiement.count({ where: { statut: "validation_section", agents: { section_id: sectionId, superieur_id: agentId } } }),
      prisma.demandes_paiement.aggregate({ _sum: { montant: true }, where: { statut: "validation_section", agents: { section_id: sectionId, superieur_id: agentId } } }),
      prisma.validations.count({ where: { statut: "approuve", date_validation: { gte: firstDayOfMonth, lte: lastDayOfMonth }, demandes_paiement: { agents: { section_id: sectionId, superieur_id: agentId } } } }),
      prisma.validations.count({ where: { statut: "rejete", date_validation: { gte: firstDayOfMonth, lte: lastDayOfMonth }, demandes_paiement: { agents: { section_id: sectionId, superieur_id: agentId } } } }),
      prisma.demandes_paiement.count({ where: { statut: "validation_entite_finance", agents: { section_id: sectionId, superieur_id: agentId } } }),
      prisma.demandes_paiement.aggregate({ _sum: { montant: true }, where: { statut: "paye", agents: { section_id: sectionId, superieur_id: agentId } } }),
      prisma.demandes_paiement.aggregate({ _sum: { montant: true }, where: { paiements: { some: {} }, agent_id: agentId } }),
    ]);

    // 📌 Construction de la réponse
    const statsResponsable = {
      nbDemandes,
      montantTotalDemandes: montantTotalDemandes._sum.montant || 0,
      nbDemandesPending,
      nbDemandesApprouvees,
      nbDemandesRejetees,
      nbDemandesENAttentePaiement,
      nbDemandesENAttenteValidation,
      montantDemandesENAttenteValidation: montantDemandesENAttenteValidation._sum.montant || 0,
      nbDemandesApprouveesCeMois,
      nbDemandesRejeteesCeMois,
      nbDemandeValidéesEtAuPaiement,
      montantDemandeValidées: montantDemandeValidées._sum.montant || 0,
      montantTotalPaiementsRecus: montantTotalPaiementsRecus._sum.montant || 0,
    };

    console.log(statsResponsable);
    return res.json(statsResponsable);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Erreur serveur" });
  }
};



const demandesCountByRef = async (req, res) => {

  try {
      const word = req.headers.authorization;
      if (!word) {
          return res.status(401).json({ error: "Token manquant" });
      }
  
      const token = word.split(" ")[1]; // Découpe correctement le token
      const utilisateurs = jwt.decode(token);
  
      if (!utilisateurs || !utilisateurs.userId) {
          return res.status(401).json({ error: "Token invalide" });
      }
  
      // Récupérer l'utilisateur et son agent associé
      const user = await prisma.utilisateurs.findUnique({
          where: { id: utilisateurs.userId },
          include: { agents: true },
      });
      
      if (!user || !user.agents) {
          return res.status(404).json({ error: "Agent non trouvé" });
      }
      
      const agentId = parseInt(user.agents.id);
  
      // 📌 Regroupement des requêtes pour optimiser les performances
      const [
          nbPaiements,
          montantPaiements,
          nbPaiementAttente,
          nbPaiementRejetees,
          nbPaiementRef,
          montantPaiementRef,
          montantPaiementEnAttenteValidation,
          nbPaiementTypePaiement
      ] = await Promise.all([
          prisma.paiements.count(),
          prisma.demandes_paiement.aggregate({
              _sum: { montant: true },
              where: { paiements: { some: {} } }
          }),
          prisma.demandes_paiement.count({
              where: { statut: "validation_entite_finance" }
          }),
          prisma.demandes_paiement.count({
              where: { statut: "rejete" }
          }),
          prisma.demandes_paiement.count({
              where: { agent_id: agentId }
          }),
          prisma.demandes_paiement.aggregate({
              _sum: { montant: true },
              where: { agent_id: agentId }
          }),
          prisma.demandes_paiement.count({
              where: {
                  validations: { none: {} },
                  agent_id: agentId
              }
          }),
          prisma.paiements.groupBy({
              by: ["moyen_paiement"],
              _count: { moyen_paiement: true }
          })
      ]);
  
      // 📌 Transformer la réponse pour la répartition des types de paiement
      const result = nbPaiementTypePaiement.reduce((acc, paiement) => {
          acc[paiement.moyen_paiement] = paiement._count.moyen_paiement;
          return acc;
      }, {});
  
      // 📌 Construction de la réponse
      const statsDaf = {
          nbPaiements,
          montantPaiements: montantPaiements._sum.montant || 0,
          nbPaiementAttente,
          nbPaiementRejetees,
          nbPaiementRef,
          montantPaiementRef: montantPaiementRef._sum.montant || 0,
          montantPaiementEnAttenteValidation,
          result
      };
  
      console.log(statsDaf);
      return res.json(statsDaf);
  } catch (error) {
      console.log(error);
      return res.status(500).json({ error: "Erreur serveur." });
  }
};

const demandesCountByReg = async (req, res) => {
  try {
    const word = req.headers.authorization;
    if (!word) {
      return res.status(401).json({ error: "Token manquant" });
    }

    const token = word.split(" ")[1];
    const utilisateurs = jwt.decode(token);

    if (!utilisateurs || !utilisateurs.userId) {
      return res.status(401).json({ error: "Token invalide" });
    }

    // 📌 Récupérer toutes les données nécessaires en parallèle
    const [
      nbPaiements,
      montantPaiements,
      nbDemandesEnAttenteValidation,
      nbDemandesApprouvees,
      nbDemandesRejetees,
      nbDemandePaiementAttente,
      montantTotalPaiements,
      nbPaiementsType
    ] = await Promise.all([
      prisma.paiements.count(),
      prisma.demandes_paiement.aggregate({
        _sum: { montant: true },
        where: { statut: "paye" }
      }),
      prisma.demandes_paiement.count({
        where: { validations: { none: {} } }
      }),
      prisma.demandes_paiement.count({
        where: { validations: { some: { statut: "approuve" } } }
      }),
      prisma.demandes_paiement.count({
        where: { validations: { some: { statut: "rejete" } } }
      }),
      prisma.demandes_paiement.count({
        where: { statut: "validation_entite_finance" }
      }),
      prisma.demandes_paiement.aggregate({
        _sum: { montant: true },
        where: { statut: "paye" }
      }),
      prisma.paiements.groupBy({
        by: ["moyen_paiement"],
        _count: { moyen_paiement: true }
      })
    ]);

    // 📌 Transformer la réponse pour la répartition des types de paiement
    const result = nbPaiementsType.reduce((acc, paiement) => {
      acc[paiement.moyen_paiement] = paiement._count.moyen_paiement;
      return acc;
    }, {});

    // 📌 Construire la réponse API
    const statsDG = {
      nbPaiements,
      montantPaiements: montantPaiements._sum.montant || 0,
      nbDemandesEnAttenteValidation,
      nbDemandesApprouvees,
      nbDemandesRejetees,
      nbDemandePaiementAttente,
      montantTotalPaiements: montantTotalPaiements._sum.montant || 0,
      result
    };

    console.log(statsDG);
    return res.json(statsDG);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Erreur serveur." });
  }
};


const demandesCountByResponsableEntite = async (req, res) => {
  try {
      const word = req.headers.authorization;
      if (!word) {
          return res.status(401).json({ error: "Token manquant" });
      }

      const token = word.split(" ")[1];
      const utilisateurs = jwt.decode(token);

      if (!utilisateurs || !utilisateurs.userId) {
          return res.status(401).json({ error: "Token invalide" });
      }

      // Récupérer l'utilisateur et son agent associé
      const user = await prisma.utilisateurs.findUnique({
          where: { id: utilisateurs.userId },
          include: { agents: true },
      });

      if (!user || !user.agents) {
          return res.status(404).json({ error: "Agent non trouvé" });
      }

      const entiteId = parseInt(user.agents.entite_id);
      
      // 📌 Regrouper toutes les requêtes pour améliorer les performances
      const [
          nbDemandes,
          montantDemandes,
          nbDemandesAttente,
          nbDemandesApprouvees,
          nbDemandesRejetees,
          nbPaiements,
          montantPaiements,
          nbPaiementsAttente,
          nbPaiementsType
      ] = await Promise.all([
          prisma.demandes_paiement.count({ where: { agents: { entite_id: entiteId } } }),
          prisma.demandes_paiement.aggregate({ _sum: { montant: true }, where: { agents: { entite_id: entiteId } } }),
          prisma.demandes_paiement.count({ where: { statut: "validation_entite", agents: { entite_id: entiteId } } }),
          prisma.validations.count({ where: { statut: "approuve", demandes_paiement: { agents: { entite_id: entiteId } } } }),
          prisma.validations.count({ where: { statut: "rejete", demandes_paiement: { agents: { entite_id: entiteId } } } }),
          prisma.paiements.count({ where: { demandes_paiement: { agents: { entite_id: entiteId } } } }),
          prisma.demandes_paiement.aggregate({ _sum: { montant: true }, where: { paiements: { some: {} }, agents: { entite_id: entiteId } } }),
          prisma.demandes_paiement.count({ where: { statut: "validation_entite_finance", agents: { entite_id: entiteId } } }),
          prisma.paiements.groupBy({
              by: ["moyen_paiement"],
              _count: { moyen_paiement: true },
              where: { demandes_paiement: { agents: { entite_id: entiteId } } }
          })
      ]);

      // 📌 Transformer la réponse en format JSON structuré
      const result = nbPaiementsType.reduce((acc, paiement) => {
          acc[paiement.moyen_paiement] = paiement._count.moyen_paiement;
          return acc;
      }, {});

      // 📌 Construction de la réponse
      const statsResponsableEntite = {
          nbDemandes,
          montantDemandes: montantDemandes._sum.montant || 0,
          nbDemandesAttente,
          nbDemandesApprouvees,
          nbDemandesRejetees,
          nbPaiements,
          montantPaiements: montantPaiements._sum.montant || 0,
          nbPaiementsAttente,
          result
      };
      console.log(statsResponsableEntite);
      return res.json(statsResponsableEntite);
  } catch (error) {
      console.log(error);
      res.status(500).json({ error: "Erreur serveur." });
  }
};


  

module.exports = {
  creerDemandePaiement,
  modifierDemandePaiement,
  supprimerDemandePaiement,
  getDemandesPaiement,
  getDemandePaiementById,
  demandesCountByUser,
  demandesCountByResponsableSection,
  demandesCountByRef,
  demandesCountByReg,
  demandesCountByResponsableEntite
};
