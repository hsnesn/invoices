"use client";

/**
 * Reusable bank details section with UK vs International transfer options.
 * Shows PayPal encouragement when international is selected.
 */
export type BankType = "uk" | "international";

export type BankDetailsValues = {
  bankType: BankType;
  accountName: string;
  bankName: string;
  accountNumber: string;
  sortCode: string;
  bankAddress: string;
  iban: string;
  swiftBic: string;
  paypal: string;
};

export const BANK_DETAILS_DEFAULT: BankDetailsValues = {
  bankType: "uk",
  accountName: "",
  bankName: "",
  accountNumber: "",
  sortCode: "",
  bankAddress: "",
  iban: "",
  swiftBic: "",
  paypal: "",
};

export const PAYPAL_INTERNATIONAL_MESSAGE =
  "For international transfers, PayPal is often faster and avoids bank commission risks. We recommend adding your PayPal email if you have one.";

type BankDetailsFieldsProps = {
  values: BankDetailsValues;
  onChange: (v: BankDetailsValues) => void;
  inputCls?: string;
  showPaypalEncouragement?: boolean;
  paypalOptional?: boolean;
};

export function BankDetailsFields({
  values,
  onChange,
  inputCls = "mt-1 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white",
  showPaypalEncouragement = true,
  paypalOptional = true,
}: BankDetailsFieldsProps) {
  const set = (partial: Partial<BankDetailsValues>) => onChange({ ...values, ...partial });

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Bank account type</label>
        <div className="mt-2 flex gap-4">
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="radio"
              name="bankType"
              checked={values.bankType === "uk"}
              onChange={() => set({ bankType: "uk", iban: "", swiftBic: "" })}
              className="h-4 w-4 text-emerald-600"
            />
            <span className="text-sm">UK bank account</span>
          </label>
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="radio"
              name="bankType"
              checked={values.bankType === "international"}
              onChange={() => set({ bankType: "international", accountNumber: "", sortCode: "" })}
              className="h-4 w-4 text-emerald-600"
            />
            <span className="text-sm">International bank transfer</span>
          </label>
        </div>
      </div>

      {values.bankType === "international" && showPaypalEncouragement && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-200">
          <p className="font-medium">{PAYPAL_INTERNATIONAL_MESSAGE}</p>
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          PayPal {paypalOptional ? "(optional)" : ""}
        </label>
        <input
          type="text"
          value={values.paypal}
          onChange={(e) => set({ paypal: e.target.value })}
          placeholder="email@example.com"
          className={inputCls}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Account name *</label>
        <input
          type="text"
          value={values.accountName}
          onChange={(e) => set({ accountName: e.target.value })}
          required
          className={inputCls}
        />
      </div>

      {values.bankType === "uk" ? (
        <>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Account number *</label>
            <input
              type="text"
              value={values.accountNumber}
              onChange={(e) => set({ accountNumber: e.target.value })}
              required
              className={inputCls}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Sort code *</label>
            <input
              type="text"
              value={values.sortCode}
              onChange={(e) => set({ sortCode: e.target.value })}
              placeholder="e.g. 12-34-56"
              required
              className={inputCls}
            />
          </div>
        </>
      ) : (
        <>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">IBAN *</label>
            <input
              type="text"
              value={values.iban}
              onChange={(e) => set({ iban: e.target.value.toUpperCase() })}
              placeholder="e.g. GB82WEST12345698765432"
              required
              className={inputCls}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">SWIFT / BIC *</label>
            <input
              type="text"
              value={values.swiftBic}
              onChange={(e) => set({ swiftBic: e.target.value.toUpperCase() })}
              placeholder="e.g. DEUTGB2L"
              required
              className={inputCls}
            />
          </div>
        </>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Bank name</label>
        <input
          type="text"
          value={values.bankName}
          onChange={(e) => set({ bankName: e.target.value })}
          className={inputCls}
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Bank address</label>
        <input
          type="text"
          value={values.bankAddress}
          onChange={(e) => set({ bankAddress: e.target.value })}
          placeholder="Street, city, country"
          className={inputCls}
        />
      </div>
    </div>
  );
}

/** UK sort code: 6 digits, optionally with hyphens (e.g. 12-34-56) */
export function isValidSortCode(s: string): boolean {
  const digits = s.replace(/-/g, "");
  return /^\d{6}$/.test(digits);
}

/** IBAN: 2 letters country, 2 digits check, 4–30 alphanumeric */
export function isValidIban(s: string): boolean {
  const cleaned = s.replace(/\s/g, "").toUpperCase();
  return /^[A-Z]{2}[0-9]{2}[A-Z0-9]{4,30}$/.test(cleaned);
}

/** SWIFT/BIC: 8 or 11 alphanumeric chars */
export function isValidSwiftBic(s: string): boolean {
  const cleaned = s.replace(/\s/g, "").toUpperCase();
  return /^[A-Z0-9]{8}([A-Z0-9]{3})?$/.test(cleaned);
}

export function validateBankDetails(values: BankDetailsValues): string | null {
  if (!values.accountName?.trim()) return "Account name is required";
  if (values.bankType === "uk") {
    if (!values.accountNumber?.trim()) return "Account number is required";
    if (!values.sortCode?.trim()) return "Sort code is required";
    if (!isValidSortCode(values.sortCode)) return "Sort code must be 6 digits (e.g. 12-34-56)";
  } else {
    if (!values.iban?.trim()) return "IBAN is required";
    if (!values.swiftBic?.trim()) return "SWIFT/BIC is required";
    if (!isValidIban(values.iban)) return "IBAN format is invalid (e.g. GB82WEST12345698765432)";
    if (!isValidSwiftBic(values.swiftBic)) return "SWIFT/BIC must be 8 or 11 characters";
  }
  return null;
}
