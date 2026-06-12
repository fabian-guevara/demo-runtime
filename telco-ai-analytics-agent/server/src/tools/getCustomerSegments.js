import { getCustomerSegments } from "../services/analyticsService.js";

export default async function getCustomerSegmentsTool() {
  return getCustomerSegments();
}
