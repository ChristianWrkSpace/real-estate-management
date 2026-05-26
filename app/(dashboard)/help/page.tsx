export const metadata = {
  title: "How to use · PropMan OS",
};

export default function HelpPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-8 pb-32 sm:px-6">
      <header className="mb-8">
        <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-zinc-500">
          Operator guide
        </p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
          How to use PropMan
        </h1>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          A practical walkthrough you can hand to anyone managing the building.
          Read top to bottom the first time — after that, jump to whichever
          section you need.
        </p>
      </header>

      <Section
        n="1"
        title="The big picture"
        body={
          <>
            <P>
              PropMan tracks <Strong>one building, four units</Strong>. Everything
              flows from three nouns: <Strong>Units</Strong> (the physical doors),{" "}
              <Strong>Tenants</Strong> (people), and <Strong>Leases</Strong> (the
              link between a tenant and a unit, with rent + dates).
            </P>
            <P>
              The bottom dock has four direct tabs (Home, Units, Tenants, P&amp;L)
              and a <Strong>More</Strong> button that opens everything else: Rent,
              Work Orders, Contractors, Contracts, Equity, Approvals, Help.
            </P>
          </>
        }
      />

      <Section
        n="2"
        title="Add a tenant (prospect or active)"
        body={
          <>
            <Ol>
              <li>
                Go to <Code>Tenants</Code> → click <Strong>+ Add Tenant</Strong>.
              </li>
              <li>
                Fill name + email <em>or</em> phone (one of the two is required —
                it&apos;s how you contact them).
              </li>
              <li>
                <Strong>If you have a unit ready:</Strong> pick a unit, enter rent
                + start date, leave &quot;Mint onboarding link&quot; checked, save.
                You get a copyable URL — text it to them in iMessage.
              </li>
              <li>
                <Strong>If they&apos;re just an applicant:</Strong> leave the unit
                blank. They&apos;ll be saved as a <Strong>prospect</Strong> —
                useful for sending them a Rental Application to fill out before
                you commit to a lease.
              </li>
            </Ol>
          </>
        }
      />

      <Section
        n="3"
        title="Convert a prospect into an active tenant"
        body={
          <>
            <P>
              This is the most common transition. Once a prospect has been
              approved and you&apos;re ready to put them in a unit:
            </P>
            <Ol>
              <li>
                <Code>Tenants</Code> → click their row to open the drawer.
              </li>
              <li>
                Scroll to <Strong>&quot;Convert to Active Tenant&quot;</Strong>.
              </li>
              <li>
                Pick the unit, set monthly rent + security deposit, pick a start
                date, choose Fixed or Month-to-month.
              </li>
              <li>
                Keep <Strong>&quot;Mint a one-time onboarding link&quot;</Strong>{" "}
                checked.
              </li>
              <li>
                Click <Strong>Activate Lease for [name]</Strong>. The unit flips
                to occupied, the tenant&apos;s status becomes active, and you get
                a copyable onboarding URL.
              </li>
            </Ol>
            <Callout>
              If the unit is already occupied, this reassigns it. The old tenant
              loses their active lease on that unit; you&apos;ll see it on the
              units page.
            </Callout>
          </>
        }
      />

      <Section
        n="4"
        title="End a lease / free up a unit"
        body={
          <>
            <P>
              Move-outs, evictions, mutual termination — same flow. Open the
              tenant&apos;s drawer and scroll to <Strong>End lease /
              move-out</Strong>:
            </P>
            <Ol>
              <li>
                Click <Strong>End [name]&apos;s lease</Strong> to expand the form.
              </li>
              <li>
                Pick the move-out date (defaults to today) and optionally enter a
                reason for the audit log.
              </li>
              <li>
                Type the confirmation phrase (e.g. <Code>END CHRISTIAN</Code>)
                and click the red end-lease button.
              </li>
              <li>
                The lease becomes <Strong>terminated</Strong>, the unit flips to{" "}
                <Strong>vacant</Strong> (ready for the next tenant), and the
                tenant&apos;s status moves to <Strong>former</Strong>. Their
                record stays — historical leases, signed documents, payment
                history, all preserved.
              </li>
            </Ol>
            <Callout>
              To put a new tenant in that unit, go to <Code>Tenants → + Add
              Tenant</Code> (or convert an existing prospect) and select the
              now-vacant unit.
            </Callout>
          </>
        }
      />

      <Section
        n="5"
        title="Send a lease for e-signature"
        body={
          <>
            <P>
              PropMan has two signing flows. Pick the one that matches what
              you&apos;re sending:
            </P>
            <Ol>
              <li>
                <Strong>Onboarding link</Strong> (full move-in packet — created
                with the lease in step 3). Sends the tenant to a page where they
                review every lease term, then e-sign. Use this for new tenants.
              </li>
              <li>
                <Strong>Contract Library — Send for Signature</Strong> (any single
                template, e.g. a renewal addendum or a walk-through script). In
                the tenant drawer, scroll to <Code>Contract Library</Code>, pick
                a template, click <Strong>Send for Signature</Strong>. Copy the{" "}
                <Code>/sign/&lt;token&gt;</Code> link and text it to them.
              </li>
            </Ol>
            <P>
              Signed documents land in the tenant&apos;s &quot;Saved to profile&quot;
              list with the signer&apos;s name, IP, and timestamp recorded for
              audit (Texas UETA / federal E-SIGN compliant).
            </P>
          </>
        }
      />

      <Section
        n="6"
        title="Collect rent"
        body={
          <>
            <Ol>
              <li>
                Go to <Code>More → Rent</Code>. You see one row per tenant with
                this month&apos;s status: paid, due, or past-due.
              </li>
              <li>
                Click <Strong>Send payment link</Strong> to generate a Stripe
                checkout URL for that tenant.
              </li>
              <li>
                When they pay, the Stripe webhook auto-marks the row paid — no
                manual data entry.
              </li>
              <li>
                Past-due tenants show a red badge. From the tenant drawer, the{" "}
                <Strong>Enforcement</Strong> menu lets you issue a Texas
                3-day-to-pay-or-quit notice as a downloadable PDF.
              </li>
            </Ol>
          </>
        }
      />

      <Section
        n="7"
        title="Work orders"
        body={
          <>
            <Ol>
              <li>
                <Code>More → Work Orders</Code> shows a kanban: <em>Open →
                Assigned → In Progress → Done</em>.
              </li>
              <li>
                Click <Strong>+ New</Strong> to log a maintenance issue (which
                unit, category, priority, estimated cost).
              </li>
              <li>
                Drag the card across columns as the job progresses, or click into
                it to assign a contractor and record final cost. Cost lands in
                the P&amp;L automatically.
              </li>
            </Ol>
          </>
        }
      />

      <Section
        n="8"
        title="Contracts & template library"
        body={
          <>
            <P>
              <Code>More → Contracts</Code> is your reusable document library.
              Each template (lease, walk-through, rental application, etc.) has
              bracketed placeholders like <Code>[APPLICANT FULL NAME]</Code>.
            </P>
            <Ol>
              <li>
                Open any tenant&apos;s drawer to see the Contract Library — pick
                a template and click <Strong>Generate</Strong> to download a
                filled .docx, or <Strong>Send for Signature</Strong> to mint a
                signing link.
              </li>
              <li>
                To replace a template, go to the Contracts page, click the
                template, and upload a new file. Bracket placeholders are
                auto-detected.
              </li>
            </Ol>
          </>
        }
      />

      <Section
        n="9"
        title="See the money — P&L, Equity, Dashboard"
        body={
          <>
            <Ul>
              <li>
                <Code>Home / Dashboard</Code> — top-line numbers (occupancy %,
                rent collected this month, open work orders, equity).
              </li>
              <li>
                <Code>P&amp;L</Code> — every income and expense line for the
                property by month. The same data as the dashboard, broken down.
              </li>
              <li>
                <Code>More → Equity</Code> — property value vs. mortgage balance
                vs. LTV. Update value or mortgage balance to recompute equity.
              </li>
            </Ul>
          </>
        }
      />

      <Section
        n="10"
        title="Approvals queue (high-stakes actions)"
        body={
          <>
            <P>
              Some actions (large contractor payments, late-fee waivers,
              eviction notices) are routed to <Code>More → Approvals</Code>{" "}
              instead of executing immediately. Owner reviews and clicks{" "}
              <Strong>Approve</Strong> or <Strong>Reject</Strong>. Every decision
              is logged.
            </P>
          </>
        }
      />

      <Section
        n="11"
        title="Roles — who sees what"
        body={
          <>
            <Ul>
              <li>
                <Strong>Owner</Strong> — full access, including finance, equity,
                approvals.
              </li>
              <li>
                <Strong>Manager</Strong> — everything except approvals and
                equity edits.
              </li>
              <li>
                <Strong>Maintenance</Strong> — only Work Orders.
              </li>
            </Ul>
            <P>
              The first email/password that signs up becomes the owner.
              Additional users are created from <Code>Settings</Code> (coming
              soon — for now use the Supabase auth dashboard).
            </P>
          </>
        }
      />

      <Section
        n="12"
        title="Common gotchas"
        body={
          <>
            <Ul>
              <li>
                <Strong>Unit shows occupied but no tenant?</Strong> The previous
                lease was probably ended without flipping the unit. Open the unit
                from <Code>Units</Code> and toggle status to vacant.
              </li>
              <li>
                <Strong>Onboarding link doesn&apos;t work?</Strong> Links are
                one-time-use. If the tenant accepted then opened it again it
                shows &quot;invalid.&quot; Regenerate from the tenant drawer.
              </li>
              <li>
                <Strong>Signed document didn&apos;t save?</Strong> The signing
                page only saves on the final &quot;Sign &amp; Submit&quot; — if
                the tenant closed it mid-form, nothing was lost; they can use
                the link again until it expires (30 days).
              </li>
              <li>
                <Strong>AI agents fail?</Strong> Check the <Code>Approvals</Code>{" "}
                page for the audit log — it will show why (low credits, model
                timeout, etc.). The system fails closed by default.
              </li>
            </Ul>
          </>
        }
      />

      <footer className="mt-12 rounded-2xl border border-zinc-200 bg-zinc-50 p-5 text-center dark:border-zinc-800 dark:bg-zinc-900/40">
        <p className="text-xs text-zinc-700 dark:text-zinc-400">
          Need something this guide doesn&apos;t cover? Every action also lives in
          the audit log, so even if a button isn&apos;t obvious, the data is
          recoverable. Open the relevant page and click into any row — most
          objects have an edit drawer with everything you need.
        </p>
      </footer>
    </div>
  );
}

function Section({
  n,
  title,
  body,
}: {
  n: string;
  title: string;
  body: React.ReactNode;
}) {
  return (
    <section className="mb-8 scroll-mt-24" id={`s-${n}`}>
      <div className="mb-3 flex items-baseline gap-3">
        <span className="font-mono text-xs font-bold text-emerald-700 dark:text-emerald-400">
          {n.padStart(2, "0")}
        </span>
        <h2 className="text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
          {title}
        </h2>
      </div>
      <div className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900/40">
        {body}
      </div>
    </section>
  );
}

function P({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-3 text-sm leading-relaxed text-zinc-700 last:mb-0 dark:text-zinc-300">
      {children}
    </p>
  );
}

function Ol({ children }: { children: React.ReactNode }) {
  return (
    <ol className="mb-3 list-decimal space-y-2 pl-5 text-sm leading-relaxed text-zinc-700 last:mb-0 dark:text-zinc-300 marker:text-emerald-600 dark:marker:text-emerald-400">
      {children}
    </ol>
  );
}

function Ul({ children }: { children: React.ReactNode }) {
  return (
    <ul className="mb-3 list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-zinc-700 last:mb-0 dark:text-zinc-300 marker:text-zinc-400">
      {children}
    </ul>
  );
}

function Strong({ children }: { children: React.ReactNode }) {
  return (
    <strong className="font-semibold text-zinc-900 dark:text-zinc-100">
      {children}
    </strong>
  );
}

function Code({ children }: { children: React.ReactNode }) {
  return (
    <code className="rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-[11px] text-zinc-800 dark:bg-zinc-800/80 dark:text-zinc-200">
      {children}
    </code>
  );
}

function Callout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-3 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2.5 text-xs text-amber-800 dark:border-amber-500/30 dark:text-amber-200">
      <strong className="mr-1">Note:</strong>
      {children}
    </div>
  );
}
