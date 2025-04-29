const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const { envoyerEmail } = require("../../config/emailConfig");

/**
 * ✅ Déterminer le prochain validateur
 */
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
      // PAS DE VALIDATEUR dans l'app pour REG → impression papier
      prochainValidateur = null;
      break;

    default:
      return { prochainStatut: null, prochainValidateur: null };
  }

  return { prochainStatut, prochainValidateur };
};

/**
 * ✅ Valider une demande de paiement et notifier le prochain validateur
 */
const validerDemande = async (req, res) => {
  const { demande_id } = req.params;
  let { valideur_id, statut, commentaire } = req.body;

  try {
    const demande = await prisma.demandes_paiement.findUnique({
      where: { id: parseInt(demande_id) },
      include: { agents: { include: { utilisateurs: true } } },
    });

    if (!demande) return res.status(404).json({ message: "Demande non trouvée." });

    const valideur = await prisma.utilisateurs.findUnique({
      where: { id: Number(valideur_id) },
      include: { agents: true },
    });

    if (!valideur) return res.status(403).json({ message: "Validateur non autorisé." });
    if (!["approuve", "rejete"].includes(statut)) {
      return res.status(400).json({ message: "Statut invalide. Utilisez 'approuve' ou 'rejete'." });
    }

    let { prochainStatut, prochainValidateur } = await determinerProchainValidateur(demande);

    if (statut === "rejete") {
      prochainStatut = "rejete";
    }

    await prisma.validations.create({
      data: {
        demande_id: Number(demande_id),
        valideur_id: Number(valideur_id),
        statut,
        commentaire,
      },
    });

    await prisma.demandes_paiement.update({
      where: { id: Number(demande_id) },
      data: { statut: prochainStatut },
    });

    // ✅ Email au prochain validateur s'il existe
    if (statut === "approuve" && prochainValidateur) {
      const utilisateurValidateur = await prisma.utilisateurs.findFirst({
        where: { agent_id: prochainValidateur.id },
        include: { agents: true },
      });

      if (utilisateurValidateur) {
        const sujet = `🔔 Nouvelle validation requise pour la demande #${demande.id}`;
        const message = `
          <p>Bonjour ${utilisateurValidateur.agents.nom},</p>
          <p>Une demande de paiement a été approuvée et est en attente de votre validation.</p>
          <p><strong>Montant :</strong> ${demande.montant} FCFA</p>
          <p><strong>Motif :</strong> ${demande.motif}</p>
          <p><a href="https://app.greenpayci.com/valider/${demande.id}">✅ Valider la demande</a></p>
          <p>Merci,</p>
          <p>GreenPay CI</p>`;

        await envoyerEmail(utilisateurValidateur.email, sujet, message);
      }
    }

    // ✅ Email au demandeur si rejeté
    if (statut === "rejete" && demande.agents.utilisateurs?.email) {
      const sujetRejet = `🚨 Votre demande de paiement #${demande.id} a été rejetée`;
      const messageRejet = `
        <p>Bonjour ${demande.agents.nom},</p>
        <p>Votre demande de paiement a été rejetée par <strong>${valideur.agents.nom}</strong>.</p>
        <p><strong>Montant :</strong> ${demande.montant} FCFA</p>
        <p><strong>Motif :</strong> ${demande.motif}</p>
        <p><strong>Commentaire :</strong> ${commentaire}</p>
        <p>Merci,</p>
        <p>GreenPay CI</p>`;

      await envoyerEmail(demande.agents.utilisateurs.email, sujetRejet, messageRejet);
    }

    return res.status(200).json({ message: `Demande ${statut} avec succès.`, prochainStatut });
  } catch (error) {
    console.error("❌ ERREUR:", error);
    res.status(500).json({ message: "Erreur serveur.", error });
  }
};

/**
 * ✅ Récupérer les demandes en attente de validation
 */
const getDemandesEnAttente = async (req, res) => {
  const { validateur_id } = req.params;

  try {
    const utilisateur = await prisma.utilisateurs.findUnique({
      where: { id: Number(validateur_id) },
      include: { agents: true },
    });

    if (!utilisateur) return res.status(404).json({ message: "Utilisateur non trouvé." });

    const fonction = utilisateur.agents.fonction;
    let statutRequis = null;

    if (fonction.includes("Responsable de section")) statutRequis = "validation_section";
    else if (fonction.includes("Responsable d'entité")) statutRequis = "validation_entite";
    else return res.status(403).json({ message: "Non autorisé." });

    const demandes = await prisma.demandes_paiement.findMany({
      where: {
        statut: statutRequis,
        agents: {
          OR: [
            { entite_id: utilisateur.agents.entite_id },
            { section_id: utilisateur.agents.section_id },
          ],
        },
      },
      include: { agents: true, validations: true },
      orderBy: { date_creation: "desc" },
    });

    return res.status(200).json({ demandes });
  } catch (error) {
    console.error("❌ Erreur récupération demandes:", error);
    res.status(500).json({ message: "Erreur serveur." });
  }
};

/**
 * ✅ Liste des validations faites par un validateur
 */
const getValidationsByValidateur = async (req, res) => {
  const { validateur_id } = req.params;
  const user = await prisma.utilisateurs.findUnique({ where: { id: parseInt(validateur_id) } });

  if (!user) return res.status(404).json({ message: "Utilisateur non trouvé" });

  try {
    const results = await prisma.validations.findMany({
      where: { valideur_id: parseInt(user.id) },
      include: { demandes_paiement: true },
      orderBy: { date_validation: "desc" },
    });

    if (results.length) return res.status(200).json(results);
    else return res.status(404).json({ message: "Aucune validation trouvée." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Erreur serveur." });
  }
};

module.exports = {
  validerDemande,
  getDemandesEnAttente,
  getValidationsByValidateur,
};
