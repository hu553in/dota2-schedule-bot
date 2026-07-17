const GRAPHEME_SEGMENTER = new Intl.Segmenter("en", {
  granularity: "grapheme",
});

export function graphemeBoundaryAtOrBefore(
  value: string,
  maximumCodeUnits: number
): number {
  let boundary = 0;
  for (const { index, segment } of GRAPHEME_SEGMENTER.segment(value)) {
    const end = index + segment.length;
    if (end > maximumCodeUnits) {
      break;
    }
    boundary = end;
  }
  return boundary;
}

export function isSingleGrapheme(value: string): boolean {
  const iterator = GRAPHEME_SEGMENTER.segment(value)[Symbol.iterator]();
  const first = iterator.next();
  return !first.done && iterator.next().done === true;
}

export function cleanText(value: string, limit: number): string {
  return [...value.replaceAll(/\s+/gu, " ").trim()].slice(0, limit).join("");
}

export function truncateText(value: string, limit: number): string {
  const characters = [...value];
  return characters.length <= limit
    ? value
    : `${characters.slice(0, limit - 1).join("")}…`;
}
