import type { EssayPrompt } from "./writing-types";

export const ESSAY_PROMPTS: readonly EssayPrompt[] = [
  // ── Passage-Based Prompts (Hunter Exam Format) ────────────────────
  // Students read a passage, then write an essay responding to or
  // inspired by the ideas in it.
  {
    id: "hp_pb_curiosity",
    passage: "People say that curiosity killed the cat, but for human beings, curiosity is what makes us alive. The greatest discoveries in science did not come from people who already knew the answers. They came from people who asked the questions no one else thought to ask. Marie Curie did not set out to win a Nobel Prize. She set out to understand something that puzzled her. Albert Einstein once said, \"I have no special talents. I am only passionately curious.\" Curiosity is the engine that drives learning, and a mind that stops asking questions is a mind that has stopped growing.",
    passageSource: "Adapted from an educational essay on scientific curiosity",
    text: "The passage argues that curiosity is essential for learning and discovery. Do you agree that curiosity is more important than knowledge? Write an essay explaining your position. Use evidence from the passage and your own experience to support your ideas.",
    category: "persuasive",
  },
  {
    id: "hp_pb_failure",
    passage: "When Thomas Edison was asked about his many unsuccessful attempts to invent the light bulb, he reportedly said, \"I have not failed. I've just found 10,000 ways that won't work.\" J.K. Rowling's first Harry Potter manuscript was rejected by twelve publishers before one finally said yes. Michael Jordan was cut from his high school basketball team. What these stories share is a simple truth: failure is not the opposite of success — it is part of the path to success. The people we admire most are not the ones who never failed. They are the ones who refused to let failure be the final word.",
    passageSource: "Adapted from motivational speeches and biographical accounts",
    text: "According to the passage, failure is \"part of the path to success.\" Think about a time you or someone you know experienced failure or a setback. Write an essay explaining what happened, what was learned from the experience, and whether you agree with the passage's message about failure.",
    category: "expository",
  },
  {
    id: "hp_pb_reading",
    passage: "\"A reader lives a thousand lives before he dies,\" wrote George R.R. Martin. \"The man who never reads lives only one.\" Reading takes us places we could never visit, introduces us to people we could never meet, and lets us experience feelings we might never otherwise know. When you read about a character facing a bully, you learn something about courage. When you follow an explorer to the Arctic, you learn something about determination. Books are not just entertainment — they are rehearsals for real life.",
    passageSource: "George R.R. Martin and adapted commentary on reading",
    text: "The passage suggests that reading is like a \"rehearsal for real life.\" Do you agree that reading can prepare us for challenges we haven't faced yet? Write an essay explaining your position, using examples from books you've read and from your own experience.",
    category: "persuasive",
  },
  {
    id: "hp_pb_kindness",
    passage: "In 2007, a young college student named Julio Diaz was mugged at knifepoint in a New York City subway station. The teenage mugger took his wallet and started to walk away. But Diaz called out to him: \"Hey, wait! If you're going to be robbing people for the rest of the night, you might as well take my coat too. It's cold out.\" Confused, the teen stopped. Diaz then offered to buy him dinner. Over burgers, the teen returned the wallet and left with something more valuable — the memory of someone who chose kindness when he had every reason not to.",
    passageSource: "Adapted from NPR's StoryCorps, 2008",
    text: "In the passage, Julio Diaz responds to being robbed with an unexpected act of kindness. Why do you think he chose to respond this way? Write an essay explaining what Diaz's actions reveal about the power of kindness, and discuss whether you think his approach could make a real difference in the world.",
    category: "expository",
  },
  {
    id: "hp_pb_nature",
    passage: "The average American child spends over seven hours a day looking at screens and less than ten minutes a day in unstructured outdoor play. Richard Louv, who wrote Last Child in the Woods, calls this \"nature-deficit disorder.\" Studies show that children who spend time in nature are calmer, more creative, and better at solving problems. They sleep better and get along better with others. Yet parks sit empty while kids huddle over phones. We have built a world of infinite information and shrinking wonder.",
    passageSource: "Adapted from Richard Louv, Last Child in the Woods (2005)",
    text: "The passage describes \"nature-deficit disorder\" and argues that children need more time outdoors. Do you think spending time in nature is truly important for young people, or can technology provide similar benefits? Write an essay taking a clear position and supporting it with evidence from the passage and your own observations.",
    category: "persuasive",
  },
  {
    id: "hp_pb_courage",
    passage: "On December 1, 1955, Rosa Parks refused to give up her seat on a Montgomery, Alabama bus to a white passenger. She was arrested and fined. Her quiet act of defiance helped spark the Montgomery Bus Boycott, which lasted 381 days and became a turning point in the civil rights movement. Parks later said, \"I have learned over the years that when one's mind is made up, this diminishes fear; knowing what must be done does away with fear.\" She was not the first person to resist bus segregation — but her courage at that moment changed history.",
    passageSource: "Adapted from biographical accounts of Rosa Parks",
    text: "Rosa Parks said that \"knowing what must be done does away with fear.\" Write an essay explaining what you think she meant. Use evidence from the passage, and describe a time when you or someone you know found the courage to do what was right even when it was difficult.",
    category: "expository",
  },
  {
    id: "hp_pb_teamwork",
    passage: "In 2018, twelve boys and their soccer coach became trapped in a flooded cave in Thailand. The rescue took eighteen days and involved thousands of people from around the world — Thai Navy SEALs, British cave divers, Australian doctors, engineers, and volunteers who pumped millions of gallons of water. No single person could have accomplished what this team achieved together. When asked how such a complex rescue succeeded, one diver said simply, \"Everyone did their part.\"",
    passageSource: "Adapted from news coverage of the Tham Luang cave rescue, 2018",
    text: "The passage describes a rescue that required teamwork on a massive scale. Think about the statement \"Everyone did their part.\" Write an essay explaining why teamwork is sometimes more powerful than individual effort. Use examples from the passage and from your own experience.",
    category: "expository",
  },
  {
    id: "hp_pb_voice",
    passage: "In 2018, after a school shooting in Parkland, Florida, a group of high school students decided they would not wait for adults to solve the problem. They organized marches, gave speeches, and demanded action from lawmakers. Some critics said these students were too young to understand the issues. The students disagreed. Emma González, one of the student leaders, responded: \"Adults like us when we have strong test scores, but they hate us when we have strong opinions.\" Within months, their movement had inspired rallies in over 800 cities worldwide.",
    passageSource: "Adapted from news coverage of the March for Our Lives movement, 2018",
    text: "Emma González said that adults \"like us when we have strong test scores, but they hate us when we have strong opinions.\" Do you think young people's voices should carry weight on important issues? Write an essay taking a clear position and supporting it with evidence from the passage and your own reasoning.",
    category: "persuasive",
  },
  {
    id: "hp_pb_mistakes",
    passage: "In 1928, scientist Alexander Fleming returned from vacation to find that a mold had contaminated one of his petri dishes and killed the bacteria he was growing. Most people would have thrown it away. Instead, Fleming investigated the mold — and discovered penicillin, the world's first antibiotic, which has since saved hundreds of millions of lives. \"One sometimes finds what one is not looking for,\" Fleming later wrote. Many of the world's greatest innovations — from the microwave oven to sticky notes — started as accidents that someone was curious enough to explore.",
    passageSource: "Adapted from the history of Alexander Fleming's discovery",
    text: "The passage suggests that mistakes and accidents can lead to important discoveries. Write an essay explaining whether you agree or disagree. Can mistakes truly be valuable, or is careful planning always better? Use evidence from the passage and examples from your own life to support your position.",
    category: "persuasive",
  },
];

/** Track recently used prompt IDs to avoid repeats. */
const recentPromptIds: string[] = [];
const MAX_RECENT = 5;

export function getRandomPrompt(): EssayPrompt {
  // Prefer prompts not recently used
  const unused = ESSAY_PROMPTS.filter((p) => !recentPromptIds.includes(p.id));
  const pool = unused.length > 0 ? unused : ESSAY_PROMPTS;

  const index = Math.floor(Math.random() * pool.length);
  const selected = pool[index];

  // Track this prompt as recently used
  recentPromptIds.push(selected.id);
  if (recentPromptIds.length > MAX_RECENT) {
    recentPromptIds.shift();
  }

  return selected;
}

export function getPromptById(id: string): EssayPrompt | undefined {
  return ESSAY_PROMPTS.find((p) => p.id === id);
}

