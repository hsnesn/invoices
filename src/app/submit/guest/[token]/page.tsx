import { getGuestSubmitTokenData } from "@/lib/guest-submit-token-data";
import { GuestSubmitErrorClient } from "./GuestSubmitErrorClient";
import { GuestSubmitFormClient } from "./GuestSubmitFormClient";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ token: string }> };

export default async function GuestInvoiceSubmitPage({ params }: PageProps) {
  const { token } = await params;
  const result = await getGuestSubmitTokenData(token);

  if (!result.ok) {
    return (
      <GuestSubmitErrorClient
        token={token}
        error={result.error}
        expiresAt={"expiresAt" in result ? result.expiresAt : undefined}
        errorType={"errorType" in result ? result.errorType : undefined}
      />
    );
  }

  const guestData = {
    guest_name: result.data.guest_name,
    title: result.data.title,
    program_name: result.data.program_name,
    recording_date: result.data.recording_date,
    recording_topic: result.data.recording_topic,
    payment_amount: result.data.payment_amount,
    payment_currency: result.data.payment_currency,
  };

  return <GuestSubmitFormClient token={token} initialData={guestData} />;
}
