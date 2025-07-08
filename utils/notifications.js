const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient()
const nodemailer = require("nodemailer");


const envoyerNotification = async (utilisateur_id, demande_id, message) => {
    try {
        // Récupérer l'email de l'utilisateur concerné
        const utilisateur = await prisma.utilisateurs.findUnique({
            where: { id: utilisateur_id },
            select: { email: true }
        });

        if (!utilisateur) {
            console.warn("❌ Utilisateur non trouvé pour la notification.");
            return;
        }

        // Envoyer l'email
        const sujet = `Nouvelle Notification - Demande de Paiement #${demande_id}`;
        await envoyerEmail(utilisateur.email, sujet, message);
    } catch (error) {
        console.error("❌ Erreur lors de l'envoi de la notification par email :", error);
    }
};

async function envoyerFichiersParMail(demandeId) {
  try {
    const demande = await prisma.demandes_paiement.findUnique({
      where: { id: demandeId },
      include: {
        agents: {
          include: {
            utilisateurs: true,
            agents: { include: { utilisateurs: true } }, // supérieur direct
          },
        },
        paiements: {
          include: {
            documents_paiements: true,
          },
        },
        proformas: true,
      },
    });

    if (!demande) {
      console.warn("❌ Demande introuvable pour envoi mail");
      return;
    }

    // 📦 Construction de la liste des fichiers
    const fichiers = [];

    if (demande.demande_physique_signee_url) {
      fichiers.push({ label: "Fichier signé (REG)", url: demande.demande_physique_signee_url });
    }

    for (const paiement of demande.paiements) {
      for (const doc of paiement.documents_paiements) {
        fichiers.push({ label: `Preuve de paiement (${doc.type})`, url: doc.url });
      }
    }

    for (const proforma of demande.proformas) {
      fichiers.push({ label: "Proforma", url: proforma.fichier });
    }

    if (fichiers.length === 0) {
      console.warn("⚠️ Aucun fichier à envoyer par e-mail.");
      return;
    }

    // 🧑‍💼 Récupération des e-mails des parties prenantes
    const emails = new Set();

    if (demande.agents.utilisateurs?.email) {
      emails.add(demande.agents.utilisateurs.email); // Demandeur
    }

    if (demande.agents.agents?.utilisateurs?.email) {
      emails.add(demande.agents.agents.utilisateurs.email); // Supérieur direct
    }

    // ✅ Tu peux ajouter ici plus d'e-mails à notifier (ex: DG, DAF...)

    if (emails.size === 0) {
      console.warn("❌ Aucun e-mail à notifier.");
      return;
    }

    // ✉️ Envoi d’e-mail avec les fichiers
    const transporter = nodemailer.createTransport({
      service: "gmail", // à adapter à ton service
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    const message = {
      from: `"GreenPay CI" <${process.env.EMAIL_USER}>`,
      to: Array.from(emails).join(","),
      subject: `📄 Fichiers associés à la demande #${demandeId}`,
      html: `
        <p>Bonjour,</p>
        <p>Voici les fichiers liés à la demande de paiement #${demandeId} :</p>
        <ul>
          ${fichiers.map(f => `<li><strong>${f.label}:</strong> <a href="${f.url}">${f.url}</a></li>`).join("")}
        </ul>
        <p>Cordialement,<br>L’équipe GreenPay</p>
      `,
    };

    await transporter.sendMail(message);
    console.log("✅ E-mail envoyé avec succès aux parties prenantes.");
  } catch (error) {
    console.error("🚨 Erreur lors de l'envoi d'e-mail :", error);
  }
}


module.exports = { envoyerNotification, envoyerFichiersParMail };




