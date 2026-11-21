/**
 * Act 1 Staff dialogue used by both the subtitles and the generated audio.
 *
 * The first three lines are a light naturalisation of the original authored
 * copy; no story fact, character identity or task state changed. The original
 * strings are kept here so the before/after can be reviewed without git
 * archaeology. `thanks` and `repeat` are short conversational additions that
 * match the generated five-line take.
 */
export const STAFF_DIALOGUE = {
  intro: [
    "Hey — you're one of the Student Ambassadors, right?",
    "Could you do me a quick favour? We need the presentation MacBook from Building 6 for tonight's dinner.",
    "It's on the office table. Mind picking it up? We're running a bit behind.",
  ],
  thanks: "Perfect, thanks! Just bring it back here when you've got it.",
  repeat: 'Hey — any luck with that laptop?',
  playerAccept: "Yeah, I'll collect it.",
  original: {
    line1: "You're one of our Student Ambassadors, right?",
    line2:
      "We need the presentation MacBook from Building 6 for tonight's dinner. Could you collect it and bring it back here?",
    line3: 'The device is waiting on the office table in Building 6.',
  },
} as const;

export type StaffIntroLine = (typeof STAFF_DIALOGUE.intro)[number];
