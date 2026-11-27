export interface ParsedTemplate {
  name: string;
  params: Map<string, string>;
  positional: string[];
}

export function findBalancedTemplate(text: string, start: number): number {
  let depth = 0;
  for (let index = start; index < text.length - 1; index++) {
    if (text.startsWith("{{", index)) {
      depth++;
      index++;
      continue;
    }
    if (text.startsWith("}}", index)) {
      depth--;
      index++;
      if (depth === 0) return index + 1;
    }
  }
  return -1;
}

export function findTemplate(text: string, templateName: string): string | null {
  const escapedName = templateName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`\\{\\{\\s*:?\\s*${escapedName}\\b`, "i");
  const match = pattern.exec(text);
  if (!match) return null;
  const end = findBalancedTemplate(text, match.index);
  if (end < 0) return null;
  return text.slice(match.index, end);
}

export function findTemplates(text: string, templateName: string): string[] {
  const escapedName = templateName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`\\{\\{\\s*:?\\s*${escapedName}\\b`, "gi");
  const results: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text)) !== null) {
    const end = findBalancedTemplate(text, match.index);
    if (end < 0) break;
    results.push(text.slice(match.index, end));
    pattern.lastIndex = end;
  }
  return results;
}

function splitTopLevel(text: string, separator: string): string[] {
  const parts: string[] = [];
  let curlyDepth = 0;
  let squareDepth = 0;
  let start = 0;
  for (let index = 0; index < text.length; index++) {
    if (text.startsWith("{{", index)) {
      curlyDepth++;
      index++;
      continue;
    }
    if (text.startsWith("}}", index)) {
      curlyDepth--;
      index++;
      continue;
    }
    if (text.startsWith("[[", index)) {
      squareDepth++;
      index++;
      continue;
    }
    if (text.startsWith("]]", index)) {
      squareDepth--;
      index++;
      continue;
    }
    if (
      text[index] === separator &&
      curlyDepth === 0 &&
      squareDepth === 0
    ) {
      parts.push(text.slice(start, index));
      start = index + 1;
    }
  }
  parts.push(text.slice(start));
  return parts;
}

function topLevelEqualsIndex(text: string): number {
  let curlyDepth = 0;
  let squareDepth = 0;
  for (let index = 0; index < text.length; index++) {
    if (text.startsWith("{{", index)) {
      curlyDepth++;
      index++;
      continue;
    }
    if (text.startsWith("}}", index)) {
      curlyDepth--;
      index++;
      continue;
    }
    if (text.startsWith("[[", index)) {
      squareDepth++;
      index++;
      continue;
    }
    if (text.startsWith("]]", index)) {
      squareDepth--;
      index++;
      continue;
    }
    if (text[index] === "=" && curlyDepth === 0 && squareDepth === 0) {
      return index;
    }
  }
  return -1;
}

export function parseTemplate(template: string): ParsedTemplate {
  let inner = template.trim();
  if (inner.startsWith("{{")) inner = inner.slice(2);
  if (inner.endsWith("}}")) inner = inner.slice(0, -2);
  const parts = splitTopLevel(inner, "|");
  const name = (parts.shift() ?? "").trim().replace(/^:/, "");
  const params = new Map<string, string>();
  const positional: string[] = [];
  for (const part of parts) {
    const equalsIndex = topLevelEqualsIndex(part);
    if (equalsIndex < 0) {
      positional.push(part.trim());
    } else {
      params.set(
        part.slice(0, equalsIndex).trim(),
        part.slice(equalsIndex + 1).trim()
      );
    }
  }
  return { name, params, positional };
}

function decodeEntities(text: string): string {
  const named: Record<string, string> = {
    "&nbsp;": " ",
    "&amp;": "&",
    "&lt;": "<",
    "&gt;": ">",
    "&quot;": '"',
    "&#39;": "'",
    "&ndash;": "–",
    "&mdash;": "—"
  };
  return text
    .replace(/&[a-z]+;|&#\d+;/gi, (entity) => {
      if (named[entity]) return named[entity];
      if (entity.startsWith("&#")) {
        const code = Number(entity.slice(2, -1));
        return Number.isFinite(code) ? String.fromCodePoint(code) : entity;
      }
      return entity;
    })
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) =>
      String.fromCodePoint(Number.parseInt(hex, 16))
    );
}

function renderTemplate(template: string): string {
  const { name, params, positional } = parseTemplate(template);
  const normalizedName = name.toLowerCase();
  if (normalizedName === "iconsap" || normalizedName === "icon") {
    return positional[0] ?? params.get("name") ?? "";
  }
  if (
    normalizedName === "tooltip" ||
    normalizedName === "hover" ||
    normalizedName === "abbr"
  ) {
    return positional[0] ?? params.get("name") ?? "";
  }
  if (normalizedName === "nbsp") return " ";
  if (normalizedName === "br" || normalizedName === "clear") return " ";
  if (normalizedName === "!" || normalizedName === "pipe") return "|";
  if (normalizedName.startsWith("#")) return "";
  return params.get("name") ?? positional[0] ?? "";
}

export function stripMarkup(input: string): string {
  let text = input;
  text = text.replace(/<!--[\s\S]*?-->/g, "");
  text = text.replace(/<ref[^>]*>[\s\S]*?<\/ref>/gi, "");
  text = text.replace(/<ref[^>]*\/>/gi, "");
  text = text.replace(/\[\[(?:File|Image):[^\]]*\]\]/gi, "");
  for (let pass = 0; pass < 25; pass++) {
    const next = text.replace(/\{\{([^{}]*)\}\}/g, (_, inner: string) =>
      renderTemplate(`{{${inner}}}`)
    );
    if (next === text) break;
    text = next;
  }
  text = text.replace(
    /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g,
    (_, target: string, display: string | undefined) =>
      (display ?? target).replace(/#.*$/, "")
  );
  text = text.replace(/'''?/g, "");
  text = text.replace(/\s*\*\s*/g, " ");
  text = text.replace(/<[^>]+>/g, " ");
  text = decodeEntities(text);
  return text.replace(/\s+/g, " ").trim();
}
