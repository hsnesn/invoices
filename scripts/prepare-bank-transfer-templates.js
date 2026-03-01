/**
 * Prepares bank transfer Word templates by adding docxtemplater placeholders.
 * Run: node scripts/prepare-bank-transfer-templates.js
 * Requires: USD_.docx in project root or public/bank-transfer-templates/USD.docx
 */
const fs = require("fs");
const path = require("path");
const PizZip = require("pizzip");

const TEMPLATE_DIR = path.join(process.cwd(), "public", "bank-transfer-templates");
const SOURCE_USD = path.join(TEMPLATE_DIR, "USD.docx");

// Placeholders to inject. We'll replace empty table cells or add after labels.
// The document has: Date/Tarih: [empty], then table with label|value rows.
const INJECTIONS = [
  // After "Date/Tarih: " add {date}
  { from: /Date\/Tarih: <\/w:t><\/w:r>/, to: 'Date/Tarih: </w:t></w:r><w:r><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman"/><w:sz w:val="20"/><w:szCs w:val="20"/></w:rPr><w:t>{date}</w:t></w:r>' },
  // Replace "Authorized signatory" with {signature}
  { from: /Authorized signatory/g, to: "{signature}" },
  // Replace "USD" in the currency value cell - be careful, only the one in the value column
  // The template has "USD" in the currency cell - we use {currency}
  { from: /<w:t>USD<\/w:t>(?=[^<]*<\/w:tc>)/, to: "<w:t>{currency}</w:t>" },
];

// Simpler: just add placeholders by replacing known empty patterns
// Empty cell: <w:p>...<w:r><w:rPr>...</w:rPr></w:r></w:p> - we add <w:t>{x}</w:t> in w:r
// Actually the empty run might not have content. Let me try replacing specific text.
const SIMPLE_REPLACEMENTS = [
  ["Date/Tarih: ", "Date/Tarih: {date}"],
  ["Authorized signatory", "{signature}"],
];

function prepareTemplate(srcPath, outPath) {
  if (!fs.existsSync(srcPath)) {
    console.error("Source not found:", srcPath);
    return false;
  }
  const zip = new PizZip(fs.readFileSync(srcPath));
  const docXml = zip.files["word/document.xml"];
  if (!docXml) {
    console.error("No document.xml in docx");
    return false;
  }
  let xml = docXml.asText();

  // Apply simple replacements
  for (const [from, to] of SIMPLE_REPLACEMENTS) {
    xml = xml.split(from).join(to);
  }

  // For empty value cells - find pattern and add placeholders
  // The beneficiary section has empty cells. We need to add {beneficiary_name}, {iban}, etc.
  // Strategy: find empty <w:t></w:t> or minimal content and replace with placeholder
  // The order of value cells in Section B: beneficiary name, IBAN, currency, sort code, swift, bank name, bank address, amount, message
  const placeholderOrder = [
    "beneficiary_name",
    "iban",
    "currency",
    "bank_sort_code",
    "swift_bic",
    "bank_name",
    "bank_address",
    "amount",
    "message",
  ];

  // Find empty table cells - pattern: <w:tc>...<w:p>...<w:r>...</w:r></w:p></w:tc>
  // where the w:r has no w:t or empty w:t. We'll target Section B's value cells.
  // Simpler: replace specific empty structures. After "Beneficiary's Account Name" the next cell's content.
  // The template might have the structure where value cells have <w:p><w:pPr>...</w:pPr></w:p>
  const emptyCellPattern = /(<w:tc>[\s\S]*?<w:p[\s\S]*?<w:r[\s\S]*?<w:rPr>[\s\S]*?<\/w:rPr>\s*<\/w:r>\s*<\/w:p>\s*<\/w:tc>)/g;
  let matchCount = 0;
  xml = xml.replace(emptyCellPattern, (match) => {
    const placeholder = placeholderOrder[matchCount] || "message";
    matchCount++;
    if (matchCount <= placeholderOrder.length) {
      return match.replace(/<\/w:rPr>\s*<\/w:r>/, `</w:rPr><w:t>{${placeholder}}</w:t></w:r>`);
    }
    return match;
  });

  zip.file("word/document.xml", xml);
  fs.writeFileSync(outPath, zip.generate({ type: "nodebuffer" }));
  console.log("Prepared:", outPath);
  return true;
}

function main() {
  if (!fs.existsSync(TEMPLATE_DIR)) {
    fs.mkdirSync(TEMPLATE_DIR, { recursive: true });
  }
  if (!fs.existsSync(SOURCE_USD)) {
    console.error("Copy USD_.docx to public/bank-transfer-templates/USD.docx first");
    process.exit(1);
  }
  prepareTemplate(SOURCE_USD, path.join(TEMPLATE_DIR, "USD.docx"));
  // Copy to EUR and GBP - they're the same structure, just currency differs
  fs.copyFileSync(path.join(TEMPLATE_DIR, "USD.docx"), path.join(TEMPLATE_DIR, "EUR.docx"));
  fs.copyFileSync(path.join(TEMPLATE_DIR, "USD.docx"), path.join(TEMPLATE_DIR, "GBP.docx"));
  console.log("Templates ready. Add placeholders manually in Word if needed: {date}, {beneficiary_name}, {iban}, {currency}, {bank_sort_code}, {swift_bic}, {bank_name}, {bank_address}, {amount}, {message}, {signature}");
}

main();
