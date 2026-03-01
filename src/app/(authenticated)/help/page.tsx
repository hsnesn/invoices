import { requireAuth } from "@/lib/auth";
import Link from "next/link";

export const dynamic = "force-dynamic";

function Tip({ children }: { children: React.ReactNode }) {
  return (
    <div className="my-4 rounded-xl border border-sky-200/80 bg-gradient-to-br from-sky-50 to-sky-50/50 px-5 py-3.5 text-sm leading-relaxed shadow-sm dark:border-sky-800/60 dark:from-sky-950/50 dark:to-sky-950/30">
      <span className="font-semibold text-sky-700 dark:text-sky-300">Quick tip:</span>{" "}
      <span className="text-gray-700 dark:text-gray-300">{children}</span>
    </div>
  );
}

function StepList({ steps }: { steps: string[] }) {
  return (
    <ol className="mt-3 list-inside list-decimal space-y-2.5 text-gray-700 dark:text-gray-300">
      {steps.map((s, i) => (
        <li key={i} className="pl-1 leading-relaxed">{s}</li>
      ))}
    </ol>
  );
}

export default async function HelpPage() {
  await requireAuth();

  return (
    <div className="mx-auto max-w-4xl pb-16">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Help & Documentation</h1>
        <p className="mt-2 text-gray-600 dark:text-gray-400">
          Step-by-step guide to using the TRT UK Operations Platform. Every feature explained in detail.
        </p>
      </div>

      <section id="about" className="mb-10 scroll-mt-24 rounded-xl border border-sky-200/80 bg-gradient-to-br from-sky-50 to-white p-6 shadow-sm dark:border-sky-800/60 dark:from-sky-950/40 dark:to-slate-900/50">
        <h2 className="text-lg font-bold text-gray-900 dark:text-white">About This System</h2>
        <p className="mt-2 text-gray-700 dark:text-gray-300">
          <strong>TRT UK Operations Platform</strong> is a central system for managing guest, contractor, and other invoices at TRT World UK. It streamlines approval workflows, reduces manual work with AI extraction, keeps everything in one place, and supports different roles.
        </p>
        <p className="mt-4 text-sm text-gray-600 dark:text-gray-400">
          <strong>Why &quot;Clari&quot;?</strong> The name comes from the Latin <em>clarus</em> (clear, bright, evident). This system was developed by <strong>Hasan Esen</strong>.
        </p>
      </section>

      <nav className="mb-10 rounded-xl border border-gray-200/80 bg-gray-50/90 p-5 shadow-sm dark:border-gray-700/80 dark:bg-gray-800/40">
        <h2 className="mb-3 font-semibold text-gray-900 dark:text-white">Table of contents</h2>
        <ol className="list-inside list-decimal space-y-1 text-sm text-gray-600 dark:text-gray-300">
          <li><a href="#about" className="hover:text-sky-600 dark:hover:text-sky-400">About This System</a></li>
          <li><a href="#intro" className="hover:text-sky-600 dark:hover:text-sky-400">Introduction</a></li>
          <li><a href="#roles" className="hover:text-sky-600 dark:hover:text-sky-400">User roles</a></li>
          <li><a href="#dashboard" className="hover:text-sky-600 dark:hover:text-sky-400">Dashboard</a></li>
          <li><a href="#nav-bar" className="hover:text-sky-600 dark:hover:text-sky-400">Navigation bar</a></li>
          <li><a href="#dashboard-customize" className="hover:text-sky-600 dark:hover:text-sky-400">Dashboard customization</a></li>
          <li><a href="#keyboard-shortcuts" className="hover:text-sky-600 dark:hover:text-sky-400">Keyboard shortcuts</a></li>
          <li><a href="#profile" className="hover:text-sky-600 dark:hover:text-sky-400">Profile</a></li>
          <li><a href="#guest-invoices" className="hover:text-sky-600 dark:hover:text-sky-400">Guest Invoices</a></li>
          <li><a href="#double-click-edit" className="hover:text-sky-600 dark:hover:text-sky-400">Double-click to edit (no file upload)</a></li>
          <li><a href="#invited-guests" className="hover:text-sky-600 dark:hover:text-sky-400">Invited Guests</a></li>
          <li><a href="#contractor-invoices" className="hover:text-sky-600 dark:hover:text-sky-400">Contractor Invoices</a></li>
          <li><a href="#other-invoices" className="hover:text-sky-600 dark:hover:text-sky-400">Other Invoices</a></li>
          <li><a href="#salaries" className="hover:text-sky-600 dark:hover:text-sky-400">Salaries</a></li>
          <li><a href="#my-availability" className="hover:text-sky-600 dark:hover:text-sky-400">My Availability</a></li>
          <li><a href="#request" className="hover:text-sky-600 dark:hover:text-sky-400">Request</a></li>
          <li><a href="#office-requests" className="hover:text-sky-600 dark:hover:text-sky-400">Office Requests</a></li>
          <li><a href="#projects" className="hover:text-sky-600 dark:hover:text-sky-400">Projects</a></li>
          <li><a href="#vendors" className="hover:text-sky-600 dark:hover:text-sky-400">Vendors & Suppliers</a></li>
          <li><a href="#messages" className="hover:text-sky-600 dark:hover:text-sky-400">Messages</a></li>
          <li><a href="#reports" className="hover:text-sky-600 dark:hover:text-sky-400">Reports</a></li>
          <li><a href="#setup" className="hover:text-sky-600 dark:hover:text-sky-400">Setup</a></li>
          <li><a href="#user-management" className="hover:text-sky-600 dark:hover:text-sky-400">User Management</a></li>
          <li><a href="#audit-log" className="hover:text-sky-600 dark:hover:text-sky-400">Audit Log</a></li>
          <li><a href="#invoice-detail" className="hover:text-sky-600 dark:hover:text-sky-400">Invoice detail page</a></li>
          <li><a href="#common-operations" className="hover:text-sky-600 dark:hover:text-sky-400">Common operations</a></li>
          <li><a href="#email-notifications" className="hover:text-sky-600 dark:hover:text-sky-400">Email notifications</a></li>
          <li><a href="#mfa" className="hover:text-sky-600 dark:hover:text-sky-400">Two-factor authentication (MFA)</a></li>
          <li><a href="#announcements" className="hover:text-sky-600 dark:hover:text-sky-400">Announcements</a></li>
          <li><a href="#logo-preview" className="hover:text-sky-600 dark:hover:text-sky-400">Logo preview</a></li>
          <li><a href="#faq" className="hover:text-sky-600 dark:hover:text-sky-400">FAQ</a></li>
          <li><a href="#glossary" className="hover:text-sky-600 dark:hover:text-sky-400">Glossary</a></li>
        </ol>
      </nav>

      <div className="space-y-12 text-gray-700 dark:text-gray-300 leading-relaxed">
        {/* Introduction */}
        <section id="intro" className="scroll-mt-24">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">1. Introduction</h2>
          <p className="mt-2">
            Log in and go to the Dashboard. From there you can submit invoices, view existing ones, approve them (if you have permission), manage availability, plan staffing, and more. Each card on the Dashboard takes you to a specific section.
          </p>
          <Tip>Bookmark the Dashboard — it&apos;s your starting point.</Tip>
        </section>

        {/* Roles */}
        <section id="roles" className="scroll-mt-24">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">2. User roles</h2>
          <ul className="mt-3 list-inside list-disc space-y-1">
            <li><strong>Submitter</strong> — Submit your own invoices. Cannot approve others.</li>
            <li><strong>Manager</strong> — Approve or reject invoices assigned to you.</li>
            <li><strong>Finance</strong> — Mark invoices as paid. Cannot add, edit or delete.</li>
            <li><strong>Operations</strong> — See all invoices. Approve contractor invoices in the Operations Room stage.</li>
            <li><strong>Viewer</strong> — Read-only. No changes.</li>
            <li><strong>Admin</strong> — Full access. Manage users, Setup, everything.</li>
          </ul>
          <Tip>If you have &quot;allowed_pages&quot; set, you only see those pages. Ask your admin if you need access.</Tip>
        </section>

        {/* Dashboard */}
        <section id="dashboard" className="scroll-mt-24">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">3. Dashboard</h2>
          <p className="mt-2">
            After login you land on the Dashboard. At the top are metric cards (e.g. &quot;Guest Pending: 5&quot;). Click &quot;View →&quot; to go to those invoices. Below are page cards: Guest Invoices, Contractor Invoices, Salaries, My Availability, Request, etc. Click any card to open that section.
          </p>
          <p className="mt-2"><strong>How to use the Dashboard:</strong></p>
          <StepList steps={[
            "Look at the metric cards to see how many items are pending.",
            "Click \"View →\" on a metric card to go directly to that filtered list.",
            "Click a page card (e.g. Guest Invoices) to open that section.",
            "Use the search bar or keyboard shortcut (Ctrl+K or Cmd+K) to jump to a page quickly.",
            "Stats refresh every 30 seconds. Click \"Refresh\" for immediate update.",
          ]} />

          <h3 id="nav-bar" className="mt-8 text-base font-semibold text-gray-900 dark:text-white">Navigation bar</h3>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">The top bar gives quick access to key actions and notifications.</p>
          <div className="mt-4 space-y-4 rounded-xl border border-gray-200 bg-gray-50/80 p-5 dark:border-gray-700 dark:bg-gray-800/40">
            <div className="flex gap-4">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-400">
                <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
              </span>
              <div>
                <p className="font-medium text-gray-900 dark:text-white">Notification bell</p>
                <p className="mt-0.5 text-sm text-gray-600 dark:text-gray-400">Appears when you have pending tasks. Click to see: guest invoices awaiting approval, contractor invoices awaiting approval, other invoices awaiting payment, unread messages. Each item links straight to the relevant list.</p>
              </div>
            </div>
            <div className="flex gap-4">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-sky-100 text-sky-600 dark:bg-sky-900/40 dark:text-sky-400">
                <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
              </span>
              <div>
                <p className="font-medium text-gray-900 dark:text-white">Messages badge</p>
                <p className="mt-0.5 text-sm text-gray-600 dark:text-gray-400">The Messages link shows an unread count when you have new messages. Click to open your inbox.</p>
              </div>
            </div>
            <div className="flex gap-4">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-400">
                <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
              </span>
              <div>
                <p className="font-medium text-gray-900 dark:text-white">Submit button</p>
                <p className="mt-0.5 text-sm text-gray-600 dark:text-gray-400">Quick access to submit invoices. Click for Guest Invoice or Contractor Invoice. If you have both, a dropdown lets you choose. You can also go via Dashboard or the relevant invoices page.</p>
              </div>
            </div>
          </div>

          <h3 className="mt-6 text-base font-semibold text-gray-900 dark:text-white">Dashboard alerts</h3>
          <p className="mt-2">
            The Dashboard may show proactive alerts at the top: <strong>Recurring invoices due soon</strong> (rent, subscriptions from Setup), <strong>Reminders due</strong> (e.g. fire extinguisher inspection), <strong>Projects with deadline soon</strong>. Click an alert to go to the relevant section.
          </p>
          <h3 className="mt-6 text-base font-semibold text-gray-900 dark:text-white">Announcements</h3>
          <p className="mt-2">
            Admin can post system-wide announcements. They appear on the Dashboard. Read them for important updates.
          </p>
          <h3 id="dashboard-customize" className="mt-6 text-base font-semibold text-gray-900 dark:text-white">Dashboard customization</h3>
          <p className="mt-2">
            Click <strong>Customize</strong> on the Dashboard to enter edit mode. You can personalise what you see:
          </p>
          <StepList steps={[
            "Click Customize. The layout switches to edit mode.",
            "Show/hide sections: Alerts, Pending Actions, Your Guests, Metric Cards, Charts, Quick Overview.",
            "Hide individual metrics (Guest Pending, Guest Paid, Contractor Pending, etc.) from the metric cards.",
            "Hide page cards you do not use.",
            "Drag and drop to reorder metric cards and page cards.",
            "Click Done when finished. Your layout is saved.",
            "Reset layout to restore the default arrangement.",
          ]} />
        </section>

        {/* Keyboard shortcuts */}
        <section id="keyboard-shortcuts" className="scroll-mt-24">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">4. Keyboard shortcuts</h2>
          <p className="mt-2">
            Press <kbd className="rounded border border-gray-300 bg-gray-100 px-1.5 py-0.5 font-mono text-xs dark:border-gray-600 dark:bg-gray-800">?</kbd> or <kbd className="rounded border border-gray-300 bg-gray-100 px-1.5 py-0.5 font-mono text-xs dark:border-gray-600 dark:bg-gray-800">Shift+/</kbd> to show the shortcuts panel. Or click the footer link.
          </p>
          <p className="mt-2">The search modal (⌘K / Ctrl+K) searches across invoices, people, and pages. Type to find and jump to a section quickly.</p>
          <ul className="mt-4 space-y-2 text-sm">
            <li><strong>⌘K / Ctrl+K</strong> — Search (invoices, people, pages)</li>
            <li><strong>g then d</strong> — Go to Dashboard</li>
            <li><strong>g then i</strong> — Go to Guest Invoices</li>
            <li><strong>g then c</strong> — Go to Contractor Invoices</li>
            <li><strong>g then o</strong> — Go to Office Requests</li>
            <li><strong>g then p</strong> — Go to Projects</li>
            <li><strong>g then r</strong> — Go to Reports</li>
            <li><strong>g then m</strong> — Go to Messages</li>
            <li><strong>g then s</strong> — Go to Setup (admin)</li>
            <li><strong>g then h</strong> — Go to Help</li>
            <li><strong>A</strong> — Approve invoice (when row expanded)</li>
            <li><strong>R</strong> — Reject invoice (when row expanded)</li>
            <li><strong>P</strong> — Mark as paid (when row expanded)</li>
            <li><strong>Esc</strong> — Close modal / Cancel</li>
          </ul>
        </section>

        {/* Profile */}
        <section id="profile" className="scroll-mt-24">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">5. Profile</h2>
          <p className="mt-2">
            Go to your Profile (click your name or avatar in the nav) to manage your account settings.
          </p>
          <StepList steps={[
            "Update your full name and phone if needed.",
            "Upload or change your avatar (profile picture).",
            "Choose theme: Light, Dark, or System.",
            "Opt out of invoice-related emails if you don't want stage notifications.",
            "Save changes.",
          ]} />
        </section>

        {/* Guest Invoices - full section */}
        <section id="guest-invoices" className="scroll-mt-24">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">6. Guest Invoices</h2>
          <p className="mt-2">
            Guest invoices are for people who appear on programmes (experts, commentators). Go to <strong>Guest Invoices</strong> from the Dashboard.
          </p>

          <h3 className="mt-6 text-base font-semibold text-gray-900 dark:text-white">6.1 Status flow</h3>
          <ul className="mt-2 list-inside list-disc space-y-1">
            <li><strong>Submitted</strong> — Just uploaded, waiting for manager.</li>
            <li><strong>Pending manager</strong> — Manager must approve or reject.</li>
            <li><strong>Rejected</strong> — Manager said no. Submitter can fix and resubmit.</li>
            <li><strong>Approved by manager</strong> — Manager approved. Admin/finance reviews.</li>
            <li><strong>Pending admin</strong> — Admin/finance must review.</li>
            <li><strong>Ready for payment</strong> — Approved. Waiting to be paid.</li>
            <li><strong>Paid</strong> — Payment done.</li>
            <li><strong>Archived</strong> — Old or closed.</li>
          </ul>

          <h3 className="mt-6 text-base font-semibold text-gray-900 dark:text-white">6.2 Submitting a guest invoice (file upload)</h3>
          <StepList steps={[
            "Click Submit in the nav bar, or go to Dashboard → Guest Invoices → Submit.",
            "Select Department and Programme from the dropdowns.",
            "Fill in Service description if needed.",
            "Enter Transaction dates (from and to) and Currency (GBP, EUR, USD).",
            "Click Choose file and select the invoice file. Supported: PDF, DOCX, DOC, XLSX, XLS, JPEG.",
            "Click Submit. You will be redirected to the invoice list.",
          ]} />
          <Tip>AI extracts beneficiary, amount, invoice number and date from the file. You can correct these after upload.</Tip>

          <h3 className="mt-6 text-base font-semibold text-gray-900 dark:text-white">6.3 Generating an invoice from scratch</h3>
          <p className="mt-2">When the guest does not send an invoice, create one using the form.</p>
          <StepList steps={[
            "On Submit Invoice page, use the \"Generate from form\" section.",
            "Fill in INV NO, Invoice date, Guest name, Title, Producer, Department, Programme.",
            "Add at least one appearance: programme name, topic, date, amount. Click \"Add appearance\" for more.",
            "Optionally add expenses (travel, accommodation). Click \"Add expense\" if needed.",
            "Enter Bank details: account name, account number, sort code. Required for payment.",
            "Attach supporting files (e.g. receipts) if needed.",
            "Click Generate and submit. The system creates a PDF and submits it.",
          ]} />

          <h3 className="mt-6 text-base font-semibold text-gray-900 dark:text-white">6.4 Templates: save and reuse</h3>
          <p className="mt-2"><strong>Save a template:</strong></p>
          <StepList steps={[
            "Fill in the form with guest details, bank info, department, programme.",
            "In \"Saved templates\", type a name (e.g. \"John Smith - News\") in Template name.",
            "Click Save as template.",
          ]} />
          <p className="mt-2"><strong>Load a template:</strong></p>
          <StepList steps={[
            "Open the \"Load template...\" dropdown.",
            "Select the template. The form fills with saved data.",
            "Update appearances (dates, amounts) and any changed fields.",
            "Generate and submit as usual.",
          ]} />
          <p className="mt-2">Edit a template (pencil icon) or delete it (X). Templates are personal — only you see yours.</p>

          <h3 className="mt-6 text-base font-semibold text-gray-900 dark:text-white">6.5 Manager approval</h3>
          <StepList steps={[
            "Go to Guest Invoices. Filter by \"Pending\" or \"Pending manager\" if needed.",
            "Click an invoice row to open the detail view (or expand inline).",
            "Review the PDF and extracted data.",
            "Click Approve to move it to the next stage, or Reject and enter a reason.",
            "The submitter sees the rejection reason and can fix and resubmit.",
          ]} />
          <Tip>You cannot approve your own invoice. If you submitted it, someone else must approve.</Tip>
          <p className="mt-2"><strong>Approval delegation:</strong> Admin can set up a backup approver in Setup → Approval Delegation when a manager is absent. Choose delegator, delegate, and date range. During that period, the delegate can approve invoices assigned to the delegator.</p>

          <h3 className="mt-6 text-base font-semibold text-gray-900 dark:text-white">6.6 Admin and finance actions</h3>
          <p className="mt-2"><strong>Mark as paid:</strong></p>
          <StepList steps={[
            "Open the invoice (status must be Ready for payment).",
            "Click Mark as paid.",
            "Enter payment reference (e.g. bank transfer ID) and paid date.",
            "Save.",
          ]} />
          <p className="mt-2">Admin can also replace files, add extra files, assign a different line manager, add notes, archive, and move to line manager.</p>
          <h3 className="mt-6 text-base font-semibold text-gray-900 dark:text-white">6.7 Invoice tags</h3>
          <p className="mt-2">Add tags to invoices for filtering (e.g. &quot;urgent&quot;, &quot;Q1&quot;). Open an invoice, add a tag, save. Filter by tag in the list.</p>
          <h3 className="mt-6 text-base font-semibold text-gray-900 dark:text-white">6.8 Duplicate detection</h3>
          <p className="mt-2">The system may highlight invoices that look similar (same beneficiary, amount, date). Rows appear in yellow/amber. Review and merge or ignore as needed.</p>
          <h3 className="mt-6 text-base font-semibold text-gray-900 dark:text-white">6.9 Move to archive / Assign to line manager</h3>
          <p className="mt-2"><strong>Move to archive:</strong> Admin can move old or closed invoices to Archived status. <strong>Move to line manager:</strong> When an invoice has no manager or needs reassignment, admin can use &quot;Move to line manager&quot; to assign it to someone.</p>
        </section>

        {/* Double-click edit */}
        <section id="double-click-edit" className="scroll-mt-24">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">7. Double-click to edit (without uploading a new file)</h2>
          <p className="mt-2">
            You can edit invoice data (beneficiary, amount, dates, department, programme, etc.) without uploading a new file. This is useful when you need to correct a typo, update an amount, or change the department — and the original PDF stays as-is.
          </p>
          <p className="mt-2"><strong>How to use double-click edit:</strong></p>
          <StepList steps={[
            "Go to Guest Invoices or Contractor Invoices.",
            "Find the invoice you want to edit. You can edit if: (a) you are the submitter and status is Submitted, Pending manager, or Rejected, or (b) you are admin or manager.",
            "Double-click the invoice row (not the PDF link). An edit modal opens.",
            "Change any fields: beneficiary name, amount, invoice number, date, department, programme, line manager, notes, etc.",
            "Optionally: (a) Replace the file — click Replace and choose a new file if you want to swap the PDF. (b) Leave the file unchanged — just save the data edits.",
            "Click Save. The invoice data is updated. If status was Rejected, it moves back to Pending manager.",
          ]} />
          <Tip>Single-click opens the row and shows the PDF. Double-click opens the edit modal. You can edit data without uploading a new file — just change the fields and save.</Tip>
          <p className="mt-2"><strong>When to use:</strong> Use double-click edit when you need to fix a typo, update an amount, change department/programme, or correct extracted data. Use Replace file only when the actual PDF is wrong — otherwise, editing the data is enough.</p>
        </section>

        {/* Invited Guests */}
        <section id="invited-guests" className="scroll-mt-24">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">8. Invited Guests</h2>
          <p className="mt-2">
            Manage guests you invited for programmes. Send invitations, track responses, mark as accepted. Generate invoices from invited guests.
          </p>
          <h3 className="mt-6 text-base font-semibold text-gray-900 dark:text-white">8.1 Inviting a guest</h3>
          <StepList steps={[
            "Go to Guest Invoices → Invited Guests (or Dashboard → Invited Guests).",
            "Click to add a new guest. Enter guest name, email, title (e.g. Political Analyst).",
            "Select programme. Send invitation. The guest receives an email with a link.",
            "Use Bulk invite to invite multiple guests at once.",
          ]} />
          <h3 className="mt-6 text-base font-semibold text-gray-900 dark:text-white">8.2 Tracking and marking accepted</h3>
          <StepList steps={[
            "View the list. Filter by status (pending, accepted, etc.).",
            "When the guest accepts (clicks the link), you can mark them as accepted in the system.",
            "Resend invitation if the guest did not receive the email.",
          ]} />
          <h3 className="mt-6 text-base font-semibold text-gray-900 dark:text-white">8.3 Generate invoice from invited guest</h3>
          <p className="mt-2">When creating an invoice, you can start from an invited guest: go to Submit Invoice → Generate from form, or use the link from the guest record. The form pre-fills with the guest&apos;s name, email, title.</p>
        </section>

        {/* Contractor Invoices */}
        <section id="contractor-invoices" className="scroll-mt-24">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">9. Contractor Invoices</h2>
          <p className="mt-2">
            Contractor (freelancer) invoices are for people who work on a day-rate or project basis. Flow: submit → manager approves → (if applicable) Operations Room approves → admin/finance marks paid.
          </p>

          <h3 className="mt-6 text-base font-semibold text-gray-900 dark:text-white">9.1 Submitting a contractor invoice</h3>
          <StepList steps={[
            "Go to Contractor Invoices → Submit.",
            "Select a contractor template if your department uses one (pre-fills company, rate, etc.).",
            "Fill in: contractor name, company, service description, number of days, rate per day, service month, additional costs.",
            "Upload the invoice file (PDF, etc.).",
            "Submit. The system may assign a manager based on department.",
          ]} />

          <h3 className="mt-6 text-base font-semibold text-gray-900 dark:text-white">9.2 Double-click to edit</h3>
          <p className="mt-2">Same as guest invoices: double-click a contractor invoice row to open the edit modal. Change data without uploading a new file. Optionally replace the file if needed.</p>

          <h3 className="mt-6 text-base font-semibold text-gray-900 dark:text-white">9.3 Contractor approval workflow</h3>
          <StepList steps={[
            "Manager approves first. Invoice goes to next stage.",
            "If the invoice goes to Operations Room, an operations user must approve.",
            "Admin or finance marks it paid.",
            "When the line manager approves, the system can automatically send a Booking Form PDF and emails to the approver and to London Operations. Admin can trigger this manually if it fails.",
          ]} />
          <h3 className="mt-6 text-base font-semibold text-gray-900 dark:text-white">9.4 Booking Form</h3>
          <p className="mt-2">
            When a line manager approves a contractor invoice, the system automatically generates a <strong>Booking Form</strong> PDF and sends two emails: one to the approver (with PDF attached), one to London Operations (with PDF attached). This happens automatically. If it fails (e.g. email error), admin can open the invoice detail page and click <strong>Send Booking Form</strong> to trigger it manually.
          </p>
        </section>

        {/* Other Invoices */}
        <section id="other-invoices" className="scroll-mt-24">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">10. Other Invoices</h2>
          <p className="mt-2">
            For any invoice that does not fit guest or contractor flows. Admin, finance and operations can upload files. AI extracts beneficiary, amount, invoice number and date.
          </p>
          <StepList steps={[
            "Go to Other Invoices from the Dashboard.",
            "Click Upload or Add. Upload a file (PDF, DOCX, XLSX, etc.).",
            "AI extracts data. Review and correct if needed.",
            "Use filters (status, search, date range) to find invoices.",
            "When payment is done, click Mark paid. You can select multiple invoices and mark them as paid in bulk.",
          ]} />
          <Tip>Other invoices skip manager approval. They go straight to &quot;ready for payment&quot;.</Tip>
        </section>

        {/* Salaries */}
        <section id="salaries" className="scroll-mt-24">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">11. Salaries</h2>
          <p className="mt-2">
            Only admin, operations and finance can access Salaries. Manage salary payments for employees.
          </p>
          <StepList steps={[
            "Go to Salaries from the Dashboard.",
            "View the list: add new salary records, edit them, upload payslips, mark as paid.",
            "Finance can only mark paid — they cannot add, edit or delete.",
            "Double-click a salary row to edit (same pattern as invoices).",
          ]} />
          <h3 className="mt-6 text-base font-semibold text-gray-900 dark:text-white">11.1 Payslip upload and export</h3>
          <p className="mt-2">Upload payslips (PDF) for each salary record. Download or view payslips from the list. Admin can export salary data for reporting.</p>
          <h3 className="mt-6 text-base font-semibold text-gray-900 dark:text-white">11.2 Needs Review status</h3>
          <p className="mt-2">Salaries can be in three groups: <strong>Pending</strong>, <strong>Needs Review</strong>, <strong>Paid</strong>. Admin can move a salary to Needs Review when there is an issue (e.g. missing data, discrepancy). Items in Needs Review must be resolved before marking as paid.</p>
          <h3 className="mt-6 text-base font-semibold text-gray-900 dark:text-white">11.3 Audit trail</h3>
          <p className="mt-2">Salary changes are logged. View the audit trail for a record to see who changed what and when.</p>
        </section>

        {/* My Availability */}
        <section id="my-availability" className="scroll-mt-24">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">12. My Availability</h2>
          <p className="mt-2">
            Contractors submit their availability by role and days. Admin sees all records. Used for planning and the Request page.
          </p>

          <h3 className="mt-6 text-base font-semibold text-gray-900 dark:text-white">12.1 Submitting your availability</h3>
          <StepList steps={[
            "Go to My Availability from the Dashboard.",
            "Select the Form tab.",
            "Choose Department and Programme.",
            "Select your Role (e.g. Output, Camera) from the dropdown.",
            "Select Month.",
            "Switch to \"Available\" mode. Click dates on the calendar to mark yourself as available. Blue = available.",
            "Click Save Availability. Your availability is recorded.",
          ]} />

          <h3 className="mt-6 text-base font-semibold text-gray-900 dark:text-white">12.2 Cancelling or removing your availability</h3>
          <p className="mt-2">
            You can cancel or remove availability you previously submitted. Click the same date again to toggle it off — the date will turn white (unselected). Then click Save Availability. Your availability for that date is removed. You can also use Blocked mode to mark dates you cannot work (e.g. holiday, sick day).
          </p>
          <StepList steps={[
            "Go to My Availability → Form tab.",
            "Select the same Department, Programme, Role and Month you used before.",
            "Click a date that is currently blue (available). It will turn white — you have removed it.",
            "Click Save Availability. The change is saved.",
          ]} />
          <Tip>Green = booked (you are assigned). Blue = available (you said you can work). Red = blocked (you said you cannot). Click to toggle.</Tip>

          <h3 className="mt-6 text-base font-semibold text-gray-900 dark:text-white">12.3 Viewing all availability (admin/operations)</h3>
          <StepList steps={[
            "Go to My Availability → All tab.",
            "Select Department, Programme, and Month.",
            "View the list of contractors and their availability by date.",
          ]} />

          <h3 className="mt-6 text-base font-semibold text-gray-900 dark:text-white">12.4 Assignments (admin/operations)</h3>
          <p className="mt-2">The Assignments link in the nav shows a badge when there are contractor assignments pending your review. Click it to go to My Availability → Assignments tab.</p>
          <StepList steps={[
            "Go to My Availability → Assignments tab.",
            "Select Department, Programme, and Month.",
            "View the grid: requirements vs availability. Add assignments by selecting a person for a date/role.",
            "Use AI Suggest to let the system propose assignments based on availability and preference lists.",
            "Click Save to save pending assignments. Approved assignments are final.",
          ]} />

          <h3 className="mt-6 text-base font-semibold text-gray-900 dark:text-white">12.5 Recurring availability</h3>
          <p className="mt-2">Set recurring availability (e.g. every Monday) so you do not have to re-enter it each month. Use the Recurring section in the Form tab.</p>
          <h3 className="mt-6 text-base font-semibold text-gray-900 dark:text-white">12.6 Export to calendar (.ics)</h3>
          <p className="mt-2">Click &quot;Export to calendar (.ics)&quot; to download your availability as an iCal file. Import it into Google Calendar, Outlook, or Apple Calendar.</p>
          <h3 className="mt-6 text-base font-semibold text-gray-900 dark:text-white">12.7 Copy from last month</h3>
          <p className="mt-2">If your availability pattern is similar each month, use &quot;Copy from last month&quot; to copy your previous month&apos;s dates. Then adjust as needed.</p>
          <h3 className="mt-6 text-base font-semibold text-gray-900 dark:text-white">12.8 Clear month (admin)</h3>
          <p className="mt-2">Admin can clear availability and/or requirements for a month (e.g. when starting fresh). Affected contractors receive an email. Use with caution.</p>
        </section>

        {/* Request */}
        <section id="request" className="scroll-mt-24">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">13. Request (Contractor requirements and assignments)</h2>
          <p className="mt-2">
            Plan daily staffing needs. <strong>Requirements</strong> = how many people you need per role per day (demand). <strong>Assignments</strong> = who is assigned to fill those slots. Contractors submit their availability in My Availability (supply). Admin, operations and managers can enter requirements and make assignments.
          </p>

          <h3 className="mt-6 text-base font-semibold text-gray-900 dark:text-white">13.1 Requirements tab (daily demand)</h3>
          <StepList steps={[
            "Go to Request from the Dashboard.",
            "Select Department, Programme, and Month.",
            "Enter requirements: for each date and role, enter how many people you need (e.g. 2 Output, 1 Camera).",
            "The grid shows coverage: needed vs filled. Green means fully covered.",
            "Use Bulk request: paste or type requirements in a text format to add many at once.",
            "Use Recurring rules: set rules like \"every Monday 2 Output\". Click Apply to month to fill the calendar from those rules.",
          ]} />

          <h3 className="mt-6 text-base font-semibold text-gray-900 dark:text-white">13.2 Assignments</h3>
          <StepList steps={[
            "Add assignments: for each date/role, select a person from the dropdown. The dropdown shows available contractors (from My Availability).",
            "Use AI Suggest to let the system propose assignments based on availability and preference lists.",
            "Save assignments. Approve when final.",
          ]} />

          <h3 className="mt-6 text-base font-semibold text-gray-900 dark:text-white">13.3 My Preference List tab</h3>
          <StepList steps={[
            "Go to Request → My Preference List tab.",
            "Add people you prefer to work with. Select Person, Department, Programme, Role. Click Add.",
            "Reorder with up/down arrows. Higher in the list = higher preference.",
            "AI will prefer assigning people who appear in more users&apos; lists when they are available.",
            "Admin can configure the Contractor Preference Pool in Setup → My Availability: only people in that pool appear in the Person dropdown. When the pool is empty, all active users appear.",
          ]} />

          <h3 className="mt-6 text-base font-semibold text-gray-900 dark:text-white">13.4 Chat tab</h3>
          <p className="mt-2">Use the Chat tab to ask questions about availability, requirements, or assignments. The AI assistant can help with planning.</p>
          <h3 className="mt-6 text-base font-semibold text-gray-900 dark:text-white">13.5 Slots short view</h3>
          <p className="mt-2">Use <code className="rounded bg-gray-100 px-1 py-0.5 text-xs dark:bg-gray-800">/request?view=slots-short</code> for a compact overview of requirements and coverage by month/department. Quick way to see gaps.</p>
        </section>

        {/* Office Requests */}
        <section id="office-requests" className="scroll-mt-24">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">14. Office Requests</h2>
          <p className="mt-2">
            Submit requests for office needs: furniture, IT equipment, supplies, maintenance, software, training, etc. Admin/operations approve, assign to someone, and you get notified when done.
          </p>

          <h3 className="mt-6 text-base font-semibold text-gray-900 dark:text-white">14.1 Submitting an office request</h3>
          <StepList steps={[
            "Go to Office Requests from the Dashboard.",
            "Click \"New request\" or similar.",
            "Enter Title (e.g. \"New office chair for desk 5\").",
            "Enter Description (optional details).",
            "Select Category: Furniture, IT Equipment, Office Supplies, Maintenance, Software, Training, or Other.",
            "Select Priority: Low, Normal, High, or Urgent.",
            "Optionally enter Cost estimate and link a Vendor.",
            "Submit. Your request goes to Pending.",
          ]} />

          <h3 className="mt-6 text-base font-semibold text-gray-900 dark:text-white">14.2 Approving and assigning (admin/operations)</h3>
          <StepList steps={[
            "Go to Office Requests. Filter by Pending if needed.",
            "Click a request. Click Approve.",
            "Optionally assign to someone: select Assignee and Due date.",
            "The requester and assignee receive emails.",
            "To reject: click Reject and enter a reason.",
          ]} />

          <h3 className="mt-6 text-base font-semibold text-gray-900 dark:text-white">14.3 Completing a request</h3>
          <StepList steps={[
            "When the task is done, the assignee (or admin/operations) opens the request.",
            "Click Complete or Mark complete.",
            "Enter completion notes if needed.",
            "Optionally tick \"Create invoice\" to auto-create an Other Invoice linked to this request.",
            "Save. The requester receives an email. Status becomes Completed.",
          ]} />

          <h3 className="mt-6 text-base font-semibold text-gray-900 dark:text-white">14.4 Todo statuses (assignee)</h3>
          <p className="mt-2">When you are assigned to an office request, the todo has statuses: <strong>Pending</strong> (not started), <strong>In progress</strong>, <strong>Completed</strong>. Update the status as you work. When done, mark Completed and add completion notes.</p>
          <h3 className="mt-6 text-base font-semibold text-gray-900 dark:text-white">14.5 Reminders</h3>
          <p className="mt-2">Admin and operations can add reminders for recurring tasks (e.g. fire extinguisher inspection, equipment checks). Go to <strong>Office Requests</strong>, find the <strong>Reminders</strong> section, click <strong>+ Add Reminder</strong>. Enter title, next due date, frequency in months, and optionally an assignee. The system sends reminder emails when due and shows alerts on the Dashboard.</p>
          <h3 className="mt-6 text-base font-semibold text-gray-900 dark:text-white">14.6 Attachments, project and vendor</h3>
          <p className="mt-2">You can attach files (PDF, images) to a request. Link a request to a Project or Vendor when creating or editing.</p>
        </section>

        {/* Projects */}
        <section id="projects" className="scroll-mt-24">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">15. Projects</h2>
          <p className="mt-2">
            Track projects and link them to office requests and invoices. Admin, operations and managers can create and edit projects.
          </p>

          <h3 className="mt-6 text-base font-semibold text-gray-900 dark:text-white">15.1 Creating a project</h3>
          <StepList steps={[
            "Go to Projects from the Dashboard.",
            "Click \"+ New Project\".",
            "Enter Name (required).",
            "Enter Description (optional).",
            "Select Status: Active, On Hold, Completed, or Cancelled.",
            "Optionally set Deadline and Assignee.",
            "Save. The project appears in the list.",
          ]} />

          <h3 className="mt-6 text-base font-semibold text-gray-900 dark:text-white">15.2 Editing and tracking</h3>
          <StepList steps={[
            "Click a project to edit it. Change status, deadline, assignee as the project progresses.",
            "Link office requests to a project when creating or approving them.",
            "Link invoices to a project (e.g. when creating an Other Invoice or from the invoice detail page).",
            "Filter projects by status (Active, On Hold, Completed, Cancelled).",
          ]} />

          <h3 className="mt-6 text-base font-semibold text-gray-900 dark:text-white">15.3 Deleting a project</h3>
          <p className="mt-2">Only admin and operations can delete a project. Deleting removes the project but does not delete linked requests or invoices — they keep their data.</p>
        </section>

        {/* Vendors */}
        <section id="vendors" className="scroll-mt-24">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">16. Vendors & Suppliers</h2>
          <p className="mt-2">
            Manage vendor/supplier contacts, contract dates and payment terms.
          </p>
          <StepList steps={[
            "Go to Vendors & Suppliers from the Dashboard.",
            "Add a vendor: name, contact details, contract dates, payment terms.",
            "Edit or delete vendors as needed. Admin can configure in Setup → Vendors.",
          ]} />
        </section>

        {/* Messages */}
        <section id="messages" className="scroll-mt-24">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">18. Messages</h2>
          <p className="mt-2">
            Send and receive messages from colleagues. Task requests and replies.
          </p>
          <StepList steps={[
            "Go to Messages from the Dashboard.",
            "View your inbox. Click a message to read it.",
            "Compose a new message: select recipient, type subject and body, send.",
            "Reply to messages. Attach files if needed.",
          ]} />
          <h3 className="mt-6 text-base font-semibold text-gray-900 dark:text-white">18.1 Message about an invoice</h3>
          <p className="mt-2">From an invoice detail page (or expanded row), click &quot;Message about this invoice&quot; or &quot;Message submitter&quot;. A new message opens with the invoice context. Use this to ask questions or request changes without leaving the invoice.</p>
        </section>

        {/* Reports */}
        <section id="reports" className="scroll-mt-24">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">19. Reports</h2>
          <p className="mt-2">
            Generate monthly/quarterly reports with department spending analysis.
          </p>
          <StepList steps={[
            "Go to Admin → Reports (or Dashboard → Reports).",
            "Choose report type: monthly, quarterly, department, custom.",
            "Select date range and filters (guest/contractor).",
            "Click Generate. Download the report (e.g. Excel).",
          ]} />
        </section>

        {/* Setup */}
        <section id="setup" className="scroll-mt-24">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">20. Setup (admin only)</h2>
          <p className="mt-2">
            In Setup you manage departments, programmes, and system configuration. Admin (and sometimes operations) only.
          </p>

          <h3 className="mt-6 text-base font-semibold text-gray-900 dark:text-white">Setup tabs</h3>
          <ul className="mt-2 list-inside list-disc space-y-1">
            <li><strong>Guest Invoices</strong> — Departments, programmes, department managers, programme overrides, approval delegation, SLA settings, producer colors, admin & finance assignment.</li>
            <li><strong>Contractor Invoices</strong> — Contractor templates, departments, Operations Room members, service descriptions, booked by, additional cost reasons, Istanbul team options.</li>
            <li><strong>My Availability</strong> — Contractor Availability Roles (roles shown in the form), Contractor Preference Pool (who appears in My Preference List dropdown), who can approve assignments.</li>
            <li><strong>Delete Permissions</strong> — Which roles can delete invoices.</li>
            <li><strong>Logos</strong> — Upload and manage logos for generated invoices.</li>
            <li><strong>Email</strong> — Enable/disable emails by stage, choose recipients.</li>
            <li><strong>Salaries</strong> — Salary-related settings.</li>
            <li><strong>Vendors</strong> — Vendor categories and options.</li>
            <li><strong>Announcements</strong> — System-wide announcements.</li>
            <li><strong>Recurring Invoices</strong> — Add recurring payments (rent, subscriptions). Set title, beneficiary, amount, frequency (weekly, monthly, quarterly, yearly), next due date. The system sends reminders before due dates. Dashboard shows alerts when due soon.</li>
          </ul>

          <p className="mt-4"><strong>Contractor Preference Pool:</strong> In Setup → My Availability, add or remove people to the Contractor Preference Pool. When this list is populated, only those people appear in the &quot;My Preference List&quot; Person dropdown on the Request page. When empty, all active users appear.</p>
        </section>

        {/* User Management */}
        <section id="user-management" className="scroll-mt-24">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">21. User Management (admin only)</h2>
          <StepList steps={[
            "Go to Admin → User Management.",
            "Invite a new user: enter email, set role, department, programmes, allowed_pages.",
            "User receives a link to set their password and join.",
            "Edit a user: change role, deactivate, or update allowed_pages.",
            "Deactivated users cannot log in.",
          ]} />
        </section>

        {/* Audit Log */}
        <section id="audit-log" className="scroll-mt-24">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">22. Audit Log (admin only)</h2>
          <p className="mt-2">
            Detailed activity log for compliance. Who did what, when. Export for audits.
          </p>
          <StepList steps={[
            "Go to Admin → Audit Log.",
            "Filter by date, user, action, or entity.",
            "View the log. Export to CSV or Excel if needed.",
          ]} />
        </section>

        {/* Invoice detail */}
        <section id="invoice-detail" className="scroll-mt-24">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">23. Invoice detail page</h2>
          <p className="mt-2">
            Click any invoice in the list to open its detail page. Single-click a row to expand and see the PDF; double-click to open the edit modal.
          </p>
          <StepList steps={[
            "View the PDF (or files), status, submitter, approver, timeline of events.",
            "Download files. Replace file (when status is submitted or rejected). Add file (attach extra document).",
            "Add notes. Change status (if you have permission).",
            "The timeline shows every status change and who did it. Useful for auditing.",
          ]} />
          <h3 className="mt-6 text-base font-semibold text-gray-900 dark:text-white">23.1 AI extraction and manager confirmation</h3>
          <p className="mt-2">
            AI extracts beneficiary, amount, invoice number and bank details from the PDF. If the AI is uncertain, extracted fields show <strong>(needs review)</strong>. You can click <strong>Re-run AI extraction</strong> to re-extract from the file.
          </p>
          <p className="mt-2">
            When approving a guest invoice, managers must tick <strong>&quot;I confirm bank details are correct&quot;</strong> before the Approve button is enabled. If extraction was flagged as needs_review, the manager should verify the bank details first. Click <strong>Confirm</strong> to record that you have checked them, or approve directly after ticking the box.
          </p>
        </section>

        {/* Common operations */}
        <section id="common-operations" className="scroll-mt-24">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">24. Common operations</h2>
          <ul className="mt-2 space-y-3">
            <li><strong>Replace file:</strong> Open the invoice, click Replace file, choose the correct file. Only when status is Submitted or Rejected.</li>
            <li><strong>Add file:</strong> Attach an extra document (e.g. receipt) without removing the main invoice.</li>
            <li><strong>Bulk download:</strong> Admin can select multiple invoices and download all their files as a zip.</li>
            <li><strong>Excel import:</strong> Admin can import invoices from an Excel file. Check the import screen for the required format.</li>
            <li><strong>Bulk mark paid:</strong> In Other Invoices, select multiple invoices and mark them as paid in one action.</li>
            <li><strong>Filter by URL:</strong> Add <code className="rounded bg-gray-100 px-1.5 py-0.5 text-xs dark:bg-gray-800">?group=pending</code> to the invoice list URL for pending only, <code className="rounded bg-gray-100 px-1.5 py-0.5 text-xs dark:bg-gray-800">?group=paid</code> for paid. The metric cards&apos; &quot;View →&quot; links use these.</li>
          </ul>
          <Tip>Supported file types: PDF, DOCX, DOC, XLSX, XLS, JPEG.</Tip>
        </section>

        {/* Email notifications */}
        <section id="email-notifications" className="scroll-mt-24">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">25. Email notifications</h2>
          <p className="mt-2">
            Automatic emails at key workflow stages. Admin controls which stages send emails and to whom in Setup → Email settings.
          </p>
          <p className="mt-2">Stages: Submission, Manager assigned, Manager approved, Manager rejected, Resubmitted, Ready for payment, Paid. Users can opt out of invoice emails in their Profile.</p>
        </section>

        {/* MFA */}
        <section id="mfa" className="scroll-mt-24">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">26. Two-factor authentication (MFA)</h2>
          <p className="mt-2">
            For extra security, the system supports two-factor authentication. After entering your password, you may be asked for a one-time code (OTP) sent to your email or generated by an authenticator app. Follow the on-screen instructions to enable or complete MFA.
          </p>
        </section>

        {/* Announcements */}
        <section id="announcements" className="scroll-mt-24">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">27. Announcements</h2>
          <p className="mt-2">
            Admin can post system-wide announcements. They appear on the Dashboard. Read them for important updates, policy changes, or maintenance notices. Admin manages announcements in Setup → Announcements.
          </p>
        </section>

        {/* Logo preview */}
        <section id="logo-preview" className="scroll-mt-24">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">28. Logo preview</h2>
          <p className="mt-2">
            Go to <Link href="/logo-preview" className="text-sky-600 hover:underline dark:text-sky-400">Logo preview</Link> to see how your uploaded logos appear on generated invoices. Admin uploads logos in Setup → Logos. The preview helps verify placement and size before generating real invoices.
          </p>
        </section>

        {/* FAQ */}
        <section id="faq" className="scroll-mt-24">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">29. Frequently Asked Questions</h2>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">Common questions and answers. Including basic ones — no question is too simple.</p>
          <dl className="mt-4 space-y-5">
            <div>
              <dt className="font-semibold text-gray-900 dark:text-white">Where do I start? What is the Dashboard?</dt>
              <dd className="mt-1">After you log in, you see the Dashboard. It has cards for each section (Guest Invoices, Contractor Invoices, etc.). Click a card to go there. The metric cards at the top show how many items are pending — click &quot;View →&quot; to go straight to them.</dd>
            </div>
            <div>
              <dt className="font-semibold text-gray-900 dark:text-white">What is the bell icon in the nav?</dt>
              <dd className="mt-1">The notification bell appears when you have pending tasks (invoices awaiting approval, unread messages). Click it to see quick links to each list.</dd>
            </div>
            <div>
              <dt className="font-semibold text-gray-900 dark:text-white">How do I customize the Dashboard?</dt>
              <dd className="mt-1">Click Customize on the Dashboard. You can show/hide sections (Alerts, Metric Cards, etc.), hide individual metrics, hide page cards, and drag to reorder. Click Done when finished. Use Reset layout to restore defaults.</dd>
            </div>
            <div>
              <dt className="font-semibold text-gray-900 dark:text-white">What is the Assignments badge?</dt>
              <dd className="mt-1">The Assignments link in the nav shows a badge when there are contractor assignments pending your review (admin/operations/manager). Click it to go to My Availability → Assignments tab.</dd>
            </div>
            <div>
              <dt className="font-semibold text-gray-900 dark:text-white">What does &quot;needs review&quot; mean on an invoice?</dt>
              <dd className="mt-1">AI extraction flagged some fields as uncertain (e.g. amount, bank details). A human should verify them. Managers must tick &quot;I confirm bank details are correct&quot; before approving. You can also click Re-run AI extraction to re-extract from the PDF.</dd>
            </div>
            <div>
              <dt className="font-semibold text-gray-900 dark:text-white">What is Salaries &quot;Needs Review&quot;?</dt>
              <dd className="mt-1">Admin can move a salary to Needs Review when there is an issue (missing data, discrepancy). Items in Needs Review must be resolved before marking as paid.</dd>
            </div>
            <div>
              <dt className="font-semibold text-gray-900 dark:text-white">I don&apos;t see the Submit button. Why?</dt>
              <dd className="mt-1">Your role or allowed_pages may not include submit_invoice. Ask your admin to give you access.</dd>
            </div>
            <div>
              <dt className="font-semibold text-gray-900 dark:text-white">I don&apos;t see some pages (e.g. Salaries, Setup). Why?</dt>
              <dd className="mt-1">Your role or allowed_pages controls what you see. Salaries and Setup are admin/operations only. Ask your admin if you need access.</dd>
            </div>
            <div>
              <dt className="font-semibold text-gray-900 dark:text-white">What is the difference between single-click and double-click on an invoice?</dt>
              <dd className="mt-1">Single-click expands the row and shows the PDF. Double-click opens the edit modal so you can change data (beneficiary, amount, etc.) without uploading a new file.</dd>
            </div>
            <div>
              <dt className="font-semibold text-gray-900 dark:text-white">How do I edit an invoice without uploading a new file?</dt>
              <dd className="mt-1">Double-click the invoice row. The edit modal opens. Change the fields (beneficiary, amount, department, etc.) and save. You do not need to replace the file unless the PDF itself is wrong.</dd>
            </div>
            <div>
              <dt className="font-semibold text-gray-900 dark:text-white">I approved by mistake. Can I undo?</dt>
              <dd className="mt-1">Only admin can change statuses. Contact an admin to revert the invoice to the previous stage.</dd>
            </div>
            <div>
              <dt className="font-semibold text-gray-900 dark:text-white">The upload failed. What do I do?</dt>
              <dd className="mt-1">Check file size (very large files may fail), format (PDF, DOCX, XLSX, JPEG supported), and your internet connection. Try a different browser. If it still fails, contact support.</dd>
            </div>
            <div>
              <dt className="font-semibold text-gray-900 dark:text-white">What file types can I upload?</dt>
              <dd className="mt-1">PDF, DOCX, DOC, XLSX, XLS, JPEG. For office request attachments: PDF, PNG, JPG, GIF, WebP, DOC, DOCX.</dd>
            </div>
            <div>
              <dt className="font-semibold text-gray-900 dark:text-white">I can&apos;t approve my own invoice. Is that normal?</dt>
              <dd className="mt-1">Yes. The system blocks self-approval. Someone else must approve your invoice.</dd>
            </div>
            <div>
              <dt className="font-semibold text-gray-900 dark:text-white">Where did my template go?</dt>
              <dd className="mt-1">Templates are stored per user. Make sure you&apos;re logged in as the same user who saved it. If you still don&apos;t see it, it may have been deleted — check with admin.</dd>
            </div>
            <div>
              <dt className="font-semibold text-gray-900 dark:text-white">How do I cancel or remove my availability?</dt>
              <dd className="mt-1">Go to My Availability → Form. Select the same Department, Programme, Role and Month. Click a blue date to toggle it off (it turns white). Click Save Availability. Your availability for that date is removed.</dd>
            </div>
            <div>
              <dt className="font-semibold text-gray-900 dark:text-white">What is the difference between Available and Blocked in My Availability?</dt>
              <dd className="mt-1">Available = you can work that day. Blocked = you cannot (holiday, sick, etc.). Use Available to add dates you can work. Use Blocked to mark dates you definitely cannot.</dd>
            </div>
            <div>
              <dt className="font-semibold text-gray-900 dark:text-white">What are Requirements vs Assignments in Request?</dt>
              <dd className="mt-1">Requirements = how many people you need per role per day (e.g. 2 Output on Monday). Assignments = who is actually assigned to fill those slots. You enter requirements first, then assign people from those who have submitted availability.</dd>
            </div>
            <div>
              <dt className="font-semibold text-gray-900 dark:text-white">What is the Contractor Preference Pool?</dt>
              <dd className="mt-1">Admin-managed list in Setup → My Availability. When populated, only those people appear in the &quot;My Preference List&quot; Person dropdown on the Request page. When empty, all active users appear.</dd>
            </div>
            <div>
              <dt className="font-semibold text-gray-900 dark:text-white">How do I submit an office request?</dt>
              <dd className="mt-1">Go to Office Requests → New request. Enter title, description, category (Furniture, IT Equipment, etc.), priority. Submit. Admin/operations will approve and optionally assign someone.</dd>
            </div>
            <div>
              <dt className="font-semibold text-gray-900 dark:text-white">Where are Reminders set up?</dt>
              <dd className="mt-1">Go to Office Requests. In the Reminders section, click + Add Reminder. Enter title (e.g. Fire extinguisher maintenance), next due date, frequency in months, and optionally an assignee. Admin and operations only.</dd>
            </div>
            <div>
              <dt className="font-semibold text-gray-900 dark:text-white">How do I complete an office request?</dt>
              <dd className="mt-1">If you are the assignee or admin/operations: open the request, click Complete, enter notes if needed, optionally tick &quot;Create invoice&quot; to auto-create an Other Invoice. Save.</dd>
            </div>
            <div>
              <dt className="font-semibold text-gray-900 dark:text-white">How do I create a project?</dt>
              <dd className="mt-1">Go to Projects → + New Project. Enter name (required), description, status, deadline, assignee. Save. You can then link office requests and invoices to it.</dd>
            </div>
            <div>
              <dt className="font-semibold text-gray-900 dark:text-white">What is the Operations Room?</dt>
              <dd className="mt-1">Extra approval stage for some contractor invoices. Operations staff (who are in the Operations Room list in Setup) can approve those invoices. Admin can always approve.</dd>
            </div>
            <div>
              <dt className="font-semibold text-gray-900 dark:text-white">I forgot my password. What do I do?</dt>
              <dd className="mt-1">Use the &quot;Forgot password&quot; link on the login page. You will receive an email to reset it. If you don&apos;t receive it, check spam or contact admin.</dd>
            </div>
            <div>
              <dt className="font-semibold text-gray-900 dark:text-white">Can I use the system on my phone?</dt>
              <dd className="mt-1">Yes. The system is responsive. Some features (e.g. bulk upload, complex forms) may be easier on a desktop.</dd>
            </div>
            <div>
              <dt className="font-semibold text-gray-900 dark:text-white">How do I get a report?</dt>
              <dd className="mt-1">Go to Reports (Admin → Reports or Dashboard). Choose report type, date range, filters. Generate. Download (e.g. Excel).</dd>
            </div>
            <div>
              <dt className="font-semibold text-gray-900 dark:text-white">I got an email about an invoice. What does it mean?</dt>
              <dd className="mt-1">The system sends emails at key stages (submitted, approved, rejected, paid). The email tells you what happened and often includes a link. Click the link to open the invoice.</dd>
            </div>
            <div>
              <dt className="font-semibold text-gray-900 dark:text-white">Can I turn off invoice emails?</dt>
              <dd className="mt-1">Yes. Go to your Profile. There is an option to opt out of invoice-related emails. Admin controls which stages send emails in Setup → Email.</dd>
            </div>
            <div>
              <dt className="font-semibold text-gray-900 dark:text-white">What is Copy from last month in My Availability?</dt>
              <dd className="mt-1">It copies your availability from the previous month to the current month. Useful if your pattern is similar (e.g. same weekdays). You can then adjust dates as needed.</dd>
            </div>
            <div>
              <dt className="font-semibold text-gray-900 dark:text-white">What is AI Suggest in Request/Assignments?</dt>
              <dd className="mt-1">The system suggests who to assign based on availability and preference lists. It tries to match people who are available and who appear in more users&apos; preference lists. You can accept or change the suggestions.</dd>
            </div>
            <div>
              <dt className="font-semibold text-gray-900 dark:text-white">Can I delete an invoice?</dt>
              <dd className="mt-1">Only certain roles (admin, finance, operations, submitter) can delete, and only in early stages. Check Setup → Delete Permissions. Once an invoice is paid or archived, deletion may be restricted.</dd>
            </div>
            <div>
              <dt className="font-semibold text-gray-900 dark:text-white">What is the difference between Guest and Contractor invoices?</dt>
              <dd className="mt-1">Guest invoices = for people who appear on programmes (experts, commentators). Contractor invoices = for freelancers who work on a day-rate or project basis. They have different workflows (e.g. contractor has Operations Room stage).</dd>
            </div>
            <div>
              <dt className="font-semibold text-gray-900 dark:text-white">What are Other Invoices?</dt>
              <dd className="mt-1">Any invoice that does not fit guest or contractor flows. Upload a file, AI extracts data, mark as paid when done. No manager approval step.</dd>
            </div>
            <div>
              <dt className="font-semibold text-gray-900 dark:text-white">How do I add a note to an invoice?</dt>
              <dd className="mt-1">Open the invoice (expand the row or go to detail page). Find the Notes section. Type your note and click Add. Notes are visible to others with access.</dd>
            </div>
            <div>
              <dt className="font-semibold text-gray-900 dark:text-white">The page is slow or not loading. What do I do?</dt>
              <dd className="mt-1">Refresh the page. Check your internet. Try a different browser. Clear cache. If it persists, contact support.</dd>
            </div>
            <div>
              <dt className="font-semibold text-gray-900 dark:text-white">What are recurring invoices?</dt>
              <dd className="mt-1">Admin defines them in Setup → Recurring Invoices (e.g. rent, subscriptions). The system sends reminders before due dates. Dashboard may show alerts when recurring invoices are due soon.</dd>
            </div>
            <div>
              <dt className="font-semibold text-gray-900 dark:text-white">What are recurring requirements in Request?</dt>
              <dd className="mt-1">Rules like &quot;every Monday 2 Output&quot;. Set them in the Recurring rules section. Click &quot;Apply to month&quot; to fill the calendar with those requirements. Saves time when your pattern is the same each week.</dd>
            </div>
            <div>
              <dt className="font-semibold text-gray-900 dark:text-white">Can I cancel an assignment (when I was assigned to a date)?</dt>
              <dd className="mt-1">Admin/operations can cancel an assignment from the Assignments tab. Contractors cannot cancel their own assignments — contact admin if you need to be removed from a date.</dd>
            </div>
          </dl>
        </section>

        {/* Glossary */}
        <section id="glossary" className="scroll-mt-24">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">30. Glossary</h2>
          <dl className="mt-3 space-y-2 text-sm">
            <dt className="font-semibold text-gray-900 dark:text-white">Submitter</dt>
            <dd>Person who uploads or creates the invoice.</dd>
            <dt className="font-semibold text-gray-900 dark:text-white">Manager / Line manager</dt>
            <dd>Person who approves or rejects the invoice at the first stage.</dd>
            <dt className="font-semibold text-gray-900 dark:text-white">Department</dt>
            <dd>Organisational unit (e.g. News, Sport).</dd>
            <dt className="font-semibold text-gray-900 dark:text-white">Programme</dt>
            <dd>Show or project within a department.</dd>
            <dt className="font-semibold text-gray-900 dark:text-white">Operations Room</dt>
            <dd>Extra approval stage for some contractor invoices.</dd>
            <dt className="font-semibold text-gray-900 dark:text-white">Template</dt>
            <dd>Saved form data (guest details, bank info) you can load to save time.</dd>
            <dt className="font-semibold text-gray-900 dark:text-white">Contractor Preference Pool</dt>
            <dd>Admin-managed list of people who can appear in the My Preference List dropdown. When populated, only those people appear.</dd>
            <dt className="font-semibold text-gray-900 dark:text-white">Booking Form</dt>
            <dd>PDF generated when a contractor invoice is approved. Sent to the approver and London Operations.</dd>
            <dt className="font-semibold text-gray-900 dark:text-white">Payslip</dt>
            <dd>Document showing salary breakdown. Uploaded to salary records.</dd>
            <dt className="font-semibold text-gray-900 dark:text-white">Assignee</dt>
            <dd>Person assigned to complete a task (e.g. office request, project).</dd>
            <dt className="font-semibold text-gray-900 dark:text-white">Todo</dt>
            <dd>Task created when an office request is approved. Has status: pending, in progress, completed.</dd>
            <dt className="font-semibold text-gray-900 dark:text-white">Tag</dt>
            <dd>Label you add to invoices for filtering (e.g. urgent, Q1).</dd>
            <dt className="font-semibold text-gray-900 dark:text-white">Archive</dt>
            <dd>Status for old or closed invoices. Archived invoices are kept but not in active workflows.</dd>
            <dt className="font-semibold text-gray-900 dark:text-white">Duplicate</dt>
            <dd>Invoice that looks similar to another (same beneficiary, amount). System may highlight it in yellow.</dd>
            <dt className="font-semibold text-gray-900 dark:text-white">Needs review</dt>
            <dd>Flag on extracted invoice or salary data when the AI is uncertain. A human should verify before approving or marking paid.</dd>
            <dt className="font-semibold text-gray-900 dark:text-white">OTP</dt>
            <dd>One-time password. Used in two-factor authentication (MFA).</dd>
            <dt className="font-semibold text-gray-900 dark:text-white">Slots short view</dt>
            <dd>Compact overview of requirements and coverage on the Request page. Use ?view=slots-short.</dd>
          </dl>
        </section>
      </div>

      <div className="mt-12 border-t border-gray-200 pt-6 dark:border-gray-700">
        <div className="flex flex-wrap items-center gap-4">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 text-sky-600 hover:text-sky-700 dark:text-sky-400 dark:hover:text-sky-300"
          >
            ← Back to Dashboard
          </Link>
          <Link
            href="/logo-preview"
            className="inline-flex items-center gap-2 text-sky-600 hover:text-sky-700 dark:text-sky-400 dark:hover:text-sky-300"
          >
            Logo preview →
          </Link>
        </div>
        <p className="mt-6 text-right text-sm text-gray-400 dark:text-gray-500">Hasan Esen</p>
      </div>
    </div>
  );
}
