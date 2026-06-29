import { Fragment, useState, useRef, useEffect } from 'react'
import { Dialog, Transition } from '@headlessui/react'
import { MessageSquare, Copy, X, UserPlus, Paperclip, FileText, Download, ExternalLink, Clock, Eye, UserCheck, CheckCircle2, Lock, Ban, Users, ThumbsUp, Send } from 'lucide-react'
import type { FeedbackItem, FeedbackState, Severity, Category, FeedbackComment } from '../../FeedbackBoard'
import { solidAvatarColor } from '../team/teamMembers'

// Feedback detail · refinement post-QA (2026-06-29):
// - Single scrolleable body (sin tabs) · status + fields + transitions unificados
// - Altura fija h-[85vh] · no más salto entre tabs
// - Chat como side panel slide-out desde el borde derecho del modal
// - Avatares solid color (shared helper) · sin gradient
// - Header icon neutralizado (no purple branded)

interface FeedbackDetailModalProps {
    isOpen: boolean
    onClose: () => void
    feedback: FeedbackItem | null
    onTransition: (id: string, next: FeedbackState) => void
    /** FB-07 · total feedbacks en el grupo de duplicates (incluyendo este). 1 = único. */
    duplicateGroupSize?: number
    /** FB-07 · count actual de "Me too" votes desde localStorage. */
    meTooCount?: number
    /** FB-07 · handler para incrementar el counter. */
    onMeToo?: () => void
    /** FB-08a · comment thread del feedback (reporter + expert). */
    comments?: FeedbackComment[]
    /** FB-08a · handler para agregar comment · role default expert. */
    onAddComment?: (body: string, role: 'reporter' | 'expert') => void
    /** Opens the AssignFeedbackModal picker desde el modal de detail. */
    onOpenAssign?: (feedbackId: string) => void
}

// Status presentation · cards contextuales per state.
interface StatusPresentation {
    icon: typeof Clock
    label: string
    helper: string
    iconColor: string
    bgColor: string
    borderColor: string
}

function statusPresentation(state: FeedbackState): StatusPresentation {
    switch (state) {
        case 'Submitted':
            return { icon: Clock, label: 'Submitted', helper: 'Waiting for expert review',
                iconColor: 'text-blue-600', bgColor: 'bg-blue-500/10', borderColor: 'border-blue-500/30' }
        case 'Triaged':
            return { icon: Eye, label: 'Triaged', helper: 'Reviewed · pending assignment',
                iconColor: 'text-blue-600', bgColor: 'bg-blue-500/10', borderColor: 'border-blue-500/30' }
        case 'Assigned':
            return { icon: UserCheck, label: 'Assigned', helper: 'Owner picked up the work',
                iconColor: 'text-amber-600', bgColor: 'bg-amber-500/10', borderColor: 'border-amber-500/30' }
        case 'Resolved':
            return { icon: CheckCircle2, label: 'Resolved', helper: 'Fix delivered · pending closure',
                iconColor: 'text-green-600', bgColor: 'bg-green-500/10', borderColor: 'border-green-500/30' }
        case 'Closed':
            return { icon: Lock, label: 'Closed', helper: 'Loop complete · no further action',
                iconColor: 'text-muted-foreground', bgColor: 'bg-muted', borderColor: 'border-border' }
        case 'Dropped':
            return { icon: Ban, label: 'Dropped', helper: 'Out of scope · won’t fix',
                iconColor: 'text-muted-foreground', bgColor: 'bg-muted', borderColor: 'border-border' }
        case 'Duplicated':
            return { icon: Copy, label: 'Duplicated', helper: 'Linked to an existing report',
                iconColor: 'text-blue-600', bgColor: 'bg-blue-500/10', borderColor: 'border-blue-500/30' }
    }
}

interface ActionOption { label: string; target: FeedbackState }
function nextActions(state: FeedbackState): ActionOption[] {
    switch (state) {
        case 'Submitted':  return [{ label: 'Triaged', target: 'Triaged' }, { label: 'Dropped', target: 'Dropped' }, { label: 'Duplicated', target: 'Duplicated' }]
        case 'Triaged':    return [{ label: 'Resolved', target: 'Resolved' }, { label: 'Dropped', target: 'Dropped' }, { label: 'Duplicated', target: 'Duplicated' }]
        case 'Assigned':   return [{ label: 'Resolved', target: 'Resolved' }, { label: 'Dropped', target: 'Dropped' }, { label: 'Duplicated', target: 'Duplicated' }]
        case 'Resolved':   return [{ label: 'Closed', target: 'Closed' }, { label: 'Reopen', target: 'Submitted' }]
        case 'Closed':     return [{ label: 'Reopen', target: 'Submitted' }]
        case 'Dropped':    return [{ label: 'Reopen', target: 'Submitted' }]
        case 'Duplicated': return [{ label: 'Reopen', target: 'Submitted' }]
    }
}

function categoryPillClasses(c: Category): string {
    switch (c) {
        case 'Bug':              return 'bg-destructive/10 text-destructive'
        case 'Feature Request':  return 'bg-blue-500/10 text-blue-600'
        case 'UI/UX':            return 'bg-indigo-500/10 text-indigo-600'
        case 'Data':             return 'bg-amber-500/10 text-amber-600'
        case 'Performance':      return 'bg-cyan-500/10 text-cyan-600'
    }
}

function severityPillClasses(s: Severity): string {
    switch (s) {
        case 'Critical': return 'bg-destructive/10 text-destructive'
        case 'High':     return 'bg-destructive/10 text-destructive'
        case 'Medium':   return 'bg-amber-500/10 text-amber-600'
        case 'Low':      return 'bg-muted text-muted-foreground'
    }
}

function statusBadgeClasses(s: FeedbackState): string {
    switch (s) {
        case 'Submitted':  return 'bg-blue-500/10 text-blue-600 border border-blue-500/20'
        case 'Triaged':    return 'bg-blue-500/10 text-blue-600 border border-blue-500/20'
        case 'Assigned':   return 'bg-amber-500/10 text-amber-600 border border-amber-500/20'
        case 'Resolved':   return 'bg-green-500/10 text-green-600 border border-green-500/20'
        case 'Closed':     return 'bg-muted text-muted-foreground border border-border'
        case 'Dropped':    return 'bg-muted text-muted-foreground border border-border'
        case 'Duplicated': return 'bg-blue-500/10 text-blue-600 border border-blue-500/20'
    }
}

function shortId(id: string): string {
    const cleaned = id.replace(/^FB-/i, '')
    return cleaned.length > 8 ? cleaned.slice(0, 8).toUpperCase() : cleaned.toUpperCase()
}

function formatTimestamp(date: string): string {
    if (!date) return '—'
    const d = new Date(date)
    if (!isNaN(d.getTime())) {
        return d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
    }
    return `${date}, 13:16:51`
}

function emailFromHandle(handle: string): string {
    if (handle.includes('@')) return handle
    return `${handle.toLowerCase()}@special-t.com`
}

function nameFromEmail(email: string): string {
    const local = email.split('@')[0]
    return local.split(/[._-]/).map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(' ')
}

export default function FeedbackDetailModal({
    isOpen, onClose, feedback, onTransition,
    duplicateGroupSize = 1, meTooCount = 0, onMeToo,
    comments = [], onAddComment, onOpenAssign,
}: FeedbackDetailModalProps) {
    const [chatOpen, setChatOpen] = useState(false)

    // Reset chat panel when the modal closes.
    useEffect(() => { if (!isOpen) setChatOpen(false) }, [isOpen])

    if (!feedback) return null

    const isDuplicate = duplicateGroupSize > 1
    const totalAffected = duplicateGroupSize + meTooCount
    const presentation = statusPresentation(feedback.state)
    const StatusIcon = presentation.icon
    const actions = nextActions(feedback.state)
    const submittedByEmail = emailFromHandle(feedback.submittedBy)
    const submittedByName = nameFromEmail(submittedByEmail)
    const initials = submittedByName.split(' ').map(w => w.charAt(0)).slice(0, 2).join('').toUpperCase()
    const idChip = shortId(feedback.id)

    // Modal panel widens cuando el chat side panel está open.
    const panelMaxWidth = chatOpen ? 'max-w-6xl' : 'max-w-3xl'

    return (
        <Transition appear show={isOpen} as={Fragment}>
            <Dialog as="div" className="relative z-50" onClose={onClose}>
                <Transition.Child
                    as={Fragment}
                    enter="ease-out duration-200" enterFrom="opacity-0" enterTo="opacity-100"
                    leave="ease-in duration-150"  leaveFrom="opacity-100" leaveTo="opacity-0"
                >
                    <div className="fixed inset-0 bg-foreground/30 backdrop-blur-sm" />
                </Transition.Child>

                <div className="fixed inset-0 overflow-y-auto">
                    <div className="flex min-h-full items-center justify-center p-4">
                        <Transition.Child
                            as={Fragment}
                            enter="ease-out duration-200" enterFrom="opacity-0 scale-95" enterTo="opacity-100 scale-100"
                            leave="ease-in duration-150"  leaveFrom="opacity-100 scale-100" leaveTo="opacity-0 scale-95"
                        >
                            <Dialog.Panel className={`w-full ${panelMaxWidth} transform overflow-hidden rounded-2xl bg-card text-left shadow-2xl border border-border flex flex-row h-[85vh] transition-[max-width] duration-300`}>
                                {/* ============ MAIN COLUMN ============ */}
                                <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
                                    {/* HEADER */}
                                    <div className="flex items-center gap-3 px-6 py-4 border-b border-border shrink-0">
                                        <div className="h-10 w-10 rounded-xl bg-muted flex items-center justify-center shrink-0">
                                            <MessageSquare className="h-5 w-5 text-muted-foreground" />
                                        </div>
                                        <div className="flex items-center gap-2 flex-1 min-w-0">
                                            <h2 className="text-lg font-semibold text-foreground">Feedback Detail</h2>
                                            <button
                                                type="button"
                                                onClick={() => navigator.clipboard?.writeText(feedback.id)}
                                                title="Copy ID"
                                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-muted text-xs font-mono text-muted-foreground hover:bg-muted/80 transition-colors"
                                            >
                                                #{idChip}
                                                <Copy className="h-3 w-3" />
                                            </button>
                                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${categoryPillClasses(feedback.category)}`}>
                                                {feedback.category === 'Bug' ? 'Bug Report' : feedback.category}
                                            </span>
                                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${severityPillClasses(feedback.severity)}`}>
                                                {feedback.severity}
                                            </span>
                                        </div>
                                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap ${statusBadgeClasses(feedback.state)}`}>
                                            {feedback.state}
                                        </span>
                                        {/* Chat toggle button */}
                                        <button
                                            type="button"
                                            onClick={() => setChatOpen(o => !o)}
                                            className={`relative inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border text-xs font-semibold transition-colors ${
                                                chatOpen
                                                    ? 'bg-primary/10 border-primary/30 text-primary'
                                                    : 'border-border text-muted-foreground hover:text-foreground hover:bg-muted'
                                            }`}
                                            title={chatOpen ? 'Hide chat' : 'Open chat'}
                                            aria-label="Toggle chat"
                                            aria-pressed={chatOpen}
                                        >
                                            <MessageSquare className="h-3.5 w-3.5" />
                                            Chat
                                            {comments.length > 0 && (
                                                <span className={`inline-flex items-center justify-center min-w-[18px] h-[18px] px-1.5 rounded-full text-[10px] font-bold ${
                                                    chatOpen ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                                                }`}>
                                                    {comments.length}
                                                </span>
                                            )}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={onClose}
                                            className="h-8 w-8 rounded-lg hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
                                            aria-label="Close"
                                        >
                                            <X className="h-5 w-5" />
                                        </button>
                                    </div>

                                    {/* BODY · single scrollable · status + fields + transitions unificados */}
                                    <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
                                        {/* Status badge XL prominente */}
                                        <div className={`flex items-center gap-4 p-4 rounded-xl border ${presentation.bgColor} ${presentation.borderColor}`}>
                                            <div className={`h-12 w-12 rounded-xl bg-card flex items-center justify-center shrink-0 ${presentation.iconColor}`}>
                                                <StatusIcon className="h-6 w-6" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Status</div>
                                                <div className={`text-lg font-bold ${presentation.iconColor}`}>{presentation.label}</div>
                                                <div className="text-xs text-muted-foreground mt-0.5">{presentation.helper}</div>
                                            </div>
                                        </div>

                                        {/* Fields grid */}
                                        <Field label="Description">
                                            <p className="text-sm text-foreground">{feedback.description}</p>
                                        </Field>

                                        <Field label="Submitted by">
                                            <div className="flex items-center gap-3">
                                                <div className={`h-9 w-9 rounded-full ${solidAvatarColor(initials)} flex items-center justify-center text-xs font-bold text-white shrink-0`}>
                                                    {initials}
                                                </div>
                                                <div>
                                                    <div className="text-sm font-semibold text-foreground">{submittedByName}</div>
                                                    <div className="text-xs text-muted-foreground">{submittedByEmail}</div>
                                                </div>
                                            </div>
                                        </Field>

                                        <Field label="Experience">
                                            <p className="text-sm text-foreground">{feedback.experience ?? 'expert-hub'}</p>
                                        </Field>

                                        <Field label="Submitted at">
                                            <p className="text-sm text-foreground">{formatTimestamp(feedback.date)}</p>
                                        </Field>

                                        <Field label="Assigned to">
                                            {feedback.assignedTo ? (
                                                <div className="flex items-center gap-3">
                                                    <div className={`h-9 w-9 rounded-full ${solidAvatarColor(feedback.assignedTo.initials)} flex items-center justify-center text-xs font-bold text-white shrink-0`}>
                                                        {feedback.assignedTo.initials}
                                                    </div>
                                                    <div>
                                                        <div className="text-sm font-semibold text-foreground">{feedback.assignedTo.name}</div>
                                                        <div className="text-xs text-muted-foreground">Owner</div>
                                                    </div>
                                                </div>
                                            ) : (
                                                <button
                                                    type="button"
                                                    onClick={() => onOpenAssign?.(feedback.id)}
                                                    disabled={!onOpenAssign}
                                                    className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                                >
                                                    <UserPlus className="h-4 w-4" />
                                                    Assign
                                                </button>
                                            )}
                                        </Field>

                                        {/* FB-07 · Duplicate / Me-too card */}
                                        {(isDuplicate || meTooCount > 0) && (
                                            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 flex items-center gap-4">
                                                <div className="h-10 w-10 rounded-lg bg-card flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0">
                                                    <Users className="h-5 w-5" />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="text-sm font-semibold text-foreground">
                                                        Affecting {totalAffected} user{totalAffected === 1 ? '' : 's'}
                                                    </div>
                                                    <div className="text-xs text-muted-foreground mt-0.5">
                                                        {isDuplicate && (
                                                            <>
                                                                {duplicateGroupSize} similar report{duplicateGroupSize === 1 ? '' : 's'} grouped by category + description
                                                                {meTooCount > 0 && ' · '}
                                                            </>
                                                        )}
                                                        {meTooCount > 0 && (
                                                            <>
                                                                {meTooCount} "Me too" vote{meTooCount === 1 ? '' : 's'}
                                                            </>
                                                        )}
                                                    </div>
                                                </div>
                                                {onMeToo && (
                                                    <button
                                                        type="button"
                                                        onClick={onMeToo}
                                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-card border border-border text-sm font-medium text-foreground hover:bg-muted transition-colors shrink-0"
                                                        title="I'm affected by this too"
                                                    >
                                                        <ThumbsUp className="h-3.5 w-3.5" />
                                                        Me too
                                                    </button>
                                                )}
                                            </div>
                                        )}

                                        {/* Attachment card */}
                                        {feedback.attachment && (
                                            <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-3">
                                                <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                                                    <Paperclip className="h-4 w-4" />
                                                    Attachment
                                                </div>
                                                <div className="flex items-start gap-4">
                                                    <div className="h-16 w-14 rounded-lg bg-card border border-border flex items-center justify-center shrink-0">
                                                        <FileText className="h-7 w-7 text-muted-foreground" />
                                                    </div>
                                                    <div className="flex-1 min-w-0 space-y-2">
                                                        <div className="text-sm font-semibold text-foreground truncate">
                                                            {feedback.attachment.name}
                                                        </div>
                                                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                                            <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-muted font-mono uppercase">
                                                                {feedback.attachment.type}
                                                            </span>
                                                            <span>· {feedback.attachment.sizeKB.toFixed(1)} KB</span>
                                                        </div>
                                                        <div className="flex items-center gap-2 pt-1">
                                                            <button className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs font-medium text-foreground hover:bg-muted transition-colors">
                                                                <Download className="h-3.5 w-3.5" />
                                                                Download
                                                            </button>
                                                            <button className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs font-medium text-foreground hover:bg-muted transition-colors">
                                                                <ExternalLink className="h-3.5 w-3.5" />
                                                                Open
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        {/* Available transitions · al fondo del scrollable */}
                                        {actions.length > 0 && (
                                            <div className="pt-2">
                                                <div className="text-sm font-semibold text-foreground mb-3">Available transitions</div>
                                                <div className="flex flex-wrap items-center gap-2">
                                                    {actions.map(action => (
                                                        <button
                                                            key={action.label}
                                                            type="button"
                                                            onClick={() => onTransition(feedback.id, action.target)}
                                                            className="px-4 py-2 rounded-lg bg-card border border-border text-sm font-semibold text-foreground hover:bg-muted hover:border-foreground/30 transition-colors shadow-sm"
                                                        >
                                                            {action.label}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* ============ CHAT SIDE PANEL · slide-in desde derecha ============ */}
                                <Transition
                                    as={Fragment}
                                    show={chatOpen}
                                    enter="transition-all duration-300 ease-out"
                                    enterFrom="opacity-0 -translate-x-4 w-0"
                                    enterTo="opacity-100 translate-x-0 w-[420px]"
                                    leave="transition-all duration-200 ease-in"
                                    leaveFrom="opacity-100 translate-x-0 w-[420px]"
                                    leaveTo="opacity-0 -translate-x-4 w-0"
                                >
                                    <div className="w-[420px] shrink-0 border-l border-border flex flex-col overflow-hidden bg-muted/20">
                                        <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-card shrink-0">
                                            <div className="flex items-center gap-2">
                                                <MessageSquare className="h-4 w-4 text-muted-foreground" />
                                                <h3 className="text-sm font-semibold text-foreground">Conversation</h3>
                                                {comments.length > 0 && (
                                                    <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1.5 rounded-full text-[10px] font-bold bg-muted text-muted-foreground">
                                                        {comments.length}
                                                    </span>
                                                )}
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => setChatOpen(false)}
                                                className="h-7 w-7 rounded-md hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
                                                title="Hide chat"
                                                aria-label="Hide chat"
                                            >
                                                <X className="h-4 w-4" />
                                            </button>
                                        </div>
                                        <ChatThread
                                            comments={comments}
                                            reporterName={submittedByName.split(' ')[0] || 'Reporter'}
                                            onAddComment={onAddComment}
                                        />
                                    </div>
                                </Transition>
                            </Dialog.Panel>
                        </Transition.Child>
                    </div>
                </div>
            </Dialog>
        </Transition>
    )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div className="grid grid-cols-[160px_1fr] gap-4 items-start">
            <div className="text-sm text-muted-foreground pt-0.5">{label}</div>
            <div>{children}</div>
        </div>
    )
}

function ChatThread({
    comments, reporterName, onAddComment,
}: {
    comments: FeedbackComment[]
    reporterName: string
    onAddComment?: (body: string, role: 'reporter' | 'expert') => void
}) {
    const [draft, setDraft] = useState('')
    const [role, setRole] = useState<'expert' | 'reporter'>('expert')
    const scrollRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
    }, [comments.length])

    const handleSend = () => {
        const body = draft.trim()
        if (!body || !onAddComment) return
        onAddComment(body, role)
        setDraft('')
    }

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); handleSend() }
    }

    const formatTimestamp = (iso: string): string => {
        try {
            const d = new Date(iso)
            return d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
        } catch { return iso }
    }

    return (
        <>
            <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
                {comments.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                        <div className="h-10 w-10 rounded-xl bg-muted flex items-center justify-center mb-2">
                            <MessageSquare className="h-5 w-5 text-muted-foreground" />
                        </div>
                        <p className="text-xs font-semibold text-foreground">No conversation yet</p>
                        <p className="text-[11px] text-muted-foreground mt-1 max-w-[220px]">Reply below to start the back-and-forth with the reporter.</p>
                    </div>
                ) : (
                    comments.map(c => (
                        <div key={c.id} className={`flex items-start gap-2 ${c.role === 'expert' ? 'flex-row-reverse' : ''}`}>
                            <div className={`h-7 w-7 rounded-full ${solidAvatarColor(c.initials)} flex items-center justify-center text-[10px] font-bold text-white shrink-0`}>
                                {c.initials}
                            </div>
                            <div className={`flex-1 max-w-[80%] ${c.role === 'expert' ? 'items-end' : 'items-start'} flex flex-col`}>
                                <div className={`text-[10px] text-muted-foreground mb-0.5 ${c.role === 'expert' ? 'text-right' : ''}`}>
                                    <span className="font-semibold text-foreground">{c.author}</span>
                                    <span className="mx-1">·</span>
                                    <span>{formatTimestamp(c.createdAt)}</span>
                                </div>
                                <div className={`rounded-xl px-3 py-2 text-xs text-foreground ${
                                    c.role === 'expert'
                                        ? 'bg-blue-500/10 border border-blue-500/20 rounded-tr-sm'
                                        : 'bg-card border border-border rounded-tl-sm'
                                }`}>
                                    {c.body}
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {onAddComment && (
                <div className="px-4 py-3 border-t border-border bg-card space-y-2 shrink-0">
                    <div className="flex items-center gap-2 text-[10px]">
                        <span className="text-muted-foreground">Reply as</span>
                        <div className="flex items-center gap-1 bg-muted rounded-md p-0.5">
                            <button
                                type="button"
                                onClick={() => setRole('expert')}
                                className={`px-2 py-0.5 rounded text-[10px] font-semibold transition-colors ${
                                    role === 'expert' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'
                                }`}
                            >
                                Expert
                            </button>
                            <button
                                type="button"
                                onClick={() => setRole('reporter')}
                                className={`px-2 py-0.5 rounded text-[10px] font-semibold transition-colors ${
                                    role === 'reporter' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'
                                }`}
                            >
                                {reporterName ? `Reporter (${reporterName})` : 'Reporter'}
                            </button>
                        </div>
                    </div>
                    <div className="flex items-end gap-2">
                        <textarea
                            value={draft}
                            onChange={e => setDraft(e.target.value)}
                            onKeyDown={handleKeyDown}
                            rows={2}
                            placeholder="Write a reply… (⌘/Ctrl+Enter to send)"
                            className="flex-1 px-2.5 py-1.5 text-xs bg-muted/30 border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 resize-none"
                        />
                        <button
                            type="button"
                            onClick={handleSend}
                            disabled={!draft.trim()}
                            className="inline-flex items-center justify-center h-8 w-8 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shrink-0"
                            title="Send"
                        >
                            <Send className="h-3.5 w-3.5" />
                        </button>
                    </div>
                </div>
            )}
        </>
    )
}
