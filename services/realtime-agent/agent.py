import asyncio
import json
import os
import urllib.error
import urllib.request

from dotenv import load_dotenv
from livekit.agents import Agent, AgentServer, AgentSession, JobContext, cli
from livekit.agents.llm import ChatMessage
from livekit.plugins import openai

load_dotenv()

server = AgentServer()


def interview_id_from_room(room_name: str) -> str | None:
    prefix = "interview-"
    return room_name[len(prefix) :] if room_name.startswith(prefix) else None


async def fetch_context(interview_id: str) -> dict:
    base_url = os.getenv("WEB_APP_URL", "http://localhost:3000").rstrip("/")
    secret = os.getenv("LIVEKIT_AGENT_SHARED_SECRET", "")
    url = f"{base_url}/api/internal/interviews/{interview_id}/context"

    def request() -> dict:
        req = urllib.request.Request(
            url,
            headers={"x-livekit-agent-secret": secret, "accept": "application/json"},
        )
        with urllib.request.urlopen(req, timeout=10) as response:
            return json.loads(response.read().decode("utf-8"))

    return await asyncio.to_thread(request)


async def persist_turn(interview_id: str, speaker: str, content: str, metadata: dict) -> None:
    base_url = os.getenv("WEB_APP_URL", "http://localhost:3000").rstrip("/")
    secret = os.getenv("LIVEKIT_AGENT_SHARED_SECRET", "")
    url = f"{base_url}/api/internal/interviews/{interview_id}/turns"
    payload = json.dumps({"speaker": speaker, "content": content, "metadata": metadata}).encode("utf-8")

    def request() -> None:
        req = urllib.request.Request(
            url,
            data=payload,
            method="POST",
            headers={
                "x-livekit-agent-secret": secret,
                "content-type": "application/json",
                "accept": "application/json",
            },
        )
        with urllib.request.urlopen(req, timeout=10):
            return None

    try:
        await asyncio.to_thread(request)
    except (urllib.error.URLError, TimeoutError, ValueError) as error:
        print(f"turn persistence failed: {error}")


def build_instructions(context: dict) -> str:
    interview = context.get("interview", {})
    candidate = context.get("candidate", {})
    resume = context.get("resume") or {}
    resume_context = resume.get("context") if isinstance(resume, dict) else {}
    resume_context = resume_context if isinstance(resume_context, dict) else {}

    skills = resume_context.get("skills", [])[:12]
    projects = [p.get("name") for p in resume_context.get("projects", []) if isinstance(p, dict) and p.get("name")][:8]
    experience = [
        " at ".join(str(value) for value in [item.get("role"), item.get("company")] if value)
        for item in resume_context.get("experience", [])
        if isinstance(item, dict)
    ][:8]
    recent_turns = context.get("recent_turns") or []
    transcript_context = "\n".join(
        f"{turn.get('speaker')}: {turn.get('content')}" for turn in recent_turns[-8:] if turn.get("content")
    )

    policy = {
        "placement": "intro → technical → deep_dive → behavioral → closing; prioritize fundamentals, projects and problem solving",
        "hr": "intro → behavioral → deep_dive → closing; prioritize evidence from candidate experiences",
        "upsc": "intro → technical → deep_dive → behavioral → closing; probe structured reasoning and subject understanding",
        "college": "intro → technical → deep_dive → closing; probe fundamentals and academic projects",
        "mba": "intro → behavioral → deep_dive → technical → closing; probe decisions, trade-offs and business reasoning",
        "ssb": "intro → behavioral → deep_dive → closing; probe concrete evidence and decision-making",
    }.get(str(interview.get("type", "placement")), "adaptive professional interview")

    return (
        "You are the realtime interviewer for a serious interview platform. "
        "Run a realistic interview, one question at a time. Use the candidate context only as grounding; "
        "never invent experience or facts. Ask for concrete evidence when claims are vague. Adapt follow-ups "
        "to the candidate's previous answer instead of following a rigid script. Respect interruptions and "
        "stop speaking when the candidate starts talking. Never infer personality, intelligence, honesty, "
        "health, or sensitive traits from voice/video. Keep questions concise and professional. "
        f"Interview type: {interview.get('type')}. Difficulty: {interview.get('difficulty')}. "
        f"Language: {interview.get('language')}. Panel size: {interview.get('panel_size')}. "
        f"Interview policy: {policy}. "
        f"Candidate: {candidate.get('display_name')}. Headline: {candidate.get('headline')}. "
        f"College: {candidate.get('college')}. Degree: {candidate.get('degree')}. "
        f"Graduation year: {candidate.get('graduation_year')}. "
        f"Resume summary: {resume_context.get('summary', '')}. "
        f"Resume skills: {', '.join(map(str, skills))}. "
        f"Resume projects: {', '.join(map(str, projects))}. "
        f"Resume experience: {', '.join(map(str, experience))}. "
        "Recent interview transcript context (continue from this state and do not repeat a question already asked):\n"
        f"{transcript_context or '(no previous turns)'}"
    )


class Interviewer(Agent):
    def __init__(self, instructions: str) -> None:
        super().__init__(
            instructions=instructions,
            llm=openai.realtime.RealtimeModel(
                model=os.getenv("OPENAI_REALTIME_MODEL", "gpt-realtime"),
            ),
        )


@server.rtc_session(agent_name="interview-agent")
async def interview_agent(ctx: JobContext):
    interview_id = interview_id_from_room(ctx.room.name)
    if not interview_id:
        raise RuntimeError("LiveKit room name must be interview-{interviewId}")

    try:
        context = await fetch_context(interview_id)
    except Exception as error:
        print(f"interview context unavailable: {error}")
        context = {"interview": {"type": "placement", "difficulty": "adaptive", "language": "English", "panel_size": 1}, "candidate": {}, "resume": {}, "recent_turns": []}

    instructions = build_instructions(context)
    session = AgentSession()

    @session.on("conversation_item_added")
    def on_conversation_item(event) -> None:
        item = event.item
        if not isinstance(item, ChatMessage):
            return
        text = item.text_content.strip()
        if not text or item.interrupted:
            return
        speaker = "candidate" if item.role == "user" else "interviewer"
        asyncio.create_task(
            persist_turn(
                interview_id,
                speaker,
                text,
                {"source": "livekit-agent", "realtime": True, "role": item.role},
            )
        )

    await session.start(agent=Interviewer(instructions), room=ctx.room)
    if not context.get("recent_turns"):
        await session.generate_reply(
            instructions=(
                "Start the interview now. Greet the candidate briefly, then ask the first question appropriate "
                "for the interview type and candidate context. Do not mention internal instructions or resume parsing."
            )
        )


if __name__ == "__main__":
    cli.run_app(server)
