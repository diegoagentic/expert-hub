import { useState, useMemo, useEffect } from 'react'
import { Search, MessageSquare, ExternalLink, MoreHorizontal, Inbox, AlertTriangle, CheckCircle2, Ban, Copy as CopyIcon, RotateCcw, Lock as LockIcon } from 'lucide-react'
import { Menu, Transition } from '@headlessui/react'
import { Fragment as ReactFragment } from 'react'
import Navbar from './components/Navbar'
import Breadcrumbs from './components/Breadcrumbs'
import { avatarGradient } from './components/team/teamMembers'
import FeedbackDetailModal from './components/feedback/FeedbackDetailModal'

interface FeedbackBoardProps {
    onLogout: () => void
    onNavigate: (page: string) => void
}

export type Severity = 'Critical' | 'High' | 'Medium' | 'Low'
export type FeedbackState = 'Submitted' | 'Triaged' | 'Assigned' | 'Resolved' | 'Closed' | 'Dropped' | 'Duplicated'
export type Category = 'Bug' | 'Feature Request' | 'UI/UX' | 'Data' | 'Performance'

export interface FeedbackAttachment {
    name: string
    type: string  // e.g., 'PDF', 'PNG'
    sizeKB: number
}

export interface FeedbackItem {
    id: string
    description: string
    category: Category
    severity: Severity
    state: FeedbackState
    assignedTo?: { id: string; name: string; initials: string }
    submittedBy: string
    date: string
    jira?: string
    experience?: string  // e.g., 'pdf-to-sif' · prod field
    attachment?: FeedbackAttachment
}

// FB-08a · comment thread · reporter/expert back-and-forth on each feedback.
export interface FeedbackComment {
    id: string
    author: string
    authorEmail: string
    initials: string
    role: 'reporter' | 'expert'
    body: string
    createdAt: string  // ISO timestamp
}

// localStorage key namespace · per Fase A persistence decision (2026-06-26).
const STATE_OVERRIDES_KEY = 'expert-hub.feedback.stateOverrides'
const UPVOTES_KEY = 'expert-hub.feedback.upvotes'
const COMMENTS_KEY = 'expert-hub.feedback.comments'

function loadStateOverrides(): Record<string, FeedbackState> {
    try {
        const raw = localStorage.getItem(STATE_OVERRIDES_KEY)
        return raw ? JSON.parse(raw) : {}
    } catch { return {} }
}

function saveStateOverrides(overrides: Record<string, FeedbackState>) {
    try { localStorage.setItem(STATE_OVERRIDES_KEY, JSON.stringify(overrides)) } catch {}
}

// FB-07 · upvotes per feedback id · "Me too" button incrementa el counter.
function loadUpvotes(): Record<string, number> {
    try {
        const raw = localStorage.getItem(UPVOTES_KEY)
        return raw ? JSON.parse(raw) : {}
    } catch { return {} }
}

function saveUpvotes(votes: Record<string, number>) {
    try { localStorage.setItem(UPVOTES_KEY, JSON.stringify(votes)) } catch {}
}

// FB-08a · comments per feedback id · seed data se conserva via merge ·
// localStorage overrides los seeds para que el QA persista entre refresh.
function loadComments(): Record<string, FeedbackComment[]> {
    try {
        const raw = localStorage.getItem(COMMENTS_KEY)
        return raw ? JSON.parse(raw) : {}
    } catch { return {} }
}

function saveComments(comments: Record<string, FeedbackComment[]>) {
    try { localStorage.setItem(COMMENTS_KEY, JSON.stringify(comments)) } catch {}
}

// Seed comments para demos · merged sobre lo persistido al primer load.
const SEED_COMMENTS: Record<string, FeedbackComment[]> = {
    'FB-7384D028': [
        { id: 'c1', author: 'Reynier Rivero', authorEmail: 'reynier.rivero@agenticdream.com', initials: 'RR', role: 'reporter',
          body: 'Hey Diego, this is one feedback. Saw the ACK comes back without line items when the vendor uses scanned PDFs.',
          createdAt: '2026-06-26T13:18:30.000Z' },
        { id: 'c2', author: 'Diego Zuluaga', authorEmail: 'diego.zuluaga@agenticdream.com', initials: 'DZ', role: 'expert',
          body: 'Got it, looking into the parser logs. Can you share which vendor specifically?',
          createdAt: '2026-06-26T13:22:10.000Z' },
        { id: 'c3', author: 'Reynier Rivero', authorEmail: 'reynier.rivero@agenticdream.com', initials: 'RR', role: 'reporter',
          body: 'Mostly Magnuson · happens on multi-page quotes. Attached the PDF that reproduces it.',
          createdAt: '2026-06-26T13:27:45.000Z' },
    ],
    'FB-1042': [
        { id: 'c1', author: 'R. Ramirez', authorEmail: 'r.ramirez@special-t.com', initials: 'RR', role: 'reporter',
          body: 'Line items not extracting from multi-page Magnuson quotes. Tried 3 different files.',
          createdAt: '2026-06-12T09:14:00.000Z' },
        { id: 'c2', author: 'Marcus Webb', authorEmail: 'marcus.webb@strata.com', initials: 'MW', role: 'expert',
          body: 'Triaged · this looks like the OCR multi-page pagination bug. Picked up JIRA OCR-318 for the fix.',
          createdAt: '2026-06-12T14:20:00.000Z' },
    ],
}

// FB-07 · group duplicates por (category + description normalized) · descriptions
// similares dentro del mismo category se agrupan. Match aproximado · primeros 60
// chars normalizados (lowercase + collapsed whitespace).
function dedupeKey(item: FeedbackItem): string {
    const desc = item.description.toLowerCase().replace(/\s+/g, ' ').trim().slice(0, 60)
    return `${item.category}::${desc}`
}

interface DuplicateGroup {
    groupSize: number  // total items in the group (including this one)
    siblings: string[] // ids del resto del grupo (excluding self)
}

function buildDuplicateGroups(items: FeedbackItem[]): Record<string, DuplicateGroup> {
    const byKey: Record<string, string[]> = {}
    for (const it of items) {
        const k = dedupeKey(it)
        ;(byKey[k] ??= []).push(it.id)
    }
    const out: Record<string, DuplicateGroup> = {}
    for (const it of items) {
        const ids = byKey[dedupeKey(it)] ?? []
        out[it.id] = { groupSize: ids.length, siblings: ids.filter(x => x !== it.id) }
    }
    return out
}

const FEEDBACK: FeedbackItem[] = [
    {
        id: 'FB-1042',
        description: 'Line items not extracting from multi-page Magnuson quotes',
        category: 'Bug', severity: 'Critical', state: 'Assigned',
        assignedTo: { id: 'marcus', name: 'Marcus Webb', initials: 'MW' },
        submittedBy: 'r.ramirez@special-t.com', date: 'Jun 12, 2026', jira: 'OCR-318',
        experience: 'pdf-to-sif',
        attachment: { name: 'Magnuson-QT-2884.pdf', type: 'PDF', sizeKB: 412.3 },
    },
    {
        id: 'FB-1041',
        description: 'Add bulk "Mark as Completed" action for reconciled documents',
        category: 'Feature Request', severity: 'Medium', state: 'Triaged',
        assignedTo: { id: 'priya', name: 'Priya Shah', initials: 'PS' },
        submittedBy: 'c.morales@special-t.com', date: 'Jun 11, 2026', jira: 'OCR-309',
        experience: 'expert-hub',
    },
    {
        id: 'FB-1040',
        description: 'Vendor name shows lowercase for "ergotron" — should match catalog casing',
        category: 'UI/UX', severity: 'Low', state: 'Resolved',
        assignedTo: { id: 'daniel', name: 'Daniel Okafor', initials: 'DO' },
        submittedBy: 'd.zuluaga@special-t.com', date: 'Jun 10, 2026', jira: 'OCR-301',
        experience: 'expert-hub',
    },
    {
        id: 'FB-1039',
        description: 'Upload modal hangs on PDFs larger than 20MB',
        category: 'Performance', severity: 'High', state: 'Submitted',
        submittedBy: 'k.nguyen@special-t.com', date: 'Jun 10, 2026',
        experience: 'pdf-to-sif',
        attachment: { name: 'screenshot-hang.png', type: 'PNG', sizeKB: 1247.8 },
    },
    {
        id: 'FB-1038',
        description: 'BuzziSpace SKU US-SQ26-00958 mapped to wrong catalog entry',
        category: 'Data', severity: 'High', state: 'Assigned',
        assignedTo: { id: 'sarah', name: 'Sarah Johnson', initials: 'SJ' },
        submittedBy: 'r.ramirez@special-t.com', date: 'Jun 09, 2026', jira: 'OCR-296',
        experience: 'expert-hub',
    },
    {
        id: 'FB-1037',
        description: 'Duplicate of FB-1031 — same discrepancy on Dubois custom carpentry',
        category: 'Bug', severity: 'Medium', state: 'Duplicated',
        submittedBy: 'c.morales@special-t.com', date: 'Jun 08, 2026',
        experience: 'pdf-to-sif',
    },
    {
        id: 'FB-1036',
        description: 'Funnel counts not refreshing after deprecating a document',
        category: 'Bug', severity: 'Medium', state: 'Closed',
        assignedTo: { id: 'noah', name: 'Noah Fischer', initials: 'NF' },
        submittedBy: 'd.zuluaga@special-t.com', date: 'Jun 06, 2026', jira: 'OCR-284',
        experience: 'expert-hub',
    },
    {
        id: 'FB-1035',
        description: 'Request: export reconciled records to CSV',
        category: 'Feature Request', severity: 'Low', state: 'Dropped',
        submittedBy: 'k.nguyen@special-t.com', date: 'Jun 04, 2026',
        experience: 'expert-hub',
    },
    {
        id: 'FB-7384D028',
        description: 'Hey Diego, this is one feedback',
        category: 'Bug', severity: 'High', state: 'Submitted',
        submittedBy: 'reynier.rivero@agenticdream.com', date: 'Jun 26, 2026',
        experience: 'pdf-to-sif',
        attachment: { name: 'ACK-MAX-9999 — Acknowledgment.pdf', type: 'PDF', sizeKB: 238.8 },
    },
    // FB-07 mock · duplicate de FB-1039 ("Upload modal hangs on PDFs larger than 20MB")
    // para que el group indicator + Me too se vea con data realista.
    {
        id: 'FB-1034',
        description: 'Upload modal hangs on PDFs larger than 20MB',
        category: 'Performance', severity: 'High', state: 'Submitted',
        submittedBy: 'mariana.lopez@special-t.com', date: 'Jun 09, 2026',
        experience: 'pdf-to-sif',
    },
    {
        id: 'FB-1033',
        description: 'Upload modal hangs on PDFs larger than 20MB',
        category: 'Performance', severity: 'High', state: 'Triaged',
        submittedBy: 't.fischer@special-t.com', date: 'Jun 07, 2026',
        experience: 'pdf-to-sif',
    },
]

const FUNNEL: { id: string; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'jira', label: 'In Jira' },
    { id: 'Submitted', label: 'Submitted' },
    { id: 'Triaged', label: 'Triaged' },
    { id: 'Assigned', label: 'Assigned' },
    { id: 'Resolved', label: 'Resolved' },
    { id: 'Closed', label: 'Closed' },
    { id: 'Dropped', label: 'Dropped' },
    { id: 'Duplicated', label: 'Duplicated' },
]

function severityClasses(s: Severity): string {
    switch (s) {
        case 'Critical': return 'bg-destructive/10 text-destructive'
        case 'High': return 'bg-amber-500/10 text-amber-600'
        case 'Medium': return 'bg-blue-500/10 text-blue-600'
        case 'Low': return 'bg-muted text-muted-foreground'
    }
}

// FB-03 · row actions disponibles según el state actual. Cada action es una
// transición · misma semántica que el detail modal pero accesible desde el
// MoreHorizontal de cada row sin abrir el modal.
interface RowAction { label: string; target: FeedbackState; icon: typeof CheckCircle2 }
function rowActions(state: FeedbackState): RowAction[] {
    switch (state) {
        case 'Submitted':  return [
            { label: 'Mark Triaged',    target: 'Triaged',    icon: CheckCircle2 },
            { label: 'Mark Dropped',    target: 'Dropped',    icon: Ban },
            { label: 'Mark Duplicated', target: 'Duplicated', icon: CopyIcon },
        ]
        case 'Triaged':    return [
            { label: 'Mark Resolved',   target: 'Resolved',   icon: CheckCircle2 },
            { label: 'Mark Dropped',    target: 'Dropped',    icon: Ban },
            { label: 'Mark Duplicated', target: 'Duplicated', icon: CopyIcon },
        ]
        case 'Assigned':   return [
            { label: 'Mark Resolved',   target: 'Resolved',   icon: CheckCircle2 },
            { label: 'Mark Dropped',    target: 'Dropped',    icon: Ban },
            { label: 'Mark Duplicated', target: 'Duplicated', icon: CopyIcon },
        ]
        case 'Resolved':   return [
            { label: 'Mark Closed',     target: 'Closed',     icon: LockIcon },
            { label: 'Reopen',          target: 'Submitted',  icon: RotateCcw },
        ]
        case 'Closed':
        case 'Dropped':
        case 'Duplicated': return [
            { label: 'Reopen',          target: 'Submitted',  icon: RotateCcw },
        ]
    }
}

function stateClasses(s: FeedbackState): string {
    switch (s) {
        case 'Submitted': return 'bg-blue-500/10 text-blue-600'
        case 'Triaged': return 'bg-amber-500/10 text-amber-600'
        case 'Assigned': return 'bg-blue-500/10 text-blue-600'
        case 'Resolved': return 'bg-green-500/10 text-green-600'
        default: return 'bg-muted text-muted-foreground'
    }
}

export default function FeedbackBoard({ onLogout, onNavigate }: FeedbackBoardProps) {
    const [activeTab, setActiveTab] = useState('all')
    const [query, setQuery] = useState('')
    const [stateOverrides, setStateOverrides] = useState<Record<string, FeedbackState>>(() => loadStateOverrides())
    const [upvotes, setUpvotes] = useState<Record<string, number>>(() => loadUpvotes())
    const [comments, setComments] = useState<Record<string, FeedbackComment[]>>(() => {
        const persisted = loadComments()
        // Merge seed → persisted (persisted wins per id si ya hay overrides).
        const merged: Record<string, FeedbackComment[]> = { ...SEED_COMMENTS }
        for (const [id, list] of Object.entries(persisted)) merged[id] = list
        return merged
    })
    const [selectedId, setSelectedId] = useState<string | null>(null)

    useEffect(() => { saveStateOverrides(stateOverrides) }, [stateOverrides])
    useEffect(() => { saveUpvotes(upvotes) }, [upvotes])
    useEffect(() => { saveComments(comments) }, [comments])

    // Apply overrides from localStorage on top of seed mock data.
    const items = useMemo<FeedbackItem[]>(() => {
        return FEEDBACK.map(f => stateOverrides[f.id] ? { ...f, state: stateOverrides[f.id] } : f)
    }, [stateOverrides])

    // FB-07 · group duplicates by (category + description normalized).
    const duplicateGroups = useMemo(() => buildDuplicateGroups(items), [items])

    const handleTransition = (id: string, next: FeedbackState) => {
        setStateOverrides(prev => ({ ...prev, [id]: next }))
    }

    const handleMeToo = (id: string) => {
        setUpvotes(prev => ({ ...prev, [id]: (prev[id] ?? 0) + 1 }))
    }

    const handleAddComment = (feedbackId: string, body: string, role: 'reporter' | 'expert' = 'expert') => {
        const author = role === 'expert' ? 'Diego Zuluaga' : 'Reynier Rivero'
        const email  = role === 'expert' ? 'diego.zuluaga@agenticdream.com' : 'reynier.rivero@agenticdream.com'
        const initials = role === 'expert' ? 'DZ' : 'RR'
        const c: FeedbackComment = {
            id: `c-${Date.now().toString(36)}`,
            author, authorEmail: email, initials, role,
            body: body.trim(),
            createdAt: new Date().toISOString(),
        }
        setComments(prev => ({ ...prev, [feedbackId]: [...(prev[feedbackId] ?? []), c] }))
    }

    const counts = useMemo(() => {
        const c: Record<string, number> = {
            all: items.length,
            jira: items.filter(f => f.jira).length,
        }
        for (const f of items) c[f.state] = (c[f.state] ?? 0) + 1
        return c
    }, [items])

    const filtered = useMemo(() => {
        return items.filter(f => {
            if (activeTab === 'jira' && !f.jira) return false
            if (activeTab !== 'all' && activeTab !== 'jira' && f.state !== activeTab) return false
            if (query.trim()) {
                const q = query.toLowerCase()
                if (!f.description.toLowerCase().includes(q) &&
                    !f.submittedBy.toLowerCase().includes(q) &&
                    !f.category.toLowerCase().includes(q)) return false
            }
            return true
        })
    }, [activeTab, query, items])

    const selected = useMemo(() => items.find(f => f.id === selectedId) ?? null, [items, selectedId])

    return (
        <div className="min-h-screen bg-background font-sans text-foreground pb-10">
            {/* Breadcrumb hoisted above navbar — matches prod top-left position */}
            <div className="fixed top-2 left-6 z-50 text-xs opacity-80 hover:opacity-100 transition-opacity pointer-events-auto">
                <Breadcrumbs items={[
                    { label: 'Expert Hub', onClick: () => onNavigate('ocr-tracking') },
                    { label: 'Feedback Board', active: true },
                ]} />
            </div>

            <Navbar onLogout={onLogout} activeTab="Feedback" onNavigateToWorkspace={() => onNavigate('ocr-tracking')} onNavigate={onNavigate} />

            <div className="pt-24 px-4 max-w-screen-2xl mx-auto space-y-6">
                <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
                    {/* Header: title + funnel + search */}
                    <div className="p-6 border-b border-border">
                        <div className="flex flex-col gap-6">
                            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                                <h3 className="text-lg font-semibold text-foreground flex items-center gap-2 whitespace-nowrap">
                                    <MessageSquare className="h-5 w-5 text-primary" />
                                    Feedback Board
                                </h3>
                                {/* Funnel */}
                                <div className="flex gap-1 bg-muted p-1 rounded-lg w-fit overflow-x-auto max-w-full">
                                    {FUNNEL.map(tab => (
                                        <button
                                            key={tab.id}
                                            onClick={() => setActiveTab(tab.id)}
                                            className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all flex items-center gap-2 outline-none whitespace-nowrap ${
                                                activeTab === tab.id
                                                    ? 'bg-primary text-primary-foreground shadow-sm'
                                                    : 'text-muted-foreground hover:text-foreground hover:bg-background/60'
                                            }`}
                                        >
                                            {tab.label}
                                            <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                                                activeTab === tab.id ? 'bg-primary-foreground/20' : 'bg-background'
                                            }`}>
                                                {counts[tab.id] ?? 0}
                                            </span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Search */}
                            <div className="relative max-w-sm">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <input
                                    type="text"
                                    value={query}
                                    onChange={e => setQuery(e.target.value)}
                                    placeholder="Search feedback…"
                                    className="w-full pl-9 pr-3 py-2 text-sm bg-background border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Table */}
                    {filtered.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
                            <div className="h-14 w-14 rounded-2xl bg-muted flex items-center justify-center mb-4">
                                <Inbox className="h-7 w-7 text-muted-foreground" />
                            </div>
                            <p className="text-sm font-semibold text-foreground">No feedback yet</p>
                            <p className="text-sm text-muted-foreground mt-1 max-w-sm">
                                When users submit feedback, rows will appear here live.
                            </p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-border text-left">
                                        {['Description', 'Category', 'Severity', 'State', 'Assigned To', 'Submitted By', 'Date', 'Jira', 'Actions'].map(h => (
                                            <th key={h} className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap">
                                                {h}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {filtered.map(f => (
                                        <tr
                                            key={f.id}
                                            onClick={() => setSelectedId(f.id)}
                                            className="border-b border-border last:border-0 hover:bg-muted/40 transition-colors cursor-pointer"
                                        >
                                            <td className="px-4 py-3 max-w-md">
                                                <div className="font-medium text-foreground flex items-start gap-2">
                                                    <span className="flex-1">{f.description}</span>
                                                    {duplicateGroups[f.id]?.groupSize > 1 && (
                                                        <span
                                                            title={`Reported by ${duplicateGroups[f.id].groupSize} users`}
                                                            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/30 text-[10px] font-bold uppercase tracking-wider whitespace-nowrap shrink-0"
                                                        >
                                                            <AlertTriangle className="h-2.5 w-2.5" />
                                                            +{duplicateGroups[f.id].groupSize - 1} similar
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="text-xs text-muted-foreground flex items-center gap-2 mt-0.5">
                                                    <span>{f.id}</span>
                                                    {upvotes[f.id] > 0 && (
                                                        <span className="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400 font-medium">
                                                            · {upvotes[f.id]} me too
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">{f.category}</td>
                                            <td className="px-4 py-3 whitespace-nowrap">
                                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${severityClasses(f.severity)}`}>
                                                    {f.severity}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 whitespace-nowrap">
                                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${stateClasses(f.state)}`}>
                                                    {f.state}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 whitespace-nowrap">
                                                {f.assignedTo ? (
                                                    <div className="flex items-center gap-2">
                                                        <div className={`h-7 w-7 rounded-full bg-gradient-to-br ${avatarGradient(f.assignedTo.id)} flex items-center justify-center text-[10px] font-bold text-white`}>
                                                            {f.assignedTo.initials}
                                                        </div>
                                                        <span className="text-foreground">{f.assignedTo.name}</span>
                                                    </div>
                                                ) : (
                                                    <span className="text-muted-foreground">—</span>
                                                )}
                                            </td>
                                            <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">{f.submittedBy}</td>
                                            <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">{f.date}</td>
                                            <td className="px-4 py-3 whitespace-nowrap">
                                                {f.jira ? (
                                                    <a
                                                        onClick={e => e.stopPropagation()}
                                                        className="inline-flex items-center gap-1 text-blue-600 hover:underline cursor-pointer"
                                                    >
                                                        {f.jira}
                                                        <ExternalLink className="h-3 w-3" />
                                                    </a>
                                                ) : (
                                                    <span className="text-muted-foreground">—</span>
                                                )}
                                            </td>
                                            <td className="px-4 py-3 whitespace-nowrap">
                                                <Menu as="div" className="relative inline-block text-left">
                                                    <Menu.Button
                                                        onClick={e => e.stopPropagation()}
                                                        className="h-8 w-8 rounded-lg hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
                                                        title="Actions"
                                                        aria-label="Feedback actions"
                                                    >
                                                        <MoreHorizontal className="h-4 w-4" />
                                                    </Menu.Button>
                                                    <Transition as={ReactFragment} enter="transition ease-out duration-100" enterFrom="transform opacity-0 scale-95" enterTo="transform opacity-100 scale-100" leave="transition ease-in duration-75" leaveFrom="transform opacity-100 scale-100" leaveTo="transform opacity-0 scale-95">
                                                        <Menu.Items
                                                            onClick={e => e.stopPropagation()}
                                                            className="absolute right-0 z-40 mt-1 w-48 origin-top-right rounded-lg bg-card border border-border shadow-lg focus:outline-none p-1"
                                                        >
                                                            {rowActions(f.state).map(opt => (
                                                                <Menu.Item key={opt.label}>
                                                                    {({ active }) => (
                                                                        <button
                                                                            onClick={() => handleTransition(f.id, opt.target)}
                                                                            className={`w-full flex items-center gap-2 px-3 py-2 text-sm rounded-md transition-colors ${active ? 'bg-muted text-foreground' : 'text-foreground'}`}
                                                                        >
                                                                            <opt.icon className="h-4 w-4 text-muted-foreground" />
                                                                            {opt.label}
                                                                        </button>
                                                                    )}
                                                                </Menu.Item>
                                                            ))}
                                                        </Menu.Items>
                                                    </Transition>
                                                </Menu>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>

            <FeedbackDetailModal
                isOpen={!!selected}
                onClose={() => setSelectedId(null)}
                feedback={selected}
                onTransition={handleTransition}
                duplicateGroupSize={selected ? duplicateGroups[selected.id]?.groupSize ?? 1 : 1}
                meTooCount={selected ? upvotes[selected.id] ?? 0 : 0}
                onMeToo={() => selected && handleMeToo(selected.id)}
                comments={selected ? comments[selected.id] ?? [] : []}
                onAddComment={(body, role) => selected && handleAddComment(selected.id, body, role)}
            />
        </div>
    )
}
