const puppeteer = require("puppeteer");
const fs = require("fs");
const path = require("path");
const { ToWords } = require('to-words');
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


    // 🔹 Remplacement des variables dynamiques dans le template
    template = template
        .replace("{{montant_lettres}}", montant_lettres || "")
        .replace("{{montant}}", demande.montant.toLocaleString() || "")
        .replace("{{motif}}", demande.motif || "")
        .replace("{{beneficiaire}}", demande.beneficiaire || "")
        .replace("{{demandeur_signature}}", demande.demandeur_signature || "Signé")
        .replace("{{approbation_dg}}", demande.approbation_dg || "")
        .replace("{{approbation_daf}}", demande.approbation_daf || "")
        .replace("{{signature}}", demande.signature || "")
        .replace("{{beneficiaire_signature}}", demande.beneficiaire_signature || "");

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
