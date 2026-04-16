import { useState, useRef, useCallback } from 'react'
import {
  DndContext,
  DragOverlay,
  useSensor,
  useSensors,
  PointerSensor,
  useDroppable,
} from '@dnd-kit/core'
import type { DragStartEvent } from '@dnd-kit/core'
import { v4 as uuidv4 } from 'uuid'
import { AGENT_DEFINITIONS } from './types'
import type { Agent, AgentType, Connection, ConnectionType } from './types'
import './App.css'

function AgentCard({
  agent,
  isDragging,
  onDelete,
}: {
  agent: Agent
  isDragging?: boolean
  onDelete?: () => void
}) {
  const def = AGENT_DEFINITIONS.find((d) => d.type === agent.type)
  return (
    <div className={`agent-card ${isDragging ? 'dragging' : ''}`}>
      <div className="agent-card-header">
        <span className="agent-icon">{def?.icon}</span>
        <span className="agent-name">{def?.name}</span>
      </div>
      <p className="agent-desc">{def?.description}</p>
      {onDelete && (
        <button className="agent-delete" onClick={onDelete} title="Remove agent">
          ×
        </button>
      )}
    </div>
  )
}

function SidebarAgent({
  agentDef,
  onDragStart,
}: {
  agentDef: typeof AGENT_DEFINITIONS[0]
  onDragStart: (type: AgentType) => void
}) {
  return (
    <div
      className="sidebar-agent"
      onDragStart={() => onDragStart(agentDef.type)}
      draggable
    >
      <span className="agent-icon">{agentDef.icon}</span>
      <span className="agent-name">{agentDef.name}</span>
    </div>
  )
}

function Canvas({
  agents,
  connections,
  onAddAgent,
  onRemoveAgent,
  onUpdateAgent,
  onAddConnection,
  onRemoveConnection,
  draggedType,
  setDraggedType,
}: {
  agents: Agent[]
  connections: Connection[]
  onAddAgent: (agent: Agent) => void
  onRemoveAgent: (id: string) => void
  onUpdateAgent: (id: string, x: number, y: number) => void
  onAddConnection: (conn: Connection) => void
  onRemoveConnection: (id: string) => void
  draggedType: AgentType | null
  setDraggedType: (type: AgentType | null) => void
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: 'canvas',
  })
  const canvasRef = useRef<HTMLDivElement>(null)
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null)
  const [connectionMode, setConnectionMode] = useState<'sequential' | 'parallel' | 'feedback' | null>(null)
  const [connectionStart, setConnectionStart] = useState<string | null>(null)

  const handleCanvasClick = (e: React.MouseEvent) => {
    if (e.target === canvasRef.current) {
      setSelectedAgent(null)
      setConnectionMode(null)
      setConnectionStart(null)
    }
  }

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      if (!draggedType || !canvasRef.current) return

      const rect = canvasRef.current.getBoundingClientRect()
      const x = e.clientX - rect.left
      const y = e.clientY - rect.top

      const newAgent: Agent = {
        id: uuidv4(),
        type: draggedType,
        x,
        y,
      }
      onAddAgent(newAgent)
      setDraggedType(null)
    },
    [draggedType, onAddAgent, setDraggedType]
  )

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
  }, [])

  const handleAgentClick = (agentId: string) => {
    if (connectionMode && connectionStart) {
      if (connectionStart !== agentId) {
        const newConn: Connection = {
          id: uuidv4(),
          from: connectionStart,
          to: agentId,
          type: connectionMode,
        }
        onAddConnection(newConn)
      }
      setConnectionMode(null)
      setConnectionStart(null)
    } else {
      setSelectedAgent(agentId)
    }
  }

  const handleCanvasMouseMove = (e: React.MouseEvent) => {
    if (!selectedAgent || !canvasRef.current) return

    const rect = canvasRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    onUpdateAgent(selectedAgent, x, y)
  }

  const handleCanvasMouseUp = () => {
    setSelectedAgent(null)
  }

  const startConnection = (agentId: string, type: ConnectionType) => {
    setConnectionMode(type)
    setConnectionStart(agentId)
  }

  return (
    <div
      ref={setNodeRef}
      className={`canvas ${isOver ? 'drag-over' : ''}`}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onClick={handleCanvasClick}
      onMouseMove={handleCanvasMouseMove}
      onMouseUp={handleCanvasMouseUp}
    >
      <div ref={canvasRef} className="canvas-area">
        {agents.map((agent) => (
          <div
            key={agent.id}
            className={`canvas-agent ${selectedAgent === agent.id ? 'selected' : ''}`}
            style={{ left: agent.x, top: agent.y }}
            onClick={(e) => {
              e.stopPropagation()
              handleAgentClick(agent.id)
            }}
          >
            <AgentCard agent={agent} onDelete={() => onRemoveAgent(agent.id)} />
            {selectedAgent === agent.id && (
              <div className="connection-buttons">
                <button
                  className="conn-btn seq"
                  onClick={(e) => {
                    e.stopPropagation()
                    startConnection(agent.id, 'sequential')
                  }}
                  title="Connect Sequential"
                >
                  →
                </button>
                <button
                  className="conn-btn par"
                  onClick={(e) => {
                    e.stopPropagation()
                    startConnection(agent.id, 'parallel')
                  }}
                  title="Connect Parallel"
                >
                  ⤢
                </button>
                <button
                  className="conn-btn feed"
                  onClick={(e) => {
                    e.stopPropagation()
                    startConnection(agent.id, 'feedback')
                  }}
                  title="Connect Feedback"
                >
                  ↻
                </button>
              </div>
            )}
          </div>
        ))}
        <svg className="connections-layer">
          {connections.map((conn) => {
            const from = agents.find((a) => a.id === conn.from)
            const to = agents.find((a) => a.id === conn.to)
            if (!from || !to) return null
            const x1 = from.x + 80
            const y1 = from.y + 30
            const x2 = to.x + 80
            const y2 = to.y + 30
            const midY = (y1 + y2) / 2
            return (
              <g key={conn.id} onClick={() => onRemoveConnection(conn.id)} className="connection-line">
                {conn.type === 'feedback' ? (
                  <path
                    d={`M ${x1} ${y1} C ${x1} ${y1 - 80}, ${x2} ${y2 + 80}, ${x2} ${y2}`}
                    className="connection-path feedback"
                  />
                ) : conn.type === 'parallel' ? (
                  <path
                    d={`M ${x1} ${y1} C ${x1 + 60} ${y1}, ${x2 - 60} ${y2}, ${x2} ${y2}`}
                    className="connection-path parallel"
                  />
                ) : (
                  <line x1={x1} y1={y1} x2={x2} y2={y2} className="connection-path sequential" />
                )}
                <text x={(x1 + x2) / 2} y={midY - 10} className="connection-label">
                  {conn.type === 'sequential' ? '→' : conn.type === 'parallel' ? '⤢' : '↻'}
                </text>
              </g>
            )
          })}
          {connectionMode && connectionStart && (
            <text x={20} y={30} className="connection-mode-indicator">
              Click target agent to connect ({connectionMode})
            </text>
          )}
        </svg>
      </div>
      <div className="canvas-empty">
        {agents.length === 0 && 'Drag agents from the sidebar to build your pipeline'}
      </div>
    </div>
  )
}

function App() {
  const [agents, setAgents] = useState<Agent[]>([])
  const [connections, setConnections] = useState<Connection[]>([])
  const [draggedType, setDraggedType] = useState<AgentType | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  )

  const handleDragStart = (e: DragStartEvent) => {
    const type = e.active.data.current as unknown as AgentType | undefined
    if (type) {
      setDraggedType(type)
    }
  }

  const handleDragEnd = () => {
    setDraggedType(null)
  }

  const addAgent = (agent: Agent) => {
    setAgents((prev) => [...prev, agent])
  }

  const removeAgent = (id: string) => {
    setAgents((prev) => prev.filter((a) => a.id !== id))
    setConnections((prev) => prev.filter((c) => c.from !== id && c.to !== id))
  }

  const updateAgent = (id: string, x: number, y: number) => {
    setAgents((prev) => prev.map((a) => (a.id === id ? { ...a, x, y } : a)))
  }

  const addConnection = (conn: Connection) => {
    setConnections((prev) => [...prev, conn])
  }

  const removeConnection = (id: string) => {
    setConnections((prev) => prev.filter((c) => c.id !== id))
  }

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="app">
        <header className="header">
          <h1>Hive</h1>
          <p className="subtitle">No-Code AI Agent Teams Builder</p>
        </header>
        <div className="main">
          <aside className="sidebar">
            <h2>Agents</h2>
            <p className="sidebar-hint">Drag agents to canvas</p>
            <div className="agent-list">
              {AGENT_DEFINITIONS.map((def) => (
                <SidebarAgent key={def.type} agentDef={def} onDragStart={setDraggedType} />
              ))}
            </div>
          </aside>
          <Canvas
            agents={agents}
            connections={connections}
            onAddAgent={addAgent}
            onRemoveAgent={removeAgent}
            onUpdateAgent={updateAgent}
            onAddConnection={addConnection}
            onRemoveConnection={removeConnection}
            draggedType={draggedType}
            setDraggedType={setDraggedType}
          />
        </div>
      </div>
      <DragOverlay>
        {draggedType && (
          <div className="drag-overlay">
            <AgentCard agent={{ id: '', type: draggedType, x: 0, y: 0 }} isDragging />
          </div>
        )}
      </DragOverlay>
    </DndContext>
  )
}

export default App
