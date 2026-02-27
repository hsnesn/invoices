import { requireAuth } from "@/lib/auth";
import Link from "next/link";

export const dynamic = "force-dynamic";

function Tip({ children }: { children: React.ReactNode }) {
  return (
    <div className="my-3 rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 text-sm dark:border-sky-800 dark:bg-sky-950/40">
      <span className="font-semibold text-sky-700 dark:text-sky-300">Quick tip:</span> {children}
    </div>
  );
}

export default async function HelpPage() {
  await requireAuth();

  return (
    <div className="mx-auto max-w-4xl pb-16">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Help & Documentation</h1>
        <p className="mt-2 text-gray-600 dark:text-gray-400">
          Step-by-step guide to using the Invoice Approval system.
        </p>
      </div>

      <nav className="mb-10 rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800/50">
        <h2 className="mb-3 font-semibold text-gray-900 dark:text-white">Table of contents</h2>
        <ol className="list-inside list-decimal space-y-1 text-sm text-gray-600 dark:text-gray-300">
          <li><a href="#intro" className="hover:text-sky-600 dark:hover:text-sky-400">Introduction</a></li>
          <li><a href="#roles" className="hover:text-sky-600 dark:hover:text-sky-400">User roles</a></li>
          <li><a href="#dashboard" className="hover:text-sky-600 dark:hover:text-sky-400">Dashboard</a></li>
          <li><a href="#guest-overview" className="hover:text-sky-600 dark:hover:text-sky-400">Guest invoices overview</a></li>
          <li><a href="#submit-upload" className="hover:text-sky-600 dark:hover:text-sky-400">Submitting a guest invoice (file upload)</a></li>
          <li><a href="#generate" className="hover:text-sky-600 dark:hover:text-sky-400">Generating an invoice from scratch</a></li>
          <li><a href="#templates" className="hover:text-sky-600 dark:hover:text-sky-400">Templates: save and reuse</a></li>
          <li><a href="#manager-approval" className="hover:text-sky-600 dark:hover:text-sky-400">Manager approval</a></li>
          <li><a href="#admin-finance" className="hover:text-sky-600 dark:hover:text-sky-400">Admin and finance actions</a></li>
          <li><a href="#contractor-overview" className="hover:text-sky-600 dark:hover:text-sky-400">Contractor invoices overview</a></li>
          <li><a href="#contractor-submit" className="hover:text-sky-600 dark:hover:text-sky-400">Submitting a contractor invoice</a></li>
          <li><a href="#contractor-approval" className="hover:text-sky-600 dark:hover:text-sky-400">Contractor approval workflow</a></li>
          <li><a href="#salaries" className="hover:text-sky-600 dark:hover:text-sky-400">Salaries</a></li>
          <li><a href="#setup" className="hover:text-sky-600 dark:hover:text-sky-400">Setup</a></li>
          <li><a href="#reports" className="hover:text-sky-600 dark:hover:text-sky-400">Reports</a></li>
          <li><a href="#users" className="hover:text-sky-600 dark:hover:text-sky-400">User management</a></li>
          <li><a href="#invoice-detail" className="hover:text-sky-600 dark:hover:text-sky-400">Invoice detail page</a></li>
          <li><a href="#common" className="hover:text-sky-600 dark:hover:text-sky-400">Common operations</a></li>
          <li><a href="#faq" className="hover:text-sky-600 dark:hover:text-sky-400">FAQ</a></li>
          <li><a href="#glossary" className="hover:text-sky-600 dark:hover:text-sky-400">Glossary</a></li>
        </ol>
      </nav>

      <div className="space-y-10 text-gray-700 dark:text-gray-300">
        {/* 1. Introduction */}
        <section id="intro" className="scroll-mt-24">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">1. Introduction</h2>
          <p className="mt-2">
            This system helps you manage invoices for guest appearances and contractor work. Think of it like a shared folder where everyone can see invoices, but only certain people can approve or reject them. You log in, go to the Dashboard, and from there you can submit new invoices, view existing ones, or approve them (if you have permission).
          </p>
          <Tip>Bookmark the Dashboard — it&apos;s your starting point. The cards show you where to go for each task.</Tip>
        </section>

        {/* 2. Roles */}
        <section id="roles" className="scroll-mt-24">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">2. User roles and permissions</h2>
          <p className="mt-2">
            Each user has a role. Your role decides what you can see and do. Imagine a school: students can hand in homework, teachers can grade it, and the principal can do everything. It&apos;s similar here.
          </p>
          <ul className="mt-3 list-inside list-disc space-y-1">
            <li><strong>Submitter</strong> — You can only see and submit your own invoices. You cannot approve anyone else&apos;s.</li>
            <li><strong>Manager</strong> — You can approve or reject invoices assigned to you (or in your department/programme).</li>
            <li><strong>Finance</strong> — You see invoices that are ready for payment. You can mark them as paid.</li>
            <li><strong>Operations</strong> — You see all invoices. For contractor invoices, you can approve in the &quot;Operations Room&quot; stage.</li>
            <li><strong>Viewer</strong> — Read-only. You can look at invoices and reports but cannot change anything.</li>
            <li><strong>Admin</strong> — Full access. You can do everything: approve, reject, mark paid, manage users, change settings.</li>
          </ul>
          <Tip>If you have &quot;allowed_pages&quot; set, you only see those pages. Ask your admin if you don&apos;t see something you need.</Tip>
        </section>

        {/* 3. Dashboard */}
        <section id="dashboard" className="scroll-mt-24">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">3. Dashboard</h2>
          <p className="mt-2">
            After you log in, you land on the Dashboard. At the top you see cards with numbers (e.g. &quot;Guest Pending: 5&quot;). These show how many invoices are waiting. Click &quot;View →&quot; on a card to go straight to those invoices. Below that, you see page cards: Guest Invoices, Contractor Invoices, Salaries, etc. Click any card to open that section.
          </p>
          <Tip>The stats refresh every 30 seconds. Click &quot;Refresh&quot; if you want to update them immediately.</Tip>
        </section>

        {/* 4. Guest invoices overview */}
        <section id="guest-overview" className="scroll-mt-24">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">4. Guest invoices — overview</h2>
          <p className="mt-2">
            Guest invoices are for people who appear on programmes (e.g. experts, commentators). Go to <strong>Guest Invoices</strong> from the Dashboard. You see a list of invoices. Each has a status. The status tells you where it is in the approval process.
          </p>
          <p className="mt-2">Status flow:</p>
          <ul className="mt-1 list-inside list-disc space-y-1">
            <li><strong>Submitted</strong> — Just uploaded, waiting for manager.</li>
            <li><strong>Pending manager</strong> — Manager must approve or reject.</li>
            <li><strong>Rejected</strong> — Manager said no. Submitter can fix and resubmit.</li>
            <li><strong>Approved by manager</strong> — Manager said yes. Now admin or finance checks it.</li>
            <li><strong>Pending admin</strong> — Admin/finance must review.</li>
            <li><strong>Ready for payment</strong> — Approved. Waiting to be paid.</li>
            <li><strong>Paid</strong> — Payment done.</li>
            <li><strong>Archived</strong> — Old or closed.</li>
          </ul>
          <Tip>Use the filter dropdown (e.g. &quot;Pending&quot;, &quot;Paid&quot;) to see only the invoices you care about.</Tip>
        </section>

        {/* 5. Submit upload */}
        <section id="submit-upload" className="scroll-mt-24">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">5. Submitting a guest invoice (file upload)</h2>
          <p className="mt-2">
            When the guest sends you a PDF or Word invoice, you upload it. Go to <strong>Submit Invoice</strong> from the Dashboard. You&apos;ll see two options: <strong>Upload a file</strong> or <strong>Generate from form</strong>. For upload:
          </p>
          <ol className="mt-3 list-inside list-decimal space-y-2">
            <li>Select <strong>Department</strong> and <strong>Programme</strong> from the dropdowns. These say which show or area the invoice belongs to.</li>
            <li>Fill in <strong>Service description</strong> if needed (e.g. &quot;Guest appearance on News Hour, 15 Jan 2025&quot;).</li>
            <li>Enter <strong>Transaction dates</strong> (from and to).</li>
            <li>Choose <strong>Currency</strong> (GBP, EUR, USD).</li>
            <li>Click <strong>Choose file</strong> and select the invoice file. Supported: PDF, DOCX, DOC, XLSX, XLS, JPEG.</li>
            <li>Click <strong>Submit</strong>. If it works, you&apos;ll be redirected to the invoice list.</li>
          </ol>
          <Tip>If you upload the wrong file, you can replace it later from the invoice detail page (when status is submitted or rejected).</Tip>
        </section>

        {/* 6. Generate invoice */}
        <section id="generate" className="scroll-mt-24">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">6. Generating an invoice from scratch</h2>
          <p className="mt-2">
            Sometimes the guest doesn&apos;t send an invoice. You create one yourself using the form. On the <strong>Submit Invoice</strong> page, use the <strong>Generate from form</strong> section. The system will create a PDF for you and submit it automatically.
          </p>
          <p className="mt-2">What to fill in:</p>
          <ul className="mt-1 list-inside list-disc space-y-1">
            <li><strong>INV NO</strong> — Invoice number (e.g. INV-2025-001).</li>
            <li><strong>Invoice date</strong> — Date of the invoice.</li>
            <li><strong>Guest name</strong> — Full name of the person.</li>
            <li><strong>Title</strong> — Their role (e.g. &quot;Political Analyst&quot;).</li>
            <li><strong>Producer</strong> — Who produced the programme.</li>
            <li><strong>Department & Programme</strong> — Where it belongs.</li>
            <li><strong>Appearances</strong> — Each appearance: programme name, topic, date, amount. Click &quot;Add appearance&quot; for more.</li>
            <li><strong>Expenses</strong> — Optional. Travel, accommodation, etc. Click &quot;Add expense&quot; if needed.</li>
            <li><strong>Bank details</strong> — Account name, account number, sort code. Required for payment.</li>
          </ul>
          <p className="mt-2">You can also attach supporting files (e.g. receipts). Click <strong>Generate and submit</strong> when done.</p>
          <Tip>At least one appearance with topic, date and amount is required. Empty rows are ignored.</Tip>
        </section>

        {/* 7. Templates */}
        <section id="templates" className="scroll-mt-24">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">7. Templates: save and reuse</h2>
          <p className="mt-2">
            If you often invoice the same guest (same bank details, address, etc.), save a template. Next time, load it and the form fills itself. You only change the dates and amounts.
          </p>
          <p className="mt-2"><strong>How to save a template:</strong></p>
          <ol className="mt-1 list-inside list-decimal space-y-1">
            <li>Fill in the form with the guest&apos;s details, bank info, department, programme.</li>
            <li>In the &quot;Saved templates&quot; box, type a name (e.g. &quot;John Smith - News&quot;) in the &quot;Template name&quot; field.</li>
            <li>Click <strong>Save as template</strong>.</li>
          </ol>
          <p className="mt-2"><strong>How to load a template:</strong></p>
          <ol className="mt-1 list-inside list-decimal space-y-1">
            <li>Open the &quot;Load template...&quot; dropdown.</li>
            <li>Select the template. The form fills with saved data.</li>
            <li>Update the appearances (dates, amounts) and any other fields that changed.</li>
            <li>Generate and submit as usual.</li>
          </ol>
          <p className="mt-2">You can also <strong>edit</strong> a template (click the pencil icon) or <strong>delete</strong> it (click the X). Templates are personal — only you see yours.</p>
          <Tip>Templates save guest name, address, phone, email, bank details, department and programme. Appearances are not saved — you add those fresh each time.</Tip>
        </section>

        {/* 8. Manager approval */}
        <section id="manager-approval" className="scroll-mt-24">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">8. Manager approval</h2>
          <p className="mt-2">
            If you are a manager, invoices assigned to you appear in the list. Open an invoice and you&apos;ll see <strong>Approve</strong> and <strong>Reject</strong> buttons. When you approve, the invoice moves to the next stage (admin/finance). When you reject, you must give a reason. The submitter sees that reason and can fix the invoice and resubmit.
          </p>
          <p className="mt-2">You cannot approve your own invoice. If you submitted it, someone else must approve it.</p>
          <p className="mt-2">
            <strong>Approval delegation:</strong> When a manager is absent (holiday, sick leave), admin can set up a backup approver in Setup → Approval Delegation. Choose the manager (delegator), the backup approver (delegate), and a date range. During that period, the delegate can approve or reject invoices assigned to the delegator. This applies to both guest and contractor invoices.
          </p>
          <Tip>Before approving, open the PDF and check the amounts and details. Once approved, it&apos;s harder to undo.</Tip>
        </section>

        {/* 9. Admin and finance */}
        <section id="admin-finance" className="scroll-mt-24">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">9. Admin and finance actions</h2>
          <p className="mt-2">
            <strong>Admin</strong> can do all status changes: approve, reject, mark ready for payment, mark paid, archive. <strong>Finance</strong> typically only sees invoices that are &quot;ready for payment&quot; or &quot;paid&quot;, and can mark them as paid.
          </p>
          <p className="mt-2">To mark as paid:</p>
          <ol className="mt-1 list-inside list-decimal space-y-1">
            <li>Open the invoice.</li>
            <li>Click <strong>Mark as paid</strong> (or similar).</li>
            <li>Enter the payment reference (e.g. bank transfer ID) and the paid date.</li>
            <li>Save.</li>
          </ol>
          <p className="mt-2">Admin can also replace files, add extra files, assign a different line manager, and add notes.</p>
          <Tip>Finance users cannot edit or delete invoices — they can only mark them paid. This keeps a clear audit trail.</Tip>
        </section>

        {/* 10. Contractor overview */}
        <section id="contractor-overview" className="scroll-mt-24">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">10. Contractor invoices — overview</h2>
          <p className="mt-2">
            Contractor (freelancer) invoices are for people who work on a day-rate or project basis. The flow is similar to guest invoices: submit → manager approves → admin/finance reviews → mark paid. There is also an <strong>Operations Room</strong> stage: some contractor invoices need approval from operations staff. If you are in the operations room, you&apos;ll see those invoices and can approve them.
          </p>
          <Tip>Contractor invoices often use contractor templates (in Setup). These pre-fill company name, rate, etc.</Tip>
        </section>

        {/* 11. Contractor submit */}
        <section id="contractor-submit" className="scroll-mt-24">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">11. Submitting a contractor invoice</h2>
          <p className="mt-2">
            Go to <strong>Contractor Invoices</strong> → <strong>Submit</strong>. Fill in: contractor name, company, service description, number of days, rate per day, service month, any additional costs. Upload the invoice file (PDF, etc.). Submit. The system may assign a manager based on department.
          </p>
          <Tip>If your department uses contractor templates, select one from the dropdown to pre-fill the form.</Tip>
        </section>

        {/* 12. Contractor approval */}
        <section id="contractor-approval" className="scroll-mt-24">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">12. Contractor approval workflow</h2>
          <p className="mt-2">
            Manager approves first. Then, if the invoice goes to the Operations Room, an operations user approves. Finally, admin or finance marks it paid. When a contractor invoice is approved, the system can automatically send a &quot;Booking Form&quot; email with a PDF to the approver and to operations. This is configured by admin.
          </p>
          <Tip>If the automatic Booking Form email fails, admin can trigger it manually from the invoice detail page.</Tip>
        </section>

        {/* 13. Salaries */}
        <section id="salaries" className="scroll-mt-24">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">13. Salaries</h2>
          <p className="mt-2">
            Only admin, operations and finance can access Salaries. Here you manage salary payments for employees. You can add new salary records, edit them, upload payslips, and mark them as paid. Finance can only mark paid — they cannot add, edit or delete.
          </p>
          <Tip>Salaries are separate from guest and contractor invoices. They have their own list and workflow.</Tip>
        </section>

        {/* 14. Setup */}
        <section id="setup" className="scroll-mt-24">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">14. Setup (admin only)</h2>
          <p className="mt-2">
            In Setup you manage <strong>Departments</strong> and <strong>Programmes</strong>. Departments are broad groups (e.g. News, Sport). Programmes belong to a department (e.g. News Hour, Sports Today). When submitting an invoice, users pick from these. Admin can also configure contractor templates, email settings, department managers, and <strong>Approval Delegation</strong> (backup approvers when a manager is absent).
          </p>
          <Tip>If you add a new programme, it appears in the dropdown the next time someone submits an invoice.</Tip>
        </section>

        {/* 15. Reports */}
        <section id="reports" className="scroll-mt-24">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">15. Reports</h2>
          <p className="mt-2">
            Reports show spending by month, quarter, or department. You can filter by guest or contractor invoices. Use this to see how much was paid in a period or which department spent the most. Export to Excel for further analysis.
          </p>
          <Tip>Choose the report type (monthly, quarterly, department, custom) and the date range. The system generates the report and lets you download it.</Tip>
        </section>

        {/* 16. User management */}
        <section id="users" className="scroll-mt-24">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">16. User management (admin only)</h2>
          <p className="mt-2">
            Admin can invite new users by email, set their role, department and programmes, and choose which pages they can access (allowed_pages). You can also deactivate a user so they can no longer log in.
          </p>
          <Tip>When inviting, use the person&apos;s real email. They receive a link to set their password and join.</Tip>
        </section>

        {/* 17. Invoice detail */}
        <section id="invoice-detail" className="scroll-mt-24">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">17. Invoice detail page</h2>
          <p className="mt-2">
            Click any invoice in the list to open its detail page. You see the PDF (or files), the status, who submitted it, who approved it, and a timeline of events. You can download files, replace a file, add a file, add notes, or change the status (if you have permission).
          </p>
          <Tip>The timeline shows every status change and who did it. Useful for auditing.</Tip>
        </section>

        {/* 18. Common operations */}
        <section id="common" className="scroll-mt-24">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">18. Common operations</h2>
          <p className="mt-2">
            <strong>Replace file:</strong> Used when you uploaded the wrong PDF. Open the invoice, click Replace file, choose the correct file. Only works when the invoice is still in early stages (submitted, rejected).<br />
            <strong>Add file:</strong> Attach an extra document (e.g. a receipt) without removing the main invoice.<br />
            <strong>Bulk download:</strong> Admin can select multiple invoices and download all their files as a zip.<br />
            <strong>Excel import:</strong> Admin can import invoices from an Excel file. Check the import screen for the required format.
          </p>
          <Tip>If you get an error when uploading, check the file type. Supported: PDF, DOCX, DOC, XLSX, XLS, JPEG.</Tip>
        </section>

        {/* 19. FAQ */}
        <section id="faq" className="scroll-mt-24">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">19. Frequently asked questions</h2>
          <dl className="mt-3 space-y-4">
            <div>
              <dt className="font-semibold text-gray-900 dark:text-white">I don&apos;t see the Submit button. Why?</dt>
              <dd className="mt-1">Your role or allowed_pages may not include submit_invoice. Ask your admin.</dd>
            </div>
            <div>
              <dt className="font-semibold text-gray-900 dark:text-white">I approved by mistake. Can I undo?</dt>
              <dd className="mt-1">Only admin can change statuses. Contact an admin to revert.</dd>
            </div>
            <div>
              <dt className="font-semibold text-gray-900 dark:text-white">The upload failed. What do I do?</dt>
              <dd className="mt-1">Check your file size (very large files may fail) and format. Try a different browser. If it still fails, contact support.</dd>
            </div>
            <div>
              <dt className="font-semibold text-gray-900 dark:text-white">Where did my template go?</dt>
              <dd className="mt-1">Templates are stored per user. If you don&apos;t see yours, make sure you&apos;re logged in as the same user who saved it.</dd>
            </div>
            <div>
              <dt className="font-semibold text-gray-900 dark:text-white">I can&apos;t approve my own invoice. Is that normal?</dt>
              <dd className="mt-1">Yes. The system blocks self-approval. Someone else must approve your invoice.</dd>
            </div>
          </dl>
        </section>

        {/* 20. Glossary */}
        <section id="glossary" className="scroll-mt-24">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">20. Glossary</h2>
          <dl className="mt-3 space-y-2 text-sm">
            <dt className="font-semibold text-gray-900 dark:text-white">Submitter</dt>
            <dd>Person who uploads or creates the invoice.</dd>
            <dt className="font-semibold text-gray-900 dark:text-white">Manager / Line manager</dt>
            <dd>Person who approves or rejects the invoice at the first stage.</dd>
            <dt className="font-semibold text-gray-900 dark:text-white">Department</dt>
            <dd>Organisational unit (e.g. News, Sport).</dd>
            <dt className="font-semibold text-gray-900 dark:text-white">Programme</dt>
            <dd>Show or project within a department.</dd>
            <dt className="font-semibold text-gray-900 dark:text-white">Workflow</dt>
            <dd>The path an invoice follows: submitted → approved → paid.</dd>
            <dt className="font-semibold text-gray-900 dark:text-white">Status</dt>
            <dd>Current stage of the invoice (e.g. pending_manager, paid).</dd>
            <dt className="font-semibold text-gray-900 dark:text-white">Template</dt>
            <dd>Saved form data (guest details, bank info) you can load to save time.</dd>
            <dt className="font-semibold text-gray-900 dark:text-white">Operations Room</dt>
            <dd>Extra approval stage for some contractor invoices. Operations staff approve here.</dd>
          </dl>
        </section>
      </div>

      <div className="mt-12 border-t border-gray-200 pt-6 dark:border-gray-700">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 text-sky-600 hover:text-sky-700 dark:text-sky-400 dark:hover:text-sky-300"
        >
          ← Back to Dashboard
        </Link>
        <p className="mt-6 text-right text-sm text-gray-400 dark:text-gray-500">Hasan Esen</p>
      </div>
    </div>
  );
}
