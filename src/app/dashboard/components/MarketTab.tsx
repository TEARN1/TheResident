'use client'

import React, { useState } from 'react'
import { ShoppingBag, Store, Users, Search, Plus, Check, AlertTriangle } from 'lucide-react'
import { isOpenNow, isSuspiciousPrice, suburbPriceStats, mentionsOffPlatformPayment } from '../../../utils/logic'
import type { MarketItem, Vendor, GroupBuy, LostFound } from '../../../store'

interface MarketTabProps {
  marketItems: MarketItem[]
  vendors: Vendor[]
  groupBuys: GroupBuy[]
  lostFound: LostFound[]
  currentUserId: string
  formatCurrency: (amount: number, currency?: string) => string
  onPostItem: (item: { title: string; description: string; price: number | null; category: string }) => void
  onPledge: (groupBuyId: string, quantity: number) => void
  onReunite: (id: string) => void
  onReport: (subjectType: string, subjectId: string) => void
  styles: Record<string, React.CSSProperties>
}

type Section = 'market' | 'vendors' | 'groupbuys' | 'lostfound'

export default function MarketTab({
  marketItems,
  vendors,
  groupBuys,
  lostFound,
  currentUserId,
  formatCurrency,
  onPostItem,
  onPledge,
  onReunite,
  onReport,
  styles
}: MarketTabProps) {
  const [section, setSection] = useState<Section>('market')
  const [showForm, setShowForm] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [price, setPrice] = useState<string>('')
  const [category, setCategory] = useState('Household')

  // Calculate market price statistics for suspicious pricing heuristics
  const allPrices = marketItems.map(i => i.price).filter((p): p is number => p !== null && p > 0)
  const priceStats = suburbPriceStats(allPrices, 2)

  const tab = (id: Section, label: string) => (
    <button
      key={id}
      onClick={() => setSection(id)}
      style={section === id ? styles.activeSubTabBtnStyle : styles.inactiveSubTabBtnStyle}
    >
      {label}
    </button>
  )

  return (
    <div style={{ marginTop: '1rem' }}>
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        {tab('market', 'For sale & free')}
        {tab('vendors', 'Spazas & vendors')}
        {tab('groupbuys', 'Group buys')}
        {tab('lostfound', 'Lost & found')}
      </div>

      {/* ── Market ─────────────────────────────────────────────────────────── */}
      {section === 'market' && (
        <div className="glass-panel" style={{ padding: '1.2rem', borderRadius: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '1rem' }}>
            <h3 style={{ ...styles.panelTitleStyle, borderBottom: 'none', margin: 0 }}>Local market</h3>
            <button
              onClick={() => setShowForm(v => !v)}
              className="btn-gold"
              style={{ marginLeft: 'auto', padding: '0.4rem 0.8rem', fontSize: '0.75rem', cursor: 'pointer' }}
            >
              <Plus size={12} style={{ verticalAlign: 'middle' }} /> Post something
            </button>
          </div>

          <p style={{ fontSize: '0.75rem', color: '#888', margin: '0 0 1rem 0' }}>
            Leave the price blank to give it away. Payment happens between you and the buyer — never through the app.
          </p>

          {showForm && (
            <form
              onSubmit={e => {
                e.preventDefault()
                if (!title.trim()) return
                onPostItem({
                  title,
                  description,
                  price: price.trim() === '' ? null : Number(price),
                  category
                })
                setTitle(''); setDescription(''); setPrice(''); setShowForm(false)
              }}
              style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1.2rem' }}
            >
              <label htmlFor="mk-title" style={{ fontSize: '0.75rem', color: '#888' }}>What is it?</label>
              <input id="mk-title" value={title} onChange={e => setTitle(e.target.value)}
                     placeholder="Two-plate stove" style={styles.inputStyle} required />
              <textarea id="mk-desc" value={description} onChange={e => setDescription(e.target.value)}
                        placeholder="Condition, why you're selling" rows={2} style={styles.inputStyle} />
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <input id="mk-price" type="number" min={0} value={price} onChange={e => setPrice(e.target.value)}
                       placeholder="Price (blank = free)" style={{ ...styles.inputStyle, flex: 1 }} />
                <select id="mk-cat" value={category} onChange={e => setCategory(e.target.value)}
                        style={{ ...styles.inputStyle, flex: 1 }}>
                  <option>Household</option>
                  <option>Furniture</option>
                  <option>Electronics</option>
                  <option>Clothing</option>
                  <option>Food</option>
                  <option>Other</option>
                </select>
              </div>
              <button type="submit" className="btn-gold" style={{ padding: '0.6rem', cursor: 'pointer' }}>Post it</button>
            </form>
          )}

          {marketItems.length === 0 ? (
            <div style={styles.emptyStateStyle}>
              <ShoppingBag size={28} color="#D4AF37" />
              <p>Nothing for sale yet. Be the first to post.</p>
            </div>
          ) : (
            <div className="responsive-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '0.9rem' }}>
              {marketItems.filter(i => i.status === 'available').map(item => {
                const suspicious = item.price ? isSuspiciousPrice(item.price, priceStats) : false
                const offPlatformWarn = mentionsOffPlatformPayment(item.description)

                return (
                  <div key={item.id} style={{ padding: '0.9rem', borderRadius: '8px', background: 'rgba(0,0,0,0.2)', border: `1px solid ${suspicious ? 'rgba(239,68,68,0.4)' : 'rgba(255,255,255,0.06)'}` }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <strong style={{ color: 'var(--text-primary, #fff)', fontSize: '0.9rem' }}>{item.title}</strong>
                      {suspicious && (
                        <span style={{ fontSize: '0.6rem', color: '#ef4444', background: 'rgba(239,68,68,0.1)', padding: '0.1rem 0.3rem', borderRadius: '3px', border: '1px solid rgba(239,68,68,0.3)', fontWeight: 'bold' }}>
                          ⚠️ LOW PRICE WARN
                        </span>
                      )}
                    </div>
                    <div style={{ color: '#D4AF37', fontWeight: 'bold', margin: '0.3rem 0' }}>
                      {item.price ? formatCurrency(item.price, item.currency) : 'Free'}
                    </div>
                    <p style={{ fontSize: '0.75rem', color: '#aaa', margin: 0 }}>{item.description}</p>
                    {offPlatformWarn && (
                      <div style={{ marginTop: '0.4rem', fontSize: '0.65rem', color: '#eab308', background: 'rgba(234,179,8,0.1)', padding: '0.2rem 0.4rem', borderRadius: '4px', border: '1px solid rgba(234,179,8,0.2)' }}>
                        🛡️ Safety Tip: Meet at verified local stands for cash delivery.
                      </div>
                    )}
                    {item.createdBy !== currentUserId && (
                      <button
                        onClick={() => onReport('market_item', item.id)}
                        style={{ marginTop: '0.6rem', background: 'none', border: 'none', color: '#666', fontSize: '0.65rem', cursor: 'pointer', padding: 0 }}
                      >
                        Report
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Vendors ────────────────────────────────────────────────────────── */}
      {section === 'vendors' && (
        <div className="glass-panel" style={{ padding: '1.2rem', borderRadius: '12px' }}>
          <h3 style={{ ...styles.panelTitleStyle, borderBottom: 'none', marginTop: 0 }}>Spazas & vendors</h3>
          {vendors.length === 0 ? (
            <div style={styles.emptyStateStyle}>
              <Store size={28} color="#D4AF37" />
              <p>No vendors registered yet.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.7rem' }}>
              {[...vendors]
                // Open vendors sort above closed ones
                .sort((a, b) => Number(isOpenNow(b.description) ?? false) - Number(isOpenNow(a.description) ?? false))
                .map(v => {
                  const open = isOpenNow(v.description)
                  return (
                    <div key={v.id} style={{ display: 'flex', alignItems: 'center', gap: '0.7rem', padding: '0.8rem', borderRadius: '8px', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.06)' }}>
                      <Store size={18} color="#D4AF37" />
                      <div style={{ flex: 1 }}>
                        <strong style={{ fontSize: '0.85rem', color: 'var(--text-primary, #fff)' }}>{v.name}</strong>
                        <div style={{ fontSize: '0.7rem', color: '#888' }}>{v.category}</div>
                      </div>
                      {open !== null && (
                        <span style={{
                          fontSize: '0.65rem', padding: '0.15rem 0.4rem', borderRadius: '3px',
                          background: open ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)',
                          border: `1px solid ${open ? '#22c55e' : '#ef4444'}`,
                          color: open ? '#22c55e' : '#ef4444'
                        }}>
                          {open ? 'OPEN NOW' : 'CLOSED'}
                        </span>
                      )}
                    </div>
                  )
                })}
            </div>
          )}
        </div>
      )}

      {/* ── Group buys ─────────────────────────────────────────────────────── */}
      {section === 'groupbuys' && (
        <div className="glass-panel" style={{ padding: '1.2rem', borderRadius: '12px' }}>
          <h3 style={{ ...styles.panelTitleStyle, borderBottom: 'none', marginTop: 0 }}>Group buys</h3>
          <p style={{ fontSize: '0.75rem', color: '#888', margin: '0 0 1rem 0' }}>
            Pledge what you need. When the target is reached everyone collects — the app never handles the money.
          </p>

          {groupBuys.length === 0 ? (
            <div style={styles.emptyStateStyle}>
              <Users size={28} color="#D4AF37" />
              <p>No group buys running.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
              {groupBuys.map(gb => {
                const pct = Math.min(100, Math.round((gb.currentPledges / Math.max(gb.targetAmount, 1)) * 100))
                return (
                  <div key={gb.id} style={{ padding: '0.9rem', borderRadius: '8px', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.06)' }}>
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      <strong style={{ color: 'var(--text-primary, #fff)', fontSize: '0.9rem' }}>{gb.title}</strong>
                      <span style={{ marginLeft: 'auto', fontSize: '0.7rem', color: gb.status === 'completed' ? '#22c55e' : '#888' }}>
                        {gb.status.toUpperCase()}
                      </span>
                    </div>
                    <p style={{ fontSize: '0.75rem', color: '#aaa', margin: '0.4rem 0' }}>{gb.description}</p>

                    <div style={{ height: '6px', borderRadius: '3px', background: 'rgba(255,255,255,0.08)', overflow: 'hidden', margin: '0.5rem 0' }}>
                      <div style={{ width: `${pct}%`, height: '100%', background: pct >= 100 ? '#22c55e' : '#D4AF37' }} />
                    </div>
                    <div style={{ fontSize: '0.7rem', color: '#888' }}>
                      {gb.currentPledges} of {gb.targetAmount} pledged ({pct}%)
                    </div>

                    {gb.status === 'open' && (
                      <button
                        onClick={() => onPledge(gb.id, 1)}
                        className="btn-gold"
                        style={{ marginTop: '0.6rem', padding: '0.3rem 0.7rem', fontSize: '0.7rem', cursor: 'pointer' }}
                      >
                        Pledge 1
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Lost & found ───────────────────────────────────────────────────── */}
      {section === 'lostfound' && (
        <div className="glass-panel" style={{ padding: '1.2rem', borderRadius: '12px' }}>
          <h3 style={{ ...styles.panelTitleStyle, borderBottom: 'none', marginTop: 0 }}>Lost & found</h3>
          {lostFound.length === 0 ? (
            <div style={styles.emptyStateStyle}>
              <Search size={28} color="#D4AF37" />
              <p>Nothing lost, nothing found.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.7rem' }}>
              {lostFound.map(lf => (
                <div key={lf.id} style={{ display: 'flex', alignItems: 'center', gap: '0.7rem', padding: '0.8rem', borderRadius: '8px', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <span style={{
                    fontSize: '0.6rem', padding: '0.15rem 0.4rem', borderRadius: '3px',
                    border: `1px solid ${lf.type === 'lost' ? '#ef4444' : '#22c55e'}`,
                    color: lf.type === 'lost' ? '#ef4444' : '#22c55e'
                  }}>
                    {lf.type.toUpperCase()}
                  </span>
                  <div style={{ flex: 1 }}>
                    <strong style={{ fontSize: '0.85rem', color: 'var(--text-primary, #fff)' }}>{lf.title}</strong>
                    <div style={{ fontSize: '0.7rem', color: '#888' }}>{lf.location}</div>
                  </div>
                  {lf.status === 'active' && (
                    <button
                      onClick={() => onReunite(lf.id)}
                      style={{
                        padding: '0.3rem 0.6rem', fontSize: '0.7rem', cursor: 'pointer',
                        background: 'rgba(34,197,94,0.15)', border: '1px solid #22c55e',
                        color: '#22c55e', borderRadius: '4px'
                      }}
                    >
                      <Check size={12} style={{ verticalAlign: 'middle' }} /> Reunited
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
