// Export CSV lisible par Excel (séparateur « ; », UTF-8 avec BOM).
// Les cellules qui commencent par = + - @ sont neutralisées (injection de formule dans un tableur).
const BOM = String.fromCharCode(0xfeff);
const EOL = String.fromCharCode(13, 10);

function cell(value) {
  let text = value == null ? "" : String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[";\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function toCsv(header, rows) {
  const lines = [header, ...rows].map((row) => row.map(cell).join(";"));
  return BOM + lines.join(EOL) + EOL;
}

module.exports = { toCsv };
