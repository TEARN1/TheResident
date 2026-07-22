'use client'

import React, { useState } from 'react'
import { Home, Users, RotateCw, Check, Award } from 'lucide-react'
import { fairnessNote, reputationTier, type FairnessRow } from '../../../utils/logic'
import type { ChoreAssignment } from '../../../store'

interface HouseholdMember {
  userId: string
  name: string
  role: string
}

interface HouseholdTabProps {
  /** The listing that forms this household — null when the user has none. */
  householdListingId: string | null
  householdName: string
  members: HouseholdMember[]
  chores: ChoreAssignment[]
  reputationScores: Record<string, number>
  currentUserId: string
  onRotate: (tasks: string[], days: string[]) => void
  onComplete: (choreId: string) => void
  styles: Record<string, React.CSSProperties>
}

const DEFAULT_TASKS = ['Kitchen', 'Bathroom', 'Bins', 'Yard', 'Common area']
const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']

export default function HouseholdTab({
  householdListingId,
  householdName,
  members,
  chores,
  reputationScores,
  currentUserId,
  onRotate,
  onComplete,
  styles
}: HouseholdTabProps) {
  const [tasks, setTasks] = useState<string[]>(DEFAULT_TASKS)
  const [newTask, setNewTask] = useState('')

  // No household = no chores. This is the gate that was missing: chores need a
  // listing_id, and nothing in the app ever supplied one.
  if (!householdListingId) {
    return (
      <div className="glass-panel" style={{ padding: '2rem', borderRadius: '12px', marginTop: '1rem' }}>
        <div style={styles.emptyStateStyle}>
          <Home size={32} color="#D4AF37" />
          <p style={{ fontWeight: 'bold', color: 'var(--text-primary, #fff)' }}>You are not in a household yet</p>
          <p style={{ fontSize: '0.8rem', color: '#888', maxWidth: '420px', margin: '0.5rem auto' }}>
            A household forms when a landlord approves your room application — or, if you are a landlord,
            when you list a room. Chores, the rota and household disputes unlock then.
          </p>
        </div>
      </div>
    )
  }

  const nameOf = (id: string) => members.find(m => m.userId === id)?.name || 'Housemate'

  const fairnessRows: FairnessRow[] = members.map(m => ({
    userId: m.userId,
    completed: chores.filter(c => c.roommateId === m.userId && c.status === 'completed').length,
    assigned: chores.filter(c => c.roommateId === m.userId).length
  }))
  const imbalance = fairnessNote(fairnessRows, nameOf)

  return (
    <div className="responsive-two-col" style={{ display: 'grid', gridTemplateColumns: '1.8fr 1.2fr', gap: '1.5rem', marginTop: '1rem' }}>
      {/* Rota */}
      <div className="glass-panel" style={{ padding: '1.2rem', borderRadius: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '0.8rem' }}>
          <h3 style={{ ...styles.panelTitleStyle, borderBottom: 'none', margin: 0 }}>
            {householdName || 'Your household'}
          </h3>
          <button
            onClick={() => onRotate(tasks, DAYS.slice(0, tasks.length))}
            className="btn-gold"
            style={{ marginLeft: 'auto', padding: '0.4rem 0.8rem', fontSize: '0.75rem', cursor: 'pointer' }}
          >
            <RotateCw size={12} style={{ verticalAlign: 'middle' }} /> Rotate this week
          </button>
        </div>

        <p style={{ fontSize: '0.75rem', color: '#888', margin: '0 0 1rem 0' }}>
          Tasks are dealt round-robin across the household, and the starting person shifts each week
          so the same one isn&apos;t always first.
        </p>

        {/* Task editor */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginBottom: '0.8rem' }}>
          {tasks.map(t => (
            <span
              key={t}
              style={{
                fontSize: '0.7rem', padding: '0.2rem 0.5rem', borderRadius: '4px',
                background: 'rgba(212,175,55,0.12)', border: '1px solid rgba(212,175,55,0.4)', color: '#D4AF37'
              }}
            >
              {t}
              <button
                onClick={() => setTasks(ts => ts.filter(x => x !== t))}
                aria-label={`Remove ${t}`}
                style={{ background: 'none', border: 'none', color: '#D4AF37', cursor: 'pointer', marginLeft: '0.3rem', padding: 0 }}
              >
                ×
              </button>
            </span>
          ))}
        </div>
        <form
          onSubmit={e => {
            e.preventDefault()
            const t = newTask.trim()
            if (!t || tasks.includes(t)) return
            setTasks(ts => [...ts, t])
            setNewTask('')
          }}
          style={{ display: 'flex', gap: '0.4rem', marginBottom: '1rem' }}
        >
          <label htmlFor="chore-new" className="sr-only" style={{ display: 'none' }}>Add a task</label>
          <input
            id="chore-new"
            value={newTask}
            onChange={e => setNewTask(e.target.value)}
            placeholder="Add a task"
            style={{ ...styles.inputStyle, flex: 1 }}
          />
          <button type="submit" style={{ ...styles.inputStyle, cursor: 'pointer', width: 'auto', padding: '0 0.8rem' }}>Add</button>
        </form>

        {chores.length === 0 ? (
          <div style={styles.emptyStateStyle}>
            <Users size={28} color="#D4AF37" />
            <p>No chores assigned yet. Hit &ldquo;Rotate this week&rdquo;.</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.8rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', color: '#D4AF37' }}>
                  <th style={{ padding: '0.6rem 0.4rem' }}>Day</th>
                  <th style={{ padding: '0.6rem 0.4rem' }}>Who</th>
                  <th style={{ padding: '0.6rem 0.4rem' }}>Task</th>
                  <th style={{ padding: '0.6rem 0.4rem', textAlign: 'right' }}>Done?</th>
                </tr>
              </thead>
              <tbody>
                {chores.map(chore => (
                  <tr key={chore.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <td style={{ padding: '0.6rem 0.4rem', fontWeight: 'bold' }}>{chore.dayOfWeek}</td>
                    <td style={{ padding: '0.6rem 0.4rem' }}>{nameOf(chore.roommateId)}</td>
                    <td style={{ padding: '0.6rem 0.4rem', color: '#ccc' }}>{chore.taskName}</td>
                    <td style={{ padding: '0.6rem 0.4rem', textAlign: 'right' }}>
                      {chore.status === 'completed' ? (
                        <Check size={14} color="#22c55e" />
                      ) : chore.roommateId === currentUserId ? (
                        <button
                          className="btn-gold"
                          onClick={() => onComplete(chore.id)}
                          style={{ padding: '0.2rem 0.5rem', fontSize: '0.7rem', cursor: 'pointer' }}
                        >
                          Done
                        </button>
                      ) : (
                        <span style={{ color: '#666', fontSize: '0.7rem' }}>pending</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Roster + standing */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div className="glass-panel" style={{ padding: '1.2rem', borderRadius: '12px' }}>
          <h3 style={{ ...styles.panelTitleStyle, borderBottom: 'none', marginTop: 0 }}>Housemates</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {members.map(m => (
              <div key={m.userId} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.5rem 0.7rem', borderRadius: '6px', background: 'rgba(0,0,0,0.2)' }}>
                <Users size={14} color="#D4AF37" />
                <span style={{ fontSize: '0.8rem', color: 'var(--text-primary, #fff)' }}>{m.name}</span>
                <span style={{ marginLeft: 'auto', fontSize: '0.65rem', color: '#888' }}>{m.role}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '1.2rem', borderRadius: '12px' }}>
          <h3 style={{ ...styles.panelTitleStyle, borderBottom: 'none', marginTop: 0 }}>Standing</h3>

          {/* Imbalance is named gently, and only when it's real */}
          {imbalance && (
            <p style={{ fontSize: '0.75rem', color: '#D4AF37', background: 'rgba(212,175,55,0.1)', padding: '0.6rem', borderRadius: '6px', margin: '0 0 0.8rem 0' }}>
              {imbalance}
            </p>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {members.map(m => (
              <div key={m.userId} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.5rem 0.7rem', borderRadius: '6px', background: 'rgba(0,0,0,0.2)' }}>
                <Award size={14} color="#22c55e" />
                <span style={{ fontSize: '0.8rem', color: 'var(--text-primary, #fff)' }}>{m.name}</span>
                <span style={{ marginLeft: 'auto', fontSize: '0.7rem', color: '#22c55e' }}>
                  {reputationTier(reputationScores[m.userId] || 0)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
