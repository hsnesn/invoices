/**
 * Adds docxtemplater placeholders to the bank transfer form.
 * Run: node scripts/add-placeholders-to-bank-form.js
 * Requires: public/bank-transfer-templates/USD.docx
 */
const fs = require("fs");
const path = require("path");
const PizZip = require("pizzip");

const TEMPLATE_DIR = path.join(process.cwd(), "public", "bank-transfer-templates");
const CURRENCIES = ["USD", "EUR", "GBP"];

function addPlaceholders(xml) {
  let result = xml;

  // 1. Date: add {date} after "Date/Tarih: "
  result = result.replace(/Date\/Tarih: <\/w:t><\/w:r>/g, () => {
    return 'Date/Tarih: </w:t></w:r><w:r><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman"/><w:sz w:val="20"/></w:rPr><w:t>{date}</w:t></w:r>';
  });

  // 2. Replace "Authorized signatory" with {signature}
  result = result.replace(/Authorized signatory/g, "{signature}");

  // 3. Replace "USD" in the currency value cell with {currency}
  // The currency cell has "USD" - we need to replace only the value, not labels
  result = result.replace(/<w:t>USD<\/w:t>/g, "<w:t>{currency}</w:t>");
  result = result.replace(/<w:t>EUR<\/w:t>/g, "<w:t>{currency}</w:t>");
  result = result.replace(/<w:t>GBP<\/w:t>/g, "<w:t>{currency}</w:t>");

  // 4. Add placeholders in empty table cells
  // Pattern: empty w:r (no w:t) - add our placeholder
  // We need to add placeholders in order. The empty cells appear in sequence.
  const placeholders = [
    "beneficiary_name",
    "iban",
    "bank_sort_code",
    "swift_bic",
    "bank_address",
    "bank_name",
    "amount",
    "message",
    "intermediary_bank_name",
    "intermediary_swift",
  ];

  let count = 0;
  result = result.replace(
    /<w:r>(\s*<w:rPr>[\s\S]*?<\/w:rPr>\s*)<\/w:r>(?=\s*<\/w:p>\s*<\/w:tc>)/g,
    (match) => {
      if (count < placeholders.length) {
        const ph = placeholders[count++];
        return `<w:r>${match.match(/<w:rPr>[\s\S]*?<\/w:rPr>/)[0]}<w:t>{${ph}}</w:t></w:r>`;
      }
      return match;
    }
  );

  return result;
}

function processTemplate(currency) {
  const srcPath = path.join(TEMPLATE_DIR, `${currency}.docx`);
  if (!fs.existsSync(srcPath)) {
    console.log(`Skipping ${currency}.docx - not found`);
    return;
  }
  const zip = new PizZip(fs.readFileSync(srcPath));
  const docFile = zip.files["word/document.xml"];
  if (!docFile) {
    console.error("No document.xml");
    return;
  }
  const xml = docFile.asText();
  const modified = addPlaceholders(xml);
  zip.file("word/document.xml", modified);
  fs.writeFileSync(srcPath, zip.generate({ type: "nodebuffer" }));
  console.log(`Updated ${currency}.docx`);
}

function main() {
  if (!fs.existsSync(TEMPLATE_DIR)) {
    fs.mkdirSync(TEMPLATE_DIR, { recursive: true });
    console.log("Created", TEMPLATE_DIR);
  }
  const usdPath = path.join(TEMPLATE_DIR, "USD.docx");
  if (!fs.existsSync(usdPath)) {
    console.error("Copy USD_.docx to public/bank-transfer-templates/USD.docx first");
    process.exit(1);
  }
  for (const c of CURRENCIES) {
    if (c !== "USD" && !fs.existsSync(path.join(TEMPLATE_DIR, `${c}.docx`))) {
      fs.copyFileSync(usdPath, path.join(TEMPLATE_DIR, `${c}.docx`));
      console.log(`Created ${c}.docx from USD`);
    }
    processTemplate(c);
  }
  console.log("Done. Placeholders: {date}, {beneficiary_name}, {iban}, {currency}, {bank_sort_code}, {swift_bic}, {bank_name}, {bank_address}, {amount}, {message}, {signature}, {intermediary_bank_name}, {intermediary_swift}");
}

main();
