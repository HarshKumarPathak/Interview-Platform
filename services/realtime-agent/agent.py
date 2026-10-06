import asyncio
import json
import os
import urllib.error
import urllib.request

from dotenv import load_dotenv
from livekit import room_io
from livekit.agents import Agent, AgentServer, AgentSession, JobContext, TurnHandlingOptions, cli
from livekit.agents.llm import ChatMessage, StopResponse
from livekit.plugins import anam, openai
from openai.types.beta.realtime.session import TurnDetection

load_dotenv()
server = AgentServer()

PANEL_ROLES = {
    0: ("Technical Interviewer", "You lead the interview. Probe technical depth, projects, fundamentals, and problem solving."),
    1: ("HR Interviewer", "You are the HR/hiring interviewer. Probe communication, motivation, ownership, teamwork, and behavioral evidence."),
    2: ("Panel Interviewer", "You are the second technical/panel interviewer. Challenge assumptions, trade-offs, architecture, and reasoning."),
}


def interview_id_from_room(room_name: str) -> str | None:
    prefix = "interview-"
    return room_name[len(prefix):] if room_name.startswith(prefix) else None


def dispatch_metadata(ctx: JobContext) -> dict:
    raw = getattr(ctx.job, "metadata", "") or ""
    if not raw:
        return {}
    try:
        value = json.loads(raw)
        return value if isinstance(value, dict) else {}
    except (TypeError, ValueError, json.JSONDecodeError):
        return {}


async def publish_panel_identity(ctx: JobContext, panel_index: int, role_name: str, avatar_enabled: bool) -> None:
    attributes = {
        "interview.panel_index": str(panel_index),
        "interview.panel_role": role_name,
        "interview.avatar_enabled": "true" if avatar_enabled else "false",
    }
    try:
        await ctx.room.local_participant.set_attributes(attributes)
        await ctx.room.local_participant.set_name(role_name)
    except Exception as error:
        print(f"panel participant metadata unavailable: {error}")


async def fetch_context(interview_id: str) -> dict:
    base_url = os.getenv("WEB_APP_URL", "http://localhost:3000").rstrip("/")
    secret = os.getenv("LIVEKIT_AGENT_SHARED_SECRET", "")
    url = f"{base_url}/api/internal/interviews/{interview_id}/context"

    def request() -> dict:
        req = urllib.request.Request(url, headers={"x-livekit-agent-secret": secret, "accept": "application/json"})
        with urllib.request.urlopen(req, timeout=10) as response:
            return json.loads(response.read().decode("utf-8"))

    return await asyncio.to_thread(request)


async def persist_turn(interview_id: str, speaker: str, content: str, metadata: dict) -> None:
    base_url = os.getenv("WEB_APP_URL", "http://localhost:3000").rstrip("/")
    secret = os.getenv("LIVEKIT_AGENT_SHARED_SECRET", "")
    url = f"{base_url}/api/internal/interviews/{interview_id}/turns"
    payload = json.dumps({"speaker": speaker, "content": content, "metadata": metadata}).encode("utf-8")

    def request() -> None:
        req = urllib.request.Request(url, data=payload, method="POST", headers={"x-livekit-agent-secret": secret, "content-type": "application/json", "accept": "application/json"})
        with urllib.request.urlopen(req, timeout=10):
            return None

    try:
        await asyncio.to_thread(request)
    except (urllib.error.URLError, TimeoutError, ValueError) as error:
        print(f"turn persistence failed: {error}")


def build_instructions(context: dict, panel_index: int) -> str:
    interview = context.get("interview", {})
    candidate = context.get("candidate", {})
    resume = context.get("resume") or {}
    resume_context = resume.get("context") if isinstance(resume, dict) else {}
    resume_context = resume_context if isinstance(resume_context, dict) else {}
    role_name, role_policy = PANEL_ROLES.get(panel_index, PANEL_ROLES[0])
    skills = resume_context.get("skills", [])[:12]
    projects = [p.get("name") for p in resume_context.get("projects", []) if isinstance(p, dict) and p.get("name")][:8]
    experience = [" at ".join(str(value) for value in [item.get("role"), item.get("company")] if value) for item in resume_context.get("experience", []) if isinstance(item, dict)][:8]
    recent_turns = context.get("recent_turns") or []
    transcript_context = "\n".join(f"{turn.get('speaker')}: {turn.get('content')}" for turn in recent_turns[-10:] if turn.get("content"))
    policy = {
        "placement": "intro → technical → deep_dive → behavioral → closing",
        "hr": "intro → behavioral → deep_dive → closing",
        "upsc": "intro → technical → deep_dive → behavioral → closing",
        "college": "intro → technical → deep_dive → closing",
        "mba": "intro → behavioral → deep_dive → technical → closing",
        "ssb": "intro → behavioral → deep_dive → closing",
    }.get(str(interview.get("type", "placement")), "adaptive professional interview")
    return (
        f"You are {role_name}, one member of a live human-style interview panel. "
        "This is a video interview, not a chatbot. Behave like a real professional interviewer on Zoom/Meet: listen fully, use brief natural acknowledgements, leave short pauses, and ask one clear question at a time. "
        "You have access to the candidate's live camera video. Use visible, task-relevant signals such as whether they appear attentive, whether their response delivery is hesitant or confident, and whether their presentation is clear to adapt your next question. Never infer protected traits, health, emotion as fact, attractiveness, or personality from appearance, and never penalize a candidate for appearance. "
        "If the candidate interrupts you, stop speaking and listen. When an answer is vague, ask a concrete follow-up based on the answer. Never stack questions, narrate reasoning, or invent candidate facts. "
        f"Your panel responsibility: {role_policy} "
        "Only speak when the panel coordinator selects you for the next turn; otherwise remain silent. "
        f"Interview type: {interview.get('type')}. Difficulty: {interview.get('difficulty')}. Language: {interview.get('language')}. Panel size: {interview.get('panel_size')}. "
        f"Interview flow: {policy}. Candidate: {candidate.get('display_name')}. Headline: {candidate.get('headline')}. College: {candidate.get('college')}. Degree: {candidate.get('degree')}. Graduation year: {candidate.get('graduation_year')}. "
        f"Resume summary: {resume_context.get('summary', '')}. Skills: {', '.join(map(str, skills))}. Projects: {', '.join(map(str, projects))}. Experience: {', '.join(map(str, experience))}. "
        "Recent transcript context:\n" + (transcript_context or "(no previous turns)")
    )


def build_question_request(context: dict, question_index: int, previous_question: str | None, previous_answer: str | None) -> dict:
    interview = context.get("interview", {})
    candidate = context.get("candidate", {})
    resume = context.get("resume") or {}
    resume_context = resume.get("context") if isinstance(resume, dict) else {}
    resume_context = resume_context if isinstance(resume_context, dict) else {}
    return {
        "context": {
            "interview_type": interview.get("type", "placement"),
            "difficulty": interview.get("difficulty", "adaptive"),
            "language": interview.get("language", "English"),
            "candidate": {
                "name": candidate.get("display_name"), "headline": candidate.get("headline"), "college": candidate.get("college"), "degree": candidate.get("degree"), "graduation_year": candidate.get("graduation_year"),
                "resume_summary": resume_context.get("summary"), "skills": resume_context.get("skills", [])[:30],
                "projects": [p.get("name") for p in resume_context.get("projects", []) if isinstance(p, dict) and p.get("name")][:15],
                "experience": [" at ".join(str(value) for value in [item.get("role"), item.get("company")] if value) for item in resume_context.get("experience", []) if isinstance(item, dict)][:15],
            },
        },
        "question_index": question_index,
        "previous_question": previous_question,
        "previous_answer": previous_answer,
    }


async def generate_next_question(context: dict, question_index: int, previous_question: str | None, previous_answer: str | None) -> dict | None:
    base_url = os.getenv("AI_ENGINE_URL", "http://localhost:8000").rstrip("/")
    payload = json.dumps(build_question_request(context, question_index, previous_question, previous_answer), ensure_ascii=False).encode("utf-8")

    def request() -> dict:
        req = urllib.request.Request(f"{base_url}/v1/interview/question", data=payload, method="POST", headers={"content-type": "application/json", "accept": "application/json"})
        with urllib.request.urlopen(req, timeout=15) as response:
            return json.loads(response.read().decode("utf-8"))

    try:
        return await asyncio.to_thread(request)
    except (urllib.error.URLError, TimeoutError, ValueError, json.JSONDecodeError) as error:
        print(f"adaptive question engine unavailable: {error}")
        return None


class PanelInterviewer(Agent):
    def __init__(self, instructions: str, context: dict, panel_index: int, panel_size: int) -> None:
        self.interview_context = context
        self.panel_index = panel_index
        self.panel_size = panel_size
        self.question_index = len([turn for turn in context.get("recent_turns", []) if turn.get("speaker") == "candidate"])
        self.previous_question: str | None = next((turn.get("content") for turn in reversed(context.get("recent_turns") or []) if turn.get("speaker") == "interviewer" and turn.get("content")), None)
        self.pending_question: dict | None = None
        super().__init__(
            instructions=instructions,
            llm=openai.realtime.RealtimeModel(
                model=os.getenv("OPENAI_REALTIME_MODEL", "gpt-realtime"),
                turn_detection=TurnDetection(
                    type="semantic_vad",
                    eagerness="medium",
                    create_response=True,
                    interrupt_response=True,
                ),
            ),
        )

    async def on_user_turn_completed(self, turn_ctx, new_message: ChatMessage) -> None:
        answer = new_message.text_content.strip()
        if not answer:
            raise StopResponse()
        self.question_index += 1
        selected_panel_index = self.question_index % self.panel_size
        if selected_panel_index != self.panel_index:
            raise StopResponse()

        next_question = await generate_next_question(self.interview_context, self.question_index, self.previous_question, answer)
        if not next_question or not next_question.get("question"):
            raise StopResponse()
        self.pending_question = next_question
        self.previous_question = str(next_question["question"])
        role_name = PANEL_ROLES.get(self.panel_index, PANEL_ROLES[0])[0]
        await self.update_instructions(
            f"You are now the selected speaker, {role_name}. Continue naturally after the candidate's answer. "
            "Use the candidate's live video only as a contextual delivery signal, never as a judgment of appearance. "
            "Ask exactly the adaptive engine's selected question and nothing else: "
            f"{next_question['question']}"
        )


async def run_panel_agent(ctx: JobContext, panel_index: int) -> None:
    interview_id = interview_id_from_room(ctx.room.name)
    metadata = dispatch_metadata(ctx)
    if metadata.get("interviewId"):
        interview_id = str(metadata["interviewId"])
    if not interview_id:
        raise RuntimeError("LiveKit room name must be interview-{interviewId}")

    metadata_panel_index = metadata.get("panelIndex")
    if isinstance(metadata_panel_index, int):
        panel_index = metadata_panel_index
    try:
        context = await fetch_context(interview_id)
    except Exception as error:
        print(f"interview context unavailable: {error}")
        context = {"interview": {"type": "placement", "difficulty": "adaptive", "language": "English", "panel_size": 1}, "candidate": {}, "resume": {}, "recent_turns": []}

    interview = context.get("interview", {})
    panel_size = min(3, max(1, int(interview.get("panel_size") or 1)))
    if panel_index >= panel_size:
        return

    instructions = build_instructions(context, panel_index)
    agent = PanelInterviewer(instructions, context, panel_index, panel_size)
    avatar_api_key = os.getenv("ANAM_API_KEY", "").strip()
    avatar_id = os.getenv(f"ANAM_AVATAR_ID_{panel_index + 1}", "").strip() or (os.getenv("ANAM_AVATAR_ID", "").strip() if panel_index == 0 else "")
    avatar_enabled = os.getenv("INTERVIEW_AVATAR_PROVIDER", "none").strip().lower() == "anam" and bool(avatar_api_key and avatar_id)
    avatar = None

    session = AgentSession(turn_handling=TurnHandlingOptions(turn_detection="vad", preemptive_generation={"preemptive_tts": False}))
    await publish_panel_identity(ctx, panel_index, PANEL_ROLES.get(panel_index, PANEL_ROLES[0])[0], avatar_enabled)
    if avatar_enabled:
        avatar = anam.AvatarSession(
            persona_config=anam.PersonaConfig(name=os.getenv(f"ANAM_AVATAR_NAME_{panel_index + 1}", "") or (os.getenv("ANAM_AVATAR_NAME", "Interview Panel Lead") if panel_index == 0 else PANEL_ROLES.get(panel_index, PANEL_ROLES[0])[0]), avatarId=avatar_id),
            session_options=anam.SessionOptions(show_ai_avatar_disclosure=os.getenv("ANAM_SHOW_AI_DISCLOSURE", "true").lower() == "true"),
            api_key=avatar_api_key,
            avatar_participant_identity=f"interviewer-avatar-{panel_index + 1}",
            avatar_participant_name=PANEL_ROLES.get(panel_index, PANEL_ROLES[0])[0],
        )
        await avatar.start(session, room=ctx.room)
        await avatar.wait_for_join()

    @session.on("conversation_item_added")
    def on_conversation_item(event) -> None:
        item = event.item
        if not isinstance(item, ChatMessage):
            return
        text = item.text_content.strip()
        if not text or item.interrupted:
            return
        speaker = "candidate" if item.role == "user" else "interviewer"
        if speaker == "candidate" and panel_index != 0:
            return
        metadata = {"source": "livekit-agent", "realtime": True, "role": item.role, "panel_index": panel_index, "panel_size": panel_size, "avatar_enabled": avatar_enabled, "video_input_enabled": True, "video_adaptive_followup": True}
        if speaker == "interviewer":
            metadata["interviewer_name"] = PANEL_ROLES.get(panel_index, PANEL_ROLES[0])[0]
            if agent.pending_question:
                metadata.update({"question_index": agent.pending_question.get("question_index"), "stage": agent.pending_question.get("stage"), "question_source": agent.pending_question.get("source"), "rationale": agent.pending_question.get("rationale"), "follow_up": agent.pending_question.get("follow_up", False), "policy_focus": agent.pending_question.get("policy_focus", [])})
                agent.pending_question = None
        asyncio.create_task(persist_turn(interview_id, speaker, text, metadata))

    await session.start(agent=agent, room=ctx.room, room_options=room_io.RoomOptions(video_input=True, audio_output=not avatar_enabled))

    if panel_index == 0 and not context.get("recent_turns"):
        first_question = await generate_next_question(context, 0, None, None)
        if first_question and first_question.get("question"):
            agent.pending_question = first_question
            agent.previous_question = str(first_question["question"])
            await agent.update_instructions("Start the interview naturally. Greet the candidate briefly, observe their live presentation only as a delivery/context signal, then ask exactly this selected first question: " + str(first_question["question"]))
            await session.generate_reply(instructions=f"Ask the selected first question exactly: {first_question['question']}")
        else:
            await session.generate_reply(instructions="Start the interview naturally. Greet the candidate briefly, then ask one concise opening question.")


@server.rtc_session(agent_name="interview-agent-1")
async def interview_agent_1(ctx: JobContext):
    await run_panel_agent(ctx, 0)


@server.rtc_session(agent_name="interview-agent-2")
async def interview_agent_2(ctx: JobContext):
    await run_panel_agent(ctx, 1)


@server.rtc_session(agent_name="interview-agent-3")
async def interview_agent_3(ctx: JobContext):
    await run_panel_agent(ctx, 2)


if __name__ == "__main__":
    cli.run_app(server)
