/** Fun loading phrases for question generation — aimed at 10-11 year olds. */
const QUESTION_PHRASES = [
  "Cooking up a brain-buster...",
  "Summoning the question goblins...",
  "Digging through the vault of tricky questions...",
  "Sharpening pencils at lightning speed...",
  "Asking the math wizards for a good one...",
  "Loading brain fuel...",
  "Waking up the question hamsters...",
  "Consulting the ancient scroll of knowledge...",
  "Mixing up a fresh batch of brain teasers...",
  "Unleashing the quiz kraken...",
  "Rummaging through the brain attic...",
  "Warming up the thinking engines...",
  "Rolling the dice of destiny...",
  "Powering up the question cannon...",
  "Convincing the puzzle elves to cooperate...",
  "Charging the knowledge crystals...",
  "Downloading brainwaves from the cloud...",
  "Hunting for the perfect challenge...",
  "Assembling a worthy opponent for your brain...",
  "Tuning the difficulty dial juuust right...",
] as const;

const PASSAGE_PHRASES = [
  "Flipping through the library at warp speed...",
  "Finding you the perfect story...",
  "The bookworms are choosing a good one...",
  "Scanning the shelves for something interesting...",
  "Dusting off a great passage for you...",
  "Sending the reading robots on a mission...",
  "Picking a page-turner just for you...",
  "The book fairy is on her way...",
] as const;

/** Return a random fun phrase for question loading screens. */
export function getRandomQuestionPhrase(): string {
  return QUESTION_PHRASES[Math.floor(Math.random() * QUESTION_PHRASES.length)];
}

/** Return a random fun phrase for passage/reading loading screens. */
export function getRandomPassagePhrase(): string {
  return PASSAGE_PHRASES[Math.floor(Math.random() * PASSAGE_PHRASES.length)];
}
