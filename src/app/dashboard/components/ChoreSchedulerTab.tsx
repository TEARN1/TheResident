import React from 'react'
import { t } from '../../../utils/i18n'
import { fairnessNote, type FairnessRow } from '../../../utils/logic'

interface Chore {
  id: string
  dayOfWeek: string
  roommateId: string
  roommateName: string
  taskName: string
  status: 'pending' | 'completed'
}

interface ChoreSchedulerTabProps {
  communityChores: Chore[]
  currentUser: { name: string; balance: number; id: string } | null
  reputationScores: Record<string, number>
  handleCompleteChore: (id: string, taskName: string) => void
  lang: 'en' | 'zu' | 'xh' | 'af'
  styles: Record<string, React.CSSProperties>
}

export default function ChoreSchedulerTab({
  communityChores,
  currentUser,
  reputationScores,
  handleCompleteChore,
  lang,
  styles
}: ChoreSchedulerTabProps) {
  // Compute fairness row metrics per roommate
  const rowsMap: Record<string, { completed: number; assigned: number }> = {}
  communityChores.forEach(c => {
    if (!rowsMap[c.roommateId]) {
      rowsMap[c.roommateId] = { completed: 0, assigned: 0 }
    }
    rowsMap[c.roommateId].assigned += 1
    if (c.status === 'completed') {
      rowsMap[c.roommateId].completed += 1
    }
  })

  const fairnessRows: FairnessRow[] = Object.entries(rowsMap).map(([userId, val]) => ({
    userId,
    completed: val.completed,
    assigned: val.assigned
  }))

  const nameMap: Record<string, string> = {
    'tenant-100': 'Global Tenant',
    'rm-1': 'Lerato Modise'
  }
  const fairnessMessage = fairnessNote(fairnessRows, (id) => nameMap[id] || id) || 'Workload distribution is currently balanced across household members.'

  return (
    <div className="responsive-two-col" style={{ display: 'grid', gridTemplateColumns: '1.8fr 1.2fr', gap: '1.5rem', marginTop: '1rem' }}>
      {/* Chores Table */}
      <div className="glass-panel" style={{ padding: '1.2rem', borderRadius: '12px' }}>
        <h3 style={{ ...styles.panelTitleStyle, borderBottom: 'none', marginTop: 0 }}>{t('weeklyChores', lang)}</h3>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.8rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', color: '#D4AF37' }}>
                <th style={{ padding: '0.6rem 0.4rem' }}>Day</th>
                <th style={{ padding: '0.6rem 0.4rem' }}>Roommate</th>
                <th style={{ padding: '0.6rem 0.4rem' }}>Task</th>
                <th style={{ padding: '0.6rem 0.4rem' }}>Status</th>
                <th style={{ padding: '0.6rem 0.4rem', textAlign: 'right' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {communityChores.map(chore => (
                <tr key={chore.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  <td style={{ padding: '0.6rem 0.4rem', fontWeight: 'bold' }}>{chore.dayOfWeek}</td>
                  <td style={{ padding: '0.6rem 0.4rem' }}>{chore.roommateName}</td>
                  <td style={{ padding: '0.6rem 0.4rem', color: '#ccc' }}>{chore.taskName}</td>
                  <td style={{ padding: '0.6rem 0.4rem' }}>
                    <span style={{ 
                      fontSize: '0.6rem', 
                      padding: '0.1rem 0.3rem', 
                      borderRadius: '3px',
                      background: chore.status === 'completed' ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                      border: `1px solid ${chore.status === 'completed' ? '#22c55e' : '#ef4444'}`,
                      color: chore.status === 'completed' ? '#22c55e' : '#ef4444'
                    }}>
                      {chore.status.toUpperCase()}
                    </span>
                  </td>
                  <td style={{ padding: '0.6rem 0.4rem', textAlign: 'right' }}>
                    {chore.status === 'pending' && chore.roommateId === currentUser?.id && (
                      <button 
                        className="btn-gold" 
                        style={{ padding: '0.2rem 0.5rem', fontSize: '0.7rem', cursor: 'pointer' }}
                        onClick={() => handleCompleteChore(chore.id, chore.taskName)}
                      >
                        Done
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Scoreboard */}
      <div className="glass-panel" style={{ padding: '1.2rem', borderRadius: '12px', height: 'fit-content' }}>
        <h3 style={{ ...styles.panelTitleStyle, borderBottom: 'none', marginTop: 0, color: '#D4AF37' }}>{t('scoreboard', lang)}</h3>
        <p style={{ fontSize: '0.75rem', color: '#888', margin: '0 0 1rem 0' }}>{t('scoreboardDesc', lang)}</p>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
          {Object.entries(reputationScores)
            .sort((a, b) => b[1] - a[1])
            .map(([uId, score], idx) => {
              const uName = uId === 'tenant-100' ? 'Global Tenant' : uId === 'rm-1' ? 'Lerato Modise' : 'Unknown Resident'
              return (
                <div key={uId} style={{ display: 'flex', alignItems: 'center', background: 'rgba(0,0,0,0.2)', padding: '0.5rem 0.8rem', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <strong style={{ color: '#D4AF37', marginRight: '0.8rem' }}>#{idx + 1}</strong>
                  <span style={{ color: '#fff', fontSize: '0.8rem' }}>{uName}</span>
                  <span style={{ marginLeft: 'auto', fontWeight: 'bold', color: '#22c55e', fontSize: '0.8rem' }}>{score} XP</span>
                </div>
              )
            })
          }
        </div>

        {/* Workload Fairness Insights */}
        <div style={{ marginTop: '1rem', padding: '0.65rem 0.8rem', borderRadius: '6px', background: 'rgba(212,175,55,0.08)', border: '1px dashed rgba(212,175,55,0.2)', fontSize: '0.75rem', color: '#D4AF37' }}>
          💡 <strong>Workload Distribution:</strong> {fairnessMessage}
        </div>
      </div>
    </div>
  )
}
