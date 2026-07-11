import React from 'react'
import { Plus } from 'lucide-react'
import { t } from '../../../utils/i18n'

interface Tool {
  id: string
  title: string
  description: string
  ownerId: string
  ownerName: string
  pricePerDay: number
  currency: string
  deposit: number
  status: 'available' | 'rented'
  rentedBy?: string
  rentedByName?: string
  rentedUntil?: string
  location: string
}

interface ToolLibraryTabProps {
  communityTools: Tool[]
  currentUser: { name: string; balance: number; id: string } | null
  setShowToolRegModal: (val: boolean) => void
  handleRentTool: (tool: Tool) => void
  handleReturnTool: (id: string, title: string) => void
  formatCurrency: (amount: number, currency: string) => string
  lang: 'en' | 'zu' | 'xh' | 'af'
  styles: Record<string, React.CSSProperties>
}

export default function ToolLibraryTab({
  communityTools,
  currentUser,
  setShowToolRegModal,
  handleRentTool,
  handleReturnTool,
  formatCurrency,
  lang,
  styles
}: ToolLibraryTabProps) {
  return (
    <div>
      <div style={styles.landlordHeaderRowStyle}>
        <h3 style={{ ...styles.panelTitleStyle, borderBottom: 'none', margin: 0 }}>{t('availableTools', lang)}</h3>
        <button className="btn-gold" style={{ cursor: 'pointer' }} onClick={() => setShowToolRegModal(true)}>
          <Plus size={14} style={{ marginRight: 6 }} /> {t('registerToolBtn', lang)}
        </button>
      </div>
      
      <div style={{ ...styles.gridStyle, marginTop: '1.2rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
        {communityTools.map(tool => (
          <div key={tool.id} className="glass-panel" style={styles.cardStyle}>
            <div style={{ ...styles.cardBodyStyle, gap: '0.5rem', display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h4 style={{ margin: 0, fontSize: '0.95rem', color: '#fff' }}>{tool.title}</h4>
                <span style={{ color: '#D4AF37', fontWeight: 'bold' }}>{formatCurrency(tool.pricePerDay, tool.currency)} / day</span>
              </div>
              <p style={{ margin: 0, fontSize: '0.75rem', color: '#aaa' }}>
                <strong>{t('owner', lang)}:</strong> {tool.ownerName} | <strong>{t('location', lang)}:</strong> {tool.location}
              </p>
              <p style={{ margin: '0.2rem 0', fontSize: '0.8rem', color: '#ccc', minHeight: '36px' }}>{tool.description}</p>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.5rem' }}>
                <span style={{ 
                  fontSize: '0.65rem', 
                  fontWeight: 'bold', 
                  borderRadius: '4px', 
                  padding: '0.1rem 0.3rem',
                  background: tool.status === 'available' ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                  border: `1px solid ${tool.status === 'available' ? '#22c55e' : '#ef4444'}`,
                  color: tool.status === 'available' ? '#22c55e' : '#ef4444'
                }}>
                  {tool.status.toUpperCase()}
                </span>
                {tool.status === 'available' ? (
                  <button 
                    className="btn-gold" 
                    style={{ padding: '0.25rem 0.6rem', fontSize: '0.75rem', cursor: 'pointer' }}
                    onClick={() => handleRentTool(tool)}
                  >
                    {t('hireToolBtn', lang)}
                  </button>
                ) : (
                  tool.rentedBy === currentUser?.id ? (
                    <button 
                      className="btn-primary" 
                      style={{ padding: '0.25rem 0.6rem', fontSize: '0.75rem', background: '#ef4444', cursor: 'pointer' }}
                      onClick={() => handleReturnTool(tool.id, tool.title)}
                    >
                      {t('returnToolBtn', lang)}
                    </button>
                  ) : (
                    <span style={{ fontSize: '0.7rem', color: '#888' }}>
                      Hired by {tool.rentedByName} until {tool.rentedUntil}
                    </span>
                  )
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
