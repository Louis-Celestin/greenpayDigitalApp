const puppeteer = require("puppeteer");
const fs = require("fs");
const path = require("path");
const { ToWords } = require('to-words');
const formatThousands = require('format-thousands');
const toWords = new ToWords({
    localeCode: 'fr-FR',
    converterOptions: {
      currency: true,
      ignoreDecimal: false,
      ignoreZeroCurrency: false,
      doNotAddOnly: false,
      currencyOptions: {
        // can be used to override defaults for the selected locale
        name: 'FRANC',
        plural: 'FRANCS',
        symbol: 'CFA',
      },
    },
  });

const generateDemandePaiementPDF = async (demande, outputPath) => {
    const browser = await puppeteer.launch({ headless: "new" });
    const page = await browser.newPage();

    // 🔹 Charger le contenu HTML
    let template = fs.readFileSync(path.join(__dirname, "../public/tempate/template.html"), "utf8");
    const montant_lettres = toWords.convert(demande.montant).toUpperCase()
    const montant_separe = formatThousands(demande.montant)


    // 🔹 Remplacement des variables dynamiques dans le template
    template = template
        .replace("{{montant_lettres}}", montant_lettres || "")
        .replace("{{montant}}", montant_separe.toLocaleString() || "")
        .replace("{{motif}}", demande.motif || "")
        .replace("{{beneficiaire}}", demande.beneficiaire || "")
        .replace("{{demandeur_signature}}", demande.demandeur_signature || "Signé")
        .replace("{{approbation_dg}}", demande.approbation_dg || "")
        .replace("{{approbation_daf}}", demande.approbation_daf || "")
        .replace("{{signature}}", demande.signature || "")
        .replace("{{beneficiaire_signature}}", demande.beneficiaire_signature || "")
        .replace("{{note}}", demande.nbMentionSection || "");

    await page.setContent(template, { waitUntil: "networkidle0" });

    // 🔹 Générer le PDF
    await page.pdf({
        path: outputPath,
        format: "A4",
        printBackground: true,
    });

    await browser.close();
};

module.exports = { generateDemandePaiementPDF };
