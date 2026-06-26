import { Fragment } from 'react'
import { Dialog, Transition } from '@headlessui/react'
import { MessageSquare, Copy, X, UserPlus, Paperclip, FileText, Download, ExternalLink, Clock, Eye, UserCheck, CheckCircle2, Lock, Ban } from 'lucide-react'
import type { FeedbackItem, FeedbackState, Severity, Category } from '../../FeedbackBoard'
import { avatarGradient } from '../team/teamMembers'

// Ports the Feedback Detail modal from production · dev-strata.orderbahn.com/expert-hub.
// Source · Diego screenshots 2026-06-26 (Submitted state + Triaged state).

interface FeedbackDetailModalProps {
    isOpen: boolean
    onClose: () => void
    feedback: FeedbackItem | null
    onTransition: (id: string, next: FeedbackState) => void
}

// Status presentation · per Diego decision (Fase B · 2026-06-26) reemplazo
// del step timeline horizontal por un único status badge prominente acorde
// governance Strata DS. Helper text + icon comunican el progreso sin dots.
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
                iconColor: 'text-purple-600', bgColor: 'bg-purple-500/10', borderColor: 'border-purple-500/30' }
    }
}

// Action transitions per current state · matches prod button visibility.
function nextActions(state: FeedbackState): FeedbackState[] {
    switch (state) {
        case 'Submitted': return ['Triaged', 'Dropped', 'Duplicated']
        case 'Triaged':   return ['Resolved', 'Dropped', 'Duplicated']
        case 'Assigned':  return ['Resolved', 'Dropped', 'Duplicated']
        case 'Resolved':  return ['Closed']
        default: return []
    }
}

function categoryPillClasses(c: Category): string {
    switch (c) {
        case 'Bug':              return 'bg-destructive/10 text-destructive'
        case 'Feature Request':  return 'bg-blue-500/10 text-blue-600'
        case 'UI/UX':            return 'bg-purple-500/10 text-purple-600'
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
        case 'Duplicated': return 'bg-purple-500/10 text-purple-600 border border-purple-500/20'
    }
}

// Short token slice of UUID-like id · matches prod "#7384D028" style chip.
function shortId(id: string): string {
    const cleaned = id.replace(/^FB-/i, '')
    return cleaned.length > 8 ? cleaned.slice(0, 8).toUpperCase() : cleaned.toUpperCase()
}

function formatTimestamp(date: string): string {
    // Mock data uses "Jun 12, 2026" format · append a fixed time for prod parity.
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

export default function FeedbackDetailModal({ isOpen, onClose, feedback, onTransition }: FeedbackDetailModalProps) {
    if (!feedback) return null

    const presentation = statusPresentation(feedback.state)
    const StatusIcon = presentation.icon
    const actions = nextActions(feedback.state)
    const submittedByEmail = emailFromHandle(feedback.submittedBy)
    const submittedByName = nameFromEmail(submittedByEmail)
    const initials = submittedByName.split(' ').map(w => w.charAt(0)).slice(0, 2).join('').toUpperCase()
    const idChip = shortId(feedback.id)

    return (
        <Transition appear show={isOpen} as={Fragment}>
            <Dialog as="div" className="relative z-50" onClose={onClose}>
                <Transition.Child
                    as={Fragment}
                    enter="ease-out duration-200"
                    enterFrom="opacity-0"
                    enterTo="opacity-100"
                    leave="ease-in duration-150"
                    leaveFrom="opacity-100"
                    leaveTo="opacity-0"
                >
                    <div className="fixed inset-0 bg-foreground/30 backdrop-blur-sm" />
                </Transition.Child>

                <div className="fixed inset-0 overflow-y-auto">
                    <div className="flex min-h-full items-center justify-center p-4">
                        <Transition.Child
                            as={Fragment}
                            enter="ease-out duration-200"
                            enterFrom="opacity-0 scale-95"
                            enterTo="opacity-100 scale-100"
                            leave="ease-in duration-150"
                            leaveFrom="opacity-100 scale-100"
                            leaveTo="opacity-0 scale-95"
                        >
                            <Dialog.Panel className="w-full max-w-4xl transform overflow-hidden rounded-2xl bg-card text-left shadow-2xl border border-border flex flex-col max-h-[90vh]">
                                {/* HEADER · icon + title + ID chip + tags + status pill + close */}
                                <div className="flex items-center gap-3 px-6 py-5 border-b border-border">
                                    <div className="h-10 w-10 rounded-xl bg-purple-500/10 flex items-center justify-center shrink-0">
                                        <MessageSquare className="h-5 w-5 text-purple-600" />
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
                                    <button
                                        type="button"
                                        onClick={onClose}
                                        className="h-8 w-8 rounded-lg hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
                                        aria-label="Close"
                                    >
                                        <X className="h-5 w-5" />
                                    </button>
                                </div>

                                {/* BODY · scrollable field section */}
                                <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
                                    <Field label="Description">
                                        <p className="text-sm text-foreground">{feedback.description}</p>
                                    </Field>

                                    <Field label="Submitted by">
                                        <div className="flex items-center gap-3">
                                            <div className={`h-9 w-9 rounded-full bg-gradient-to-br ${avatarGradient(initials)} flex items-center justify-center text-xs font-bold text-white shrink-0`}>
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
                                                <div className={`h-9 w-9 rounded-full bg-gradient-to-br ${avatarGradient(feedback.assignedTo.id)} flex items-center justify-center text-xs font-bold text-white shrink-0`}>
                                                    {feedback.assignedTo.initials}
                                                </div>
                                                <div className="text-sm font-semibold text-foreground">{feedback.assignedTo.name}</div>
                                            </div>
                                        ) : (
                                            <button
                                                type="button"
                                                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                                            >
                                                <UserPlus className="h-4 w-4" />
                                                Assign
                                            </button>
                                        )}
                                    </Field>

                                    {/* Attachment card · matches prod layout */}
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
                                </div>

                                {/* FOOTER · status badge XL prominente (reemplaza step timeline · Fase B) + actions */}
                                <div className="px-6 py-5 border-t border-border bg-card space-y-4">
                                    <div className={`flex items-center gap-4 p-4 rounded-xl border ${presentation.bgColor} ${presentation.borderColor}`}>
                                        <div className={`h-12 w-12 rounded-xl bg-card flex items-center justify-center shrink-0 ${presentation.iconColor}`}>
                                            <StatusIcon className="h-6 w-6" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Status</div>
                                            <div className={`text-lg font-bold ${presentation.iconColor}`}>{presentation.label}</div>
                                            <div className="text-xs text-muted-foreground mt-0.5">{presentation.helper}</div>
                                        </div>
                                        {actions.length > 0 && (
                                            <div className="flex items-center gap-2 shrink-0">
                                                {actions.map(action => (
                                                    <button
                                                        key={action}
                                                        type="button"
                                                        onClick={() => onTransition(feedback.id, action)}
                                                        className="px-3 py-1.5 rounded-lg bg-card border border-border text-sm font-medium text-foreground hover:bg-muted transition-colors shadow-sm"
                                                    >
                                                        {action}
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
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

