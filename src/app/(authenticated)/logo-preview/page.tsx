"use client";

/**
 * Logo preview page – compare TRT logos used across the site.
 * Access at /logo-preview when logged in.
 */
export default function LogoPreviewPage() {
  const logos = [
    { src: "/trt-logo.png", label: "TRT Logo (Nav, Dashboard, Upload overlay)" },
    { src: "/trt-world-logo.png", label: "TRT World Logo (Booking Form PDFs)" },
    { src: "/logo.png", label: "Logo (Emails)" },
  ];

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Logo Preview</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Compare logos used across the site. TRT World logo appears in Booking Form PDFs.
        </p>
      </div>

      <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
        {logos.map(({ src, label }) => (
          <div
            key={src}
            className="flex flex-col items-center gap-4 rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-900/60"
          >
            <div className="flex h-32 w-full items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-800">
              <img
                src={src}
                alt={label}
                className="max-h-24 max-w-full object-contain"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='40'%3E%3Ctext x='10' y='25' fill='%23999' font-size='12'%3ENot found%3C/text%3E%3C/svg%3E";
                }}
              />
            </div>
            <p className="text-center text-xs font-medium text-gray-600 dark:text-gray-400">{label}</p>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4 dark:border-amber-800/50 dark:bg-amber-900/20">
        <p className="text-sm text-amber-800 dark:text-amber-200">
          <strong>TRT World logo</strong> is used when you view or download a Booking Form PDF from Freelancer Invoices.
        </p>
      </div>
    </div>
  );
}
