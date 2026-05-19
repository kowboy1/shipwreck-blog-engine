const WORDS_PER_MINUTE = 220

export function readingTimeMinutes(text: string): number {
  const words = text.trim().split(/\s+/).length
  return Math.max(1, Math.ceil(words / WORDS_PER_MINUTE))
}

export function readingTimeLabel(text: string): string {
  return `${readingTimeMinutes(text)} min read`
}
