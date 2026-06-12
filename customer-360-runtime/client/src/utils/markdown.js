function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function renderInlineMarkdown(text) {
  return escapeHtml(text)
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
}

function isTableRow(line) {
  const trimmed = String(line).trim();
  return trimmed.startsWith("|") && trimmed.includes("|", 1);
}

function isTableSeparator(line) {
  if (!isTableRow(line)) {
    return false;
  }

  const cells = parseTableCells(line);
  return cells.length > 0 && cells.every((cell) => /^:?-{3,}:?$/.test(cell));
}

function parseTableCells(line) {
  const trimmed = String(line).trim();
  const inner = trimmed.startsWith("|") ? trimmed.slice(1) : trimmed;
  const withoutTrailing = inner.endsWith("|") ? inner.slice(0, -1) : inner;
  return withoutTrailing.split("|").map((cell) => cell.trim());
}

function renderTable(rows) {
  const headerCells = parseTableCells(rows[0]);
  const bodyStart = rows.length > 1 && isTableSeparator(rows[1]) ? 2 : 1;
  const headerHtml = headerCells.map((cell) => `<th>${renderInlineMarkdown(cell)}</th>`).join("");
  const bodyHtml = rows
    .slice(bodyStart)
    .map((row) => {
      const cells = parseTableCells(row);
      return `<tr>${cells.map((cell) => `<td>${renderInlineMarkdown(cell)}</td>`).join("")}</tr>`;
    })
    .join("");

  return `<div class="markdown-table-wrap"><table><thead><tr>${headerHtml}</tr></thead><tbody>${bodyHtml}</tbody></table></div>`;
}

function isHeading(line) {
  return /^#{1,4}\s/.test(String(line).trim());
}

function parseHeading(line) {
  const match = String(line).trim().match(/^(#{1,4})\s+(.+)$/);
  if (!match) {
    return null;
  }

  return {
    level: match[1].length,
    text: match[2]
  };
}

function isOrderedListItem(line) {
  return /^\d+\.\s+/.test(String(line).trim());
}

function isUnorderedListItem(line) {
  return /^[-*]\s+/.test(String(line).trim());
}

function isBlockStart(line) {
  const trimmed = String(line).trim();
  return (
    !trimmed ||
    isHeading(trimmed) ||
    isUnorderedListItem(trimmed) ||
    isOrderedListItem(trimmed) ||
    isTableRow(trimmed)
  );
}

export function markdownToHtml(text = "") {
  const lines = String(text).replace(/\r\n/g, "\n").split("\n");
  const html = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];
    const trimmed = line.trim();

    if (!trimmed) {
      index += 1;
      continue;
    }

    const heading = parseHeading(trimmed);
    if (heading) {
      html.push(`<h${heading.level}>${renderInlineMarkdown(heading.text)}</h${heading.level}>`);
      index += 1;
      continue;
    }

    if (isTableRow(trimmed)) {
      const rows = [];

      while (index < lines.length && isTableRow(lines[index].trim())) {
        rows.push(lines[index].trim());
        index += 1;
      }

      html.push(renderTable(rows));
      continue;
    }

    if (isUnorderedListItem(trimmed)) {
      const items = [];

      while (index < lines.length && isUnorderedListItem(lines[index].trim())) {
        items.push(`<li>${renderInlineMarkdown(lines[index].trim().replace(/^[-*]\s+/, ""))}</li>`);
        index += 1;
      }

      html.push(`<ul>${items.join("")}</ul>`);
      continue;
    }

    if (isOrderedListItem(trimmed)) {
      const items = [];

      while (index < lines.length && isOrderedListItem(lines[index].trim())) {
        items.push(`<li>${renderInlineMarkdown(lines[index].trim().replace(/^\d+\.\s+/, ""))}</li>`);
        index += 1;
      }

      html.push(`<ol>${items.join("")}</ol>`);
      continue;
    }

    const paragraph = [trimmed];
    index += 1;

    while (index < lines.length && lines[index].trim() && !isBlockStart(lines[index])) {
      paragraph.push(lines[index].trim());
      index += 1;
    }

    html.push(`<p>${renderInlineMarkdown(paragraph.join(" "))}</p>`);
  }

  return html.join("");
}
