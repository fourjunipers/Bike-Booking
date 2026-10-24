import { PageLoading } from "@/components/page-loading";

// Vendor pages read the session and locale cookie, so each needs its own
// Suspense boundary.
export default PageLoading;
