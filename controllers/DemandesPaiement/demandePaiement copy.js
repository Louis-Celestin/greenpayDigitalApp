const { PrismaClient } = require("@prisma/client");
const cloudinary = require("../../config/cloudinaryConfig");
const { envoyerNotification } = require("../../utils/notifications"); // Ajout des notifications
const { envoyerEmail } = require("../../config/emailConfig");
const prisma = new PrismaClient();

// Fonction pour uploader un fichier sur Cloudinary
const uploadToCloudinary = (fileBuffer) => {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: "proformas" },
      (error, result) => {
        if (error) {
          reject(error);
        } else {
          resolve(result.secure_url);
        }
      }
    );
    stream.end(fileBuffer);
  });
};

// Fonction pour déterminer le validateur initial en fonction du demandeur
const determinerValidateurInitial = async (agent) => {
  let statutInitial = "validation_superieur_hierarchique";
  let validateurInitial = agent.superieur_id; // Par défaut, le validateur est le supérieur hiérarchique

  // Si l'agent est un Directeur Général (DG), la validation passe directement au DAF
  if (agent.fonction_id === 12) {
    // 3 = DG
    statutInitial = "validation_DAF";
    const daf = await prisma.agents.findFirst({ where: { fonction_id: 13 } }); // 4 = DAF
    validateurInitial = daf ? daf.id : null;
  }

  // Si l'agent est un Directeur Financier (DAF), la validation passe au DG
  if (agent.fonction_id === 13) {
    // 4 = DAF
    statutInitial = "validation_DG";
    const dg = await prisma.agents.findFirst({ where: { fonction_id: 12 } }); // 3 = DG
    validateurInitial = dg ? dg.id : null;
  }

  // Si l'agent est un Directeur de Département, la validation passe au DG
  if (
    agent.fonction_id == 13 ||
    agent.fonction_id == 14 ||
    agent.fonction_id == 11
  ) {
    statutInitial = "validation_DG";
    const dg = await prisma.agents.findFirst({ where: { fonction_id: 12 } });
    validateurInitial = dg ? dg.id : null;
  }

  return { statutInitial, validateurInitial };
};

// Demande de paiement
const creerDemandePaiement = async (req, res) => {
  let { agent_id, montant, motif, moyen_paiement_id, requiert_proforma } =
    req.body;

  try {
    // Vérifier si l'agent existe
    const agent = await prisma.agents.findUnique({
      where: { id: parseInt(agent_id) },
    });
    if (!agent) return res.status(404).json({ message: "Agent non trouvé." });

    // Vérifier si le moyen de paiement est valide
    const moyenPaiement = await prisma.moyens_paiement.findUnique({
      where: { id: parseInt(moyen_paiement_id) },
    });
    if (!moyenPaiement)
      return res.status(400).json({ message: "Moyen de paiement invalide." });

    // Déterminer le validateur initial
    const { statutInitial, validateurInitial } =
      await determinerValidateurInitial(agent);

    let proformaUrl = null;

    // Vérifier et uploader la proforma si nécessaire
    if (requiert_proforma === "true") {
      if (!req.file) {
        return res.status(400).json({ message: "Une proforma est requise." });
      }
      proformaUrl = await uploadToCloudinary(req.file.buffer); // Attente de l'upload
    } else if (requiert_proforma === "false" && req.file) {
      return res
        .status(400)
        .json({ message: "Vous ne pouvez pas mettre de proforma" });
    } else {
      requiert_proforma = "";
    }

    // Transaction Prisma pour assurer la cohérence des données
    const transactionResult = await prisma.$transaction(async (tx) => {
      const demande = await tx.demandes_paiement.create({
        data: {
          agent_id: parseInt(agent_id),
          montant: parseFloat(montant),
          motif,
          moyen_paiement_id: parseInt(moyen_paiement_id),
          statut: statutInitial, // Mise à jour du statut initial
          requiert_proforma: Boolean(requiert_proforma),
        },
      });

      // Enregistrer la proforma si elle est requise
      if (demande.requiert_proforma === true && proformaUrl) {
        await tx.proformas.create({
          data: { demande_id: demande.id, fichier: proformaUrl },
        });
      }

      const validateur = await prisma.utilisateurs.findUnique({
        where: { id: Number(validateurInitial) },
        include: { agents: true },
      });

      console.log(validateur);
      // Envoi d'un e-mail au validateur
      const sujet = `Nouvelle demande de paiement #${demande.id} en attente de validation`;
      const message = `
            <p>Bonjour ${validateur.agents.nom},</p>
            <p>Une nouvelle demande de paiement a été créée par ${agent.nom}.</p>
            <p>Montant : <strong>${montant} FCFA</strong></p>
            <p>Motif : ${motif}</p>
            <p>Merci de bien vouloir la valider.</p>`;
      await envoyerEmail(validateur.email, sujet, message);

      return demande;
    });
    // console.log(validateurInitial)

    res
      .status(201)
      .json({
        message: "Demande créée avec succès.",
        demande: transactionResult,
      });
  } catch (error) {
    console.error("Erreur :", error);
    res.status(500).json({ message: "Erreur serveur.", error });
  }
};

const modifierDemandePaiement = async (req, res) => {
  const { demande_id } = req.params;
  const { montant, motif, moyen_paiement_id, requiert_proforma } = req.body;
  let proformaUrl = null;

  try {
    // Vérifier si la demande existe et n'a pas encore été validée
    const demande = await prisma.demandes_paiement.findUnique({
      where: { id: parseInt(demande_id), deleted_at: null },
      include: { proformas: true },
    });

    if (!demande)
      return res
        .status(404)
        .json({ message: "Demande non trouvée ou déjà supprimée." });

    if (demande.statut !== "validation_superieur_hierarchique") {
      return res
        .status(400)
        .json({
          message: "Vous ne pouvez pas modifier une demande déjà validée.",
        });
    }

    // Vérifier si une nouvelle proforma est fournie
    if (requiert_proforma === "true") {
      if (!req.file) {
        return res.status(400).json({ message: "Une proforma est requise." });
      }
      proformaUrl = await uploadToCloudinary(req.file.buffer); // Upload de la nouvelle proforma

      // Supprimer l'ancienne proforma si elle existe
      if (demande.proformas.length > 0) {
        await prisma.proformas.deleteMany({
          where: { demande_id: parseInt(demande_id) },
        });
      }

      // Ajouter la nouvelle proforma
      await prisma.proformas.create({
        data: { demande_id: parseInt(demande_id), fichier: proformaUrl },
      });
    } else if (requiert_proforma === "false" && req.file) {
      return res
        .status(400)
        .json({
          message:
            "Vous ne pouvez pas ajouter une proforma si elle n'est pas requise.",
        });
    }

    // Modifier la demande
    const demandeModifiee = await prisma.demandes_paiement.update({
      where: { id: parseInt(demande_id) },
      data: {
        montant,
        motif,
        moyen_paiement_id,
        requiert_proforma: requiert_proforma === "true",
      },
    });

    res
      .status(200)
      .json({
        message: "Demande modifiée avec succès.",
        demande: demandeModifiee,
      });
  } catch (error) {
    console.error("Erreur :", error);
    res.status(500).json({ message: "Erreur serveur.", error });
  }
};

const supprimerDemandePaiement = async (req, res) => {
  const { demande_id } = req.params;

  try {
    // Vérifier si la demande existe
    const demande = await prisma.demandes_paiement.findUnique({
      where: { id: parseInt(demande_id), deleted_at: null },
    });

    if (!demande)
      return res
        .status(404)
        .json({ message: "Demande non trouvée ou déjà supprimée." });

    // Appliquer le soft delete
    await prisma.demandes_paiement.update({
      where: { id: parseInt(demande_id) },
      data: { deleted_at: new Date() },
    });

    res.status(200).json({ message: "Demande supprimée (soft delete)." });
  } catch (error) {
    console.error("Erreur :", error);
    res.status(500).json({ message: "Erreur serveur.", error });
  }
};

const getDemandesPaiement = async (req, res) => {
  try {
    const demandes = await prisma.demandes_paiement.findMany({
      where: { deleted_at: null },
      include: { agent: true, moyens_paiement: true },
    });

    res.status(200).json({ demandes });
  } catch (error) {
    console.error("Erreur :", error);
    res.status(500).json({ message: "Erreur serveur.", error });
  }
};

const getDemandePaiementById = async (req, res) => {
  const { demande_id } = req.params;

  try {
    const demande = await prisma.demandes_paiement.findUnique({
      where: { id: parseInt(demande_id), deleted_at: null },
      include: { agent: true, moyens_paiement: true },
    });

    if (!demande)
      return res.status(404).json({ message: "Demande non trouvée." });

    res.status(200).json({ demande });
  } catch (error) {
    console.error("Erreur :", error);
    res.status(500).json({ message: "Erreur serveur.", error });
  }
};

module.exports = {
  creerDemandePaiement,
  modifierDemandePaiement,
  supprimerDemandePaiement,
  getDemandesPaiement,
  getDemandePaiementById
};
