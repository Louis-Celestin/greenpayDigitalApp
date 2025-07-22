const { PrismaClient, paiements_moyen_paiement } = require("@prisma/client");
const cloudinary = require("../../config/cloudinaryConfig");
const prisma = new PrismaClient();
const { envoyerEmail } = require("../../config/emailConfig");
const jwt = require("jsonwebtoken");
const { envoyerFichiersParMail } = require("../../utils/notifications");
/**
 * ✅ Fonction pour uploader un fichier sur Cloudinary
 */
const uploadToCloudinary = (fileBuffer) => {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: "proformas", resource_type: "auto" },

      (error, result) => {
        if (error) reject(error);
        else resolve(result.secure_url);
      }
    );
    stream.end(fileBuffer);
  });
};

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

const creerDemandePaiement = async (req, res) => {
  let { agent_id, montant, motif, requiert_proforma, beneficiaire } = req.body;

  try {
    // 1️⃣ Récupération de l'agent
    const agent = await prisma.agents.findUnique({
      where: { id: parseInt(agent_id) },
    });
    if (!agent) return res.status(404).json({ message: "Agent non trouvé." });

    // 2️⃣ Déterminer le statut initial et le validateur
    const { statutInitial, validateurInitial } =
      await determinerValidateurInitial(agent);
    if (!validateurInitial) {
      return res
        .status(400)
        .json({
          message: "Aucun validateur initial trouvé pour cette demande.",
        });
    }

    // 3️⃣ Uploader la proforma avant la transaction
    let proformaUrl = null;
    if (requiert_proforma === "true" && req.file) {
      proformaUrl = await uploadToCloudinary(req.file.buffer);
    }

    // 4️⃣ Créer la demande + proforma dans la base (transaction)
    const demandeCree = await prisma.$transaction(async (tx) => {
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
          data: {
            demande_id: demande.id,
            fichier: proformaUrl,
          },
        });
      }

      return demande;
    });

    // 5️⃣ Récupération du validateur utilisateur (après transaction)
    const validateur = await prisma.utilisateurs.findFirst({
      where: { agent_id: validateurInitial.id },
      include: { agents: true },
    });

    // 6️⃣ Envoi d'email après la transaction
    if (validateur) {
      const validationURL = `https://achats.greenpayci.com/validations/${demandeCree.id}`;
      const sujet = `Nouvelle demande de paiement #${demandeCree.id} en attente`;
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

    // 7️⃣ Retour au frontend
    res.status(201).json({
      message: "Demande créée avec succès.",
      demande: demandeCree,
    });
  } catch (error) {
    console.error("❌ Erreur :", error);
    res.status(500).json({ message: "Erreur serveur.", error });
  }
};

// const modifierDemandePaiement = async (req, res) => {

//   // 📌 Récupération des paramètres et du corps de la requête
//   const { demande_id } = req.params;
//   const { montant, motif, requiert_proforma, beneficiaire, statut, moyen_paiement } = req.body;

//   const documents = Array.isArray(req.body.documents) ? req.body.documents : [req.body.documents];
//   const types = Array.isArray(req.body.types) ? req.body.types : [req.body.types];

//   try {
//     const demande = await prisma.demandes_paiement.findUnique({
//       where: { id: parseInt(demande_id) },
//       include: { proformas: true },
//     });

//     if (!demande) return res.status(404).json({ message: "Demande non trouvée." });

//     const transitionsAutorisees = {
//       validation_section : ["validation_section"],
//       validation_entite : ["validation_entite"],
//       validation_entite_generale: ["en_attente_paiement", "paye", "rejete"],
//       en_attente_paiement: ["paye", "rejete"],
//     };

//     const transitionsPossibles = transitionsAutorisees[demande.statut] || [];
//     if (!transitionsPossibles.includes(statut)) {
//       return res.status(400).json({ message: `Changement de statut non autorisé depuis '${demande.statut}' vers '${statut}'.` });
//     }

//     const result = await prisma.$transaction(async (tx) => {

//       console.log("Statut de la demande :", statut);

//       // 💾 en_attente_paiement → stocker le lien signé REG
//       if (statut === "en_attente_paiement") {
//         const indexReg = types.findIndex(t => t === "signe_reg");
//         if (indexReg !== -1 && documents[indexReg]) {
//           await tx.demandes_paiement.update({
//             where: { id: parseInt(demande_id) },
//             data: {
//               demande_physique_signee_url: documents[indexReg],
//             },
//           });
//         }
//       }

//       // 💾 paye → créer ligne paiement + documents liés
//       if (statut === "paye") {
//         const paiement = await tx.paiements.create({
//           data: {
//             demande_id: parseInt(demande_id),
//             moyen_paiement,
//           },
//         });

//         const docsPaiement = documents
//           .map((url, idx) => ({ url, type: types[idx] }))
//           .filter(doc => doc.type === "preuve_paiement");

//         for (const doc of docsPaiement) {
//           await tx.documents_paiements.create({
//             data: {
//               paiement_id: paiement.id,
//               url: doc.url,
//               type: doc.type,
//             },
//           });
//         }
//       }

//       if (statut === "validation_section") {
//         if(requiert_proforma === "true" && req.file) {
//           const proformaUrl = await uploadToCloudinary(req.file.buffer);
//           let proforma = await tx.proformas.findFirst({
//             where: { demande_id: parseInt(demande_id) },
//           });

//           if (proforma) {
//             proforma.url = proformaUrl;
//             await tx.proformas.update({
//               where: { id: proforma.id },
//               data: { url: proforma.url },
//             });
//           } else {
//             await tx.proformas.create({
//               data: {
//                 demande_id: parseInt(demande_id),
//                 url: proformaUrl,
//               },
//             });
//           }
//         } else if (requiert_proforma === "false") {
//           await tx.proformas.deleteMany({
//             where: { demande_id: parseInt(demande_id) },
//           });
//         }
//       }

//       if (statut === "validation_entite") {
//         if (requiert_proforma === "true" && req.file) {
//           const proformaUrl = await uploadToCloudinary(req.file.buffer);
//           console.log("Proforma URL :", proformaUrl);
//           let proforma = await tx.proformas.findFirst({
//             where: { demande_id: parseInt(demande_id) },
//           });

//           if (proforma) {
//             proforma.url = proformaUrl;
//             console.log("Proforma mise à jour :", proforma);
//             await tx.proformas.update({
//               where: { id: proforma.id },
//               data: { url: proforma.url },
//             });
//           } else {
//             await tx.proformas.create({
//               data: {
//                 demande_id: parseInt(demande_id),
//                 url: proformaUrl,
//               },
//             });
//           }
//         }else if (requiert_proforma === "false") {
//           await tx.proformas.deleteMany({
//             where: { demande_id: parseInt(demande_id) },
//           });
//         }
//       }

//       // ⚙️ Mise à jour générale
//       const updated = await tx.demandes_paiement.update({
//         where: { id: parseInt(demande_id) },
//         data: {
//           montant: montant ? parseFloat(montant) : demande.montant,
//           motif: motif || demande.motif,
//           beneficiaire: beneficiaire || demande.beneficiaire,
//           requiert_proforma: requiert_proforma === "true",
//           statut,
//         },
//       });

//       return updated;
//     });

//     // ✉️ Envoi des fichiers par mail (à garder)
//     await envoyerFichiersParMail(parseInt(demande_id));

//     return res.status(200).json({
//       message: "Demande mise à jour avec succès.",
//       demande: result
//     });
//   } catch (error) {
//     console.error("🔥 Erreur :", error);
//     return res.status(500).json({ message: "Erreur serveur", error });
//   }
// }

const modifierDemandePaiement = async (req, res) => {
  const { demande_id } = req.params;
  const {
    montant,
    motif,
    requiert_proforma,
    beneficiaire,
    statut,
    moyen_paiement,
  } = req.body;
  const documents = Array.isArray(req.body.documents)
    ? req.body.documents
    : [req.body.documents];
  const types = Array.isArray(req.body.types)
    ? req.body.types
    : [req.body.types];

  try {
    const demande = await prisma.demandes_paiement.findUnique({
      where: { id: parseInt(demande_id) },
      include: { proformas: true },
    });
    if (!demande)
      return res.status(404).json({ message: "Demande non trouvée." });

    const transitionsAutorisees = {
      validation_section: ["validation_section"],
      validation_entite: ["validation_entite"],
      validation_entite_generale: ["en_attente_paiement", "paye", "rejete"],
      en_attente_paiement: ["paye", "rejete"],
    };
    const possibles = transitionsAutorisees[demande.statut] || [];
    if (!possibles.includes(statut)) {
      return res
        .status(400)
        .json({
          message: `Changement de statut non autorisé : '${demande.statut}' → '${statut}'.`,
        });
    }

    const result = await prisma.$transaction(async (tx) => {
      if (statut === "en_attente_paiement") {
        const idx = types.findIndex((t) => t === "signe_reg");
        if (idx !== -1 && documents[idx]) {
          await tx.demandes_paiement.update({
            where: { id: parseInt(demande_id) },
            data: { demande_physique_signee_url: documents[idx] },
          });
        }
      }

      if (statut === "paye") {
        console.log("Nous sommes ici en paye");
        const paiement = await tx.paiements
          .create({
            data: { demande_id: parseInt(demande_id), moyen_paiement },
          })
          .then((p) => p)
          .catch((err) => {
            console.log("Erreur lors de la création du paiement :", err);
          });
        const docsPaiement = documents
          .map((url, i) => ({ url, type: types[i] }))
          .filter((d) => d.type === "preuve_paiement");
        for (const doc of docsPaiement) {
          await tx.documents_paiements.create({
            data: { paiement_id: paiement.id, url: doc.url, type: doc.type },
          });
        }
      }

      // Proforma create/update only
      if (["validation_section", "validation_entite"].includes(statut)) {
        // cherche dans le tableau `req.files` l’entrée dont fieldname est "proforma"
        const proformaEntry = (req.files || []).find(
          (f) => f.fieldname === "proforma"
        );

        if (proformaEntry) {
          // proformaEntry.buffer contient ton image
          const proformaUrl = await uploadToCloudinary(proformaEntry.buffer);

          const existing = await tx.proformas.findFirst({
            where: { demande_id: parseInt(demande_id, 10) },
          });

          if (existing) {
            await tx.proformas.update({
              where: { id: existing.id },
              data: { url: proformaUrl },
            });
          } else {
            await tx.proformas.create({
              data: {
                demande_id: parseInt(demande_id),
                fichier: proformaUrl,
                date_ajout: new Date(),
              },
            });
          }
        }
      }
      return tx.demandes_paiement.update({
        where: { id: parseInt(demande_id) },
        data: {
          montant: montant ? parseFloat(montant) : demande.montant,
          motif: motif || demande.motif,
          beneficiaire: beneficiaire || demande.beneficiaire,
          requiert_proforma: requiert_proforma === "true",
          statut,
        },
      });
    });

    await envoyerFichiersParMail(parseInt(demande_id));
    return res
      .status(200)
      .json({ message: "Demande mise à jour avec succès.", demande: result });
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .json({ message: "Erreur serveur", error: error.message });
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
      include: {
        validations: true,
      },
    });

    if (!demande)
      return res.status(404).json({ message: "Demande non trouvée." });

    if (demande.validations.length > 0) {
      return res.status(400).json({ message: "Demande déjà validée." });
    }

    const validations = await prisma.validations.findMany({
      where: { demande_id: parseInt(demande_id) },
    });
    if (validations.length > 0) {
      return res
        .status(400)
        .json({ message: "Suppression impossible après validation." });
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
        // agents : {entite_id : parseInt(utilisateur.agents.entite_id)},
        agent_id: parseInt(utilisateur.agent_id),
        deleted_at: null,
      },
      include: { agents: true, proformas: true, validations: true },
    });

    const totalDemandes = await prisma.demandes_paiement.count();
    const totalPages = Math.ceil(totalDemandes / limit);

    res.json({ demandes, totalPages });
  } catch (error) {
    res.status(500).json({ message: "Erreur serveur", error });
  }
};

const getAllDemandesPaiement = async (req, res) => {
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
        agents: { entite_id: parseInt(utilisateur.agents.entite_id) },
        deleted_at: null,
        AND: {
          agent_id: { not: parseInt(utilisateur.agent_id) },
        },
      },
      include: { agents: true, proformas: true, validations: true },
    });

    const totalDemandes = await prisma.demandes_paiement.count();
    const totalPages = Math.ceil(totalDemandes / limit);
    console.log("Total demandes:", totalDemandes, "Total pages:", totalPages);
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
        paiements: { include: { documents_paiements: true } },
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
      montantTotalPaiementsRecus,
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
      montantTotalDemandesPending:
        montantTotalDemandesPending._sum.montant || 0,
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
    const entiteId = parseInt(user.agents.entite_id);

    // 📌 Filtrage du mois en cours
    const today = new Date();
    const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const lastDayOfMonth = new Date(
      today.getFullYear(),
      today.getMonth() + 1,
      0
    );

    // 📌 Récupération des statistiques en une seule requête groupée
    const [
      nbDemandes,
      montantTotalDemandes,
      nbDemandesPending,
      nbDemandesApprouvees,
      nbDemandesApprouveesCeMois,
      nbDemandesRejeteesCeMois,
      nbDemandesRejetees,
      montantTotalPaiementsRecus,
      nbDemandeValidéesEtAuPaiement,
      montantDemandeValidées,
    ] = await Promise.all([
      prisma.demandes_paiement.count({
        where: { agents: { section_id: sectionId } },
      }),
      prisma.demandes_paiement.aggregate({
        _sum: { montant: true },
        where: { agents: { entite_id: entiteId } },
      }),
      prisma.demandes_paiement.count({
        where: {
          statut: { notIn: ["paye", "rejete"] },
          agents: { section_id: sectionId },
        },
      }),
      prisma.demandes_paiement.count({
        where: {
          validations: { some: { statut: "approuve" } },
          agents: { entite_id: entiteId },
        },
      }),
      prisma.demandes_paiement.count({
        where: {
          validations: { some: { statut: "approuve" } },
          agents: { entite_id: entiteId },
          date_creation: { gte: firstDayOfMonth, lte: lastDayOfMonth },
        },
      }),
      prisma.demandes_paiement.count({
        where: {
          validations: { some: { statut: "rejete" } },
          agents: { entite_id: entiteId },
          date_creation: { gte: firstDayOfMonth, lte: lastDayOfMonth },
        },
      }),
      prisma.demandes_paiement.count({
        where: {
          validations: { some: { statut: "rejete" } },
          agents: { entite_id: entiteId },
        },
      }),
      prisma.demandes_paiement.aggregate({
        _sum: { montant: true },
        where: { statut: "paye", agents: { entite_id: entiteId } },
      }),
    ]);
    // 📌 Construction de la réponse
    const statsResponsable = {
      nbDemandes,
      montantTotalDemandes: montantTotalDemandes._sum.montant || 0,
      nbDemandesPending,
      nbDemandesApprouvees,
      nbDemandesApprouveesCeMois,
      nbDemandesRejeteesCeMois,
      nbDemandesRejetees,
      montantTotalPaiementsRecus: montantTotalPaiementsRecus._sum.montant || 0,
      // nbDemandesENAttentePaiement,
      // nbDemandesENAttenteValidation,
      // montantDemandesENAttenteValidation: montantDemandesENAttenteValidation._sum.montant || 0,
      // nbDemandesRejeteesCeMois,
      // nbDemandeValidéesEtAuPaiement,
      // montantDemandeValidées: montantDemandeValidées._sum.montant || 0,
      // montantTotalPaiementsRecus: montantTotalPaiementsRecus._sum.montant || 0,
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
      nbPaiementTypePaiement,
    ] = await Promise.all([
      prisma.paiements.count(),
      prisma.demandes_paiement.aggregate({
        _sum: { montant: true },
        where: { paiements: { some: {} } },
      }),
      prisma.demandes_paiement.count({
        where: { statut: "validation_entite_finance" },
      }),
      prisma.demandes_paiement.count({
        where: { statut: "rejete" },
      }),
      prisma.demandes_paiement.count({
        where: { agent_id: agentId },
      }),
      prisma.demandes_paiement.aggregate({
        _sum: { montant: true },
        where: { agent_id: agentId },
      }),
      prisma.demandes_paiement.count({
        where: {
          validations: { none: {} },
          agent_id: agentId,
        },
      }),
      prisma.paiements.groupBy({
        by: ["moyen_paiement"],
        _count: { moyen_paiement: true },
      }),
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
      result,
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
      nbPaiementsType,
    ] = await Promise.all([
      prisma.paiements.count(),
      prisma.demandes_paiement.aggregate({
        _sum: { montant: true },
        where: { statut: "paye" },
      }),
      prisma.demandes_paiement.count({
        where: { validations: { none: {} } },
      }),
      prisma.demandes_paiement.count({
        where: { validations: { some: { statut: "approuve" } } },
      }),
      prisma.demandes_paiement.count({
        where: { validations: { some: { statut: "rejete" } } },
      }),
      prisma.demandes_paiement.count({
        where: { statut: "validation_entite_finance" },
      }),
      prisma.demandes_paiement.aggregate({
        _sum: { montant: true },
        where: { statut: "paye" },
      }),
      prisma.paiements.groupBy({
        by: ["moyen_paiement"],
        _count: { moyen_paiement: true },
      }),
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
      result,
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
      nbPaiementsType,
    ] = await Promise.all([
      prisma.demandes_paiement.count({
        where: { agents: { entite_id: entiteId } },
      }),
      prisma.demandes_paiement.aggregate({
        _sum: { montant: true },
        where: { agents: { entite_id: entiteId } },
      }),
      prisma.demandes_paiement.count({
        where: {
          OR: [
            { statut: "validation_entite_generale" },
            { statut: "validation_entite" },
            { statut: "en_attente_paiement" },
            { statut: "validation_section" },
            { statut: "approuve" },
          ],
          agents: { entite_id: entiteId },
        },
      }),
      prisma.demandes_paiement.count({
        where: {
          validations: { some: { statut: "approuve" } },
          agents: { entite_id: entiteId },
        },
      }),
      prisma.validations.count({
        where: {
          statut: "rejete",
          demandes_paiement: { agents: { entite_id: entiteId } },
        },
      }),
      prisma.paiements.count({
        where: { demandes_paiement: { agents: { entite_id: entiteId } } },
      }),
      prisma.demandes_paiement.aggregate({
        _sum: { montant: true },
        where: { paiements: { some: {} }, agents: { entite_id: entiteId } },
      }),
      prisma.demandes_paiement.count({
        where: {
          statut: "validation_entite_finance",
          agents: { entite_id: entiteId },
        },
      }),
      prisma.paiements.groupBy({
        by: ["moyen_paiement"],
        _count: { moyen_paiement: true },
        where: { demandes_paiement: { agents: { entite_id: entiteId } } },
      }),
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
      result,
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
  demandesCountByResponsableEntite,
  getAllDemandesPaiement,
};
