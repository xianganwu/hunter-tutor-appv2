/**
 * Count the number of words in a text string.
 * Shared utility — used by EssayEditor, WritingWorkshop, SimulationSession, and API routes.
 */
export function countWords(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
}
