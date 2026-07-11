import React from 'react'
import { t } from '../../../utils/i18n'

interface Notice {
  id: string
  title: string
  description: string
  type: 'notice' | 'event'
  postedBy: string
  timestamp: string
  vibes?: string[]
  echos?: string[]
  rsvps: string[]
}

interface NoticeBoardTabProps {
  communityNotices: Notice[]
  currentUser: { name: string; balance: number; id: string } | null
  noticeTitle: string
  setNoticeTitle: (val: string) => void
  noticeType: 'notice' | 'event'
  setNoticeType: (val: 'notice' | 'event') => void
  noticeEventDate: string
  setNoticeEventDate: (val: string) => void
  noticeDesc: string
  setNoticeDesc: (val: string) => void
  handleVibeNotice: (id: string) => void
  handleEchoNotice: (id: string) => void
  handleRSVPToEvent: (id: string) => void
  handlePostNotice: (e: React.FormEvent) => void
  lang: 'en' | 'zu' | 'xh' | 'af'
  styles: Record<string, React.CSSProperties>
}

export default function NoticeBoardTab({
  communityNotices,
  currentUser,
  noticeTitle,
  setNoticeTitle,
  noticeType,
  setNoticeType,
  noticeEventDate,
  setNoticeEventDate,
  noticeDesc,
  setNoticeDesc,
  handleVibeNotice,
  handleEchoNotice,
  handleRSVPToEvent,
  handlePostNotice,
  lang,
  styles
}: NoticeBoardTabProps) {
  return (
    <div className="responsive-two-col" style={{ display: 'grid', gridTemplateColumns: '1.8fr 1.2fr', gap: '1.5rem', marginTop: '1rem' }}>
      {/* Notices List */}
      <div>
        <h3 style={{ ...styles.panelTitleStyle, marginTop: 0 }}>{t('bulletins', lang)}</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {communityNotices.map(notice => (
            <div key={notice.id} className="glass-panel" style={{ padding: '1.2rem', borderRadius: '10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <span style={{ 
                  fontSize: '0.65rem', 
                  fontWeight: 'bold', 
                  padding: '0.1rem 0.4rem', 
                  borderRadius: '4px',
                  background: notice.type === 'event' ? 'rgba(212, 175, 55, 0.15)' : 'rgba(59, 130, 246, 0.15)',
                  border: `1px solid ${notice.type === 'event' ? '#D4AF37' : '#3b82f6'}`,
                  color: notice.type === 'event' ? '#D4AF37' : '#3b82f6'
                }}>
                  {notice.type.toUpperCase()}
                </span>
                <span style={{ fontSize: '0.7rem', color: '#888' }}>
                  Posted: {new Date(notice.timestamp).toLocaleDateString()} by {notice.postedBy}
                </span>
              </div>
              <h4 style={{ margin: '0 0 0.5rem 0', color: '#fff', fontSize: '0.95rem' }}>{notice.title}</h4>
              <p style={{ margin: 0, fontSize: '0.8rem', color: '#ccc', lineHeight: '1.4' }}>{notice.description}</p>
              
              <div style={{ marginTop: '1rem', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '0.8rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <button 
                    className="btn-gold" 
                    style={{ 
                      padding: '0.2rem 0.5rem', 
                      fontSize: '0.7rem', 
                      background: notice.vibes?.includes(currentUser?.name || '') ? '#D4AF37' : 'rgba(255,255,255,0.05)',
                      color: notice.vibes?.includes(currentUser?.name || '') ? '#000' : '#D4AF37',
                      border: '1px solid rgba(212,175,55,0.2)',
                      cursor: 'pointer'
                    }}
                    onClick={() => handleVibeNotice(notice.id)}
                  >
                    ❤️ vibe ({notice.vibes?.length || 0})
                  </button>
                  <button 
                    className="btn-gold" 
                    style={{ 
                      padding: '0.2rem 0.5rem', 
                      fontSize: '0.7rem', 
                      background: notice.echos?.includes(currentUser?.name || '') ? '#D4AF37' : 'rgba(255,255,255,0.05)',
                      color: notice.echos?.includes(currentUser?.name || '') ? '#000' : '#D4AF37',
                      border: '1px solid rgba(212,175,55,0.2)',
                      cursor: 'pointer'
                    }}
                    onClick={() => handleEchoNotice(notice.id)}
                  >
                    📢 echo ({notice.echos?.length || 0})
                  </button>
                </div>

                {notice.type === 'event' ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
                    <span style={{ fontSize: '0.75rem', color: '#888' }}>
                      {notice.rsvps.length} attending {notice.rsvps.length > 0 && `(${notice.rsvps.join(', ')})`}
                    </span>
                    <button 
                      className="btn-gold" 
                      style={{ padding: '0.25rem 0.6rem', fontSize: '0.75rem', cursor: 'pointer' }}
                      onClick={() => handleRSVPToEvent(notice.id)}
                    >
                      {notice.rsvps.includes(currentUser?.name || '') ? 'Cancel RSVP' : 'RSVP'}
                    </button>
                  </div>
                ) : (
                  <span style={{ fontSize: '0.7rem', color: '#666' }}>Bulletin Notice</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Post Notice Form */}
      <div className="glass-panel" style={{ padding: '1.2rem', borderRadius: '12px', height: 'fit-content' }}>
        <h3 style={{ ...styles.panelTitleStyle, borderBottom: 'none', marginBottom: '1rem', marginTop: 0 }}>{t('postAnnouncement', lang)}</h3>
        <form onSubmit={handlePostNotice} style={styles.formStyleStyle}>
          <div style={styles.inputGroupStyle}>
            <label style={styles.labelStyleStyle}>{t('title', lang)}</label>
            <input 
              type="text" 
              required 
              placeholder="e.g. Water cut this Thursday / Found key ring" 
              value={noticeTitle}
              onChange={(e) => setNoticeTitle(e.target.value)}
              style={styles.modalInputStyle}
            />
          </div>
          <div style={styles.inputGroupStyle}>
            <label style={styles.labelStyleStyle}>{t('postType', lang)}</label>
            <select 
              value={noticeType}
              onChange={(e) => setNoticeType(e.target.value as 'notice' | 'event')}
              style={styles.modalSelectStyle}
            >
              <option value="notice">{t('generalNotice', lang)}</option>
              <option value="event">{t('communityEvent', lang)}</option>
            </select>
          </div>
          {noticeType === 'event' && (
            <div style={styles.inputGroupStyle}>
              <label style={styles.labelStyleStyle}>{t('eventDateTime', lang)}</label>
              <input 
                type="text" 
                placeholder="e.g. Saturday, 30 May at 2:00 PM" 
                value={noticeEventDate}
                onChange={(e) => setNoticeEventDate(e.target.value)}
                style={styles.modalInputStyle}
              />
            </div>
          )}
          <div style={styles.inputGroupStyle}>
            <label style={styles.labelStyleStyle}>{t('detailsDesc', lang)}</label>
            <textarea 
              rows={3} 
              required 
              placeholder="Write announcement details here..." 
              value={noticeDesc}
              onChange={(e) => setNoticeDesc(e.target.value)}
              style={styles.modalTextareaStyle}
            />
          </div>
          <button type="submit" className="btn-gold" style={{ ...styles.modalSubmitBtnStyle, marginTop: '0.5rem', cursor: 'pointer' }}>
            {t('publishButton', lang)}
          </button>
        </form>
      </div>
    </div>
  )
}
