export function cleanText(value: string, limit: number): string {
  return [...value.replace(/\s+/gu, " ").trim()].slice(0, limit).join("");
}

export function truncateText(value: string, limit: number): string {
  const characters = [...value];
  return characters.length <= limit
    ? value
    : `${characters.slice(0, limit - 1).join("")}…`;
}
