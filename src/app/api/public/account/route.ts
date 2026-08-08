import { requireDonorAccess } from "@/server/auth/access-links";
import { getDonorAccount } from "@/server/domains/donors/account-access-service";
import { errorResponse, successResponse } from "@/server/http/responses";

export async function GET(request: Request) {
  try {
    const { donorId } = await requireDonorAccess(request);
    const account = await getDonorAccount(donorId);
    return successResponse(account);
  } catch (error) {
    return errorResponse(error);
  }
}
