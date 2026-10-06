# MVP Product Scope

## Candidate flow

1. Landing page
2. Sign up / sign in
3. Candidate profile
4. Resume upload
5. Resume parsing and profile review
6. Interview type selection
7. Language, duration, difficulty, and interviewer configuration
8. Camera/microphone check
9. Realtime interview
10. Interview completion
11. Delayed evaluation state
12. Result ready
13. Detailed report
14. Interview history

## MVP interview behavior

The interviewer should:

- Ask questions based on the selected interview definition.
- Use the candidate's resume/profile as context.
- Ask contextual follow-ups.
- Challenge unsupported or unclear answers.
- Adapt difficulty within configured limits.
- Handle natural interruptions and turn-taking.
- Maintain an interview state rather than producing unrelated questions.

## Evaluation

Initial evaluation dimensions:

- Knowledge and correctness
- Relevance
- Answer structure
- Communication clarity
- Technical depth where applicable
- Follow-up handling
- Evidence-based strengths and weaknesses

The system should not claim to infer intelligence, honesty, mental state, or other sensitive psychological traits from facial expressions or voice.

## Delayed result experience

When a session ends, the UI should show that evaluation is underway. A background worker processes the session and eventually marks the result as ready. This makes evaluation feel like a real post-interview outcome rather than an instant chatbot score.
