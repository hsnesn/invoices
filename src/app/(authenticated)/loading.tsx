import { LoadingLogo } from "@/components/LoadingLogo";

export default function AuthenticatedLoading() {
  return (
    <div className="flex flex-1 items-center justify-center p-6 min-h-[200px]">
      <LoadingLogo fullScreen={false} />
    </div>
  );
}
