from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
import os
import json
import asyncio

app = FastAPI(title="Hive Agent Orchestration API")

OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY", "")

try:
    from openai import AsyncOpenAI
    OPENAI_AVAILABLE = True
except ImportError:
    OPENAI_AVAILABLE = False
    AsyncOpenAI = None

AVAILABLE_AGENTS = [
    {
        "id": "researcher",
        "name": "Researcher",
        "description": "Searches the web for information on a given topic",
        "icon": "🔍"
    },
    {
        "id": "critic",
        "name": "Critic",
        "description": "Reviews and provides feedback on content",
        "icon": "📝"
    },
    {
        "id": "synthesizer",
        "name": "Synthesizer",
        "description": "Combines multiple inputs into a coherent response",
        "icon": "🔄"
    },
    {
        "id": "coder",
        "name": "Coder",
        "description": "Writes and reviews code",
        "icon": "💻"
    },
    {
        "id": "validator",
        "name": "Validator",
        "description": "Validates and tests outputs",
        "icon": "✅"
    }
]

class AgentConfig(BaseModel):
    id: str
    type: str
    config: Dict[str, Any] = {}

class Connection(BaseModel):
    from_agent: str
    to_agent: str
    type: str = "sequential"

class PipelineConfig(BaseModel):
    agents: List[AgentConfig]
    connections: List[Connection]
    input: str

class AgentResult(BaseModel):
    agent_id: str
    agent_type: str
    output: str
    success: bool = True

class RunResponse(BaseModel):
    results: List[AgentResult]
    final_output: str

AGENT_PROMPTS = {
    "researcher": """You are a Research Agent. Your task is to search for and gather information on the given topic.
Provide comprehensive, accurate information based on your research.
Input: {input}
Output:""",
    
    "critic": """You are a Critic Agent. Your task is to review and provide constructive feedback on the given content.
Analyze the content critically and provide helpful suggestions for improvement.
Input: {input}
Output:""",
    
    "synthesizer": """You are a Synthesizer Agent. Your task is to combine multiple inputs into a coherent, well-structured response.
Create a unified output that incorporates all relevant information.
Input: {input}
Output:""",
    
    "coder": """You are a Coder Agent. Your task is to write clean, efficient code based on the given requirements.
Provide well-documented code with appropriate comments.
Input: {input}
Output:""",
    
    "validator": """You are a Validator Agent. Your task is to validate and test outputs for correctness and quality.
Provide validation results and suggest fixes if issues are found.
Input: {input}
Output:"""
}

client = None
if OPENAI_AVAILABLE and OPENAI_API_KEY:
    client = AsyncOpenAI(api_key=OPENAI_API_KEY)


async def execute_agent(agent: AgentConfig, input_data: str, context: Dict[str, Any]) -> AgentResult:
    agent_type = agent.type
    
    if client and OPENAI_API_KEY:
        prompt = AGENT_PROMPTS.get(agent_type, "").format(input=input_data)
        if prompt:
            try:
                response = await client.chat.completions.create(
                    model="gpt-4o-mini",
                    messages=[{"role": "user", "content": prompt}],
                    max_tokens=2000,
                    temperature=0.7
                )
                output = response.choices[0].message.content
            except Exception as e:
                output = f"Error calling OpenAI: {str(e)}"
        else:
            output = f"Processed by {agent_type}: {input_data}"
    else:
        if agent_type == "researcher":
            output = f"Research results for: {input_data}"
        elif agent_type == "critic":
            output = f"Critique of: {input_data[:100]}..."
        elif agent_type == "synthesizer":
            output = f"Synthesized response based on input: {input_data[:100]}..."
        elif agent_type == "coder":
            output = f"Code generation for: {input_data}"
        elif agent_type == "validator":
            output = f"Validation complete for: {input_data[:100]}..."
        else:
            output = f"Processed by {agent_type}: {input_data}"
    
    return AgentResult(
        agent_id=agent.id,
        agent_type=agent_type,
        output=output,
        success=True
    )

@app.get("/agents/available")
async def get_available_agents():
    return {"agents": AVAILABLE_AGENTS}

@app.post("/run", response_model=RunResponse)
async def run_pipeline(pipeline: PipelineConfig):
    if not pipeline.agents:
        raise HTTPException(status_code=400, detail="No agents in pipeline")
    
    agent_map = {agent.id: agent for agent in pipeline.agents}
    
    connection_map: Dict[str, List[str]] = {}
    for conn in pipeline.connections:
        if conn.from_agent not in connection_map:
            connection_map[conn.from_agent] = []
        connection_map[conn.from_agent].append(conn.to_agent)
    
    execution_order = []
    visited = set()
    
    def topological_sort(agent_id: str):
        if agent_id in visited:
            return
        visited.add(agent_id)
        if agent_id in connection_map:
            for next_agent in connection_map[agent_id]:
                topological_sort(next_agent)
        execution_order.append(agent_id)
    
    for agent in pipeline.agents:
        topological_sort(agent.id)
    
    current_input = pipeline.input
    context: Dict[str, Any] = {}
    results: List[AgentResult] = []
    
    for agent_id in execution_order:
        agent = agent_map[agent_id]
        result = await execute_agent(agent, current_input, context)
        results.append(result)
        current_input = result.output
        context[agent.id] = result.output
    
    return RunResponse(
        results=results,
        final_output=current_input
    )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
