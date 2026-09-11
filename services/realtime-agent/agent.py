import os

from dotenv import load_dotenv
from livekit.agents import Agent, AgentServer, AgentSession, JobContext, cli
from livekit.plugins import openai

load_dotenv()

server = AgentServer()


class Interviewer(Agent):
    def __init__(self) -> None:
        super().__init__(
            instructions=(
                "You are a professional AI interviewer. Conduct a realistic, concise interview. "
                "Ask one question at a time, listen carefully, use natural follow-ups, and do not "
                "invent candidate facts. Challenge unsupported claims with specific evidence questions. "
                "Never infer personality, intelligence, honesty, health, or other sensitive traits from voice or video. "
                "If the candidate interrupts, stop speaking and respond naturally to the new turn."
            ),
            llm=openai.realtime.RealtimeModel(
                model=os.getenv("OPENAI_REALTIME_MODEL", "gpt-realtime"),
            ),
        )


@server.rtc_session(agent_name="interview-agent")
async def interview_agent(ctx: JobContext):
    session = AgentSession()
    await session.start(agent=Interviewer(), room=ctx.room)
    await session.generate_reply(
        instructions="Greet the candidate briefly and ask the first interview question."
    )


if __name__ == "__main__":
    cli.run_app(server)
