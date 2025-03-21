const validerDemande = async (req, res) => {
    const { demande_id } = req.params;
    const { valideur_id, statut, commentaire } = req.body;

    try {
        const demande = await prisma.demandes_paiement.findUnique({
            where: { id: Number(demande_id) },
            include: { agents: true }
        });

        if (!demande) return res.status(404).json({ message: "Demande non trouvée." });

        const valideur = await prisma.utilisateurs.findUnique({
            where: { id: Number(valideur_id) },
            include: { agents: true, utilisateur_roles: { include: { roles: true } } }
        });

        if (!valideur) return res.status(403).json({ message: "Validateur non autorisé." });

        const role_valideur = valideur.utilisateur_roles.length > 0 ? valideur.utilisateur_roles[0].role_id : null;
        if (!role_valideur) return res.status(403).json({ message: "Validateur sans rôle défini." });

        let nouveauStatut = demande.statut;
        let prochainValidateur = null;

        if (statut === "approuvé") {
            const { prochainStatut, prochainValidateur: validateurSuivant } = await determinerProchainValidateur(demande);
            nouveauStatut = prochainStatut;
            prochainValidateur = validateurSuivant;
        } else if (statut === "rejeté") {
            nouveauStatut = "rejeté";
        }

        // ✅ Correction de l'erreur ici !
        await prisma.validations.create({
            data: {
                demande_id: Number(demande.id),  // ✅ Correction : connexion correcte
                valideur_id: Number(valideur_id),
                role_valideur: role_valideur,
                statut: statut === "approuvé" ? "approuvé" : "rejeté",
                commentaire,
                signature: valideur.signature || null,
            }
        });

        await prisma.demandes_paiement.update({
            where: { id: Number(demande.id) },
            data: { statut: nouveauStatut }
        });

        if (statut === "rejeté") {
            await envoyerEmail(demande.agents.utilisateurs.email, `Demande #${demande.id} rejetée`, `Votre demande a été rejetée pour la raison suivante : ${commentaire}`);
        } else if (prochainValidateur) {
            await envoyerEmail(prochainValidateur.utilisateurs.email, `Nouvelle demande en attente`, `Une demande de paiement est en attente de votre validation.`);
        }

        res.status(200).json({ message: `Demande ${statut} avec succès.`, nouveauStatut });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Erreur serveur.", error });
    }
};
